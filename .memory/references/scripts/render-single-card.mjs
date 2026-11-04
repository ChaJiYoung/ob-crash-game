import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto('https://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const startBtn = page.locator('button:has-text("PC"), button:has-text("시작")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 5000 });
  await startBtn.click();
  await page.waitForTimeout(4000);

  // Position camera directly in front of the center card (0, 1.5, -2) and look at (0, 1.5, -5)
  await page.evaluate(() => {
    const camera = window.__camera;
    if (camera) {
      camera.position.set(0, 1.5, -2.0);
      camera.lookAt(0, 1.5, -5);
    }
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: '.memory/references/scripts/out/close-up-card.png' });
  console.log('Saved close-up screenshot: .memory/references/scripts/out/close-up-card.png');

  await browser.close();
}

run().catch(console.error);
