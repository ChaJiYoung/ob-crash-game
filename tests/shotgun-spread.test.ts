import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS, WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';
import type { WeaponKind, WeaponLevel } from '../src/shared/types';

const mk = (
  kind: ActiveTargetEntity['kind'],
  thetaRad: number,
  extra: Partial<ActiveTargetEntity> = {}
): ActiveTargetEntity => {
  const radiusM = 8;
  return {
    id: `${kind}_${thetaRad}_${Math.random()}`,
    kind,
    hp: 99,
    maxHp: 99,
    radiusM,
    thetaRad,
    x: Math.sin(thetaRad) * radiusM,
    z: -Math.cos(thetaRad) * radiusM,
    speedMps: 0,
    hitRadiusM: TARGET_SPECS[kind].hitRadiusM,
    killBonusScore: 10,
    breached: false,
    ...extra,
  };
};

let engine: BeerCrusherEngine;
let now = 1000;

const selectShotgun = (level: WeaponLevel) => {
  engine.getPlayer(0).weaponSystem.selectWeapon('shotgun', level);
  engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);
};

/** 주 대상 정중앙을 쏜다(PERFECT). */
const shootCenter = (primary: ActiveTargetEntity, source: 'press' | 'hold' = 'press') => {
  const proj = engine.computeTargetAimCoords(primary);
  now += 1000;
  return engine.shootAt(proj.targetNormX, proj.targetNormY, now, source);
};

/** findBestTarget과 같은 방식의 화면 거리(조준 좌표 단위). */
const screenDist = (a: ActiveTargetEntity, b: ActiveTargetEntity) => {
  const pa = engine.computeTargetAimCoords(a);
  const pb = engine.computeTargetAimCoords(b);
  return Math.hypot((pa.targetNormX - pb.targetNormX) * engine.aspect, (pa.targetNormY - pb.targetNormY) * 0.85);
};

beforeEach(() => {
  engine = new BeerCrusherEngine();
  engine.startGame({ withWeaponSelect: false });
  engine.startWave(6);
  (engine as any).spawnedInWave = 999;
  (engine as any).goldenCanSpawnedInWave = true;
  engine.activeTargets = [];
  now = 1000;
});

describe('shotgun spread tuning', () => {
  it('pins the spread numbers and the 1.0 damage scale', () => {
    expect(GAME_TUNING.shotgunSpread.extraTargetsByLevel).toEqual({ 1: 2, 2: 2, 3: 3, 4: 3 });
    expect(GAME_TUNING.shotgunSpread.damageRatioByLevel).toEqual({ 1: 0.1, 2: 0.15, 3: 0.2, 4: 0.25 });
    expect(GAME_TUNING.shotgunSpread.radiusNorm).toBe(0.3);
    expect(GAME_TUNING.weaponDamageScale.shotgun).toBe(1.0);
  });

  it('one full hit is 1.05 / 1.60 / 2.50 / 3.60 (pellets x damage per pellet)', () => {
    const expected = { 1: 1.05, 2: 1.6, 3: 2.5, 4: 3.6 } as const;
    ([1, 2, 3, 4] as const).forEach((l) => {
      const spec = WEAPON_ARCHETYPE_SPECS.shotgun.levels[l];
      expect(spec.pelletCount * spec.damagePerHit).toBeCloseTo(expected[l], 5);
    });
  });

  it('Lv1 GREAT-or-better hit still one-shots a 1HP can (1-level one-shot rule)', () => {
    selectShotgun(1);
    const can = mk('pilgood', 0, { hp: 1, maxHp: 1 });
    engine.activeTargets = [can];
    const r = shootCenter(can);
    expect(r.killed).toBe(true);
    expect(engine.activeTargets).not.toContain(can);
  });
});

