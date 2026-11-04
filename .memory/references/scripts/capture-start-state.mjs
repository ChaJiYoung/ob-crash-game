import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err.stack || err.message));

  console.log('Navigating to https://localhost:5173 ...');
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });

  await page.waitForTimeout(1000);

  // Click PC Start button
  console.log('Clicking start button...');
  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  console.log('Button text:', await startBtn.innerText());
  await startBtn.click();

  await page.waitForTimeout(1500);

  const engineState = await page.evaluate(() => {
    const eng = window.__engine;
    return {
      gamePhase: eng?.gamePhase,
      targetCount: eng?.activeTargets.length,
      targets: eng?.activeTargets.map(t => ({
        id: t.id,
        kind: t.kind,
        x: t.x,
        z: t.z,
        weaponSelectKind: t.weaponSelectKind,
        rewardCardKind: t.rewardCardKind,
      })),
      isWeaponSelectPending: eng?.isWeaponSelectPending,
      isRewardCardPending: eng?.isRewardCardPending,
    };
  });
  console.log('After Start Engine State:', JSON.stringify(engineState, null, 2));

  await page.screenshot({ path: '.memory/references/scripts/out/start-state.png' });
  console.log('Screenshot saved to .memory/references/scripts/out/start-state.png');

  await browser.close();
}

run().catch(console.error);
