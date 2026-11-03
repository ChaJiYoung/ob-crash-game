import { chromium } from 'playwright';
import * as path from 'path';

async function captureWeaponsAndSkills() {
  console.log('Launching browser for weapon & skill captures...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=metal'],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const screensDir = path.join(process.cwd(), 'docs/screens');

  console.log('1. Navigating to https://localhost:5173...');
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // --- Part 1: Capture Guide Modal Tabs ---
  console.log('Opening Guide Modal...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent && b.textContent.includes('게임 가이드')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  // Helper to click tab inside modal
  async function clickModalTab(tabLabel) {
    await page.evaluate((label) => {
      const modal = document.querySelector('div[style*="position: fixed"]');
      if (!modal) return;
      const tab = Array.from(modal.querySelectorAll('button')).find(b =>
        b.textContent && b.textContent.includes(label)
      );
      if (tab) tab.click();
    }, tabLabel);
    await page.waitForTimeout(600);
  }

  // Tab 1: Weapons & Skills
  console.log('Capturing screen-07a-guide-weapons.png (Tab 1)...');
  await clickModalTab('3종 무기 & 스킬 도감');
  await page.screenshot({ path: path.join(screensDir, 'screen-07a-guide-weapons.png') });
  console.log('Captured screen-07a-guide-weapons.png!');

  // Tab 2: Monster Codex & HP Bar
  console.log('Capturing screen-08-guide-modal-monsters.png (Tab 2)...');
  await clickModalTab('몬스터 도감 & 체력바');
  await page.screenshot({ path: path.join(screensDir, 'screen-08-guide-modal-monsters.png') });
  console.log('Captured screen-08-guide-modal-monsters.png!');

  // Tab 3: Reward Cards & Controls
  console.log('Capturing screen-09-guide-modal-cards-controls.png (Tab 3)...');
  await clickModalTab('보상 카드 & 조작법');
  await page.screenshot({ path: path.join(screensDir, 'screen-09-guide-modal-cards-controls.png') });
  console.log('Captured screen-09-guide-modal-cards-controls.png!');

  // Tab 4: Pub Items
  console.log('Capturing screen-09b-guide-modal-items.png (Tab 4)...');
  await clickModalTab('펍 아이템');
  await page.screenshot({ path: path.join(screensDir, 'screen-09b-guide-modal-items.png') });
  console.log('Captured screen-09b-guide-modal-items.png!');

  // Close Modal
  console.log('Closing Guide Modal...');
  await page.evaluate(() => {
    const modal = document.querySelector('div[style*="position: fixed"]');
    if (!modal) return;
    const closeBtn = Array.from(modal.querySelectorAll('button')).find(b =>
      b.textContent && (b.textContent.includes('닫기') || b.textContent.includes('✕'))
    );
    if (closeBtn) closeBtn.click();
  });
  await page.waitForTimeout(600);

  // --- Part 2: Enter PC Game & Capture 3D Battle & Weapons ---
  console.log('Starting PC Game...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent && b.textContent.includes('스마트폰 없이 PC')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);

  // Initial Weapon Select Stage
  console.log('Capturing screen-13a-starting-weapon-selection.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-13a-starting-weapon-selection.png') });

  // 1. Setup Shotgun Lv.2 & active monsters
  console.log('Setting up Shotgun Lv.2 & active monsters...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (!eng) return;
    // Clear initial weapon select targets
    eng.activeTargets = [];
    eng.isWeaponSelectPending = false;
    eng.weaponSystem.selectWeapon('shotgun', 2);
    const now = performance.now();
    eng.spawnSandboxTarget('obi', { radiusM: 8.0, thetaRad: -0.25, stationary: true });
    eng.spawnSandboxTarget('hanmac', { radiusM: 11.0, thetaRad: 0.05, stationary: true });
    eng.spawnSandboxTarget('bottle', { radiusM: 13.0, thetaRad: 0.28, stationary: true });
    eng.spawnGoldenCanTarget(now);
  });
  await page.waitForTimeout(1000);
  console.log('Capturing screen-14-weapon-shotgun-battle.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-14-weapon-shotgun-battle.png') });

  // Trigger Plunger Storm Skill
  console.log('Triggering Plunger Storm skill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.weaponSystem.refillSkillInstant();
    eng.triggerWeaponSkill(performance.now());
    }
  });
  await page.waitForTimeout(400);
  console.log('Capturing screen-17-skill-plunger-storm.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-17-skill-plunger-storm.png') });

  // 2. Setup Revolver Lv.3
  console.log('Setting up Revolver Lv.3...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (!eng) return;
    eng.activeTargets = [];
    eng.weaponSystem.selectWeapon('revolver', 3);
    const now = performance.now();
    eng.spawnSandboxTarget('hanmac', { radiusM: 9.0, thetaRad: -0.15, stationary: true });
    eng.spawnSandboxTarget('bottle', { radiusM: 12.0, thetaRad: 0.1, stationary: true });
  });
  await page.waitForTimeout(1000);
  console.log('Capturing screen-15-weapon-revolver-battle.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-15-weapon-revolver-battle.png') });

  console.log('Triggering Opener Boomerang skill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.weaponSystem.refillSkillInstant();
    eng.triggerWeaponSkill(performance.now());
    }
  });
  await page.waitForTimeout(400);
  console.log('Capturing screen-18-skill-opener-boomerang.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-18-skill-opener-boomerang.png') });

  // 3. Setup Gatling Lv.4 MAX & Boss
  console.log('Setting up Gatling Lv.4 MAX...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (!eng) return;
    eng.activeTargets = [];
    eng.weaponSystem.selectWeapon('gatling', 4);
    const now = performance.now();
    eng.spawnSandboxTarget('boss', { radiusM: 14.0, thetaRad: 0.0, stationary: true });
    eng.spawnSandboxTarget('hanmac', { radiusM: 10.0, thetaRad: -0.3, stationary: true });
  });
  await page.waitForTimeout(1000);
  console.log('Capturing screen-16-weapon-gatling-battle.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-16-weapon-gatling-battle.png') });

  console.log('Triggering Foam Tsunami skill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.weaponSystem.refillSkillInstant();
    eng.triggerWeaponSkill(performance.now());
    }
  });
  await page.waitForTimeout(400);
  console.log('Capturing screen-19-skill-foam-tsunami.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-19-skill-foam-tsunami.png') });

  // 4. Spawn Wave Clear Reward Cards (Shoot-to-Select)
  console.log('Spawning Wave Reward Cards 3D...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.activeTargets = [];
      eng.spawnWaveRewardCards(performance.now());
    }
  });
  await page.waitForTimeout(1000);
  console.log('Capturing screen-20-reward-cards-selection.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-20-reward-cards-selection.png') });

  await browser.close();
  console.log('ALL WEAPON & SKILL SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

captureWeaponsAndSkills().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
