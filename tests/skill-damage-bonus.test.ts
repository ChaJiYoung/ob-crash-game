import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { REWARD_CARD_SPECS, WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';

const mk = (kind: ActiveTargetEntity['kind'], hp: number, id: string): ActiveTargetEntity => ({
  id, kind, hp, maxHp: hp, radiusM: 12, thetaRad: 0, x: 0, z: -12, speedMps: 0,
  hitRadiusM: 1, killBonusScore: 0, breached: false,
});

function setup() {
  const e = new BeerCrusherEngine();
  e.startGame({ withWeaponSelect: false });
  e.startWave(6);
  (e as any).spawnedInWave = 999;
  return e;
}

describe('the damage card applies to skill damage', () => {
  it('shotgun skill: blast 0.7 (when the stun ends) and boss 4 (immediate), raised by +30%', () => {
    const spec = WEAPON_ARCHETYPE_SPECS.shotgun.levels[1];
    const e = setup();
    e.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
    e.getPlayer(0).weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    const m = mk('hanmac', 10, 'm');
    const b = mk('boss', 100, 'b');
    e.activeTargets = [m, b];
    e.triggerWeaponSkill(1000);
    expect(m.hp).toBe(10); // 박히는 순간에는 피해가 없다
    e.update(1000 + spec.skillStunMs, 0.016); // 기절이 끝나면 터진다
    expect(m.hp).toBeCloseTo(10 - spec.skillDamage, 5);
    expect(b.hp).toBeCloseTo(100 - spec.skillBossDamage, 5);

    const e2 = setup();
    e2.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
    e2.getPlayer(0).weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    e2.getPlayer(0).weaponSystem.addDamageBonus(0.3);
    const m2 = mk('hanmac', 10, 'm');
    const b2 = mk('boss', 100, 'b');
    e2.activeTargets = [m2, b2];
    e2.triggerWeaponSkill(1000);
    e2.update(1000 + spec.skillStunMs, 0.016);
    expect(m2.hp).toBeCloseTo(10 - spec.skillDamage * 1.3, 3);
    expect(b2.hp).toBeCloseTo(100 - spec.skillBossDamage * 1.3, 3);
  });

  it('a skill kill is counted and removes the monster', () => {
    const e = setup();
    e.getPlayer(0).weaponSystem.selectWeapon('shotgun', 4);
    e.getPlayer(0).weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    const m = mk('pilgood', 0.1, 'p');
    e.activeTargets = [m];
    const before = (e as any).killedInWave;
    e.triggerWeaponSkill(1000);
    e.update(1000 + WEAPON_ARCHETYPE_SPECS.shotgun.levels[4].skillStunMs, 0.016);
    expect((e as any).killedInWave).toBe(before + 1);
    expect(e.activeTargets).not.toContain(m);
  });

  it('the card text mentions skills', () => {
    expect(REWARD_CARD_SPECS.damage_up.descriptionKo).toContain('스킬');
  });
});
