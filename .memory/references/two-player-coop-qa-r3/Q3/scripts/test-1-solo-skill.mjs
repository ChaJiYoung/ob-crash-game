import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR, ensureLoadAndRaf } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 1-Skill: 1P Solo Skill (10x repetition with card selection handler)...');
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot, errors, pageErrors } = env;

  const phone = createFakePhone(roomId, 1, '블루폰1P', 'solo_skill');

  const defenseShootAndHandleCards = async () => {
    const s = await getSnapshot();
    if (!s) return;
    if (s.selection?.kind === 'card') {
      const card = s.targets.find((t) => t.selectKind === 'card') || s.targets[0];
      if (card) {
        log('Card round active! Selecting card:', card.selectValue);
        await phone.aimHold(card.aimX, card.aimY, 200);
        await phone.snap(card.aimX, card.aimY);
        await sleep(300);
      }
      return;
    }
    if (s.phase === 'PLAYING') {
      let pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding && t.landed && t.hp > 0);
      if (pool.length === 0) {
        pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding && t.hp > 0);
      }
      pool.sort((a, b) => (a.radiusM ?? 10) - (b.radiusM ?? 10));
      const target = pool[0];
      if (target) {
        await phone.aimHold(target.aimX, target.aimY, 30);
        await phone.snap(target.aimX, target.aimY);
      }
    }
  };

  try {
    await page.getByText('📱 모바일').first().click();
    await sleep(400);

    await phone.join();
    await sleep(400);
    await phone.zero();
    await sleep(500);

    await phone.aimHold(0, 0, 300);
    await phone.snap(0, 0);
    await phone.aimHold(0, 0, 3500);
    await sleep(1000);

    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(100);
    }
    const card = snap.targets.find((t) => t.selectValue === 'gatling') || snap.targets[0];
    await phone.aimHold(card.aimX, card.aimY, 300);
    await phone.snap(card.aimX, card.aimY);
    await sleep(600);

    for (let i = 0; i < 60; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(100);
    }
    log('Combat active. Starting skill 10x test...');

    const load = await ensureLoadAndRaf(page, defenseShootAndHandleCards);
    log('Load before 1P skill test:', load.ok ? 'OK' : 'SKIP', load);

    if (!load.ok) {
      const skipRes = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load,
        pageErrors,
        errors,
      };
      await shot('Q3-1P-04-skill-skipped');
      fs.writeFileSync(path.join(OUT_DIR, 'test-1-solo-skill-result.json'), JSON.stringify(skipRes, null, 2));
      phone.close();
      await env.ctx.close();
      await env.browser.close();
      return;
    }

    const skillTrials = [];
    let failedCount = 0;

    for (let i = 1; i <= 10; i++) {
      log(`[Trial ${i}/10] Waiting for skillStock >= 1...`);
      let stockReady = false;
      const waitStart = Date.now();
      while (Date.now() - waitStart < 45000) {
        const s = await getSnapshot();
        if (s?.phase === 'GAMEOVER' || s?.phase === 'VICTORY') {
          log('Game ended with phase:', s?.phase);
          break;
        }
        if (s?.selection?.kind === 'card') {
          await defenseShootAndHandleCards();
          await sleep(100);
          continue;
        }
        if (s?.players[0].skillStock >= 1 && s?.selection?.kind === null) {
          stockReady = true;
          break;
        }
        await defenseShootAndHandleCards();
        await sleep(80);
      }

      if (!stockReady) {
        log(`Trial #${i} FAILED: stock not ready or selection pending`);
        failedCount++;
        skillTrials.push({ trial: i, success: false, reason: 'stock not ready' });
        continue;
      }

      const before = await getSnapshot();
      const stockBefore = before.players[0].skillStock;
      log(`Trial #${i}: stockBefore=${stockBefore}. Sending skillSnapTriggered: true...`);

      phone.frame(0, 0, { skillSnapTriggered: true });
      await sleep(150);
      phone.frame(0, 0, { skillSnapTriggered: false });
      await sleep(100);

      const after = await getSnapshot();
      const stockAfter = after.players[0].skillStock;
      const consumed = stockBefore - stockAfter === 1;

      if (!consumed) failedCount++;
      skillTrials.push({
        trial: i,
        stockBefore,
        stockAfter,
        consumed,
        success: consumed,
      });

      log(`Trial #${i} result: stock ${stockBefore} -> ${stockAfter}, consumed: ${consumed}`);
      await sleep(1000);
    }

    await shot('Q3-1P-04-skill');

    const result = {
      test: '1P Solo Skill 10x',
      status: failedCount === 0 ? 'PASS' : 'BUG',
      load,
      failedCount,
      trials: skillTrials,
      pageErrors,
      errors,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'test-1-solo-skill-result.json'), JSON.stringify(result, null, 2));
    log('Test 1-Skill completed! Status:', result.status, 'failedCount:', failedCount);

    phone.close();
  } finally {
    await env.ctx.close();
    await env.browser.close();
  }
}

run().catch((e) => {
  console.error('Test 1-Skill failed:', e);
  process.exit(1);
});
