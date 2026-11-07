import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(__dirname, '..');
const URL = 'https://127.0.0.1:5205/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

async function checkBounds(page, width, height, label) {
  await page.setViewportSize({ width, height });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  // 로비 주요 요소들 bounds 체크
  const elements = await page.evaluate(() => {
    const list = [];
    const selectors = ['h1', 'button', '[data-shootable]', 'input'];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        const text = (el.innerText || el.getAttribute('placeholder') || el.tagName).slice(0, 30);
        list.push({
          tag: el.tagName,
          text,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
          outOfBounds: r.x < 0 || r.y < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight,
        });
      }
    }
    return {
      window: { width: window.innerWidth, height: window.innerHeight },
      elements: list,
    };
  });

  const clipped = elements.elements.filter((e) => e.outOfBounds);
  log(`[${label} ${width}x${height}] Total elements checked: ${elements.elements.length}, Clipped: ${clipped.length}`);
  if (clipped.length > 0) {
    log(`[${label}] Clipped items:`, JSON.stringify(clipped, null, 2));
  }
  await page.screenshot({ path: path.join(OUT, `5-3-bounds-${width}x${height}-${label}.png`) });
  return clipped;
}

const page = await browser.newPage({ ignoreHTTPSErrors: true });
await checkBounds(page, 1440, 900, 'lobby');
await checkBounds(page, 1024, 768, 'lobby');

await browser.close();
process.exit(0);
