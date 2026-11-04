import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildHudSnapshot, isHudSnapshotEqual, roundTo100Ms } from '../src/pc/hudSnapshot';

describe('HUD snapshot (gameplay-polish P01-T07)', () => {
  it('treats identical engine state as equal', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const a = buildHudSnapshot(engine, 1000);
    const b = buildHudSnapshot(engine, 1010);
    expect(isHudSnapshotEqual(a, b)).toBe(true);
  });

  it('detects changes in score, ammo and lives', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const base = buildHudSnapshot(engine, 1000);

    expect(isHudSnapshotEqual(base, { ...base, score: base.score + 10 })).toBe(false);
    expect(isHudSnapshotEqual(base, { ...base, ammo: base.ammo - 1 })).toBe(false);
    expect(isHudSnapshotEqual(base, { ...base, lives: base.lives - 1 })).toBe(false);
  });

  it('rounds cooldown and buff time to 100ms so 40ms jitter is ignored but 200ms is not', () => {
    expect(roundTo100Ms(10040)).toBe(roundTo100Ms(10000));
    expect(roundTo100Ms(10200)).not.toBe(roundTo100Ms(10000));
  });

  it('builds rounded cooldown and buff values from the engine', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const realGetState = engine.weaponSystem.getState.bind(engine.weaponSystem);
    engine.weaponSystem.getState = () => ({ ...realGetState(), skillCooldownRemainingMs: 12345 });
    const snap = buildHudSnapshot(engine, 1000);
    expect(snap.skillCooldownRemainingMs).toBe(12300);
  });

  it('compares nested wave progress and buffs by value', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const base = buildHudSnapshot(engine, 1000);
    const copy = {
      ...base,
      waveProgress: base.waveProgress ? { ...base.waveProgress } : undefined,
      activeBuffs: base.activeBuffs.map((b) => ({ ...b })),
    };
    expect(isHudSnapshotEqual(base, copy)).toBe(true);
    if (base.waveProgress) {
      expect(
        isHudSnapshotEqual(base, { ...base, waveProgress: { ...base.waveProgress, killedInWave: base.waveProgress.killedInWave + 1 } })
      ).toBe(false);
    }
  });

  it('reads engine state used during render (card pending, boss HP) when building', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const base = buildHudSnapshot(engine, 1000);

    engine.isRewardCardPending = true;
    const pending = buildHudSnapshot(engine, 1000);
    expect(pending.isRewardCardPending).toBe(true);
    expect(isHudSnapshotEqual(base, pending)).toBe(false);

    engine.activeTargets.push({
      id: 'boss_1', kind: 'boss', hp: 40, maxHp: 60, radiusM: 10, thetaRad: 0, x: 0, z: -10,
      speedMps: 0, hitRadiusM: 1, killBonusScore: 0, breached: false,
    } as any);
    const withBoss = buildHudSnapshot(engine, 1000);
    expect(withBoss.bossHpKey).toContain('boss_1');
    expect(isHudSnapshotEqual(pending, withBoss)).toBe(false);
  });
});
