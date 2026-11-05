import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS, WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';

const mk = (kind: ActiveTargetEntity['kind'], radiusM: number, extra: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity => ({
  id: `${kind}_${radiusM}_${extra.thetaRad ?? 0}`, kind, hp: 99, maxHp: 99, radiusM, thetaRad: 0,
  x: 0, z: -radiusM, speedMps: 0, hitRadiusM: TARGET_SPECS[kind].hitRadiusM,
  killBonusScore: 0, breached: false, ...extra,
});

let engine: BeerCrusherEngine;
let now = 1000;
const tick = (n: number) => { for (let i = 0; i < n; i++) { now += 16; engine.update(now, 0.016); } };
const cast = (level: 1 | 2 | 3 | 4 = 1) => {
  engine.weaponSystem.selectWeapon('gatling', level);
  return engine.triggerWeaponSkill(now);
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

describe('gatling foam wave', () => {
  it('nothing changes at cast time; the wave records the level numbers', () => {
    const m = mk('hanmac', 12);
    engine.activeTargets = [m];
    const r = cast(1);
    expect(r.foamCount).toBe(GAME_TUNING.skills.foam.countByLevel[1]);
    expect(engine.activeSkillFoamWaves.length).toBe(1);
    expect(m.hp).toBe(99);
    expect(m.radiusM).toBe(12);
  });

  it('on contact: small damage, slow, and a slide back instead of a teleport', () => {
    const m = mk('hanmac', 10);
    engine.activeTargets = [m];
    cast(1);
    tick(25);
    expect(m.hp).toBeCloseTo(99 - WEAPON_ARCHETYPE_SPECS.gatling.levels[1].skillDamage, 5);
    expect(m.slowUntilMs).toBeGreaterThan(now);
    expect(m.slowRatio).toBe(WEAPON_ARCHETYPE_SPECS.gatling.levels[1].skillSlowRatio);
    expect(m.radiusM).toBeGreaterThan(10);
    expect(m.radiusM).toBeLessThan(13); // still sliding or just arrived
    tick(30);
    expect(m.radiusM).toBeCloseTo(13, 5);
  });

  it('never pulls a far monster forward and caps at the spawn radius', () => {
    const far = mk('hanmac', 22);
    engine.activeTargets = [far];
    cast(1);
    tick(80);
    expect(far.radiusM).toBeGreaterThanOrEqual(22);
    expect(far.radiusM).toBeLessThanOrEqual(24);
  });

  it('has no arc limit', () => {
    const m = mk('hanmac', 12, { thetaRad: 0.9, x: Math.sin(0.9) * 12, z: -Math.cos(0.9) * 12 });
    engine.activeTargets = [m];
    cast(1);
    tick(30);
    expect(m.hp).toBeLessThan(99);
  });

  it('a boss takes boss damage but is not pushed, slowed or slid', () => {
    const boss = mk('boss', 12, { hp: 100, maxHp: 100 });
    engine.activeTargets = [boss];
    cast(1);
    tick(30);
    expect(100 - boss.hp).toBeCloseTo(GAME_TUNING.skills.foam.bossDamageByLevel[1], 5);
    expect(boss.radiusM).toBe(12);
    expect(boss.slowUntilMs).toBeUndefined();
    expect(boss.slideRemainingM).toBeUndefined();
  });

  it('a shielded king blocks the wave', () => {
    const king = mk('boss', 12, { hp: 100, maxHp: 100, isShielded: true, bossRole: 'king' });
    engine.activeTargets = [king];
    cast(1);
    tick(30);
    expect(king.hp).toBe(100);
    expect(engine.drainSkillHitEvents().some((e) => e.target === king && e.blocked && e.source === 'foam')).toBe(true);
  });

  it('ignores shells, items, golden cans and monsters still falling in', () => {
    const shell = engine.spawnMonsterProjectile(now, 'hanmac', { thetaRad: 0, radiusM: 10 });
    const item = mk('pilgood', 10, { isItem: true });
    const can = mk('pilgood', 10, { isGoldenCan: true });
    const falling = mk('hanmac', 12, { dropLandAtMs: now + 100000 });
    engine.activeTargets = [shell, item, can, falling];
    cast(1);
    tick(40);
    expect(engine.activeTargets).toContain(shell);
    expect(item.hp).toBe(99);
    expect(can.hp).toBe(99);
    expect(falling.hp).toBe(99);
  });

  it('hits each monster once', () => {
    const m = mk('hanmac', 10);
    engine.activeTargets = [m];
    cast(1);
    tick(80);
    expect(99 - m.hp).toBeCloseTo(WEAPON_ARCHETYPE_SPECS.gatling.levels[1].skillDamage, 5);
  });

  it('the damage card raises foam damage but Lv.4 foam with +30% cannot one-shot a 1hp monster', () => {
    engine.weaponSystem.addDamageBonus(0.3);
    const m = mk('pilgood', 12, { hp: 1, maxHp: 1 });
    engine.activeTargets = [m];
    cast(4);
    tick(30);
    expect(m.hp).toBeCloseTo(1 - WEAPON_ARCHETYPE_SPECS.gatling.levels[4].skillDamage * 1.3, 3);
    expect(m.hp).toBeGreaterThan(0);
  });

  it('pierces a raised obi shield and skips cards and weapon-select targets', () => {
    const obi = mk('obi', 10, { isGuarding: true });
    const card = mk('obi', 10, { rewardCardKind: 'bar_repair' as any });
    const pick = mk('obi', 10, { weaponSelectKind: 'shotgun' as any });
    engine.activeTargets = [obi, card, pick];
    (engine as any).isRewardCardPending = false;
    cast(1);
    tick(30);
    expect(obi.hp).toBeLessThan(99);
    expect(card.hp).toBe(99);
    expect(pick.hp).toBe(99);
  });

  it('small bottles born from a foam kill are not hit again by the same wave', () => {
    const big = mk('bottle', 10, { hp: 0.1, maxHp: 4 });
    engine.activeTargets = [big];
    cast(1);
    tick(60);
    const kids = engine.activeTargets.filter((t) => t.isSplitChild);
    expect(kids.length).toBe(2);
    kids.forEach((k) => expect(k.hp).toBe(k.maxHp));
  });

  it('freezes while a card choice is pending', () => {
    const m = mk('hanmac', 12);
    engine.activeTargets = [m];
    cast(1);
    const r0 = engine.activeSkillFoamWaves[0].radiusM;
    engine.isRewardCardPending = true;
    tick(5);
    expect(engine.activeSkillFoamWaves[0].radiusM).toBe(r0);
    expect(engine.activeSkillFoamWaves[0].prevRadiusM).toBeLessThanOrEqual(r0);
  });

  it('a monster entering the field behind the wave front is not hit', () => {
    cast(2);
    tick(20);
    const late = mk('hanmac', 4);
    engine.activeTargets.push(late);
    tick(3);
    expect(late.hp).toBe(99);
  });

  it('a pushed caslight does not jump sideways while sliding', () => {
    const c = mk('caslight', 10, { initialThetaRad: 0 });
    engine.activeTargets = [c];
    tick(1); // settle the sway before measuring
    cast(1);
    let prev = c.thetaRad;
    let maxStep = 0;
    for (let i = 0; i < 40; i++) {
      tick(1);
      maxStep = Math.max(maxStep, Math.abs(c.thetaRad - prev));
      prev = c.thetaRad;
    }
    expect(maxStep).toBeLessThan(0.025);
  });
});
