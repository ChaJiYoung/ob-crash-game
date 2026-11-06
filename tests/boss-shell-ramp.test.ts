import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const c = GAME_TUNING.boss.shellInterval;
const interval = (e: BeerCrusherEngine, now: number): number => (e as any).getBossShellIntervalMs(now);

describe('boss shell interval shrinks the longer the boss fight lasts', () => {
  let engine: BeerCrusherEngine;
  let now: number;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.lives = engine.maxLives = 999;
    now = 100_000;
  });

  const startBoss = (wave = 3): void => {
    engine.startWave(wave);
    engine.activeTargets = [];
    (engine as any).spawnedInWave = GAME_TUNING.waves[wave - 1].totalSpawns;
    engine.update(now, 0.016);
    expect(engine.isBossEncounterActive).toBe(true);
  };

  /** Freezes everything but the bosses so a long fight never loses lives to walking monsters. */
  const step = (ms: number): void => {
    now += ms;
    engine.update(now, ms / 1000);
    engine.activeTargets.forEach((t) => {
      if (t.kind !== 'boss' && !t.isProjectile) t.speedMps = 0;
      if (t.isProjectile) t.speedMps = 0;
    });
  };

  const countShellsOver = (durationMs: number): number => {
    let shells = 0;
    const seen = new Set<string>();
    for (let t = 0; t < durationMs; t += 50) {
      step(50);
      engine.activeTargets.filter((x) => x.isProjectile && !seen.has(x.id)).forEach((x) => {
        seen.add(x.id);
        shells += 1;
      });
      engine.activeTargets = engine.activeTargets.filter((x) => !x.isProjectile);
    }
    return shells;
  };

  it('has the tuned ramp', () => {
    expect(c).toEqual({ startMs: 3500, stepMs: 500, everyMs: 15000, minMs: 1500 });
  });

  it('follows 3500 -> 3000 -> 2500 -> 2000 -> 1500 and stops at the floor', () => {
    startBoss();
    const t0 = (engine as any).bossEncounterStartMs as number;
    expect(t0).toBe(now);
    expect(interval(engine, t0)).toBe(3500);
    expect(interval(engine, t0 + 14_999)).toBe(3500);
    expect(interval(engine, t0 + 15_000)).toBe(3000);
    expect(interval(engine, t0 + 30_000)).toBe(2500);
    expect(interval(engine, t0 + 45_000)).toBe(2000);
    expect(interval(engine, t0 + 60_000)).toBe(1500);
    expect(interval(engine, t0 + 600_000)).toBe(1500);
  });

  it('a boss without a start time (not spawned through the encounter) uses the base interval', () => {
    expect(interval(engine, 999_999)).toBe(c.startMs);
  });

  it('fires more shells late in a long fight than in the first 15 seconds', () => {
    startBoss();
    const early = countShellsOver(15_000);
    now += 45_000; // jump 45s ahead so the interval is down to its floor
    (engine as any).lastBossProjectileMs = now;
    const late = countShellsOver(15_000);
    expect(late).toBeGreaterThan(early);
  });

  it('pausing does not count toward the ramp', () => {
    startBoss();
    const t0 = (engine as any).bossEncounterStartMs as number;
    step(20_000);
    const before = interval(engine, now);
    expect(before).toBe(3000);
    engine.setPaused(true, now);
    engine.setPaused(false, now + 120_000); // two minutes paused
    now += 120_000; // the game clock keeps running during the pause; only the game's own time must not
    expect((engine as any).bossEncounterStartMs).toBe(t0 + 120_000);
    expect(interval(engine, now)).toBe(before);
  });

  it('a card pick freeze does not count either', () => {
    startBoss();
    step(20_000);
    const before = interval(engine, now);
    engine.spawnWaveRewardCards(now, false);
    engine.update(now + 1, 0.001);
    now += 90_000;
    engine.update(now, 0.016); // frozen while the card is pending: the start time is pushed by the real elapsed time
    expect(interval(engine, now)).toBe(before);
  });

  it('resets when a new wave or game starts', () => {
    startBoss();
    expect((engine as any).bossEncounterStartMs).toBeGreaterThan(0);
    engine.startWave(4);
    expect((engine as any).bossEncounterStartMs).toBe(0);
    startBoss(5);
    engine.startGame({ withWeaponSelect: false });
    expect((engine as any).bossEncounterStartMs).toBe(0);
  });
});
