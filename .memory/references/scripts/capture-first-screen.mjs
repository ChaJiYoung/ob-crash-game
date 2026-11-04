import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err));

  await page.goto('https://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const texts = await page.locator('button, h1, h2, h3, div').allInnerTexts();
  console.log('Visible texts on page:', texts.filter(t => t.length > 2 && t.length < 50).slice(0, 15));

  await page.screenshot({ path: '.memory/references/scripts/out/current-page.png' });
  console.log('Saved current-page.png');

  await browser.close();
}

run().catch(console.error);
