import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { getCrosshairVisualSpec } from '../src/pc/components/CrosshairOverlay';

describe('Weapon Crosshair Hit Detection & Visual Alignment', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    // Clear initial wave targets for isolated tests
    engine.activeTargets = [];
  });

  it('should return distinct crosshair visual specs per weapon kind', () => {
    const shotgunSpec = getCrosshairVisualSpec({ weaponKind: 'shotgun', weaponLevel: 1 });
    expect(shotgunSpec.sizePx).toBe(120);
    expect(shotgunSpec.primaryColor).toBe('#f59e0b');

    const revolverSpec = getCrosshairVisualSpec({ weaponKind: 'revolver', weaponLevel: 1 });
    expect(revolverSpec.sizePx).toBe(76);
    expect(revolverSpec.primaryColor).toBe('#fbbf24');

    const gatlingSpec = getCrosshairVisualSpec({ weaponKind: 'gatling', weaponLevel: 1 });
    expect(gatlingSpec.sizePx).toBe(88);
    expect(gatlingSpec.primaryColor).toBe('#38bdf8');
  });

  it('should allow shotgun to hit target within 120px pellet spread circle (1.35x apparent radius)', () => {
    // Spawn single target at (0, -6)
    engine.activeTargets.push({
      id: 'target_test_shotgun',
      kind: 'obi',
      hp: 3,
      maxHp: 3,
      radiusM: 6.0,
      thetaRad: 0,
      x: 0,
      z: -6.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
    });

    const target = engine.activeTargets[0];
    const proj = engine.computeTargetAimCoords(target);

    // Aim offset by 1.35x apparentHitRadius (inside shotgun 1.40x tolerance circle).
    // Horizontal aim spans half the screen width per unit, so divide by the aspect ratio.
    const aimX = proj.targetNormX + (proj.apparentHitRadius * 1.35) / engine.aspect;
    const aimY = proj.targetNormY;

    // 1. Shotgun test -> Should HIT (effective radius is 1.40x, so 1.35x is within circle)
    engine.weaponSystem.selectWeapon('shotgun', 1);
    const shotgunShot = engine.shootAt(aimX, aimY, 1000);
    expect(shotgunShot.fired).toBe(true);
    expect(shotgunShot.grade).not.toBe('MISS');

    // 2. Revolver test at same offset -> Should MISS (effective radius is 0.95x, so 1.35x misses)
    engine.weaponSystem.selectWeapon('revolver', 1);
    const revolverShot = engine.shootAt(aimX, aimY, 2000);
    expect(revolverShot.fired).toBe(true);
    expect(revolverShot.grade).toBe('MISS');
  });

  it('should allow gatling to hit target within its tightened 1.05x spray radius (1.02x offset) and miss outside (1.12x)', () => {
    engine.activeTargets.push({
      id: 'target_test_gatling',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 7.0,
      thetaRad: 0,
      x: 0,
      z: -7.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
    });

    const target = engine.activeTargets[0];
    const proj = engine.computeTargetAimCoords(target);

    // 1. Inside tightened 1.05x tolerance (1.02x offset) -> HIT
    const insideAimX = proj.targetNormX + (proj.apparentHitRadius * 1.02) / engine.aspect;
    const aimY = proj.targetNormY;

    engine.weaponSystem.selectWeapon('gatling', 1);
    const hitShot = engine.shootAt(insideAimX, aimY, 1000);
    expect(hitShot.fired).toBe(true);
    expect(hitShot.grade).not.toBe('MISS');

    // 2. Outside 1.05x tolerance (1.12x offset) -> MISS
    const outsideAimX = proj.targetNormX + (proj.apparentHitRadius * 1.12) / engine.aspect;
    const missShot = engine.shootAt(outsideAimX, aimY, 2000);
    expect(missShot.fired).toBe(true);
    expect(missShot.grade).toBe('MISS');
  });

  it('should apply relaxed vertical tolerance (0.70x dy) for revolver sniper piercing line', () => {
    engine.activeTargets.push({
      id: 'target_test_revolver_vert',
      kind: 'hanmac',
      hp: 2,
      maxHp: 2,
      radiusM: 6.0,
      thetaRad: 0,
      x: 0,
      z: -6.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
    });

    const target = engine.activeTargets[0];
    const proj = engine.computeTargetAimCoords(target);

    // Vertical aim offset by 1.25x apparentHitRadius
    // For revolver: dy * 0.70 = 1.25 * 0.70 = 0.875 <= 0.95 * apparentHitRadius -> HITS!
    const aimX = proj.targetNormX;
    const aimY = proj.targetNormY + proj.apparentHitRadius * 1.25;

    engine.weaponSystem.selectWeapon('revolver', 1);
    const shot = engine.shootAt(aimX, aimY, 1000);
    expect(shot.fired).toBe(true);
    expect(shot.grade).not.toBe('MISS');
  });
});
