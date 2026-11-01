import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import * as path from 'path';

async function captureAllStudioAndGame() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const screensDir = path.join(process.cwd(), 'docs/screens');

  console.log('1. Navigating to monster-studio.html...');
  await page.goto('https://localhost:5173/docs/monster-studio.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Monsters
  const monsters = [
    { kind: 'pilgood', filename: 'monster-01-pilgood.png' },
    { kind: 'caslight', filename: 'monster-02-caslight.png' },
    { kind: 'obi', filename: 'monster-03-obi.png' },
    { kind: 'hanmac', filename: 'monster-04-hanmac.png' },
    { kind: 'mug', filename: 'monster-05-draft-mug.png' },
    { kind: 'boss', filename: 'monster-06-boss-dispenser.png' },
  ];

  for (const m of monsters) {
    console.log(`Capturing monster: ${m.kind}...`);
    await page.evaluate((kind) => window.showMonster(kind), m.kind);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screensDir, m.filename) });
  }

  // Monster Lineup
  console.log('Capturing monster lineup...');
  await page.evaluate(() => window.showAllLineup());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(screensDir, 'monster-lineup-all.png') });

  // Items
  const items = [
    { kind: 'power_shot', filename: 'item-01-power-shot.png' },
    { kind: 'wide_scope', filename: 'item-02-wide-scope.png' },
    { kind: 'ice_freeze', filename: 'item-03-ice-freeze.png' },
    { kind: 'bar_repair', filename: 'item-04-bar-repair.png' },
  ];

  for (const item of items) {
    console.log(`Capturing item: ${item.kind}...`);
    await page.evaluate((kind) => window.showItem(kind), item.kind);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screensDir, item.filename) });
  }

  // Item Lineup
  console.log('Capturing item lineup...');
  await page.evaluate(() => window.showAllItemsLineup());
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screensDir, 'item-lineup-all.png') });

  // In-game play screen (screen-04-pc-gameplay.png)
  console.log('2. Navigating to in-game screen...');
  await page.goto('https://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Click start as PC to enter game
  const pcStartBtn = await page.$('button:has-text("혼자 테스트 플레이")');
  if (pcStartBtn) {
    await pcStartBtn.click();
    await page.waitForTimeout(1500);

    // Let an item and some targets spawn
    await page.evaluate(() => {
      if (window.__engine) {
        window.__engine.spawnItemTarget('wide_scope', performance.now());
        window.__engine.activateItemBuff('power_shot', performance.now());
      }
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screensDir, 'screen-04-pc-gameplay.png') });
    console.log('Captured screen-04-pc-gameplay.png!');
  }

  await browser.close();
  console.log('All studio & in-game screenshots captured successfully!');
}

captureAllStudioAndGame().catch((err) => {
  console.error(err);
  process.exit(1);
});
