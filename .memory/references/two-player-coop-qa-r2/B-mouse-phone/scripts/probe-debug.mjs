import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('https://127.0.0.1:5202/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const debugExists = await page.evaluate(() => {
  return typeof window.__BEER_DEBUG__ !== 'undefined';
});
console.log('window.__BEER_DEBUG__ exists:', debugExists);
if (debugExists) {
  const keys = await page.evaluate(() => Object.keys(window.__BEER_DEBUG__));
  console.log('window.__BEER_DEBUG__ keys:', keys);
  const snap = await page.evaluate(() => window.__BEER_DEBUG__.snapshot ? window.__BEER_DEBUG__.snapshot() : null);
  console.log('snapshot keys:', snap ? Object.keys(snap) : 'null');
  console.log('snapshot:', JSON.stringify(snap, null, 2));
}

await browser.close();
