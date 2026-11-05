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
  engine.weaponSystem.selectWeapon('revolver', level);
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

describe('revolver fan blades', () => {
  it('Lv.1 casts 3 blades spread over the field and damages nothing yet', () => {
    const m = mk('hanmac', 12);
    engine.activeTargets = [m];
    const r = cast(1);
    expect(r.bladeCount).toBe(3);
    expect(engine.activeSkillBlades.length).toBe(3);
    const range = engine.getSkillFanHalfRangeRad();
    const thetas = engine.activeSkillBlades.map((b) => b.thetaRad);
    expect(thetas[0]).toBeCloseTo(-range * (2 / 3), 5);
    expect(thetas[1]).toBeCloseTo(0, 5);
    expect(thetas[2]).toBeCloseTo(range * (2 / 3), 5);
    expect(m.hp).toBe(99);
    expect(m.slowUntilMs).toBeUndefined();
  });

  it('damage arrives when the blade reaches the target, not at cast time', () => {
    const m = mk('hanmac', 12);
    engine.activeTargets = [m];
    cast(1);
    tick(10);
    expect(m.hp).toBe(99);
    tick(10);
    expect(m.hp).toBeCloseTo(99 - WEAPON_ARCHETYPE_SPECS.revolver.levels[1].skillDamage, 5);
  });

  it('a target between blades is not hit', () => {
    const range = engine.getSkillFanHalfRangeRad();
    const t = range / 3;
    const m = mk('hanmac', 16, { thetaRad: t, x: Math.sin(t) * 16, z: -Math.cos(t) * 16 });
    engine.activeTargets = [m];
    cast(1);
    tick(60);
    expect(m.hp).toBe(99);
  });

  it('pierce: Lv.1 hits one, Lv.2 two, Lv.4 three along a lane', () => {
    const lane = (lv: 1 | 2 | 4) => {
      const e = new BeerCrusherEngine();
      e.startGame({ withWeaponSelect: false });
      e.startWave(6);
      (e as any).spawnedInWave = 999;
      (e as any).goldenCanSpawnedInWave = true;
      const ts = [8, 10, 12].map((r) => mk('hanmac', r));
      e.activeTargets = [...ts];
      e.weaponSystem.selectWeapon('revolver', lv);
      let t = 1000;
      e.triggerWeaponSkill(t);
      // use only the middle blade: drop the others
      e.activeSkillBlades = e.activeSkillBlades.filter((b) => Math.abs(b.thetaRad) < 1e-6);
      for (let i = 0; i < 80; i++) { t += 16; e.update(t, 0.016); }
      return ts.filter((x) => x.hp < 99).length;
    };
    expect(lane(1)).toBe(1);
    expect(lane(2)).toBe(2);
    expect(lane(4)).toBe(3);
  });

  it('several blades can hit the same close target', () => {
    const m = mk('bottle', 5);
    engine.activeTargets = [m];
    cast(4);
    tick(30);
    const dmg = WEAPON_ARCHETYPE_SPECS.revolver.levels[4].skillDamage;
    // 7 blades at Lv.4 sweep a 5m target; the lanes within the hit width all connect
    const hits = (99 - m.hp) / dmg;
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(Number.isInteger(Math.round(hits * 1000) / 1000)).toBe(true);
  });

  it('boss takes boss damage and the damage card raises it', () => {
    const boss = mk('boss', 12, { hp: 100, maxHp: 100 });
    engine.activeTargets = [boss];
    engine.weaponSystem.addDamageBonus(0.3);
    cast(1);
    engine.activeSkillBlades = engine.activeSkillBlades.filter((b) => Math.abs(b.thetaRad) < 1e-6);
    tick(40);
    expect(100 - boss.hp).toBeCloseTo(GAME_TUNING.skills.blade.bossDamageByLevel[1] * 1.3, 3);
    expect(boss.slowUntilMs).toBeUndefined();
  });

  it('cuts enemy shells without using pierce', () => {
    const shell = engine.spawnMonsterProjectile(now, 'hanmac', { thetaRad: 0, radiusM: 8 });
    const m = mk('hanmac', 10);
    engine.activeTargets = [shell, m];
    cast(1);
    engine.activeSkillBlades = engine.activeSkillBlades.filter((b) => Math.abs(b.thetaRad) < 1e-6);
    tick(40);
    expect(engine.activeTargets).not.toContain(shell);
    expect(m.hp).toBeLessThan(99);
  });

  it('pierces a raised obi shield; a shielded king blocks and takes nothing', () => {
    const obi = mk('obi', 10, { isGuarding: true });
    const king = mk('boss', 14, { isShielded: true, hp: 100, maxHp: 100, bossRole: 'king' });
    engine.activeTargets = [obi, king];
    cast(2); // pierce 1: the obi uses the first hit, the king takes the second
    engine.activeSkillBlades = engine.activeSkillBlades.filter((b) => Math.abs(b.thetaRad) < 1e-6);
    tick(40);
    expect(obi.hp).toBeLessThan(99);
    expect(king.hp).toBe(100);
    const events = engine.drainSkillHitEvents();
    expect(events.some((e) => e.target === king && e.blocked)).toBe(true);
    expect(engine.drainSkillHitEvents()).toEqual([]);
  });

  it('ignores items, golden cans, cards and monsters still falling in', () => {
    const item = mk('pilgood', 10, { isItem: true });
    const can = mk('pilgood', 10, { isGoldenCan: true });
    const falling = mk('hanmac', 12, { dropLandAtMs: now + 100000 });
    engine.activeTargets = [item, can, falling];
    cast(1);
    tick(50);
    expect(item.hp).toBe(99);
    expect(can.hp).toBe(99);
    expect(falling.hp).toBe(99);
  });

  it('freezes while a card choice is pending and is cleared by a new wave', () => {
    const m = mk('hanmac', 12);
    engine.activeTargets = [m];
    cast(1);
    const r0 = engine.activeSkillBlades[0].radiusM;
    engine.isRewardCardPending = true;
    tick(5);
    expect(engine.activeSkillBlades[0].radiusM).toBe(r0);
    engine.isRewardCardPending = false;
    engine.startWave(2);
    expect(engine.activeSkillBlades.length).toBe(0);
  });

  it('a blade kill splits a big bottle', () => {
    const b = mk('bottle', 10, { hp: 0.5, maxHp: 4 });
    engine.activeTargets = [b];
    cast(1);
    tick(40);
    expect(engine.activeTargets.filter((t) => t.isSplitChild).length).toBe(2);
  });

  it('a monster that enters a lane behind the blade front is not hit', () => {
    cast(2);
    engine.activeSkillBlades = engine.activeSkillBlades.filter((b) => Math.abs(b.thetaRad) < 1e-6);
    tick(25); // front is now around 19m
    const late = mk('hanmac', 6);
    const shell = engine.spawnMonsterProjectile(now, 'hanmac', { thetaRad: 0, radiusM: 7 });
    engine.activeTargets.push(late);
    tick(3);
    expect(late.hp).toBe(99);
    expect(engine.activeTargets).toContain(shell);
  });

  it('blades are cleared on victory, when leaving sandbox, and when the phase ends', () => {
    cast(4);
    engine.activeTargets = [mk('hanmac', 12)];
    expect(engine.activeSkillBlades.length).toBe(7);
    (engine as any).declareVictory();
    expect(engine.activeSkillBlades.length).toBe(0);

    const e2 = new BeerCrusherEngine();
    e2.startSandboxMode();
    e2.weaponSystem.selectWeapon('revolver', 4);
    e2.triggerWeaponSkill(1000);
    expect(e2.activeSkillBlades.length).toBe(7);
    e2.exitSandboxMode();
    expect(e2.activeSkillBlades.length).toBe(0);
  });

  it('killing the final boss with a blade ends the game and clears the blades', () => {
    engine.startWave(7);
    (engine as any).spawnedInWave = 999;
    (engine as any).isBossEncounterActive = true;
    const boss = mk('boss', 12, { hp: 0.5, maxHp: 50, bossRole: 'cooler' });
    engine.activeTargets = [boss];
    cast(1);
    tick(40);
    expect(engine.gamePhase).toBe('VICTORY');
    expect(engine.activeSkillBlades.length).toBe(0);
  });
});
