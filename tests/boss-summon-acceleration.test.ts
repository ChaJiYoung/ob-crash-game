import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const { summonIntervalMs: BASE } = GAME_TUNING.boss;
const { minIntervalMs: MIN, rampMs } = GAME_TUNING.boss.summonAccel;

describe('boss summon acceleration (score-differentiation P02-T01)', () => {
  let engine: any;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
  });

  it('uses the base interval outside a boss encounter', () => {
    expect(engine.getBossSummonIntervalMs(123_456)).toBe(BASE);
  });

  it('shrinks linearly from the base interval to the minimum over the ramp', () => {
    engine.bossEncounterStartMs = 10_000;
    expect(engine.getBossSummonIntervalMs(10_000)).toBe(BASE);
    expect(engine.getBossSummonIntervalMs(10_000 + rampMs / 2)).toBe(Math.round((BASE + MIN) / 2));
    expect(engine.getBossSummonIntervalMs(10_000 + rampMs)).toBe(MIN);
    expect(engine.getBossSummonIntervalMs(10_000 + rampMs * 3)).toBe(MIN);
  });

  it('starts the ramp when the boss encounter spawns and clears it when the bosses fall', () => {
    engine.startWave(3);
    engine.update(1000, 0.016);
    engine.spawnedInWave = engine.waveDefinitions[3].totalSpawns;
    engine.activeTargets = [];
    engine.update(5000, 0.016); // mini-wave done -> boss encounter
    expect(engine.isBossEncounterActive).toBe(true);
    expect(engine.bossEncounterStartMs).toBe(5000);

    const boss = engine.getBossEntities()[0];
    engine.activeTargets = engine.activeTargets.filter((t: any) => t !== boss); // killed bosses leave the field first
    engine.handleMonsterKilled(boss, 9000);
    expect(engine.isBossEncounterActive).toBe(false);
    expect(engine.bossEncounterStartMs).toBeNull();
  });

  it('does not advance while the game clock is frozen (card selection / pause)', () => {
    engine.bossEncounterStartMs = 10_000;
    const at = 10_000 + rampMs / 2;
    const before = engine.getBossSummonIntervalMs(at);
    engine.freezeTimers(20_000);
    expect(engine.bossEncounterStartMs).toBe(30_000);
    expect(engine.getBossSummonIntervalMs(at + 20_000)).toBe(before);
  });

  it('summons faster late in the fight than early', () => {
    engine.startWave(3);
    engine.update(1000, 0.016);
    engine.spawnedInWave = engine.waveDefinitions[3].totalSpawns;
    engine.activeTargets = [];
    engine.update(5000, 0.016);
    const countMinions = () => engine.activeTargets.filter((t: any) => t.id.startsWith('boss_minion_')).length;
    for (const b of engine.getBossEntities()) { b.radiusM = 10; b.z = -10; b.x = 0; }

    // Early in the fight a summon 5s after the previous one is too soon
    engine.lastBossSummonTimeMs = 6000;
    engine.update(11_000, 0.016);
    expect(countMinions()).toBe(0);

    // 40s into the fight the same 5s gap is enough (interval is down to the minimum)
    engine.activeTargets = engine.activeTargets.filter((t: any) => !t.id.startsWith('boss_minion_'));
    for (const b of engine.getBossEntities()) { b.radiusM = 10; b.z = -10; b.x = 0; }
    engine.lastBossSummonTimeMs = 45_000 - (MIN + 100);
    engine.update(45_000, 0.016);
    expect(countMinions()).toBe(GAME_TUNING.boss.summonCount);
  });
});
