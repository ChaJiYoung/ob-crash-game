import { chromium } from 'playwright';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureGuideScreens() {
  console.log('Launching browser for guide captures...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=metal'],
  });

  const screensDir = path.join(process.cwd(), 'docs/screens');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('1. Navigating to https://127.0.0.1:5173...');
  await page.goto('https://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await sleep(1500);

  // Open Guide Modal
  console.log('Opening Guide Modal...');
  const guideBtn = page.locator('button:has-text("게임 가이드")').first();
  await guideBtn.click();
  await sleep(800);

  // Tab 1: Weapons & Skills (activeTab is 'weapons' by default)
  // Expand Shotgun card details
  console.log('Expanding Shotgun card details in Weapons tab...');
  const shotgunDetails = page.locator('[data-testid="weapon-card-shotgun-details"] summary, [data-testid="weapon-card-shotgun"] summary').first();
  if (await shotgunDetails.count()) {
    await shotgunDetails.click();
    await sleep(400);
  } else {
    // fallback: any first summary in card
    const firstSummary = page.locator('summary:has-text("자세히 보기")').first();
    if (await firstSummary.count()) {
      await firstSummary.click();
      await sleep(400);
    }
  }

  console.log('Capturing screen-07a-guide-weapons.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-07a-guide-weapons.png') });
  console.log('Captured screen-07a-guide-weapons.png');

  // Tab 2: Monster Codex
  console.log('Switching to Monster Codex Tab...');
  const monsterTabBtn = page.locator('button:has-text("몬스터 도감")').first();
  await monsterTabBtn.click();
  await sleep(600);
  console.log('Capturing screen-08-guide-modal-monsters.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-08-guide-modal-monsters.png') });
  console.log('Captured screen-08-guide-modal-monsters.png');

  // Tab 3: Cards & Controls
  console.log('Switching to Cards & Controls Tab...');
  const cardsTabBtn = page.locator('button:has-text("보상 카드")').first();
  await cardsTabBtn.click();
  await sleep(600);
  console.log('Capturing screen-09-guide-modal-cards-controls.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-09-guide-modal-cards-controls.png') });
  console.log('Captured screen-09-guide-modal-cards-controls.png');

  // Tab 4: Pub Items
  console.log('Switching to Items Tab...');
  const itemsTabBtn = page.locator('button:has-text("펍 아이템")').first();
  await itemsTabBtn.click();
  await sleep(600);
  console.log('Capturing screen-09b-guide-modal-items.png and screen-09-guide-modal-items.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-09b-guide-modal-items.png') });
  await page.screenshot({ path: path.join(screensDir, 'screen-09-guide-modal-items.png') });
  console.log('Captured screen-09b-guide-modal-items.png & screen-09-guide-modal-items.png');

  await browser.close();
  console.log('All guide modal screens captured successfully!');
}

captureGuideScreens().catch((err) => {
  console.error(err);
  process.exit(1);
});
