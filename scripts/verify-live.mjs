import { chromium } from 'playwright';

async function testGame() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));

  console.log('Navigating to https://localhost:5173 ...');
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Check if canvas exists
  const canvas = page.locator('canvas');
  await canvas.waitFor({ timeout: 5000 });
  console.log('Canvas found!');

  // Check initial canvas element identity
  const canvasHandle = await canvas.elementHandle();

  // 2. Move mouse rapidly 20 times across the screen to test stutter / re-creation
  console.log('Simulating rapid mouse movement across canvas...');
  for (let i = 0; i < 20; i++) {
    const x = 200 + (i % 5) * 150;
    const y = 150 + (i % 4) * 100;
    await page.mouse.move(x, y);
    await page.waitForTimeout(30);
  }

  // Verify canvas element was NOT re-created or destroyed
  const canvasHandleAfter = await canvas.elementHandle();
  const isSameCanvas = await page.evaluate(
    ([c1, c2]) => c1 === c2,
    [canvasHandle, canvasHandleAfter]
  );
  console.log('Canvas maintained same instance across 20 mouse movements:', isSameCanvas);

  // 3. Start game as PC
  console.log('Looking for PC start button...');
  const startBtn = page.getByRole('button', { name: /PC 단독 플레이/i });
  if (await startBtn.isVisible()) {
    await startBtn.click();
    console.log('Clicked PC start button!');
  } else {
    const anyStart = page.locator('button:has-text("시작")').first();
    if (await anyStart.isVisible()) {
      await anyStart.click();
      console.log('Clicked start button!');
    }
  }

  await page.waitForTimeout(1000);

  // 4. Check active targets moving in engine
  const targetCheck = await page.evaluate(() => {
    const engine = window.__engine;
    if (!engine) return { found: false, error: 'no window.__engine' };
    const targets = engine.activeTargets.map(t => ({
      id: t.id,
      kind: t.kind,
      radiusM: Number(t.radiusM.toFixed(2)),
      x: Number(t.x.toFixed(2)),
      z: Number(t.z.toFixed(2)),
      speedMps: t.speedMps
    }));
    return {
      found: true,
      gamePhase: engine.gamePhase,
      wave: engine.currentWave,
      targetCount: targets.length,
      targets: targets.slice(0, 3)
    };
  });
  console.log('Initial Targets state:', JSON.stringify(targetCheck, null, 2));

  // Wait 1.5 seconds and check targets again to verify movement towards player
  await page.waitForTimeout(1500);

  const targetCheck2 = await page.evaluate(() => {
    const engine = window.__engine;
    if (!engine) return { found: false };
    const targets = engine.activeTargets.map(t => ({
      id: t.id,
      kind: t.kind,
      radiusM: Number(t.radiusM.toFixed(2)),
      x: Number(t.x.toFixed(2)),
      z: Number(t.z.toFixed(2)),
      speedMps: t.speedMps
    }));
    return {
      targetCount: targets.length,
      targets: targets.slice(0, 3)
    };
  });
  console.log('After 1.5s Targets state (checking approach):', JSON.stringify(targetCheck2, null, 2));

  // 5. Test mouse shoot click
  console.log('Simulating mouse shoot...');
  await page.mouse.click(640, 360);
  await page.waitForTimeout(300);

  const afterShotEngine = await page.evaluate(() => {
    const engine = window.__engine;
    return {
      ammo: engine.weaponSystem.getState().ammo,
      totalScore: engine.scoreManager.getState().totalScore
    };
  });
  console.log('Weapon & Score state after shot:', JSON.stringify(afterShotEngine, null, 2));

  // Screenshot capture
  await page.screenshot({ path: 'docs/screens/screen-live-verification.png' });
  console.log('Screenshot saved to docs/screens/screen-live-verification.png');

  console.log('Page Errors count:', errors.length);
  if (errors.length > 0) {
    console.error('Errors:', errors);
  }

  await browser.close();
}

testGame().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
