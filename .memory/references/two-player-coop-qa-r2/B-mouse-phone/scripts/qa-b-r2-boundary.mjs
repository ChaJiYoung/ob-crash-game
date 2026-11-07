import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone');
const URL = 'https://127.0.0.1:5202/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function checkBoundaryForViewport(width, height) {
  log(`Checking boundaries for viewport ${width}x${height}...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });

  const ctx = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  // 로비 모달 및 버튼 바운더리 체크
  const elements = [
    { name: 'PairingModal', selector: '[data-testid="pairing-modal"]' },
    { name: 'SlotCard1', selector: '[data-testid="slot-card-1"]' },
    { name: 'SlotCard2', selector: '[data-testid="slot-card-2"]' },
    { name: 'StartButton', selector: '[data-shootable="start"]' },
    { name: 'RankingTabSolo', selector: 'button:has-text("개인 랭킹")' },
    { name: 'RankingTabTeam', selector: 'button:has-text("팀 랭킹")' },
  ];

  const results = [];
  for (const el of elements) {
    const loc = page.locator(el.selector);
    const count = await loc.count();
    if (count > 0) {
      const box = await loc.first().boundingBox();
      const isWithinX = box ? box.x >= 0 && box.x + box.width <= width : false;
      const isWithinY = box ? box.y >= 0 && box.y + box.height <= height : false;
      results.push({
        name: el.name,
        box,
        isWithinViewport: isWithinX && isWithinY,
        clipped: {
          left: box ? box.x < 0 : false,
          right: box ? box.x + box.width > width : false,
          top: box ? box.y < 0 : false,
          bottom: box ? box.y + box.height > height : false,
        },
      });
    } else {
      results.push({ name: el.name, count: 0, note: 'Not found' });
    }
  }

  await page.screenshot({ path: path.join(OUT, `boundary-lobby-${width}x${height}.png`) });
  await browser.close();

  return { viewport: { width, height }, results };
}

async function run() {
  const r1440 = await checkBoundaryForViewport(1440, 900);
  const r1024 = await checkBoundaryForViewport(1024, 768);

  const report = { r1440, r1024 };
  fs.writeFileSync(path.join(OUT, 'boundary-report.json'), JSON.stringify(report, null, 2));
  log('Saved boundary report to boundary-report.json');
}

run().catch((e) => {
  console.error('Boundary check error:', e);
  process.exit(1);
});
