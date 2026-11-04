import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(4000);

  // Evaluate three.js scene from react component mount
  const sceneAnalysis = await page.evaluate(() => {
    const eng = window.__engine;
    // Find canvas parent or three objects
    const canvas = document.querySelector('canvas');
    return {
      activeTargets: eng?.activeTargets,
      isWeaponSelectPending: eng?.isWeaponSelectPending,
    };
  });

  console.log('Scene Analysis:', JSON.stringify(sceneAnalysis, null, 2));
  await browser.close();
}

run().catch(console.error);
