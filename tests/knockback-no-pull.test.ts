import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { TARGET_SPECS } from '../src/shared/constants';

const mk = (kind: ActiveTargetEntity['kind'], radiusM: number, extra: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity => ({
  id: `t_${kind}_${radiusM}`, kind, hp: 99, maxHp: 99, radiusM, thetaRad: 0,
  x: 0, z: -radiusM, speedMps: 0, hitRadiusM: TARGET_SPECS[kind].hitRadiusM,
  killBonusScore: 0, breached: false, ...extra,
});

function setup(weapon: 'shotgun' | 'gatling', level: 1 | 2 | 3 | 4) {
  const e = new BeerCrusherEngine();
  e.startGame({ withWeaponSelect: false });
  e.startWave(6);
  (e as any).spawnedInWave = 999;
  e.weaponSystem.selectWeapon(weapon, level);
  return e;
}

describe('knockback never pulls a monster toward the player', () => {
  it.each([[10, 11], [15, 16], [18, 19], [22, 23], [24, 24]])('gatling skill: %sm -> %sm', (from, to) => {
    const e = setup('gatling', 1);
    const t = mk('hanmac', from);
    e.activeTargets = [t];
    e.triggerWeaponSkill(2000);
    expect(t.radiusM).toBeCloseTo(to, 5);
    expect(t.x).toBeCloseTo(Math.sin(t.thetaRad) * t.radiusM, 5);
    expect(t.z).toBeCloseTo(-Math.cos(t.thetaRad) * t.radiusM, 5);
  });

  it.each([[10, 10.3], [22, 22.3]])('shotgun Lv.2 hit: %sm -> %sm', (from, to) => {
    const e = setup('shotgun', 2);
    const t = mk('hanmac', from);
    e.activeTargets = [t];
    const p = e.computeTargetAimCoords(t);
    e.shootAt(p.targetNormX, p.targetNormY, 2000, 'press');
    expect(t.radiusM).toBeCloseTo(to, 5);
  });

  it('a target beyond the spawn radius does not move forward', () => {
    const e = setup('gatling', 1);
    const t = mk('hanmac', 24.5);
    e.activeTargets = [t];
    e.triggerWeaponSkill(2000);
    expect(t.radiusM).toBe(24.5);
  });

  it('a pushed caslight keeps the same sway position as an unpushed one', () => {
    const run = (push: boolean) => {
      const e = setup('gatling', 4);
      const t = mk('caslight', 12, { initialThetaRad: 0 });
      e.activeTargets = [t];
      e.update(2000, 0.016);
      if (push) e.triggerWeaponSkill(2016);
      e.update(2032, 0.016);
      return t.thetaRad;
    };
    expect(Math.abs(run(true) - run(false))).toBeLessThan(0.005);
  });
});
