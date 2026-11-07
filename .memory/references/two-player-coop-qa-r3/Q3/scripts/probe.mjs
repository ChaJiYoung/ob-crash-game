import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import os from 'node:os';

async function test(name, args) {
  console.log(`Testing ${name}...`);
  const browser = await chromium.launch({
    headless: true,
    args,
  });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://127.0.0.1:5223/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1000));

  const fps = await page.evaluate(() => {
    return new Promise((resolve) => {
      let count = 0;
      const start = performance.now();
      function tick() {
        count++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(tick);
        } else {
          resolve(count);
        }
      }
      requestAnimationFrame(tick);
    });
  });

  console.log(`${name} FPS: ${fps}, load: ${os.loadavg().map((x) => x.toFixed(2)).join(', ')}`);
  await browser.close();
}

async function main() {
  await test('swiftshader', ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl']);
  await test('metal', ['--ignore-certificate-errors', '--use-angle=metal', '--enable-webgl']);
  await test('default', ['--ignore-certificate-errors', '--enable-webgl']);
}

main().catch(console.error);
