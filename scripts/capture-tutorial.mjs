import { chromium } from 'playwright';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shootOneTarget(page) {
  return await page.evaluate(() => {
    const eng = window.__engine;
    if (eng && eng.activeTargets.length > 0) {
      const t = eng.activeTargets[0];
      t.hp = 0.01;
      const p = eng.computeTargetAimCoords(t);
      eng.getPlayer(0).weaponSystem.lastFireTimeMs = 0;
      eng.shootAt(p.targetNormX, p.targetNormY, performance.now(), 'press');
      return true;
    }
    return false;
  });
}

async function captureTutorialScreens() {
  console.log('Launching browser for tutorial captures...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=metal'],
  });

  const screensDir = path.join(process.cwd(), 'docs/screens');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('1. Navigating to https://127.0.0.1:5173...');
  await page.goto('https://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await sleep(1500);

  // Click "튜토리얼 시작"
  console.log('Starting interactive shooting range tutorial...');
  const startBtn = page.locator('button:has-text("튜토리얼 시작")').first();
  await startBtn.click();
  await sleep(1500);

  // Step 1: Single Shot
  console.log('Capturing screen-10-tutorial-shooting-range-step1.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-10-tutorial-shooting-range-step1.png') });
  console.log('Captured screen-10-tutorial-shooting-range-step1.png');

  // Clear Step 1: 3 targets
  console.log('Clearing Step 1 targets...');
  for (let i = 0; i < 3; i++) {
    await shootOneTarget(page);
    await sleep(200);
  }
  await sleep(800);

  // Step 2: Rapid Fire
  console.log('Capturing screen-11-tutorial-shooting-range-step2.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-11-tutorial-shooting-range-step2.png') });
  console.log('Captured screen-11-tutorial-shooting-range-step2.png');

  // Clear Step 2: 1 target (bottle)
  console.log('Clearing Step 2 bottle target...');
  await shootOneTarget(page);
  await sleep(800);

  // Step 3-1: Shotgun
  console.log('Capturing screen-11b-tutorial-skill-shotgun.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-11b-tutorial-skill-shotgun.png') });
  console.log('Captured screen-11b-tutorial-skill-shotgun.png');

  // Trigger Shotgun skill & wait for blast and advance
  console.log('Triggering Shotgun skill...');
  await page.evaluate(() => window.__engine.triggerWeaponSkill(performance.now(), 0));
  await sleep(3200);

  // Step 3-2: Revolver
  console.log('Capturing screen-11b-tutorial-skill-revolver.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-11b-tutorial-skill-revolver.png') });
  console.log('Captured screen-11b-tutorial-skill-revolver.png');

  // Trigger Revolver skill & wait for advance
  console.log('Triggering Revolver skill...');
  await page.evaluate(() => window.__engine.triggerWeaponSkill(performance.now(), 0));
  await sleep(1800);

  // Step 3-3: Gatling
  console.log('Capturing screen-11b-tutorial-skill-gatling.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-11b-tutorial-skill-gatling.png') });
  console.log('Captured screen-11b-tutorial-skill-gatling.png');

  // Trigger Gatling skill & wait for advance to Step 4
  console.log('Triggering Gatling skill...');
  await page.evaluate(() => window.__engine.triggerWeaponSkill(performance.now(), 0));
  await sleep(1800);

  // Step 4: Fever Mode
  console.log('Activating Fever in Step 4...');
  await page.evaluate(() => window.__engine.activateFever(performance.now()));
  await sleep(800);
  console.log('Capturing screen-12-tutorial-shooting-range-step3.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-12-tutorial-shooting-range-step3.png') });
  console.log('Captured screen-12-tutorial-shooting-range-step3.png');

  // Clear Step 4 Fever enemies to graduate
  console.log('Clearing Step 4 enemies to graduate...');
  for (let i = 0; i < 15; i++) {
    const shot = await shootOneTarget(page);
    if (!shot) break;
    await sleep(150);
  }
  await sleep(1000);

  console.log('Capturing screen-13-tutorial-graduation-modal.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-13-tutorial-graduation-modal.png') });
  console.log('Captured screen-13-tutorial-graduation-modal.png');

  await browser.close();
  console.log('All tutorial screens captured successfully!');
}

captureTutorialScreens().catch((err) => {
  console.error(err);
  process.exit(1);
});
