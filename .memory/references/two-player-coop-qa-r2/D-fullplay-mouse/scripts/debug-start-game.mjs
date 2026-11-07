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
await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(1500);

console.log('Finding mouse button...');
const clicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const mouseBtn = btns.find((b) => b.textContent && b.textContent.includes('마우스'));
  if (mouseBtn) {
    mouseBtn.click();
    return true;
  }
  return false;
});
console.log('Clicked mouse button via evaluate:', clicked);
await sleep(500);

await page.screenshot({ path: path.join(OUT, 'debug-after-mouse-click.png') });

const inputVisible = await page.locator('input[placeholder="닉네임 입력"]').isVisible();
console.log('Nickname input visible:', inputVisible);

if (inputVisible) {
  await page.locator('input[placeholder="닉네임 입력"]').fill('테스터-샷건');
  await sleep(200);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const confirmBtn = btns.find((b) => b.textContent && b.textContent.trim() === '확인');
    confirmBtn?.click();
  });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, 'debug-after-confirm.png') });

  const startVisible = await page.locator('[data-shootable="start"]').isVisible();
  console.log('Start button visible:', startVisible);
  if (startVisible) {
    await page.locator('[data-shootable="start"]').click();
    await sleep(2000);
    const snap = await page.evaluate(() => window.__BEER_DEBUG__.snapshot());
    console.log('Game Phase after start:', snap.phase);
    console.log('Selection:', snap.selection);
    console.log('Targets:', snap.targets.length);
    await page.screenshot({ path: path.join(OUT, 'debug-after-start.png') });
  }
}

await browser.close();
