import { chromium } from 'playwright';

/**
 * Live automated playtest against `npm run dev` (https://localhost:5173).
 * Covers: starting weapon pick, wave combat, a reward card pick, weapon swaps, and the wave-7
 * boss encounter (two coolers + shielded king) through to VICTORY.
 * Shots use the engine's own aim coordinates and shot sources ('press' | 'fever'), card picks wait for the
 * 800ms input lock, and the bot avoids targets that cannot be hurt right now (raised shields).
 */

const CARD_LOCK_WAIT_MS = 900;
const BOSS_FIGHT_TIMEOUT_MS = 150_000;

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
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  const metrics = {
    shotsFired: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    shieldBlocked: 0,
    skillsUsed: 0,
    feversTriggered: 0,
    goldenCanKills: 0,
    projectilesIntercepted: 0,
    cardsPicked: 0,
    weaponSelected: null,
    bossEncounterSeen: false,
    maxBossCount: 0,
    victory: false,
  };

  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Start the game from the lobby (PC mode)
  console.log('1. Starting game from lobby...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('스마트폰 없이 PC')
    );
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.__engine && window.__engine.gamePhase === 'PLAYING', null, { timeout: 20000 });

  // One bot step, executed inside the page. Returns what happened so Node can aggregate metrics.
  const stepBot = () =>
    page.evaluate(() => {
      const eng = window.__engine;
      if (!eng) return { done: true };
      if (eng.gamePhase !== 'PLAYING') return { done: true, phase: eng.gamePhase };
      const now = performance.now();
      const out = { weaponSelected: null, cardPicked: false, skill: false, fever: false, shot: null, bossCount: 0 };

      // Card selection: wait for the input lock, then pick with a fresh press
      if (eng.isCardSelectPending) {
        if (now - eng.rewardCardsSpawnTimeMs >= 900) {
          const card = eng.activeTargets.find((t) => t.weaponSelectKind || t.rewardCardKind);
          if (card) {
            const p = eng.computeTargetAimCoords(card);
            const res = eng.shootAt(p.targetNormX, p.targetNormY, now, 'press');
            if (res.selectedWeapon) out.weaponSelected = res.selectedWeapon;
            if (res.selectedCard) out.cardPicked = true;
          }
        }
        return out;
      }

      out.bossCount = eng.getBossEntities().length;

      const fs = eng.scoreManager.getState();
      if (fs.isFeverReady && !fs.isFeverActive && eng.activateFever(now)) out.fever = true;

      const monsters = eng.activeTargets.filter((t) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.rewardCardKind);
      if (eng.weaponSystem.getState().skillStock > 0 && monsters.length >= 2 && eng.triggerWeaponSkill(now).activated) {
        out.skill = true;
      }

      // Pick the target: golden can > projectile > nearest vulnerable monster/boss
      const pool = eng.activeTargets.filter((t) => !t.isItem && !t.weaponSelectKind && !t.rewardCardKind);
      const ok = pool.filter((t) => !t.isGuarding && !t.isShielded);
      const list = ok.length ? ok : pool;
      if (list.length === 0) return out;
      list.sort((a, b) => {
        if (a.isGoldenCan !== b.isGoldenCan) return a.isGoldenCan ? -1 : 1;
        if (a.isProjectile !== b.isProjectile) return a.isProjectile ? -1 : 1;
        return a.radiusM - b.radiusM;
      });
      const chosen = list[0];
      const p = eng.computeTargetAimCoords(chosen);
      const source = eng.scoreManager.getState().isFeverActive ? 'fever' : 'press';
      out.shot = eng.shootAt(p.targetNormX, p.targetNormY, now, source);
      return out;
    });

  const record = (r) => {
    if (r.weaponSelected) metrics.weaponSelected = r.weaponSelected;
    if (r.cardPicked) metrics.cardsPicked++;
    if (r.skill) metrics.skillsUsed++;
    if (r.fever) metrics.feversTriggered++;
    if (r.bossCount > 0) metrics.bossEncounterSeen = true;
    metrics.maxBossCount = Math.max(metrics.maxBossCount, r.bossCount ?? 0);
    const s = r.shot;
    if (s && s.fired) {
      metrics.shotsFired++;
      if (s.shieldBlocked) metrics.shieldBlocked++;
      else if (s.grade === 'PERFECT') metrics.perfectCount++;
      else if (s.grade === 'GREAT') metrics.greatCount++;
      else if (s.grade === 'GOOD') metrics.goodCount++;
      else metrics.missCount++;
      if (s.goldenCanKilled) metrics.goldenCanKills++;
      if (s.interceptedProjectile) metrics.projectilesIntercepted++;
    }
  };

  async function play(durationMs, stopWhen) {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      const r = await stepBot();
      record(r);
      if (r.done) return r;
      if (stopWhen && (await page.evaluate(stopWhen))) return r;
      await page.waitForTimeout(70);
    }
    return null;
  }

  // 2. Starting weapon: the three weapon cards are up; pick the shotgun after the input lock
  console.log('2. Choosing starting weapon (shotgun card)...');
  await page.waitForTimeout(CARD_LOCK_WAIT_MS);
  await page.evaluate(() => {
    const eng = window.__engine;
    const card = eng.activeTargets.find((t) => t.weaponSelectKind === 'shotgun');
    if (card) {
      const p = eng.computeTargetAimCoords(card);
      eng.shootAt(p.targetNormX, p.targetNormY, performance.now(), 'press');
    }
  });
  await page.waitForTimeout(500);
  metrics.weaponSelected = await page.evaluate(() => window.__engine.weaponSystem.getState().weaponKind);

  // 3. Wave 1 combat with some extra targets
  console.log('3. Playing wave 1...');
  await page.evaluate(() => {
    const eng = window.__engine;
    eng.spawnSandboxTarget('obi', { radiusM: 10.0, thetaRad: -0.2 });
    eng.spawnSandboxTarget('caslight', { radiusM: 12.0, thetaRad: 0.15 });
    eng.spawnGoldenCanTarget(performance.now());
  });
  await play(8000);

  // 4. Reward cards (random draw): pick whichever card the bot finds first
  console.log('4. Spawning reward cards and picking one...');
  await page.evaluate(() => {
    const eng = window.__engine;
    eng.activeTargets = [];
    eng.spawnWaveRewardCards(performance.now(), false);
  });
  const cardsBefore = metrics.cardsPicked;
  await play(6000, () => !window.__engine.isCardSelectPending);
  console.log(`   card picked: ${metrics.cardsPicked > cardsBefore}`);

  // 5. Revolver piercing test
  console.log('5. Switching to revolver Lv.3...');
  await page.evaluate(() => {
    const eng = window.__engine;
    eng.weaponSystem.selectWeapon('revolver', 3);
    eng.weaponSystem.refillSkillInstant();
    eng.spawnSandboxTarget('hanmac', { radiusM: 9.0, thetaRad: 0.0 });
    eng.spawnSandboxTarget('bottle', { radiusM: 13.0, thetaRad: 0.0 });
    eng.spawnMonsterProjectile(performance.now(), 'hanmac');
  });
  await play(6000);

  // 6. Final boss encounter: jump to wave 7, clear the mini-wave, then beat two coolers and the king
  console.log('6. Wave 7: mini-wave, then the boss encounter with a gatling Lv.4...');
  await page.evaluate(() => {
    const eng = window.__engine;
    eng.weaponSystem.selectWeapon('gatling', 4);
    eng.weaponSystem.refillSkillInstant();
    eng.startWave(7);
    eng.activeTargets = [];
    // The bot is a smoke test, not a skill test: keep the defense line up while it learns the encounter
    eng.lives = eng.maxLives = 999;
  });
  const end = await play(BOSS_FIGHT_TIMEOUT_MS, () => window.__engine.gamePhase !== 'PLAYING');

  const finalSummary = await page.evaluate(() => {
    const eng = window.__engine;
    return {
      phase: eng.gamePhase,
      score: eng.scoreManager.getState().totalScore,
      combo: eng.scoreManager.getState().combo,
      lives: eng.lives,
      wave: eng.currentWave,
      weaponKind: eng.weaponSystem.getState().weaponKind,
      weaponLevel: eng.weaponSystem.getState().weaponLevel,
      ammo: eng.weaponSystem.getState().ammo,
    };
  });
  metrics.victory = finalSummary.phase === 'VICTORY';

  await browser.close();

  console.log('✅ Playtest finished.');
  console.log('Final Metrics:', JSON.stringify({ metrics, finalSummary, ended: end ? end.phase : 'timeout' }, null, 2));

  const problems = [];
  if (metrics.weaponSelected !== 'shotgun') problems.push('weapon card was not picked');
  if (metrics.cardsPicked < 1) problems.push('no reward card was picked');
  if (!metrics.bossEncounterSeen) problems.push('boss encounter never started');
  if (metrics.maxBossCount < 3) problems.push(`expected 3 bosses at wave 7, saw ${metrics.maxBossCount}`);
  if (!metrics.victory) problems.push('did not reach VICTORY');
  if (finalSummary.ammo === undefined || finalSummary.score === undefined) problems.push('ammo/score are undefined');
  if (problems.length) {
    console.error('❌ Playtest problems:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

runPlaytest().catch((err) => {
  console.error('Playtest failed:', err);
  process.exit(1);
});
