import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';

const URL = 'https://127.0.0.1:5204/';

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});

const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await new Promise((r) => setTimeout(r, 2000));

const title = await page.title();
const debugExists = await page.evaluate(() => typeof window.__BEER_DEBUG__ !== 'undefined');
console.log('Title:', title);
console.log('debugExists:', debugExists);
console.log('Errors:', errors);

await browser.close();
