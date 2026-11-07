import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 }, ignoreHTTPSErrors: true })).newPage();
await page.goto('https://127.0.0.1:5203/', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 8000));
const info = await page.evaluate(() => {
  const se = document.scrollingElement;
  const scrollables = Array.from(document.querySelectorAll('*')).filter((e) => e.scrollHeight > e.clientHeight + 4 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), scrollH: e.scrollHeight, clientH: e.clientHeight }));
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('새 방 만들기'));
  if (btn) btn.scrollIntoView({ block: 'center' });
  const r = btn ? btn.getBoundingClientRect() : null;
  return { docScrollH: se.scrollHeight, docClientH: se.clientHeight, scrollables, newRoomBtnRectAfterScrollIntoView: r ? [Math.round(r.top), Math.round(r.bottom)] : null, innerH: window.innerHeight };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
