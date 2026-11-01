import { describe, it, expect } from 'vitest';
import {
  computeHorizontalHalfFovRad,
  sampleFanSpawnPoint,
  advanceRadialTarget,
} from '../src/pc/engine/FanSpawner';
import { evaluateHitJudgment } from '../src/pc/engine/HitJudgment';
import { ScoreAndFeverManager } from '../src/pc/engine/ScoreAndFeverManager';
import { WeaponSystem } from '../src/pc/engine/WeaponSystem';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('Core Engine: Fan Spawn, 3-Tier Judgment, Fever 100% Lock, Auto Reload', () => {
  it('should calculate horizontal FOV and sample across the fan arc', () => {
    const hHalfFov = computeHorizontalHalfFovRad(52, 16 / 9);
    expect(hHalfFov).toBeGreaterThan(0.65); // ~40+ degrees

    // Sample across fan
    const ptLeft = sampleFanSpawnPoint({
      vFovDeg: 52,
      aspect: 16 / 9,
      rng: () => 0.05, // Far left
    });
    expect(ptLeft.thetaRad).toBeLessThan(0);
    expect(ptLeft.x).toBeLessThan(0);
    expect(ptLeft.radiusM).toBe(28.0);

    const ptRight = sampleFanSpawnPoint({
      vFovDeg: 52,
      aspect: 16 / 9,
      rng: () => 0.95, // Far right
    });
    expect(ptRight.thetaRad).toBeGreaterThan(0);
    expect(ptRight.x).toBeGreaterThan(0);

    // Radial advance
    const state = advanceRadialTarget({ radiusM: 2.0, thetaRad: 0 }, 1.0, 0.5, 1.8);
    expect(state.radiusM).toBe(1.5);
    expect(state.breached).toBe(true);
  });

  it('should evaluate 3-tier hit judgment thresholds', () => {
    // hitRadiusM = 1.0
    const perfect = evaluateHitJudgment(0.12, 1.0);
    expect(perfect.grade).toBe('PERFECT');
    expect(perfect.baseScore).toBe(150);
    expect(perfect.feverDelta).toBe(30);

    const great = evaluateHitJudgment(0.35, 1.0);
    expect(great.grade).toBe('GREAT');
    expect(great.baseScore).toBe(100);
    expect(great.feverDelta).toBe(20);

    const good = evaluateHitJudgment(0.85, 1.0);
    expect(good.grade).toBe('GOOD');
    expect(good.baseScore).toBe(50);
    expect(good.feverDelta).toBe(10);

    const miss = evaluateHitJudgment(1.15, 1.0);
    expect(miss.grade).toBe('MISS');
    expect(miss.feverDelta).toBe(-5);

    // During Fever, normal hits are upgraded to PERFECT with damage 2
    const feverHit = evaluateHitJudgment(0.75, 1.0, true);
    expect(feverHit.grade).toBe('PERFECT');
    expect(feverHit.damage).toBe(2);
  });

  it('should enforce Fever 100% Lock on missed shots (D06 Anti-Regression)', () => {
    const manager = new ScoreAndFeverManager();

    // 1. Partial gauge can be penalized
    manager.registerHit('GOOD'); // +10 -> gauge 10
    expect(manager.getState().feverGauge).toBe(10);

    manager.applyMissPenalty(); // -5 -> gauge 5
    expect(manager.getState().feverGauge).toBe(5);

    // 2. Build up to 100%
    manager.registerHit('PERFECT'); // +30 -> 35
    manager.registerHit('PERFECT'); // +30 -> 65
    manager.registerHit('PERFECT'); // +30 -> 95
    manager.registerHit('PERFECT'); // +30 -> clamped at 100
    expect(manager.getState().feverGauge).toBe(100);
    expect(manager.getState().isFeverReady).toBe(true);

    // 3. CRITICAL: Once at 100%, 5 missed shots must NEVER reduce gauge!
    for (let i = 0; i < 5; i++) {
      manager.applyMissPenalty();
      expect(manager.getState().feverGauge).toBe(100);
      expect(manager.getState().isFeverReady).toBe(true);
    }

    // 4. Activate Fever
    const activated = manager.activateFever(1000);
    expect(activated).toBe(true);
    expect(manager.getState().isFeverActive).toBe(true);

    // Gauge decays over 6000ms
    manager.updateFeverTimer(4000); // 3000ms left out of 6000ms -> ~50%
    expect(manager.getState().feverGauge).toBeGreaterThan(45);
    expect(manager.getState().feverGauge).toBeLessThan(55);

    manager.updateFeverTimer(7000); // expired
    expect(manager.getState().isFeverActive).toBe(false);
    expect(manager.getState().feverGauge).toBe(0);
  });

  it('should auto reload 10 rounds after 1.2s delay without manual action', () => {
    const weapon = new WeaponSystem();
    expect(weapon.getState().ammo).toBe(10);

    let now = 1000;
    for (let i = 0; i < 9; i++) {
      const res = weapon.consumeShot(now, false);
      expect(res.fired).toBe(true);
      now += 120;
    }
    expect(weapon.getState().ammo).toBe(1);

    // 10th shot depletes magazine
    const lastShot = weapon.consumeShot(now, false);
    expect(lastShot.fired).toBe(true);
    expect(lastShot.ammo).toBe(0);
    expect(lastShot.isReloading).toBe(true);

    // Cannot fire while reloading
    now += 500;
    expect(weapon.canFire(now, false)).toBe(false);

    // After 1200ms, automatic reload completes
    now += 750; // Total 1250ms since reload start
    const updateRes = weapon.update(now, false);
    expect(updateRes.reloadedJustNow).toBe(true);
    expect(weapon.getState().ammo).toBe(10);
    expect(weapon.getState().isReloading).toBe(false);
  });

  it('should run BeerCrusherEngine game loop, wave progression, and target breaches', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();
    expect(engine.gamePhase).toBe('PLAYING');
    expect(engine.lives).toBe(3);

    let now = 1000;
    // Update to trigger initial spawn
    engine.update(now, 0.016);
    expect(engine.activeTargets.length).toBeGreaterThan(0);

    const firstTarget = engine.activeTargets[0];
    // Shoot near target
    const hHalfFov = computeHorizontalHalfFovRad(52, 16 / 9);
    const targetNormX = firstTarget.thetaRad / (hHalfFov * 0.92);

    const hitResult = engine.shootAt(targetNormX, 0, now + 150);
    expect(hitResult.fired).toBe(true);
    expect(hitResult.grade).not.toBe('MISS');

    // Test breach logic by manually placing a target at 1.7m
    engine.activeTargets.push({
      id: 'breaching_target',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 1.81,
      thetaRad: 0,
      x: 0,
      z: -1.81,
      speedMps: 5.0,
      hitRadiusM: 0.5,
      killBonusScore: 30,
      breached: false,
    });

    const breachUpdate = engine.update(now + 200, 0.1);
    expect(breachUpdate.breaches.length).toBeGreaterThan(0);
    expect(engine.lives).toBe(2);
  });
});
