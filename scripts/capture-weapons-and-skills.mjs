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
  const weaponsDir = path.join(screensDir, 'weapons');

  console.log('1. Navigating to https://localhost:5173...');
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // --- Step 1: Start PC Game & Capture 3D Starting Weapon Selection Cards ---
  console.log('Starting PC Game to capture starting weapon selection...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent && b.textContent.includes('스마트폰 없이 PC')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(1200);

  console.log('Capturing screen-13a-starting-weapon-selection.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-13a-starting-weapon-selection.png') });
  console.log('Captured screen-13a-starting-weapon-selection.png!');

  // --- Step 2: Capture Wave Clear Reward Cards (Shoot-to-Select) ---
  console.log('Spawning 3D Wave Reward Cards...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.activeTargets = [];
      eng.isWeaponSelectPending = false;
      eng.spawnWaveRewardCards(performance.now());
    }
  });
  await page.waitForTimeout(1000);
  console.log('Capturing screen-20-reward-cards-selection.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-20-reward-cards-selection.png') });
  console.log('Captured screen-20-reward-cards-selection.png!');

  // --- Step 3: Capture 3 Weapons x 4 Level Evolutions (Lv.1 ~ Lv.4 MAX) ---
  const weapons = [
    { kind: 'shotgun', nameKo: '맥주관 뚫어뻥 샷건' },
    { kind: 'revolver', nameKo: '황금 병따개 리볼버' },
    { kind: 'gatling', nameKo: '탄산 탭 개틀링' },
  ];

  for (const w of weapons) {
    for (let lv = 1; lv <= 4; lv++) {
      console.log(`Setting up ${w.kind} Lv.${lv}...`);
      await page.evaluate(([k, l]) => {
        const eng = window.__engine;
        if (eng) {
          eng.activeTargets = [];
          eng.isWeaponSelectPending = false;
          eng.isRewardCardPending = false;
          eng.weaponSystem.selectWeapon(k, l);
          eng.selectedWeaponKind = k;
          // Spawn one target in far distance to show clean aiming view
          eng.spawnSandboxTarget('obi', { radiusM: 14.0, thetaRad: 0.1, stationary: true });
        }
      }, [w.kind, lv]);

      await page.waitForTimeout(600);
      const filename = path.join(weaponsDir, `${w.kind}-lv${lv}.png`);
      await page.screenshot({ path: filename });
      console.log(`Captured ${filename}`);
    }
  }

  // --- Step 4: Capture Active Skill Action Frames with KeyR ---

  // 1. Shotgun: Plunger Storm
  console.log('Setting up Shotgun for Plunger Storm skill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.activeTargets = [];
      // Pending card flags gate shooting, skills and fever; clear them together with the cards
      eng.isWeaponSelectPending = false;
      eng.isRewardCardPending = false;
      eng.weaponSystem.selectWeapon('shotgun', 3);
      eng.weaponSystem.refillSkillInstant();
      const now = performance.now();
      eng.spawnSandboxTarget('obi', { radiusM: 9.0, thetaRad: -0.25, stationary: true });
      eng.spawnSandboxTarget('hanmac', { radiusM: 11.0, thetaRad: 0.05, stationary: true });
      eng.spawnSandboxTarget('bottle', { radiusM: 13.0, thetaRad: 0.28, stationary: true });
    }
  });
  await page.waitForTimeout(800);

  console.log('Firing Plunger Storm via KeyR...');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(120); // Golden frame while plungers are flying in parabolic arcs!
  console.log('Capturing screen-17-skill-plunger-storm.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-17-skill-plunger-storm.png') });

  // 2. Revolver: Opener Slash
  console.log('Setting up Revolver for Opener Slash skill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.activeTargets = [];
      eng.isWeaponSelectPending = false;
      eng.isRewardCardPending = false;
      eng.weaponSystem.selectWeapon('revolver', 3);
      eng.weaponSystem.refillSkillInstant();
      const now = performance.now();
      eng.spawnSandboxTarget('hanmac', { radiusM: 9.0, thetaRad: -0.15, stationary: true });
      eng.spawnSandboxTarget('bottle', { radiusM: 12.0, thetaRad: 0.1, stationary: true });
    }
  });
  await page.waitForTimeout(800);

  console.log('Firing Opener Slash via KeyR...');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(160); // Blades are mid-flight and have just reached the first monsters
  console.log('Capturing screen-18-skill-opener-slash.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-18-skill-opener-slash.png') });

  // 3. Gatling: Foam Tsunami
  console.log('Setting up Gatling for Foam Tsunami skill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.activeTargets = [];
      eng.isWeaponSelectPending = false;
      eng.isRewardCardPending = false;
      eng.weaponSystem.selectWeapon('gatling', 4);
      eng.weaponSystem.refillSkillInstant();
      const now = performance.now();
      eng.spawnSandboxTarget('boss', { radiusM: 13.0, thetaRad: 0.0, stationary: true });
      eng.spawnSandboxTarget('hanmac', { radiusM: 10.0, thetaRad: -0.3, stationary: true });
    }
  });
  await page.waitForTimeout(800);

  console.log('Firing Foam Tsunami via KeyR...');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400); // Frame while the foam wave sweeps across the field
  console.log('Capturing screen-19-skill-foam-tsunami.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-19-skill-foam-tsunami.png') });

  // 3b. Gatling foam during fever (gameplay frame)
  console.log('Firing Foam Tsunami during fever...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.weaponSystem.refillSkillInstant();
      eng.scoreManager.addFeverGauge(100);
      eng.activateFever(performance.now());
    }
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screensDir, 'play-fever-foam-tsunami.png') });

  // 4. Poop shell in flight and the boss-clear sequence (game state driven through the engine)
  console.log('Setting up a hanmac shell...');
  await page.mouse.up();
  await page.mouse.move(150, 760); // aim away so the shell is not intercepted before the shot
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.isSandboxMode = false;
      eng.startGame({ withWeaponSelect: false }); // fresh state: no fever, no leftover banners
      eng.activeTargets = [];
      eng.weaponSystem.selectWeapon('shotgun', 1);
      eng.spawnMonsterProjectile(performance.now(), 'hanmac', { thetaRad: 0.05, radiusM: 7.0 });
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(screensDir, 'play-poop-shell.png') });

  console.log('Setting up a boss kill...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.isSandboxMode = false;
      eng.startGame({ withWeaponSelect: false });
      eng.weaponSystem.selectWeapon('revolver', 1);
      eng.startWave(3);
      eng.activeTargets = [];
      eng.spawnedInWave = 999;
      eng.update(performance.now(), 0.016);
      const boss = eng.activeTargets.find((t) => t.kind === 'boss');
      if (boss) {
        boss.radiusM = 10;
        boss.x = 0;
        boss.z = -10;
        boss.thetaRad = 0;
        boss.hp = 0.1;
        const p = eng.computeTargetAimCoords(boss);
        eng.shootAt(p.targetNormX, p.targetNormY, performance.now(), 'press');
      }
    }
  });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(screensDir, 'play-boss-down.png') });

  await browser.close();
  console.log('ALL WEAPON EVOLUTIONS, SKILL ACTION FRAMES & CARD SELECTIONS CAPTURED SUCCESSFULLY!');
}

captureWeaponsAndSkills().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
