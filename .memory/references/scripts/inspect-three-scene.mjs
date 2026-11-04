import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.click();
  await page.waitForTimeout(4000);

  const meshesInfo = await page.evaluate(() => {
    // Traverse window THREE scene by searching window or container
    const eng = window.__engine;
    // Find canvas
    const canvas = document.querySelector('canvas');
    return {
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
      activeTargets: eng?.activeTargets.map(t => ({
        id: t.id,
        kind: t.kind,
        x: t.x,
        y: t.customBaseY,
        z: t.z,
        weaponSelectKind: t.weaponSelectKind,
        rewardCardKind: t.rewardCardKind,
      })),
    };
  });

  console.log('Canvas & Engine Targets:', JSON.stringify(meshesInfo, null, 2));
  await browser.close();
}

run().catch(console.error);
