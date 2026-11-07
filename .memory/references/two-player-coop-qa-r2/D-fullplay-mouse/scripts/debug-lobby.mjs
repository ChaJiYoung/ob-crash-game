import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/D-fullplay-mouse';
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
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: path.join(OUT, 'debug-initial-lobby.png') });

const html = await page.evaluate(() => document.body.innerHTML);
console.log('HTML snippet:', html.slice(0, 1000));

await browser.close();
