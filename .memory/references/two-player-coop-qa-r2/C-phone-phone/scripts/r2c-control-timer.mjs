import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const measure = () => new Promise((resolve) => {
  let timerTicks = 0; let frames = 0;
  const id = window.setInterval(() => { timerTicks += 1; }, 5);
  const t0 = performance.now();
  const raf = () => { frames += 1; if (performance.now() - t0 < 1000) requestAnimationFrame(raf); else { window.clearInterval(id); resolve({ timer5msPerSec: timerTicks, rafPerSec: frames }); } };
  requestAnimationFrame(raf);
});
const blank = await (await browser.newContext()).newPage();
await blank.setContent('<html><body>blank</body></html>');
console.log('blank page', JSON.stringify(await blank.evaluate(measure)));
for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  const p = await (await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true })).newPage();
  await p.goto('https://127.0.0.1:5203/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 6000));
  console.log('game lobby', vp.width + 'x' + vp.height, JSON.stringify(await p.evaluate(measure)));
}
await browser.close();