describe('shotgun spread hits', () => {
  it('Lv3 hits the primary plus 3 nearest neighbours at 20% of the primary damage (nearest first)', () => {
    selectShotgun(3);
    const primary = mk('hanmac', 0);
    const n1 = mk('hanmac', 0.04);
    const n2 = mk('hanmac', -0.07);
    const n3 = mk('hanmac', 0.1);
    const n4 = mk('hanmac', -0.13); // 4번째 후보: 마릿수 상한(3)에서 잘린다
    engine.activeTargets = [primary, n4, n3, n2, n1];
    // 배치 검증: 모두 반경 안, 거리 순서가 n1 < n2 < n3 < n4
    const d = [n1, n2, n3, n4].map((t) => screenDist(primary, t));
    d.forEach((x) => expect(x).toBeLessThanOrEqual(GAME_TUNING.shotgunSpread.radiusNorm));
    expect(d[0]).toBeLessThan(d[1]);
    expect(d[1]).toBeLessThan(d[2]);
    expect(d[2]).toBeLessThan(d[3]);

    const r = shootCenter(primary);
    expect(r.grade).toBe('PERFECT');
    const primaryDamage = 5 * 0.5 * GAME_TUNING.judgment.perfectDamage; // 5.0
    expect(primary.hp).toBeCloseTo(99 - primaryDamage, 3);
    const extra = primaryDamage * 0.2; // 1.0
    [n1, n2, n3].forEach((t) => expect(t.hp).toBeCloseTo(99 - extra, 3));
    expect(n4.hp).toBe(99);
    expect(r.hitTargets).toEqual([primary, n1, n2, n3]);
  });

  it('Lv1 hits at most 2 neighbours at 10%', () => {
    selectShotgun(1);
    const primary = mk('hanmac', 0);
    const ns = [mk('hanmac', 0.04), mk('hanmac', -0.07), mk('hanmac', 0.1)];
    engine.activeTargets = [primary, ...ns];
    shootCenter(primary);
    const primaryDamage = 3 * 0.35 * GAME_TUNING.judgment.perfectDamage;
    expect(ns[0].hp).toBeCloseTo(99 - primaryDamage * 0.1, 3);
    expect(ns[1].hp).toBeCloseTo(99 - primaryDamage * 0.1, 3);
    expect(ns[2].hp).toBe(99);
  });

  it('does not hit anything outside the spread radius', () => {
    selectShotgun(4);
    const primary = mk('hanmac', 0);
    const far = mk('hanmac', 0.9);
    engine.activeTargets = [primary, far];
    expect(screenDist(primary, far)).toBeGreaterThan(GAME_TUNING.shotgunSpread.radiusNorm);
    const r = shootCenter(primary);
    expect(far.hp).toBe(99);
    expect(r.hitTargets).toEqual([primary]);
  });

  it('skips bosses, raised shields, items and monsters that have not landed', () => {
    selectShotgun(4);
    const primary = mk('hanmac', 0);
    const boss = mk('boss', 0.04);
    const guard = mk('obi', -0.05, { isGuarding: true });
    const item = mk('pilgood', 0.07, { isItem: true, itemKind: 'power_shot' });
    const unlanded = mk('hanmac', -0.08, { dropLandAtMs: now + 60000 });
    const ok = mk('hanmac', 0.1);
    engine.activeTargets = [primary, boss, guard, item, unlanded, ok];
    shootCenter(primary);
    expect(boss.hp).toBe(99);
    expect(guard.hp).toBe(99);
    expect(item.hp).toBe(99);
    expect(unlanded.hp).toBe(99);
    expect(ok.hp).toBeLessThan(99);
  });

  it('a boss primary still spreads to ordinary neighbours, and only the primary takes the boss scale', () => {
    selectShotgun(2);
    const boss = mk('boss', 0);
    const minion = mk('hanmac', 0.05);
    engine.activeTargets = [boss, minion];
    const r = shootCenter(boss);
    expect(r.hitTargets).toEqual([boss, minion]);
    const primaryDamage = 4 * 0.4 * GAME_TUNING.judgment.perfectDamage * GAME_TUNING.boss.damageScaleByWeapon.shotgun;
    expect(boss.hp).toBeCloseTo(99 - primaryDamage, 3);
    expect(minion.hp).toBeCloseTo(99 - 4 * 0.4 * GAME_TUNING.judgment.perfectDamage * 0.15, 3);
  });

  it('no spread when the primary is an item', () => {
    selectShotgun(4);
    const item = mk('pilgood', 0, { isItem: true, itemKind: 'power_shot', hp: 1, maxHp: 1 });
    const neighbour = mk('hanmac', 0.05);
    engine.activeTargets = [item, neighbour];
    shootCenter(item);
    expect(neighbour.hp).toBe(99);
  });

  it('a killed neighbour counts as a kill and emits targetKilled', () => {
    selectShotgun(3);
    const primary = mk('hanmac', 0);
    const weak = mk('pilgood', 0.05, { hp: 1, maxHp: 1 });
    engine.activeTargets = [primary, weak];
    const killed: string[] = [];
    engine.addEventListener((e) => {
      if (e.type === 'targetKilled') killed.push(e.target.id);
    });
    const before = engine.getPlayer(0).totalKills;
    shootCenter(primary);
    // 5.0 * 0.2 = 1.0 >= 1HP
    expect(engine.activeTargets).not.toContain(weak);
    expect(killed).toContain(weak.id);
    expect(engine.getPlayer(0).totalKills).toBe(before + 1);
  });

  it('hold fire applies the 60% hold penalty to the primary and to the neighbours', () => {
    selectShotgun(3);
    const primary = mk('hanmac', 0);
    const n = mk('hanmac', 0.05);
    engine.activeTargets = [primary, n];
    shootCenter(primary, 'hold');
    const hold = GAME_TUNING.fire.holdDamageByWeapon.shotgun;
    const primaryDamage = 5 * 0.5 * GAME_TUNING.judgment.perfectDamage * hold;
    expect(primary.hp).toBeCloseTo(99 - primaryDamage, 3);
    expect(n.hp).toBeCloseTo(99 - primaryDamage * 0.2, 3);
  });

  it('a bottle that splits on death does not hit its own children in the same shot', () => {
    selectShotgun(4);
    const bottle = mk('bottle', 0, { hp: 1, maxHp: 1 });
    engine.activeTargets = [bottle];
    shootCenter(bottle);
    const children = engine.activeTargets.filter((t) => t.isSplitChild);
    expect(children.length).toBeGreaterThan(0);
    children.forEach((c) => expect(c.hp).toBe(GAME_TUNING.monsters.bottle.childHp));
  });

  it('revolver and gatling never spread', () => {
    (['revolver', 'gatling'] as WeaponKind[]).forEach((kind) => {
      engine.getPlayer(0).weaponSystem.selectWeapon(kind, 4);
      engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);
      const primary = mk('hanmac', 0);
      const n = mk('hanmac', 0.05);
      engine.activeTargets = [primary, n];
      shootCenter(primary);
      expect(n.hp).toBe(99);
    });
  });
});
