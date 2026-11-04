import { chromium } from 'playwright';

async function runPlaytest() {
  console.log('🎮 Starting Live Automated Playtest Session...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=metal'],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const metrics = {
    shotsFired: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    skillsUsed: 0,
    feversTriggered: 0,
    goldenCanKills: 0,
    projectilesIntercepted: 0,
    bossDefeated: false,
    finalScore: 0,
    maxCombo: 0,
    fpsSamples: [],
  };

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Click Start Game on PC
  console.log('1. Starting game from lobby...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent && b.textContent.includes('스마트폰 없이 PC')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(1200);

  // 2. Select Starting Weapon (Shot-to-Select: Center card or Left card)
  console.log('2. Choosing Starting Weapon: 맥주관 뚫어뻥 샷건...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng && eng.isWeaponSelectPending) {
      // Find weapon select target for shotgun
      const target = eng.activeTargets.find(t => t.weaponSelectKind === 'shotgun');
      if (target) {
        // Shoot at shotgun card
        const res = eng.shootAt(target.x / 14.0, 0.05, performance.now());
        console.log('Shotgun selected result:', res);
      }
    }
  });
  await page.waitForTimeout(1000);

  // Helper function to simulate aim and shooting
  async function aimAndShootAtTargets(durationMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      const state = await page.evaluate(() => {
        const eng = window.__engine;
        if (!eng) return null;

        // Auto target nearest non-item monster or projectile
        const targets = eng.activeTargets.filter(t => !t.isItem && !t.weaponSelectKind && !t.rewardCardKind);
        if (targets.length === 0) return { hasTarget: false };

        // Prioritize golden can, then projectile, then closest monster
        targets.sort((a, b) => {
          if (a.isGoldenCan) return -1;
          if (b.isGoldenCan) return 1;
          if (a.isProjectile) return -1;
          if (b.isProjectile) return 1;
          return a.radiusM - b.radiusM;
        });

        const chosen = targets[0];
        // Calculate aim coordinates (-1 to 1)
        const aimX = chosen.x / 14.0;
        const aimY = (chosen.customBaseY || 0.0) / 10.0;

        const now = performance.now();
        const res = eng.shootAt(aimX, aimY, now);

        return {
          hasTarget: true,
          res,
          feverReady: eng.scoreManager.getState().feverGauge >= 100,
          skillReady: eng.weaponSystem.getState().skillStock > 0,
          weaponKind: eng.weaponSystem.getState().weaponKind,
          weaponLevel: eng.weaponSystem.getState().weaponLevel,
          ammo: eng.weaponSystem.getState().currentAmmo,
          score: eng.scoreManager.getState().currentScore,
          combo: eng.scoreManager.getState().combo,
          lives: eng.lives,
        };
      });

      if (state && state.res && state.res.fired) {
        metrics.shotsFired++;
        if (state.res.grade === 'PERFECT') metrics.perfectCount++;
        else if (state.res.grade === 'GREAT') metrics.greatCount++;
        else if (state.res.grade === 'GOOD') metrics.goodCount++;
        else metrics.missCount++;

        if (state.res.goldenCanKilled) metrics.goldenCanKills++;
        if (state.res.interceptedProjectile) metrics.projectilesIntercepted++;

        // Trigger Skill if ready
        if (state.skillReady && Math.random() < 0.25) {
          await page.keyboard.press('KeyR');
          metrics.skillsUsed++;
          console.log(`[SKILL TRIGGERED] Weapon: ${state.weaponKind} Lv.${state.weaponLevel}`);
          await page.waitForTimeout(100);
        }

        // Trigger Fever if ready
        if (state.feverReady) {
          await page.keyboard.press('Space');
          metrics.feversTriggered++;
          console.log('[FEVER ACTIVATED] 4s Hyper Fever Burst Mode!');
          // Rapid fire during fever
          for (let f = 0; f < 8; f++) {
            await page.evaluate(() => {
              const eng = window.__engine;
              if (eng) eng.shootAt(0, 0.05, performance.now());
            });
            await page.waitForTimeout(60);
          }
        }
      }

      await page.waitForTimeout(140);
    }
  }

  // 3. Play Wave 1 Combat
  console.log('3. Playing Wave 1 with 🪠 맥주관 뚫어뻥 샷건...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.spawnSandboxTarget('obi', { radiusM: 10.0, thetaRad: -0.2 });
      eng.spawnSandboxTarget('caslight', { radiusM: 12.0, thetaRad: 0.15 });
      eng.spawnGoldenCanTarget(performance.now());
    }
  });
  await aimAndShootAtTargets(3500);

  // 4. Wave Clear & Reward Card Selection
  console.log('4. Wave 1 Cleared! Spawning Reward Cards...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.activeTargets = [];
      eng.spawnWaveRewardCards(performance.now());
    }
  });
  await page.waitForTimeout(600);

  // Shoot the 'weapon_level_up' card
  console.log('Selecting [무기 레벨업 (Weapon Level Up)] card...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      const card = eng.activeTargets.find(t => t.rewardCardKind === 'weapon_level_up');
      if (card) {
        eng.shootAt(card.x / 14.0, 0.05, performance.now());
      }
    }
  });
  await page.waitForTimeout(600);

  // 5. Test Revolver in Wave 2
  console.log('5. Switching to 🍾 황금 병따개 리볼버 Lv.3 for piercing test...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.weaponSystem.selectWeapon('revolver', 3);
      eng.weaponSystem.refillSkillInstant();
      const now = performance.now();
      // Spawn two lined-up enemies to test piercing shot
      eng.spawnSandboxTarget('hanmac', { radiusM: 9.0, thetaRad: 0.0 });
      eng.spawnSandboxTarget('bottle', { radiusM: 13.0, thetaRad: 0.0 });
      eng.spawnMonsterProjectile(now, 'hanmac');
    }
  });
  await aimAndShootAtTargets(3500);

  // 6. Test Gatling in Boss Wave
  console.log('6. Switching to 🍺 탄산 탭 개틀링 MAX for Boss Raid test...');
  await page.evaluate(() => {
    const eng = window.__engine;
    if (eng) {
      eng.weaponSystem.selectWeapon('gatling', 4);
      eng.weaponSystem.refillSkillInstant();
      const now = performance.now();
      eng.spawnSandboxTarget('boss', { radiusM: 14.0, thetaRad: 0.0 });
      eng.spawnMonsterProjectile(now, 'boss');
    }
  });
  await aimAndShootAtTargets(5000);

  // 7. Collect Final Engine State & Metrics
  const finalSummary = await page.evaluate(() => {
    const eng = window.__engine;
    if (!eng) return null;
    return {
      score: eng.scoreManager.getState().currentScore,
      combo: eng.scoreManager.getState().combo,
      lives: eng.lives,
      wave: eng.currentWave,
      weaponKind: eng.weaponSystem.getState().weaponKind,
      weaponLevel: eng.weaponSystem.getState().weaponLevel,
      currentAmmo: eng.weaponSystem.getState().currentAmmo,
      totalHits: eng.scoreManager.totalHits || 0,
    };
  });

  await browser.close();

  console.log('✅ Playtest Completed Successfully!');
  console.log('Final Metrics:', JSON.stringify({ metrics, finalSummary }, null, 2));
}

runPlaytest().catch(err => {
  console.error('Playtest failed:', err);
  process.exit(1);
});
