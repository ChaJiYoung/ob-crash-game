import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { TARGET_SPECS, STAGE_CONSTANTS } from '../src/shared/constants';
import { GAME_TUNING } from '../src/shared/gameTuning';

describe('chalang spec and tuning registration', () => {
  it('registers the chalang target spec with 3 HP', () => {
    expect(TARGET_SPECS.chalang.kind).toBe('chalang');
    expect(TARGET_SPECS.chalang.maxHp).toBe(3);
  });

  it('keeps the chalang tuning values from the decisions', () => {
    const c = GAME_TUNING.monsters.chalang;
    expect(c.submergeMinMs).toBe(1500);
    expect(c.submergeMaxMs).toBe(3000);
    expect(c.surfacedMs).toBe(1000);
    expect(c.minRadiusM).toBe(8);
    expect(c.rushAfterAppearances).toBe(3);
    expect(c.rushSpeedMult).toBe(3);
  });

  it('orders the submerge range and keeps the teleport radius between the defense line and spawn', () => {
    const c = GAME_TUNING.monsters.chalang;
    expect(c.submergeMinMs).toBeLessThan(c.submergeMaxMs);
    expect(c.minRadiusM).toBeGreaterThan(STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M);
    expect(c.minRadiusM).toBeLessThan(STAGE_CONSTANTS.SPAWN_RADIUS_M);
  });
});

const mkChalang = (radiusM: number, extra: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity => ({
  id: `chalang_${Math.random()}`,
  kind: 'chalang',
  hp: 3,
  maxHp: 3,
  radiusM,
  thetaRad: 0,
  initialThetaRad: 0,
  x: 0,
  z: -radiusM,
  speedMps: TARGET_SPECS.chalang.speedMps,
  hitRadiusM: TARGET_SPECS.chalang.hitRadiusM,
  killBonusScore: 10,
  breached: false,
  appearanceCount: 1,
  ...extra,
});

describe('chalang submerge and teleport', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    // 웨이브 스폰이 테스트 대상과 섞이지 않게 한다
    (engine as unknown as { spawnedInWave: number }).spawnedInWave = 999;
  });

  it('is not targetable and does not advance while submerged', () => {
    const t = mkChalang(12, { submergedUntilMs: 10_000 });
    engine.activeTargets = [t];
    expect(engine.isTargetable(t, 1000)).toBe(false);
    engine.update(1000, 0.1);
    const before = t.radiusM;
    engine.update(1100, 0.1);
    engine.update(1200, 0.1);
    expect(t.radiusM).toBe(before);
    expect(t.submergedUntilMs).toBe(10_000);
  });

  it('is excluded from aim candidates while submerged', () => {
    const t = mkChalang(12, { submergedUntilMs: 10_000 });
    engine.activeTargets = [t];
    const find = (engine as unknown as { findBestTarget: (...a: unknown[]) => unknown }).findBestTarget.bind(engine);
    expect(find(0, 0, 1000, () => true)).toBeUndefined();
    // 대조군: 같은 위치의 수면 위 찰랑은 후보로 잡혀야 테스트가 의미를 가진다
    t.submergedUntilMs = undefined;
    expect(find(0, 0, 1000, () => true)).toBeDefined();
  });

  it('teleports to a random spot beyond minRadiusM when the dive ends', () => {
    const t = mkChalang(12, { submergedUntilMs: 1050 });
    engine.activeTargets = [t];
    engine.update(1100, 0.1);
    expect(t.appearanceCount).toBe(2);
    expect(t.submergedUntilMs).toBeUndefined();
    expect(t.radiusM).toBeGreaterThanOrEqual(GAME_TUNING.monsters.chalang.minRadiusM);
    expect(t.radiusM).toBeLessThanOrEqual(STAGE_CONSTANTS.SPAWN_RADIUS_M + 1e-6);
  });

  it('moves forward while surfaced', () => {
    const t = mkChalang(12, { surfacedUntilMs: 5000 });
    engine.activeTargets = [t];
    engine.update(1000, 0.1);
    const before = t.radiusM;
    engine.update(1100, 0.1);
    expect(before - t.radiusM).toBeCloseTo(t.speedMps * 0.1, 3);
  });

  it('dives for submergeMinMs when the random roll is at its minimum', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const t = mkChalang(12, { surfacedUntilMs: 1050 });
      engine.activeTargets = [t];
      engine.update(1100, 0.1);
      expect(t.submergedUntilMs).toBe(1100 + GAME_TUNING.monsters.chalang.submergeMinMs);
    } finally {
      spy.mockRestore();
    }
  });
});
