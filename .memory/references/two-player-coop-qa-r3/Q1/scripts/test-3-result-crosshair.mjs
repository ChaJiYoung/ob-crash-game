import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 3: Result Crosshair & Shoot to Restart...');
  const results = {};

  // Part 1: Solo Phone Game -> Result Screen
  log('--- Part 1: Solo Phone Game Result Screen ---');
  const envSolo = await createTestEnv();
  const { page: pageSolo, roomId: roomIdSolo, shot: shotSolo, fakePhone: fakePhoneSolo, getSnapshot: getSnapSolo, cleanup: cleanupSolo } = envSolo;

  // 1P: Fake Phone pairing
  log('Pairing 1P Fake Phone...');
  const phoneSolo = fakePhoneSolo(1, '솔로폰', 'phone_solo_r3');
  await phoneSolo.join(1);
  await sleep(400);
  await phoneSolo.zero(1);
  await sleep(500);

  // Shoot center to start 3s countdown (or click start button)
  log('Shooting center to start game countdown...');
  await phoneSolo.aimHold(0, 0, 500);
  await phoneSolo.snap(0, 0);
  await sleep(4000);

  // Wait for weapon select
  let snap = null;
  for (let i = 0; i < 30; i++) {
    snap = await getSnapSolo();
    if (snap && snap.selection && snap.selection.kind === 'weapon') break;
    await sleep(200);
  }
  log('Weapon select reached, phase:', snap?.phase);

  // Select center weapon with phone
  const targets = snap.targets.filter((t) => t.selectKind === 'weapon');
  const card = targets[1] || targets[0];
  log('Shooting weapon card at aim:', card.aimX, card.aimY);
  await phoneSolo.aimHold(card.aimX, card.aimY, 300);
  await phoneSolo.snap(card.aimX, card.aimY);
  await sleep(1000);

  log('Entered combat. Waiting for lives to reach 0 (GAMEOVER)...');
  let reachedGameOver = false;
  for (let sec = 0; sec < 120; sec++) {
    snap = await getSnapSolo();
    const restartVisible = await pageSolo.locator('[data-shootable="restart"]').isVisible().catch(() => false);
    if (snap?.phase === 'GAMEOVER' || (snap?.lives !== undefined && snap.lives <= 0) || restartVisible) {
      log(`Game over reached at sec ${sec}: phase=${snap?.phase}, lives=${snap?.lives}`);
      reachedGameOver = true;
      break;
    }
    await phoneSolo.aimHold(0, 0, 1000);
  }
  await sleep(2000);

  // Check crosshair presence and tag
  const soloCrosshairInfo = await pageSolo.evaluate(() => {
    const crosshairs = Array.from(document.querySelectorAll('[data-testid^="crosshair-"]'));
    const restartBtn = document.querySelector('[data-shootable="restart"]');
    const scoreNum = document.querySelector('[data-testid="result-score-num"]') || document.querySelector('.text-4xl, .text-5xl, .text-6xl, .font-bold');
    return {
      crosshairCount: crosshairs.length,
      crosshairs: crosshairs.map((c) => ({
        id: c.getAttribute('data-testid'),
        tag: c.querySelector('[data-testid*="tag"], [class*="tag"]')?.textContent || null,
        tagElements: c.querySelectorAll('[class*="tag"]').length,
        style: c.getAttribute('style'),
      })),
      hasRestartBtn: !!restartBtn,
      scoreRect: scoreNum ? scoreNum.getBoundingClientRect() : null,
      restartRect: restartBtn ? restartBtn.getBoundingClientRect() : null,
    };
  });
  log('Solo Crosshair Info on result screen:', JSON.stringify(soloCrosshairInfo, null, 2));

  // Aim crosshair over the result score numbers
  if (soloCrosshairInfo.scoreRect) {
    const r = soloCrosshairInfo.scoreRect;
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const aimX = (centerX / 1440) * 2 - 1;
    const aimY = 1 - (centerY / 900) * 2;
    log(`Aiming phone over score number at (${aimX.toFixed(3)}, ${aimY.toFixed(3)})...`);
    await phoneSolo.aimHold(aimX, aimY, 800);
  }
  await shotSolo('Q1-03-result-crosshair-solo');

  // Shoot "다시 도전하기" (restart button) with phone
  let restartSuccess = false;
  if (soloCrosshairInfo.restartRect) {
    const r = soloCrosshairInfo.restartRect;
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const aimX = (centerX / 1440) * 2 - 1;
    const aimY = 1 - (centerY / 900) * 2;
    log(`Shooting restart button at aim (${aimX.toFixed(3)}, ${aimY.toFixed(3)})...`);
    await phoneSolo.aimHold(aimX, aimY, 500);
    await phoneSolo.snap(aimX, aimY);
    await sleep(2000);

    const postSnap = await getSnapSolo();
    log('Post restart snap phase:', postSnap?.phase);
    restartSuccess = postSnap?.phase === 'PLAYING' || postSnap?.phase === 'WEAPON_SELECT';
    await shotSolo('Q1-03-result-after-restart-solo');
  }

  results.solo = {
    crosshairVisible: soloCrosshairInfo.crosshairCount > 0,
    hasTag: soloCrosshairInfo.crosshairs.some((c) => !!c.tag || c.tagElements > 0),
    restartSuccess,
  };

  phoneSolo.close();
  await cleanupSolo();

  // Part 2: Coop Mode Result Screen
  log('--- Part 2: Coop Mode Result Screen ---');
  const envCoop = await createTestEnv();
  const { page: pageCoop, roomId: roomIdCoop, shot: shotCoop, fakePhone: fakePhoneCoop, getSnapshot: getSnapCoop, cleanup: cleanupCoop } = envCoop;

  // 1P: Mouse
  const coopSlot1 = pageCoop.locator('[data-testid="slot-card-1"]');
  await coopSlot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(400);
  const coopNick = pageCoop.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await coopNick.isVisible()) {
    await coopNick.fill('마우스1P');
    const confirmBtn = pageCoop.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(400);

  // 2P: Phone
  const phoneCoop = fakePhoneCoop(2, '폰2P', 'phone_coop_r3');
  await phoneCoop.join(2);
  await sleep(400);
  await phoneCoop.zero(2);
  await sleep(500);

  // Click Start
  await pageCoop.locator('button:has-text("게임 시작")').click();
  await sleep(1000);

  // Select weapons
  for (let i = 0; i < 30; i++) {
    snap = await getSnapCoop();
    if (snap && snap.selection && snap.selection.kind === 'weapon') break;
    await sleep(200);
  }
  const coopTargets = snap.targets.filter((t) => t.selectKind === 'weapon');
  const p1Card = coopTargets.find((t) => t.ownerIndex === 0);
  const p2Card = coopTargets.find((t) => t.ownerIndex === 1);

  // 1P select
  const clickX = ((p1Card.aimX + 1) / 2) * 1440;
  const clickY = ((1 - p1Card.aimY) / 2) * 900;
  await pageCoop.mouse.click(clickX, clickY);
  await sleep(300);

  // 2P select
  await phoneCoop.snap(p2Card.aimX, p2Card.aimY);
  await sleep(1000);

  log('Entered coop combat. Waiting for lives to reach 0...');
  for (let sec = 0; sec < 120; sec++) {
    snap = await getSnapCoop();
    const restartVisible = await pageCoop.locator('[data-shootable="restart"]').isVisible().catch(() => false);
    if (snap?.phase === 'GAMEOVER' || (snap?.lives !== undefined && snap.lives <= 0) || restartVisible) {
      log(`Coop Game over reached at sec ${sec}: phase=${snap?.phase}, lives=${snap?.lives}`);
      break;
    }
    await phoneCoop.aimHold(0, 0, 1000);
  }
  await sleep(2000);

  const coopCrosshairInfo = await pageCoop.evaluate(() => {
    const crosshairs = Array.from(document.querySelectorAll('[data-testid^="crosshair-"]'));
    const scoreNum = document.querySelector('[data-testid="result-score-num"]') || document.querySelector('.text-4xl, .text-5xl, .text-6xl, .font-bold');
    return {
      crosshairCount: crosshairs.length,
      crosshairs: crosshairs.map((c) => ({
        id: c.getAttribute('data-testid'),
        tag: c.querySelector('[data-testid*="tag"], [class*="tag"]')?.textContent || null,
        tagElements: c.querySelectorAll('[class*="tag"]').length,
        style: c.getAttribute('style'),
      })),
      scoreRect: scoreNum ? scoreNum.getBoundingClientRect() : null,
    };
  });
  log('Coop Crosshair Info on result screen:', JSON.stringify(coopCrosshairInfo, null, 2));

  // Aim phone over result score numbers
  if (coopCrosshairInfo.scoreRect) {
    const r = coopCrosshairInfo.scoreRect;
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const aimX = (centerX / 1440) * 2 - 1;
    const aimY = 1 - (centerY / 900) * 2;
    await phoneCoop.aimHold(aimX, aimY, 800);
  }
  await shotCoop('Q1-03-result-crosshair-coop');

  results.coop = {
    crosshairVisible: coopCrosshairInfo.crosshairCount > 0,
    hasTag: coopCrosshairInfo.crosshairs.some((c) => !!c.tag || c.tagElements > 0),
  };

  phoneCoop.close();
  await cleanupCoop();

  fs.writeFileSync(path.join(OUT_DIR, 'test-3-result.json'), JSON.stringify(results, null, 2));
  log('Test 3 finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 3 error:', e);
  process.exit(1);
});
