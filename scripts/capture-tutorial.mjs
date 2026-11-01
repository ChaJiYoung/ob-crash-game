import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import * as path from 'path';

async function captureTutorialScreens() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors'],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const screensDir = path.join(process.cwd(), 'docs/screens');

  console.log('1. Navigating to game host...');
  await page.goto('https://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Open Guide Modal from QR Pairing Screen
  console.log('Opening Guide Modal...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('게임 가이드')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screensDir, 'screen-07-guide-modal-controls.png') });
  console.log('Captured screen-07-guide-modal-controls.png');

  // Switch to Monster Codex Tab
  console.log('Switching to Monster Codex...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const tab = tabs.find((b) => b.textContent.includes('몬스터 도감'));
    if (tab) {
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screensDir, 'screen-08-guide-modal-monsters.png') });
  console.log('Captured screen-08-guide-modal-monsters.png');

  // Switch to Items Tab
  console.log('Switching to Items & Fever...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const tab = tabs.find((b) => b.textContent.includes('아이템 & 피버'));
    if (tab) {
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screensDir, 'screen-09-guide-modal-items.png') });
  console.log('Captured screen-09-guide-modal-items.png');

  // Click "지금 바로 사격 연습하기"
  console.log('Starting interactive shooting range...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('지금 바로 사격 연습하기')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screensDir, 'screen-10-tutorial-shooting-range-step1.png') });
  console.log('Captured screen-10-tutorial-shooting-range-step1.png');

  // Advance Step 2
  console.log('Advancing to Step 2...');
  await page.evaluate(() => {
    if (window.__engine) {
      window.__engine.advanceTutorialStep(2);
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screensDir, 'screen-11-tutorial-shooting-range-step2.png') });
  console.log('Captured screen-11-tutorial-shooting-range-step2.png');

  // Advance Step 3
  console.log('Advancing to Step 3...');
  await page.evaluate(() => {
    if (window.__engine) {
      window.__engine.advanceTutorialStep(3);
      window.__engine.scoreManager.activateFever(performance.now());
      window.__engine.spawnTutorialStep3Enemies();
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screensDir, 'screen-12-tutorial-shooting-range-step3.png') });
  console.log('Captured screen-12-tutorial-shooting-range-step3.png');

  // Advance Completed
  console.log('Graduating tutorial...');
  await page.evaluate(() => {
    if (window.__engine) {
      window.__engine.advanceTutorialStep('COMPLETED');
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screensDir, 'screen-13-tutorial-graduation-modal.png') });
  console.log('Captured screen-13-tutorial-graduation-modal.png');

  await browser.close();
  console.log('All tutorial screens captured successfully!');
}

captureTutorialScreens().catch((err) => {
  console.error(err);
  process.exit(1);
});
