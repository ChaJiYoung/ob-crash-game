import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/D-fullplay-mouse';
const URL = 'https://127.0.0.1:5204/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

console.log('Navigating to', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(2000);

console.log('Clicking 1P Mouse button...');
await page.getByText('🖱 마우스').first().click();
await sleep(500);

await page.getByPlaceholder('닉네임 입력').fill('테스터-샷건');
await sleep(200);
await page.getByText('확인', { exact: true }).click();
await sleep(800);

console.log('Clicking Start button...');
const startBtn = page.locator('[data-shootable="start"]');
await startBtn.click();
await sleep(1500);

const snap = await page.evaluate(() => window.__BEER_DEBUG__.snapshot());
console.log('Phase:', snap.phase);
console.log('Selection:', snap.selection);
console.log('Targets count:', snap.targets.length);
console.log('Targets:', snap.targets.map((t) => ({ kind: t.kind, selectKind: t.selectKind, selectValue: t.selectValue, aimX: t.aimX, aimY: t.aimY })));

await page.screenshot({ path: path.join(OUT, 'test-weapon-select.png') });
console.log('Errors:', errors);

await browser.close();
