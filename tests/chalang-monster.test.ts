import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import * as THREE from 'three';
import { createTargetMesh3D, updateTargetAnimation3D } from '../src/pc/three/TargetModels3D';
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
    expect(c.swimSpeedMps).toBe(1.2);
    expect(c.rushAfterAppearances).toBe(3);
    expect(c.rushSpeedMult).toBe(3);
  });

  it('orders the submerge range and keeps the teleport radius between the defense line and spawn', () => {
    const c = GAME_TUNING.monsters.chalang;
    expect(c.submergeMinMs).toBeLessThan(c.submergeMaxMs);
    expect(STAGE_CONSTANTS.SPAWN_RADIUS_M).toBeGreaterThan(STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M);
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

  it('is not targetable and does not advance radially while submerged', () => {
    const t = mkChalang(12, { submergedUntilMs: 10_000, swimDir: 1 });
    engine.activeTargets = [t];
    expect(engine.isTargetable(t, 1000)).toBe(false);
    engine.update(1000, 0.1);
    const before = t.radiusM;
    engine.update(1100, 0.1);
    engine.update(1200, 0.1);
    expect(t.radiusM).toBe(before);
    expect(t.submergedUntilMs).toBe(10_000);
  });

  it('swims sideways (theta changes) while submerged', () => {
    const t = mkChalang(12, { submergedUntilMs: 10_000, swimDir: 1, thetaRad: 0 });
    engine.activeTargets = [t];
    engine.update(1000, 0.0001);
    engine.update(1500, 0.5);
    expect(t.thetaRad).toBeGreaterThan(0);
    expect(Math.hypot(t.x, t.z)).toBeCloseTo(12, 3);
  });

  it('reverses swim direction at the edge of the visible fan', () => {
    const t = mkChalang(12, { submergedUntilMs: 10_000, swimDir: 1, thetaRad: 0 });
    engine.activeTargets = [t];
    engine.update(1000, 0.0001);
    engine.update(1100, 200); // 한 번에 시야 끝을 넘는 큰 dt
    expect(t.swimDir).toBe(-1);
    expect(Math.abs(t.thetaRad)).toBeLessThan(1.6);
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

  it('surfaces where it dove and counts one more appearance', () => {
    const t = mkChalang(12, { submergedUntilMs: 1050, thetaRad: 0.1 });
    engine.activeTargets = [t];
    engine.update(1100, 0.1);
    expect(t.appearanceCount).toBe(2);
    expect(t.submergedUntilMs).toBeUndefined();
    expect(t.surfacedUntilMs).toBeDefined();
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

describe('chalang rush and hp', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    (engine as unknown as { spawnedInWave: number }).spawnedInWave = 999;
  });

  it('starts rushing at the 3rd appearance and never submerges again', () => {
    const t = mkChalang(12, { submergedUntilMs: 1050, appearanceCount: 2 });
    engine.activeTargets = [t];
    engine.update(1100, 0.1);
    expect(t.appearanceCount).toBe(3);
    expect(t.isRushing).toBe(true);
    expect(t.submergedUntilMs).toBeUndefined();
    // 급발진 중에는 다시 물속에 들어가지 않는다
    for (let now = 1200; now <= 6000; now += 100) engine.update(now, 0.1);
    expect(t.submergedUntilMs).toBeUndefined();
  });

  it('does not rush before the 3rd appearance', () => {
    const t = mkChalang(12, { submergedUntilMs: 1050, appearanceCount: 1 });
    engine.activeTargets = [t];
    engine.update(1100, 0.1);
    expect(t.appearanceCount).toBe(2);
    expect(t.isRushing).toBeFalsy();
  });

  it('moves at rushSpeedMult times the surfaced speed while rushing', () => {
    const t = mkChalang(12, { isRushing: true, surfacedUntilMs: undefined });
    engine.activeTargets = [t];
    engine.update(1000, 0.0001);
    const before = t.radiusM;
    engine.update(1100, 0.1);
    expect(before - t.radiusM).toBeCloseTo(t.speedMps * GAME_TUNING.monsters.chalang.rushSpeedMult * 0.1, 3);
  });

  it('does not advance while stunned even when rushing', () => {
    const t = mkChalang(12, { isRushing: true, stunUntilMs: 5000 });
    engine.activeTargets = [t];
    engine.update(1000, 0.0001);
    const before = t.radiusM;
    engine.update(1100, 0.1);
    expect(t.radiusM).toBe(before);
  });

  it('takes the same skill damage rule as other monsters and never heals', () => {
    const t = mkChalang(12, { hp: 3, maxHp: 3 });
    engine.activeTargets = [t];
    (engine as unknown as { applySkillDamage: (...a: unknown[]) => boolean }).applySkillDamage(t, 1.2, 1000, 0);
    expect(t.hp).toBeCloseTo(1.8, 3);
    // 시간이 흘러도 체력은 회복되지 않는다(D10)
    for (let now = 1100; now <= 8000; now += 100) engine.update(now, 0.1);
    expect(t.hp).toBeCloseTo(1.8, 3);
  });
});

describe('chalang 3D model', () => {
  it('builds a cutout billboard body and a hidden ripple ring', () => {
    const mesh = createTargetMesh3D('chalang');
    const parts = mesh.userData.chalangParts;
    expect(parts).toBeDefined();
    expect(parts.body.name).toBe('chalangBody');
    expect((parts.body.geometry as THREE.PlaneGeometry).parameters.width).toBeCloseTo(0.85, 3);
    expect(parts.ripple.name).toBe('chalangRipple');
    expect(parts.ripple.visible).toBe(false);
    expect(parts.water.visible).toBe(false);
  });
});

describe('chalang submerged visuals', () => {
  it('sinks the cutout to a water line and shows the ripple while submerged', () => {
    const mesh = createTargetMesh3D('chalang');
    const parts = mesh.userData.chalangParts;
    for (let i = 0; i < 60; i++) updateTargetAnimation3D(mesh, 'chalang', 1 + i / 60, 1, { isSubmerged: true });
    // 물속에서는 몸체를 완전히 숨기고 물만 보인다
    expect(parts.body.visible).toBe(false);
    expect(parts.body.scale.y).toBe(1);
    expect(parts.ripple.visible).toBe(true);
    expect(parts.water.visible).toBe(true);
  });

  it('restores the surfaced look when it comes back up', () => {
    const mesh = createTargetMesh3D('chalang');
    const parts = mesh.userData.chalangParts;
    for (let i = 0; i < 60; i++) updateTargetAnimation3D(mesh, 'chalang', i / 60, 1, { isSubmerged: true });
    for (let i = 0; i < 60; i++) updateTargetAnimation3D(mesh, 'chalang', 2 + i / 60, 1, { isSubmerged: false });
    expect(parts.body.visible).toBe(true);
    expect(parts.ripple.visible).toBe(false);
    expect(parts.water.visible).toBe(false);
  });
});

describe('chalang review fixes', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    (engine as unknown as { spawnedInWave: number }).spawnedInWave = 999;
  });

  it('pausing shifts the submerge and surface timers so resume does not jump', () => {
    const t = mkChalang(12, { submergedUntilMs: 5000 });
    engine.activeTargets = [t];
    (engine as unknown as { freezeTimers: (ms: number) => void }).freezeTimers(2000);
    expect(t.submergedUntilMs).toBe(7000);
  });

  it('a stunned chalang does not start a dive', () => {
    const t = mkChalang(12, { surfacedUntilMs: 900, stunUntilMs: 5000 });
    engine.activeTargets = [t];
    engine.update(1000, 0.0001);
    expect(t.submergedUntilMs).toBeUndefined();
  });

  it('a submerged chalang takes no plunger blast damage', () => {
    const t = mkChalang(12, { submergedUntilMs: 10_000, hp: 3, plungerBlast: { damage: 2, ownerIndex: 0 } });
    engine.activeTargets = [t];
    (engine as unknown as { advancePlungerBlasts: (ms: number) => void }).advancePlungerBlasts(1000);
    expect(t.hp).toBe(3);
    expect(t.plungerBlast).toBeDefined();
  });
});
