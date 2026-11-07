import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import os from 'node:os';

async function testFPS() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=metal', '--enable-webgl'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  await page.goto('https://127.0.0.1:5223/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1000));

  const fps = await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(tick);
        } else {
          resolve(frames);
        }
      }
      requestAnimationFrame(tick);
    });
  });

  console.log(`1-sec rAF count: ${fps}`);
  console.log(`Load avg: ${os.loadavg().map((x) => x.toFixed(2)).join(', ')}`);
  console.log(`Uptime: ${os.uptime()}s`);
  await browser.close();
}

testFPS().catch(console.error);
