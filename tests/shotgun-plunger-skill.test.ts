import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS, WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';
import type { WeaponLevel } from '../src/shared/types';

const mk = (id: string, radiusM: number, extra: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity => ({
  id,
  kind: 'hanmac',
  hp: 99,
  maxHp: 99,
  radiusM,
  thetaRad: 0,
  x: 0,
  z: -radiusM,
  speedMps: 0,
  hitRadiusM: TARGET_SPECS.hanmac.hitRadiusM,
  killBonusScore: 10,
  breached: false,
  ...extra,
});

let engine: BeerCrusherEngine;
const NOW = 1000;

const newEngine = (playerCount: 1 | 2 = 1) => {
  const e = new BeerCrusherEngine();
  e.startGame({ withWeaponSelect: false, playerCount });
  e.startWave(6);
  (e as any).spawnedInWave = 999;
  (e as any).goldenCanSpawnedInWave = true;
  e.activeTargets = [];
  return e;
};

const castShotgun = (level: WeaponLevel, nowMs = NOW, playerIndex: 0 | 1 = 0, e: BeerCrusherEngine = engine) => {
  const ws = e.getPlayer(playerIndex).weaponSystem;
  ws.selectWeapon('shotgun', level);
  ws.refillSkillInstant(); // selectWeapon starts with 0 charges
  return e.triggerWeaponSkill(nowMs, playerIndex);
};

beforeEach(() => {
  engine = newEngine();
});

describe('plunger skill tuning', () => {
  it('the weapon table reads the skill numbers from GAME_TUNING.skills.plunger', () => {
    const p = GAME_TUNING.skills.plunger;
    ([1, 2, 3, 4] as const).forEach((l) => {
      const spec = WEAPON_ARCHETYPE_SPECS.shotgun.levels[l];
      expect(spec.skillStickMax).toBe(p.stickMaxByLevel[l]);
      expect(spec.skillStunMs).toBe(p.stunMsByLevel[l]);
      expect(spec.skillDamage).toBe(p.blastDamageByLevel[l]);
      expect(spec.skillBossDamage).toBe(p.bossDamageByLevel[l]);
      expect(spec.skillPlungerCount).toBe(p.visualCountByLevel[l]);
      expect(WEAPON_ARCHETYPE_SPECS.revolver.levels[l].skillStickMax).toBe(0);
      expect(WEAPON_ARCHETYPE_SPECS.gatling.levels[l].skillStickMax).toBe(0);
    });
    expect(p.stickMaxByLevel).toEqual({ 1: 4, 2: 5, 3: 6, 4: 8 });
    expect(p.stunMsByLevel).toEqual({ 1: 2000, 2: 2200, 3: 2500, 4: 3000 });
    expect(p.blastDamageByLevel).toEqual({ 1: 0.7, 2: 0.8, 3: 0.9, 4: 1.0 });
    expect(p.bossDamageByLevel).toEqual({ 1: 4, 2: 5, 3: 6, 4: 6 });
  });

  it('the cooldown stays on the shared table', () => {
    expect(([1, 2, 3, 4] as const).map((l) => WEAPON_ARCHETYPE_SPECS.shotgun.levels[l].skillCooldownMs)).toEqual([
      21000, 19000, 16000, 14000,
    ]);
  });
});

describe('plunger skill: stick, stun, blast', () => {
  it('sticks without any immediate damage and records stun end, blast damage and stuck count', () => {
    const m = mk('m', 10);
    engine.activeTargets = [m];
    const r = castShotgun(1);
    expect(r.activated).toBe(true);
    expect(m.hp).toBe(99);
    expect(m.stunUntilMs).toBe(NOW + 2000);
    expect(m.stuckPlungerCount).toBe(2);
    expect(m.plungerBlast).toEqual({ damage: 0.7, ownerIndex: 0 });
    expect(r.affectedTargets).toContain(m);
  });

  it('Lv1 sticks only the 4 monsters nearest to the defense line; Lv4 sticks all 7', () => {
    const make = () => [3, 4, 5, 6, 7, 8, 9].map((r) => mk(`m${r}`, r));
    let ms = make();
    engine.activeTargets = ms;
    castShotgun(1);
    expect(ms.filter((m) => m.plungerBlast).map((m) => m.radiusM)).toEqual([3, 4, 5, 6]);

    engine = newEngine();
    ms = make();
    engine.activeTargets = ms;
    castShotgun(4);
    expect(ms.every((m) => m.plungerBlast)).toBe(true);
  });

  it('blasts exactly when the stun ends: nothing just before, damage right at stun end', () => {
    const m = mk('m', 10);
    engine.activeTargets = [m];
    castShotgun(1);
    engine.update(NOW + 2000 - 1, 0.016);
    expect(m.hp).toBe(99);
    expect(m.plungerBlast).toBeDefined();
    const events: string[] = [];
    engine.addEventListener((e) => {
      if (e.type === 'plungerBlasted') events.push(e.target.id);
    });
    engine.update(NOW + 2000, 0.016);
    expect(m.hp).toBeCloseTo(99 - 0.7, 5);
    expect(m.plungerBlast).toBeUndefined();
    expect(m.stuckPlungerCount).toBe(0);
    expect(events).toEqual(['m']);
    const hits = engine.drainSkillHitEvents();
    expect(hits.some((h) => h.source === 'plunger' && h.target === m && !h.killed)).toBe(true);
  });

  it('a stuck monster does not move while stunned, and a blast kill is counted for the caster', () => {
    const m = mk('m', 10, { hp: 0.5, maxHp: 0.5, speedMps: 2 });
    engine.activeTargets = [m];
    castShotgun(1);
    engine.update(NOW + 500, 0.5);
    expect(m.radiusM).toBe(10); // 기절 중에는 이동하지 않는다
    const before = engine.getPlayer(0).totalKills;
    engine.update(NOW + 2000, 0.016);
    expect(engine.activeTargets).not.toContain(m);
    expect(engine.getPlayer(0).totalKills).toBe(before + 1);
  });

  it('killing a stuck monster by shooting plays the blast visual only and never explodes again', () => {
    // 한맥은 죽을 때 주변에 폭발 피해를 주므로 필스굿(kind pilgood)을 쓴다.
    const weak = mk('weak', 10, { kind: 'pilgood', hp: 0.2, maxHp: 0.2, hitRadiusM: TARGET_SPECS.pilgood.hitRadiusM });
    const other = mk('other', 11, { kind: 'pilgood', hitRadiusM: TARGET_SPECS.pilgood.hitRadiusM });
    engine.activeTargets = [weak, other];
    castShotgun(1);
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);
    const p = engine.computeTargetAimCoords(weak);
    engine.drainSkillHitEvents();
    engine.shootAt(p.targetNormX, p.targetNormY, NOW + 1000, 'press');
    expect(engine.activeTargets).not.toContain(weak);
    const ev = engine.drainSkillHitEvents().filter((h) => h.source === 'plunger');
    expect(ev).toHaveLength(1);
    expect(ev[0].killed).toBe(true);
    const otherHpBefore = other.hp;
    engine.update(NOW + 2500, 0.016); // other의 폭발은 정상
    expect(other.hp).toBeCloseTo(otherHpBefore - 0.7, 5);
    expect(engine.drainSkillHitEvents().filter((h) => h.target === weak)).toHaveLength(0);
  });

  it('an already stuck monster is skipped by the next cast (2-player: the other player takes the next nearest)', () => {
    const e2 = newEngine(2);
    const ms = [3, 4, 5, 6, 7, 8].map((r) => mk(`q${r}`, r));
    e2.activeTargets = ms;
    castShotgun(1, NOW, 0, e2);
    castShotgun(1, NOW + 700, 1, e2);
    expect(ms.filter((m) => m.plungerBlast?.ownerIndex === 0).map((m) => m.radiusM)).toEqual([3, 4, 5, 6]);
    expect(ms.filter((m) => m.plungerBlast?.ownerIndex === 1).map((m) => m.radiusM)).toEqual([7, 8]);
  });

  it('a boss is never stuck: it takes the immediate boss damage and does not count against the stick limit', () => {
    const boss = mk('b', 14, { kind: 'boss', hp: 100, maxHp: 100, hitRadiusM: TARGET_SPECS.boss.hitRadiusM });
    const ms = [3, 4, 5, 6, 7].map((r) => mk(`m${r}`, r));
    engine.activeTargets = [boss, ...ms];
    const r = castShotgun(1);
    expect(boss.plungerBlast).toBeUndefined();
    expect(boss.stunUntilMs).toBeUndefined();
    expect(boss.hp).toBeCloseTo(100 - 4, 5);
    expect(ms.filter((m) => m.plungerBlast)).toHaveLength(4);
    expect(r.affectedTargets).toContain(boss);
  });

  it('the damage card raises the blast damage, fixed at cast time', () => {
    const m = mk('m', 10);
    engine.activeTargets = [m];
    engine.getPlayer(0).weaponSystem.addDamageBonus(0.3);
    castShotgun(1);
    expect(m.plungerBlast?.damage).toBeCloseTo(0.7 * 1.3, 3);
  });

  it('pausing shifts the blast time: no blast at the old time, blast at the shifted time', () => {
    const m = mk('m', 10);
    engine.activeTargets = [m];
    castShotgun(1);
    const stunEnd = m.stunUntilMs!;
    (engine as any).freezeTimers(3000); // 일시정지·카드 선택 3초
    expect(m.stunUntilMs).toBe(stunEnd + 3000);
    engine.update(stunEnd + 100, 0.016);
    expect(m.hp).toBe(99);
    engine.update(stunEnd + 3000, 0.016);
    expect(m.hp).toBeCloseTo(99 - 0.7, 5);
  });

  it('an away caster still gets the blast scored to them', () => {
    const m = mk('m', 10, { hp: 0.5, maxHp: 0.5 });
    engine.activeTargets = [m];
    castShotgun(1);
    engine.getPlayer(0).isAway = true;
    const before = engine.getPlayer(0).totalKills;
    engine.update(NOW + 2000, 0.016);
    expect(engine.getPlayer(0).totalKills).toBe(before + 1);
  });
});
