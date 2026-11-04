import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to https://localhost:5173 ...');
  await page.goto('https://localhost:5173', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Body Text (first 200 chars):', bodyText.slice(0, 200));

  await page.screenshot({ path: '.memory/references/scripts/out/landing.png' });
  console.log('Saved landing.png');

  await browser.close();
}

run().catch(console.error);
