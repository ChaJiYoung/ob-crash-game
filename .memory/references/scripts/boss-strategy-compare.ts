// Compares boss-fight strategies on the real engine: minions first, boss rush (ignore minions), and stalling
// (keep the boss alive and farm minions until a time limit, then finish the boss).
// Usage: npx tsx .memory/references/scripts/boss-strategy-compare.ts [games=30] [weapon|all] [strategy]
// Everything else (waves 1-2, cards, fever, skills) is played by the same accurate bot.
import { BeerCrusherEngine } from '../../../src/pc/engine/BeerCrusherEngine';

const WEAPONS = ['shotgun', 'revolver', 'gatling'] as const;
type Strategy = 'minions-first' | 'boss-rush' | 'stall';
const STRATEGIES: Strategy[] = ['minions-first', 'boss-rush', 'stall'];
const STALL_UNTIL_MS = 45_000; // keep the boss alive this long after the encounter starts, then finish it
const MAX_GAME_MS = 8 * 60 * 1000;
const N = +(process.argv[2] || 30);
const onlyWeapon = process.argv[3];
const onlyStrategy = process.argv[4];

function play(kind: (typeof WEAPONS)[number], strategy: Strategy) {
  const e: any = new BeerCrusherEngine();
  e.aspect = 16 / 9;
  e.startGame({ withWeaponSelect: false });
  e.weaponSystem.selectWeapon(kind, 1);
  const sm = e.scoreManager;
  let now = 1000, tSec = Math.random() * 6, cx = 0, cy = 0, lastTap = 0;
  const dt = 1000 / 60;
  let bossStart = 0, bossWave = 0, livesAtStart = 0;
  const bossDur: Record<number, number> = {};
  let bossLives = 0;

  while (e.gamePhase === 'PLAYING' && now < MAX_GAME_MS) {
    e.update(now, dt / 1000);
    if (e.gamePhase !== 'PLAYING') break;
    if (e.isBossEncounterActive && bossWave === 0) { bossWave = e.currentWave; bossStart = now; livesAtStart = e.lives; }
    else if (!e.isBossEncounterActive && bossWave !== 0) { bossDur[bossWave] = (now - bossStart) / 1000; bossLives += livesAtStart - e.lives; bossWave = 0; }
    if (e.isCardSelectPending) {
      const cards = e.activeTargets.filter((t: any) => t.rewardCardKind);
      if (cards.length && now - e.rewardCardsSpawnTimeMs >= 850) {
        const c = cards.find((x: any) => x.rewardCardKind === 'weapon_level_up') ?? cards[0];
        const p = e.computeTargetAimCoords(c);
        e.shootAt(p.targetNormX, p.targetNormY, now, 'press');
      }
      now += dt;
      continue;
    }
    const fs = sm.getState();
    if (fs.isFeverReady && !fs.isFeverActive) e.activateFever(now);
    const mons = e.activeTargets.filter((t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.rewardCardKind);
    if (e.weaponSystem.getState().skillStock > 0 && mons.length >= 2) e.triggerWeaponSkill(now);
    tSec += dt / 1000;

    let pool = e.activeTargets.filter((t: any) => !t.isItem && !t.rewardCardKind && !t.isGuarding && !t.isShielded && e.isTargetLanded(t, now));
    if (e.isBossEncounterActive) {
      const bosses = pool.filter((t: any) => t.kind === 'boss');
      const others = pool.filter((t: any) => t.kind !== 'boss');
      const sinceStart = now - bossStart;
      if (strategy === 'boss-rush' && bosses.length) pool = bosses;
      // Stall: farm minions (and never touch the boss) until the time limit, then finish it
      if (strategy === 'stall') pool = sinceStart < STALL_UNTIL_MS ? others : bosses.length ? bosses : pool;
    }
    if (pool.length) {
      const near = [...pool].sort((a: any, b: any) => a.radiusM - b.radiusM)[0];
      const p = e.computeTargetAimCoords(near);
      const kk = Math.min(1, (dt / 1000) * 6);
      cx += (p.targetNormX - cx) * kk;
      cy += (p.targetNormY - cy) * kk;
    }
    const fever = sm.getState().isFeverActive;
    // The stalling bot must not accidentally hit the boss: it only shoots while aiming at a minion
    const aimingAtBoss = strategy === 'stall' && e.isBossEncounterActive && now - bossStart < STALL_UNTIL_MS && pool.length === 0; // nothing to farm yet: hold fire, never touch the boss
    if (!aimingAtBoss && (fever || now - lastTap >= 150)) {
      lastTap = now;
      e.shootAt(cx + 0.02 * Math.sin(tSec * 5), cy + 0.016 * Math.sin(tSec * 7.3), now, fever ? 'fever' : 'press');
    }
    now += dt;
  }
  if (bossWave !== 0) { bossDur[bossWave] = (now - bossStart) / 1000; bossLives += livesAtStart - e.lives; }
  return { win: e.gamePhase === 'VICTORY', bossLives, bossDur, score: e.getScoreBreakdown().total, dur: now / 1000 };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number, d = 0) => (Number.isNaN(x) ? '-' : x.toFixed(d));
for (const kind of WEAPONS) {
  if (onlyWeapon && onlyWeapon !== 'all' && onlyWeapon !== kind) continue;
  for (const strategy of STRATEGIES) {
    if (onlyStrategy && onlyStrategy !== strategy) continue;
    const rs = Array.from({ length: N }, () => play(kind, strategy));
    const bd = (w: number) => f(avg(rs.filter((r) => r.bossDur[w] !== undefined).map((r) => r.bossDur[w])));
    console.log(
      `${kind.padEnd(9)}${strategy.padEnd(14)} 클리어 ${f((100 * rs.filter((r) => r.win).length) / N).padStart(3)}% | 보스전 체력손실 ${f(avg(rs.map((r) => r.bossLives)), 1)} | 보스전 ${bd(3)}/${bd(5)}/${bd(7)}s | 총 ${f(avg(rs.map((r) => r.dur)))}s | 점수 ${f(avg(rs.map((r) => r.score)))}`
    );
  }
}
