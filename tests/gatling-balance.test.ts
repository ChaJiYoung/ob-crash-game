import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

// Scores are scaled by GAME_TUNING.score.scale (point values in comments are at scale 1.0)
const sc = (n: number) => Math.round(n * GAME_TUNING.score.scale);

describe('Gatling Gun Balance & Score Normalization', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
  });

  it('should award half base score (0.5x) for gatling hits compared to revolver', () => {
    // Spawn a high-HP target that survives multiple hits
    engine.activeTargets.push({
      id: 'target_high_hp',
      kind: 'bottle',
      hp: 10,
      maxHp: 10,
      radiusM: 6.0,
      thetaRad: 0,
      x: 0,
      z: -6.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 200,
      breached: false,
    });

    const target = engine.activeTargets[0];
    const proj = engine.computeTargetAimCoords(target);

    // 1. Gatling shot (aim dead-center => PERFECT)
    engine.getPlayer(0).weaponSystem.selectWeapon('gatling', 1);
    const gatlingShot = engine.shootAt(proj.targetNormX, proj.targetNormY, 1000);
    expect(gatlingShot.fired).toBe(true);
    expect(gatlingShot.grade).toBe('PERFECT');
    // PERFECT baseScore is 150. With 0.5x multiplier => 75
    expect(gatlingShot.earnedScore).toBe(sc(75));

    // Reset score manager for isolated revolver comparison
    engine.getPlayer(0).scoreManager.reset();

    // 2. Revolver shot (aim dead-center => PERFECT)
    engine.getPlayer(0).weaponSystem.selectWeapon('revolver', 1);
    const revolverShot = engine.shootAt(proj.targetNormX, proj.targetNormY, 2000);
    expect(revolverShot.fired).toBe(true);
    expect(revolverShot.grade).toBe('PERFECT');
    // PERFECT baseScore is 150. Full 1.0x => 150
    expect(revolverShot.earnedScore).toBe(sc(150));
  });

  it('should charge fever gauge at 0.33x rate for gatling compared to revolver', () => {
    engine.activeTargets.push({
      id: 'target_fever_test',
      kind: 'bottle',
      hp: 500,
      maxHp: 500,
      radiusM: 10.0,
      thetaRad: 0,
      x: 0,
      z: -10.0,
      speedMps: 0,
      hitRadiusM: 2.0,
      killBonusScore: 1000,
      breached: false,
    });

    const target = engine.activeTargets[0];
    const proj = engine.computeTargetAimCoords(target);

    // 1. Gatling non-kill hit: base fever delta is round(2 * 0.33) = 1
    engine.getPlayer(0).weaponSystem.selectWeapon('gatling', 1);
    engine.shootAt(proj.targetNormX, proj.targetNormY, 1000);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(1);

    // Reset score manager
    engine.getPlayer(0).scoreManager.reset();

    // 2. Revolver non-kill hit: base fever delta is 2 * 1.0 = 2
    engine.getPlayer(0).weaponSystem.selectWeapon('revolver', 1);
    engine.shootAt(proj.targetNormX, proj.targetNormY, 2000);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(2);
  });

  it('should preserve full kill bonus score when gatling kills a target', () => {
    // Target with low HP (0.2) so 0.25 gatling bullet kills it
    engine.activeTargets.push({
      id: 'target_kill',
      kind: 'pilgood',
      hp: 0.2,
      maxHp: 1.0,
      radiusM: 5.0,
      thetaRad: 0,
      x: 0,
      z: -5.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 80,
      breached: false,
    });

    const target = engine.activeTargets[0];
    const proj = engine.computeTargetAimCoords(target);

    engine.getPlayer(0).weaponSystem.selectWeapon('gatling', 1);
    const shot = engine.shootAt(proj.targetNormX, proj.targetNormY, 1000);
    expect(shot.killed).toBe(true);
    // Base PERFECT (75) + Kill Bonus (80) = 155
    expect(shot.earnedScore).toBe(sc(75) + sc(80));
  });
});
