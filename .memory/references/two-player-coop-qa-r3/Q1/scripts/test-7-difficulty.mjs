import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 7: Coop Difficulty Tuning (D41)...');
  const results = {};

  // Part 1: Solo Wave 1 baseline (monster HP)
  log('--- Part 1: Solo Wave 1 Monster HP baseline ---');
  const envSolo = await createTestEnv();
  const pageSolo = envSolo.page;

  // 1P: Mouse pairing solo
  const soloSlot1 = pageSolo.locator('[data-testid="slot-card-1"]');
  await soloSlot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(400);

  const soloNick = pageSolo.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await soloNick.isVisible()) {
    await soloNick.fill('난이도솔로');
    const confirmBtn = pageSolo.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(400);

  await pageSolo.locator('button:has-text("게임 시작")').click();
  await sleep(1000);

  let snapSolo = null;
  for (let i = 0; i < 30; i++) {
    snapSolo = await envSolo.getSnapshot();
    if (snapSolo?.selection?.kind === 'weapon') break;
    await sleep(200);
  }

  // Select shotgun
  const sTargets = snapSolo.targets.filter((t) => t.selectKind === 'weapon');
  const sCard = sTargets[0];
  await pageSolo.mouse.click(((sCard.aimX + 1) / 2) * 1440, ((1 - sCard.aimY) / 2) * 900);
  await sleep(1500);

  // Wait for wave 1 monsters to spawn
  let soloMonsterHps = {};
  for (let i = 0; i < 20; i++) {
    snapSolo = await envSolo.getSnapshot();
    const monsters = snapSolo.targets.filter((t) => !t.selectKind && !t.isItem);
    if (monsters.length > 0) {
      monsters.forEach((m) => {
        soloMonsterHps[m.kind] = m.maxHp;
      });
      if (Object.keys(soloMonsterHps).length >= 1) break;
    }
    await sleep(500);
  }
  log('Solo Monster maxHp baseline:', soloMonsterHps);
  await envSolo.cleanup();

  // Part 2: Coop 2-Player (1P mouse + 2P phone)
  log('--- Part 2: Coop 2-Player Wave 1 and Wave 3 Boss Verification ---');
  const envCoop = await createTestEnv();
  const { page, shot, fakePhone, getSnapshot, cleanup } = envCoop;

  // 1P: Mouse
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  await slot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(400);
  const nickInput = page.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await nickInput.isVisible()) {
    await nickInput.fill('난이도마우스');
    const confirmBtn = page.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(400);

  // 2P: Phone
  const phone = fakePhone(2, '난이도폰', 'phone_diff_r3');
  await phone.join(2);
  await sleep(400);
  await phone.zero(2);
  await sleep(500);

  // Start coop game
  await page.locator('button:has-text("게임 시작")').click();
  await sleep(1000);

  // Weapon select
  let snap = null;
  for (let i = 0; i < 30; i++) {
    snap = await getSnapshot();
    if (snap?.selection?.kind === 'weapon') break;
    await sleep(200);
  }

  const wTargets = snap.targets.filter((t) => t.selectKind === 'weapon');
  const p1Card = wTargets.find((t) => t.ownerIndex === 0);
  const p2Card = wTargets.find((t) => t.ownerIndex === 1);

  await page.mouse.click(((p1Card.aimX + 1) / 2) * 1440, ((1 - p1Card.aimY) / 2) * 900);
  await sleep(400);

  for (let i = 0; i < 5; i++) {
    await phone.aimHold(p2Card.aimX, p2Card.aimY, 300);
    await phone.snap(p2Card.aimX, p2Card.aimY);
    await sleep(300);
    snap = await getSnapshot();
    if (snap.phase === 'PLAYING' && (!snap.selection || snap.selection.done?.every(Boolean))) break;
  }
  log('Coop Game started, Phase:', snap.phase);
  await sleep(1500);

  // Check 1: WAVE 진행도 분모 (Wave 1 spawns = 40)
  const hudProgressText = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const progLabel = spans.find((s) => s.textContent && s.textContent.trim() === 'WAVE 진행도');
    if (progLabel && progLabel.parentElement) {
      return progLabel.parentElement.textContent.replace(/\s+/g, ' ').trim();
    }
    return null;
  });
  log('Wave 1 HUD Progress text:', hudProgressText);

  // Wait for first coop monsters to spawn and check their maxHp
  let coopMonsterHps = {};
  for (let i = 0; i < 20; i++) {
    snap = await getSnapshot();
    const monsters = snap.targets.filter((t) => !t.selectKind && !t.isItem);
    if (monsters.length > 0) {
      monsters.forEach((m) => {
        coopMonsterHps[m.kind] = m.maxHp;
      });
      if (Object.keys(coopMonsterHps).length >= 1) break;
    }
    await sleep(500);
  }
  log('Coop Monster maxHp in Wave 1:', coopMonsterHps);
  await shot('Q1-07-coop-wave1-spawns40-monsterhp');

  results.wave1 = {
    hudProgressText,
    denominatorIs40: hudProgressText?.includes('/ 40') || hudProgressText?.includes('40'),
    soloMonsterHps,
    coopMonsterHps,
    monsterHpEqualsSolo: Object.keys(coopMonsterHps).every((k) => !soloMonsterHps[k] || soloMonsterHps[k] === coopMonsterHps[k]),
  };

  // Bot play through Wave 1 & Wave 2 to reach Wave 3 Boss
  log('Auto-playing Wave 1 & 2 to reach Wave 3 Boss...');
  const autoPlayStart = Date.now();
  let bossReached = false;
  let coolerBoss = null;
  let firstSummonCount = 0;

  while (Date.now() - autoPlayStart < 180000) {
    snap = await getSnapshot();
    if (snap.phase === 'GAMEOVER') {
      log('Game over during progression, breaking');
      break;
    }

    // Handle reward card select if pending
    if (snap.selection && snap.selection.kind === 'card') {
      log('Reward card selection encountered, selecting...');
      const cardTargets = snap.targets.filter((t) => t.selectKind === 'card');
      const p1c = cardTargets.find((t) => t.ownerIndex === 0);
      const p2c = cardTargets.find((t) => t.ownerIndex === 1);
      if (p1c && !snap.selection.done[0]) {
        await page.mouse.click(((p1c.aimX + 1) / 2) * 1440, ((1 - p1c.aimY) / 2) * 900);
      }
      if (p2c && !snap.selection.done[1]) {
        await phone.aimHold(p2c.aimX, p2c.aimY, 200);
        await phone.snap(p2c.aimX, p2c.aimY);
      }
      await sleep(500);
      continue;
    }

    // Check if Wave 3 reached and boss spawned
    if (snap.wave >= 3) {
      coolerBoss = snap.targets.find((t) => t.kind === 'cooler' || (t.maxHp === 200 && !t.selectKind));
      if (coolerBoss) {
        log('Wave 3 Boss Cooler found!', { id: coolerBoss.id, kind: coolerBoss.kind, hp: coolerBoss.hp, maxHp: coolerBoss.maxHp });
        bossReached = true;
        break;
      }
    }

    // Aim and shoot at active targets
    const activeEnemies = snap.targets.filter((t) => !t.selectKind && !t.isItem && t.hp > 0);
    if (activeEnemies.length > 0) {
      // Pick nearest / lowest z enemy
      const enemy = activeEnemies.sort((a, b) => b.aimY - a.aimY)[0];
      const clickX = ((enemy.aimX + 1) / 2) * 1440;
      const clickY = ((1 - enemy.aimY) / 2) * 900;
      await page.mouse.click(clickX, clickY);
      await phone.snap(enemy.aimX, enemy.aimY);
    } else {
      await phone.aimHold(0, 0, 100);
    }
    await sleep(80);
  }

  if (coolerBoss) {
    await shot('Q1-07-coop-wave3-boss-cooler-hp200');

    // Shoot boss until first summon (threshold: 80% = 160 HP)
    log(`Shooting boss (initial HP: ${coolerBoss.hp}/${coolerBoss.maxHp}) to trigger first minion summon...`);

    for (let i = 0; i < 150; i++) {
      snap = await getSnapshot();
      const currentBoss = snap.targets.find((t) => t.id === coolerBoss.id);
      if (i % 10 === 0) log(`[Boss attack step ${i}] Boss HP: ${currentBoss?.hp}/${currentBoss?.maxHp}`);
      if (!currentBoss || currentBoss.hp <= 160) {
        log('Boss HP reduced to threshold (<= 160):', currentBoss?.hp);
        await sleep(1000);
        break;
      }
      const clickX = ((currentBoss.aimX + 1) / 2) * 1440;
      const clickY = ((1 - currentBoss.aimY) / 2) * 900;
      await page.mouse.click(clickX, clickY);
      await phone.snap(currentBoss.aimX, currentBoss.aimY);
      await sleep(100);
    }

    await sleep(800);
    snap = await getSnapshot();
    const bossMinions = snap.targets.filter((t) => t.id.startsWith('boss_minion'));
    firstSummonCount = bossMinions.length;
    log(`Boss first summon count: ${firstSummonCount}, minions:`, bossMinions.map((m) => m.id));
    await shot('Q1-07-coop-wave3-boss-first-summon-8');
  }

  results.boss = {
    bossReached,
    coolerBossMaxHp: coolerBoss?.maxHp ?? null,
    bossMaxHpIs200: coolerBoss?.maxHp === 200,
    firstSummonCount,
    firstSummonCountIs8: firstSummonCount === 8,
  };

  results.pass = results.wave1.denominatorIs40 && results.wave1.monsterHpEqualsSolo && results.boss.bossMaxHpIs200 && results.boss.firstSummonCountIs8;

  phone.close();
  await cleanup();

  fs.writeFileSync(path.join(OUT_DIR, 'test-7-result.json'), JSON.stringify(results, null, 2));
  log('Test 7 finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 7 error:', e);
  process.exit(1);
});
