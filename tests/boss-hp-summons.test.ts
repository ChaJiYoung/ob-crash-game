import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING, RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

const [S1, S2, S3] = GAME_TUNING.boss.summonCountByStep;
const bosses = (e: BeerCrusherEngine) => e.activeTargets.filter((t) => t.kind === 'boss');
const minions = (e: BeerCrusherEngine) => e.activeTargets.filter((t) => t.isSummonedMinion);

function startBossWave(engine: BeerCrusherEngine, wave: number, now: number): void {
  engine.startWave(wave);
  engine.activeTargets = [];
  (engine as any).spawnedInWave = GAME_TUNING.waves[wave - 1].totalSpawns;
  engine.update(now, 0.016);
}

describe('boss minions are summoned when a boss crosses an HP threshold', () => {
  let engine: BeerCrusherEngine;
  let now: number;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    now = 100_000;
  });

  const hold = (e: BeerCrusherEngine) => bosses(e).forEach((b) => { b.speedMps = 0; b.radiusM = 10; b.z = -10; });
  const step = () => { now += 16; engine.update(now, 0.016); };

  it('has the tuned thresholds and the new boss HP', () => {
    expect(GAME_TUNING.boss.summonHpThresholds).toEqual([0.99, 0.66, 0.33]);
    expect(GAME_TUNING.boss.summonCountByStep).toEqual([4, 5, 6]);
    expect(GAME_TUNING.boss.summonCountByStep.length).toBe(GAME_TUNING.boss.summonHpThresholds.length);
    expect(RANKING_RULESET_VERSION).toBe(5);
    const hp = (w: number) => GAME_TUNING.waves[w - 1].boss!;
    expect(hp(3).coolerHp).toEqual([75]);
    expect(hp(5).coolerHp).toEqual([70, 70]);
    expect(hp(7).coolerHp).toEqual([90, 90]);
    expect(hp(7).kingHp).toBe(200);
  });

  it('summons nothing while the boss is at full HP, no matter how long the fight lasts', () => {
    startBossWave(engine, 3, now);
    hold(engine);
    for (let i = 0; i < 400; i++) step();
    expect(minions(engine).length).toBe(0);
  });

  it('summons 4, 5, 6 at 99 / 66 / 33 percent, 15 in total, and never again', () => {
    startBossWave(engine, 3, now);
    hold(engine);
    const boss = bosses(engine)[0];
    const counts: number[] = [];
    for (const ratio of [0.98, 0.65, 0.32, 0.1]) {
      boss.hp = boss.maxHp * ratio;
      step();
      counts.push(minions(engine).length);
    }
    expect(counts).toEqual([S1, S1 + S2, S1 + S2 + S3, S1 + S2 + S3]);
  });

  it('a big drop in HP summons every skipped threshold at once', () => {
    startBossWave(engine, 3, now);
    hold(engine);
    const boss = bosses(engine)[0];
    boss.hp = boss.maxHp * 0.2;
    step();
    expect(minions(engine).length).toBe(S1 + S2 + S3);
  });

  it('has no cap on the number of minions on the field', () => {
    startBossWave(engine, 3, now);
    hold(engine);
    const boss = bosses(engine)[0];
    for (const ratio of [0.98, 0.65, 0.32]) {
      boss.hp = boss.maxHp * ratio;
      step();
    }
    expect(minions(engine).length).toBeGreaterThan(7);
  });

  it('two coolers count their own thresholds', () => {
    startBossWave(engine, 5, now);
    hold(engine);
    const [a, c] = bosses(engine);
    a.hp = a.maxHp * 0.5;
    step();
    expect(minions(engine).length).toBe(S1 + S2); // a crossed 99 and 66
    c.hp = c.maxHp * 0.98;
    step();
    expect(minions(engine).length).toBe(S1 + S2 + S1); // c starts from its own first step
  });

  it('the king follows the same rule (no shield)', () => {
    startBossWave(engine, 7, now);
    hold(engine);
    const king = bosses(engine).find((b) => b.bossRole === 'king')!;
    king.hp = king.maxHp * 0.6;
    step();
    expect(minions(engine).length).toBe(S1 + S2);
  });

  it('the thresholds start over for the next boss fight', () => {
    startBossWave(engine, 3, now);
    hold(engine);
    bosses(engine)[0].hp = 1;
    step();
    startBossWave(engine, 5, now + 100_000);
    hold(engine);
    now += 100_000;
    bosses(engine)[0].hp = bosses(engine)[0].maxHp * 0.98;
    step();
    expect(minions(engine).filter((m) => m.id.startsWith('boss_minion_')).length).toBeGreaterThanOrEqual(S1);
  });
});
