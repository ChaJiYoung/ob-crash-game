import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 5: Gatling Console Errors for 60s Play...');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, cleanup } = env;

  const capturedConsoleErrors = [];
  const capturedPageErrors = [];

  page.on('pageerror', (e) => {
    capturedPageErrors.push(e.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      capturedConsoleErrors.push(msg.text());
    }
  });

  // 1P Mouse Pairing
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  await slot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(400);

  const nickInput = page.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await nickInput.isVisible()) {
    await nickInput.fill('개틀링테스터');
    const confirmBtn = page.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(400);

  // Start solo game
  await page.locator('button:has-text("게임 시작")').click();
  await sleep(1000);

  // Wait for weapon select
  let snap = null;
  for (let i = 0; i < 30; i++) {
    snap = await getSnapshot();
    if (snap && snap.selection && snap.selection.kind === 'weapon') break;
    await sleep(200);
  }

  const targets = snap.targets.filter((t) => t.selectKind === 'weapon');
  const gatlingCard = targets.find((t) => t.selectValue === 'gatling');
  if (!gatlingCard) throw new Error('Gatling card not found in weapon selection!');

  log('Selecting Gatling card at aim:', gatlingCard.aimX, gatlingCard.aimY);
  const clickX = ((gatlingCard.aimX + 1) / 2) * 1440;
  const clickY = ((1 - gatlingCard.aimY) / 2) * 900;
  await page.mouse.click(clickX, clickY);
  await sleep(800);

  snap = await getSnapshot();
  log('Weapon selected. Current weaponKind:', snap?.players[0]?.weaponKind, 'phase:', snap?.phase);

  log('Playing Gatling solo for 60 seconds (firing regularly, monitoring errors)...');
  const startTime = Date.now();
  let shotCount = 0;

  while (Date.now() - startTime < 60000) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    snap = await getSnapshot();

    // Aim at center or near target and shoot / hold
    const x = 720 + Math.sin(elapsed) * 200;
    const y = 450 + Math.cos(elapsed) * 100;
    await page.mouse.move(x, y);

    // Rapid fire hold for 400ms
    await page.mouse.down();
    await sleep(400);
    await page.mouse.up();
    shotCount++;

    if (elapsed % 15 === 0) {
      log(`[Play elapsed: ${elapsed}s] lives=${snap?.lives}, score=${snap?.players[0]?.score}, consoleErrors=${capturedConsoleErrors.length}, pageErrors=${capturedPageErrors.length}`);
      await shot(`Q1-05-gatling-combat-${elapsed}s`);
    }

    // If game ended prematurely, restart or keep monitoring
    if (snap?.phase === 'GAMEOVER') {
      const restartBtn = page.locator('[data-shootable="restart"]');
      if (await restartBtn.isVisible().catch(() => false)) {
        log(`Died at sec ${elapsed}, clicking restart...`);
        await restartBtn.click();
        await sleep(1000);
        // Select gatling again if needed
        const reSnap = await getSnapshot();
        if (reSnap?.selection?.kind === 'weapon') {
          const reTargets = reSnap.targets.filter((t) => t.selectKind === 'weapon');
          const reGatling = reTargets.find((t) => t.selectValue === 'gatling');
          if (reGatling) {
            await page.mouse.click(((reGatling.aimX + 1) / 2) * 1440, ((1 - reGatling.aimY) / 2) * 900);
          }
        }
      }
    }

    await sleep(200);
  }

  await shot('Q1-05-gatling-combat-final');
  await cleanup();

  const results = {
    playDurationSec: 60,
    totalShots: shotCount,
    consoleErrorsCount: capturedConsoleErrors.length,
    consoleErrors: capturedConsoleErrors,
    pageErrorsCount: capturedPageErrors.length,
    pageErrors: capturedPageErrors,
    pass: capturedConsoleErrors.length === 0 && capturedPageErrors.length === 0,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'test-5-result.json'), JSON.stringify(results, null, 2));
  log('Test 5 finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 5 error:', e);
  process.exit(1);
});
