import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
const flags = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--enable-webgl', ...flags] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
const t = Date.now();
await page.goto('https://127.0.0.1:5204/', { waitUntil: 'domcontentloaded', timeout: 120000 });
const load = Date.now() - t;
const r = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(f);
}));
const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); return g ? g.getParameter(g.RENDERER) : 'none'; });
console.log(JSON.stringify({ flags, loadMs: load, fps: Number(r.toFixed(1)), gl }));
await browser.close();
