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
    expect(ptLeft.radiusM).toBe(18.0);

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

  it('should evaluate 3-tier hit judgment thresholds and buff options', () => {
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

    // Power shot buff grants damage 2 even outside fever
    const powerHit = evaluateHitJudgment(0.12, 1.0, { isPowerShotActive: true });
    expect(powerHit.grade).toBe('PERFECT');
    expect(powerHit.damage).toBe(2);

    // Wide scope buff expands effective radius by 1.6x (dist 1.2 normally MISS, now in GREAT or GOOD range)
    const wideHit = evaluateHitJudgment(1.2, 1.0, { isWideScopeActive: true });
    expect(wideHit.grade).not.toBe('MISS');
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

  it('should protect fever base combo as floor during active fever on missed shots (D02)', () => {
    const manager = new ScoreAndFeverManager();

    // 1. Build up combo to 10 and fill fever gauge to 100
    for (let i = 0; i < 10; i++) {
      manager.registerHit('PERFECT');
    }
    expect(manager.getState().combo).toBe(10);
    expect(manager.getState().isFeverReady).toBe(true);

    // 2. Activate Fever -> feverBaseCombo is snapshotted to 10
    const activated = manager.activateFever(1000);
    expect(activated).toBe(true);
    expect(manager.getState().isFeverActive).toBe(true);
    expect(manager.getState().feverBaseCombo).toBe(10);

    // 3. During fever, player fires into empty air (MISS)
    // Combo must NOT drop to 0; it must stay at or above the feverBaseCombo floor (10)
    const penalty1 = manager.applyMissPenalty();
    expect(penalty1.combo).toBe(10);
    expect(manager.getState().combo).toBe(10);

    // 4. Hit additional targets during fever -> combo increases to 12
    manager.registerHit('PERFECT');
    manager.registerHit('PERFECT');
    expect(manager.getState().combo).toBe(12);

    // 5. Another MISS during fever -> drops back to current or stays at floor (here 12 >= 10)
    const penalty2 = manager.applyMissPenalty();
    expect(penalty2.combo).toBe(12);

    // 6. Once fever expires, MISS penalty resets combo to 0
    manager.updateFeverTimer(8000); // fever expired
    expect(manager.getState().isFeverActive).toBe(false);

    const normalPenalty = manager.applyMissPenalty();
    expect(normalPenalty.combo).toBe(0);
    expect(manager.getState().combo).toBe(0);
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
    expect(engine.lives).toBe(5);

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

    // Test breach logic by manually placing a target at 1.81m
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
    expect(engine.lives).toBe(4);
  });

  it('should manage 4 item buffs, decay timers, and immunity on breach', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();
    expect(engine.lives).toBe(5);

    // Damage player by 2
    engine.lives = 3;

    let now = 1000;
    // 1. Bar repair heals +1 immediately
    engine.activateItemBuff('bar_repair', now);
    expect(engine.lives).toBe(4);
    engine.activateItemBuff('bar_repair', now);
    expect(engine.lives).toBe(5);
    engine.activateItemBuff('bar_repair', now);
    expect(engine.lives).toBe(5); // Clamped at 5

    // 2. Timed buffs (8000ms)
    engine.activateItemBuff('power_shot', now);
    engine.activateItemBuff('wide_scope', now);
    expect(engine.isBuffActive('power_shot', now)).toBe(true);
    expect(engine.isBuffActive('wide_scope', now)).toBe(true);

    const buffs = engine.getActiveBuffs(now);
    expect(buffs.length).toBe(2);

    // Check expiry after 8500ms
    expect(engine.isBuffActive('power_shot', now + 8500)).toBe(false);

    // 3. Item breach does NOT reduce lives
    engine.activeTargets.push({
      id: 'test_item_target',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 1.81,
      thetaRad: 0,
      x: 0,
      z: -1.81,
      speedMps: 5.0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
      isItem: true,
      itemKind: 'power_shot',
    });

    const breachRes = engine.update(now + 500, 0.1);
    expect(breachRes.breaches.length).toBe(0); // Not counted in breaches
    expect(engine.lives).toBe(5); // Lives intact!
    expect(engine.activeTargets.some((t) => t.id === 'test_item_target')).toBe(false);

    // 4. Shooting item target activates its buff
    const spawnedItem = engine.spawnItemTarget('ice_freeze', now + 1000);
    const hHalfFov = computeHorizontalHalfFovRad(52, 16 / 9);
    const itemNormX = spawnedItem.thetaRad / (hHalfFov * 0.92);

    const shootRes = engine.shootAt(itemNormX, 0, now + 1050);
    expect(shootRes.fired).toBe(true);
    expect(shootRes.killed).toBe(true);
    expect(shootRes.activatedItem).toBe('ice_freeze');
    expect(engine.isBuffActive('ice_freeze', now + 1050)).toBe(true);
  });

  it('should project targetNormY based on target altitude (airborne vs ground)', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();

    // 1. Airborne target (pilgood) -> higher visual center (targetNormY > 0)
    const airTarget = {
      id: 'air_1',
      kind: 'pilgood' as const,
      hp: 1,
      maxHp: 1,
      radiusM: 8.0,
      thetaRad: 0,
      x: 0,
      z: -8.0,
      speedMps: 3.0,
      hitRadiusM: 0.85,
      killBonusScore: 30,
      breached: false,
    };
    const airProj = engine.computeTargetAimCoords(airTarget);
    expect(airProj.targetNormY).toBeGreaterThan(0.05);

    // 2. Ground target (bottle) -> lower visual center (targetNormY < 0)
    const groundTarget = {
      id: 'ground_1',
      kind: 'bottle' as const,
      hp: 3,
      maxHp: 3,
      radiusM: 8.0,
      thetaRad: 0,
      x: 0,
      z: -8.0,
      speedMps: 2.0,
      hitRadiusM: 1.15,
      killBonusScore: 160,
      breached: false,
    };
    const groundProj = engine.computeTargetAimCoords(groundTarget);
    expect(groundProj.targetNormY).toBeLessThan(-0.05);

    // Direct hit test with pitch compensation
    engine.activeTargets = [airTarget];
    const airShot = engine.shootAt(0, airProj.targetNormY, 2000);
    expect(airShot.fired).toBe(true);
    expect(airShot.grade).toBe('PERFECT');

    engine.activeTargets = [groundTarget];
    const groundShot = engine.shootAt(0, groundProj.targetNormY, 2200);
    expect(groundShot.fired).toBe(true);
    expect(groundShot.grade).toBe('PERFECT');
  });
});
