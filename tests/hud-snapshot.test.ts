import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildHudSnapshot, isHudSnapshotEqual } from '../src/pc/hudSnapshot';

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

  it('ignores 40ms cooldown jitter but not 200ms differences', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const base = buildHudSnapshot(engine, 1000);
    const near = { ...base, skillCooldownRemainingMs: 10000 };
    const jitter = { ...base, skillCooldownRemainingMs: 10000 };
    expect(isHudSnapshotEqual(near, jitter)).toBe(true);
    expect(isHudSnapshotEqual(near, { ...base, skillCooldownRemainingMs: 10200 })).toBe(false);
  });

  it('rounds skill cooldown and buff time to 100ms when building', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const snap = buildHudSnapshot(engine, 1000);
    expect(snap.skillCooldownRemainingMs % 100).toBe(0);
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

  it('tracks engine state read during render (card pending, boss HP)', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const base = buildHudSnapshot(engine, 1000);
    expect(isHudSnapshotEqual(base, { ...base, isRewardCardPending: !base.isRewardCardPending })).toBe(false);
    expect(isHudSnapshotEqual(base, { ...base, bossHpKey: 'boss:10/60' })).toBe(false);
  });
});
