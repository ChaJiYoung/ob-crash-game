import { describe, it, expect } from 'vitest';
import {
  computeHorizontalHalfFovRad,
  sampleFanSpawnPoint,
  advanceRadialTarget,
} from '../src/pc/engine/FanSpawner';
import { evaluateHitJudgment } from '../src/pc/engine/HitJudgment';
import { ScoreAndFeverManager } from '../src/pc/engine/ScoreAndFeverManager';
import { WeaponSystem } from '../src/pc/engine/WeaponSystem';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { STAGE_CONSTANTS } from '../src/shared/constants';

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
    expect(ptLeft.radiusM).toBe(STAGE_CONSTANTS.SPAWN_RADIUS_M); // 24.0m rebalanced

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
    expect(perfect.feverDelta).toBe(10);

    const great = evaluateHitJudgment(0.35, 1.0);
    expect(great.grade).toBe('GREAT');
    expect(great.baseScore).toBe(100);
    expect(great.feverDelta).toBe(6);

    // Rebalanced D03: relaxed PERFECT tolerance (up to 0.25)
    const relaxedPerfect = evaluateHitJudgment(0.22, 1.0);
    expect(relaxedPerfect.grade).toBe('PERFECT');

    // Rebalanced D03: relaxed GREAT tolerance (up to 0.55)
    const relaxedGreat = evaluateHitJudgment(0.50, 1.0);
    expect(relaxedGreat.grade).toBe('GREAT');

    const good = evaluateHitJudgment(0.85, 1.0);
    expect(good.grade).toBe('GOOD');
    expect(good.baseScore).toBe(50);
    expect(good.feverDelta).toBe(3);

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
    manager.registerHit('GOOD'); // +3 -> gauge 3
    expect(manager.getState().feverGauge).toBe(3);

    manager.applyMissPenalty(); // -5 -> gauge clamped at 0
    expect(manager.getState().feverGauge).toBe(0);

    // 2. Build up to 100% with 10 PERFECT hits (+10 each)
    for (let i = 0; i < 10; i++) {
      manager.registerHit('PERFECT');
    }
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

    // Gauge decays over 4000ms (D04)
    manager.updateFeverTimer(3000); // 2000ms left out of 4000ms -> 50%
    expect(manager.getState().feverGauge).toBeGreaterThan(45);
    expect(manager.getState().feverGauge).toBeLessThan(55);

    manager.updateFeverTimer(5500); // expired (> 5000ms)
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
    manager.updateFeverTimer(5500); // fever expired (> 5000ms)
    expect(manager.getState().isFeverActive).toBe(false);

    const normalPenalty = manager.applyMissPenalty();
    expect(normalPenalty.combo).toBe(0);
    expect(manager.getState().combo).toBe(0);
  });

  it('should protect combo when fever gauge is 100% full (feverReady) even before activation', () => {
    const manager = new ScoreAndFeverManager();
    for (let i = 0; i < 10; i++) {
      manager.registerHit('PERFECT');
    }
    expect(manager.getState().combo).toBe(10);
    expect(manager.getState().isFeverReady).toBe(true);

    // Missed shot right before double-tap fever activation must NOT reset combo!
    manager.applyMissPenalty();
    expect(manager.getState().combo).toBe(10);

    const activated = manager.activateFever(1000);
    expect(activated).toBe(true);
    expect(manager.getState().feverBaseCombo).toBe(10);
  });

  it('should auto reload magazine rounds after auto reload delay without manual action', () => {
    const weapon = new WeaponSystem('shotgun', 1);
    const maxAmmo = weapon.getMaxAmmo();
    expect(weapon.getState().ammo).toBe(maxAmmo);

    let now = 1000;
    for (let i = 0; i < maxAmmo - 1; i++) {
      const res = weapon.consumeShot(now, false);
      expect(res.fired).toBe(true);
      now += 350;
    }
    expect(weapon.getState().ammo).toBe(1);

    // Last shot depletes magazine
    const lastShot = weapon.consumeShot(now, false);
    expect(lastShot.fired).toBe(true);
    expect(lastShot.ammo).toBe(0);
    expect(lastShot.isReloading).toBe(true);

    // Cannot fire while reloading
    now += 500;
    expect(weapon.canFire(now, false)).toBe(false);

    // After reload duration (1400ms for Lv.1 shotgun), automatic reload completes
    now += 1000; // Total 1500ms since reload start > 1400ms
    const updateRes = weapon.update(now, false);
    expect(updateRes.reloadedJustNow).toBe(true);
    expect(weapon.getState().ammo).toBe(maxAmmo);
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
      hp: 4,
      maxHp: 4,
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
    const groundShot = engine.shootAt(0, groundProj.targetNormY, 2400);
    expect(groundShot.fired).toBe(true);
    expect(groundShot.grade).toBe('PERFECT');

    // 3. Distant 24m target hitbox floor test (D03)
    const distantTarget = {
      id: 'distant_1',
      kind: 'pilgood' as const,
      hp: 1,
      maxHp: 1,
      radiusM: 24.0,
      thetaRad: 0,
      x: 0,
      z: -24.0,
      speedMps: 2.6,
      hitRadiusM: 0.85,
      killBonusScore: 30,
      breached: false,
    };
    const distantProj = engine.computeTargetAimCoords(distantTarget);
    expect(distantProj.apparentHitRadius).toBeGreaterThanOrEqual(0.14);

    // 4. Exact 3D camera projection 1:1 hit verification on angled target
    const angledTarget = {
      id: 'angled_1',
      kind: 'bottle' as const,
      hp: 4,
      maxHp: 4,
      radiusM: 14.0,
      thetaRad: 0.30,
      x: 14.0 * Math.sin(0.30),
      z: -14.0 * Math.cos(0.30),
      speedMps: 1.5,
      hitRadiusM: 1.15,
      killBonusScore: 160,
      breached: false,
    };
    const angledProj = engine.computeTargetAimCoords(angledTarget);
    engine.activeTargets = [angledTarget];
    const exactShot = engine.shootAt(angledProj.targetNormX, angledProj.targetNormY, 2800);
    expect(exactShot.fired).toBe(true);
    expect(exactShot.grade).toBe('PERFECT');
    expect(exactShot.errorRatio).toBeLessThan(0.05);
  });

  it('should freeze monster movement, spawns, fever/buff timers when paused and time-shift upon unpause (D03)', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();

    // 1. Setup target, fever, and buff
    const now = 1000;
    engine.scoreManager.forceSetFeverGauge(100);
    engine.scoreManager.activateFever(now); // 5000ms duration, ends at 6000
    engine.activateItemBuff('wide_scope', now); // 6000ms duration, ends at 7000

    const target = {
      id: 'target_pause_test',
      kind: 'caslight' as const,
      hp: 1,
      maxHp: 1,
      radiusM: 10.0,
      thetaRad: 0,
      x: 0,
      z: -10.0,
      speedMps: 2.0,
      hitRadiusM: 0.9,
      killBonusScore: 50,
      breached: false,
    };
    engine.activeTargets = [target];

    // 2. Pause the engine at now = 2000 (after 1000ms of game time)
    engine.update(2000, 1.0);
    expect(target.radiusM).toBe(8.0); // 10.0 - 2.0 * 1.0 = 8.0

    engine.setPaused(true, 2000);
    expect(engine.isPaused).toBe(true);

    // 3. During pause, update does not move targets or expire fever/buffs
    const updateResult = engine.update(10000, 8.0); // 8 seconds of wall time passes
    expect(updateResult.breaches).toHaveLength(0);
    expect(target.radiusM).toBe(8.0); // frozen!

    // Firing during pause is blocked
    const pausedShot = engine.shootAt(0, 0, 10000);
    expect(pausedShot.fired).toBe(false);

    // 4. Unpause after 8000ms pause (now = 10000)
    engine.setPaused(false, 10000);
    expect(engine.isPaused).toBe(false);

    // Fever had 3000ms remaining when paused (5000 - 2000 = 3000).
    // After unpausing at 10000, feverEndTimeMs should be 5000 + 8000 = 13000!
    // At now = 12000 (2s after unpause), fever and wide_scope must STILL be active!
    engine.update(12000, 2.0);
    expect(engine.scoreManager.getState().isFeverActive).toBe(true);
    expect(engine.isBuffActive('wide_scope', 12000)).toBe(true);
    // Target moved another 2.0s * 2.0m/s = 4.0m -> radius is 4.0m
    expect(target.radiusM).toBe(4.0);

    // At now = 14000: fever is expired (> 13000), but wide_scope (ends at 17000) is still active!
    engine.update(14000, 2.0);
    expect(engine.scoreManager.getState().isFeverActive).toBe(false);
    expect(engine.isBuffActive('wide_scope', 14000)).toBe(true);

    // At now = 18000, wide_scope is also expired (> 17000)
    engine.update(18000, 4.0);
    expect(engine.isBuffActive('wide_scope', 18000)).toBe(false);
  });

  it('should support 3-weapon ballistics (shotgun pellets/knockback, revolver pierce, gatling rapid)', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();

    // 1. Shotgun Lv.2: 4 pellets * 0.40 = 1.60 DMG + 0.3m knockback
    engine.weaponSystem.selectWeapon('shotgun', 2);
    const sgTarget = {
      id: 'sg_dummy',
      kind: 'bottle' as const,
      hp: 4.0,
      maxHp: 4.0,
      radiusM: 8.0,
      thetaRad: 0,
      x: 0,
      z: -8.0,
      speedMps: 1.5,
      hitRadiusM: 1.15,
      killBonusScore: 160,
      breached: false,
    };
    engine.activeTargets = [sgTarget];
    const projSg = engine.computeTargetAimCoords(sgTarget);

    const shot1 = engine.shootAt(projSg.targetNormX, projSg.targetNormY, 1000);
    expect(shot1.fired).toBe(true);
    expect(shot1.grade).toBe('PERFECT');
    expect(sgTarget.hp).toBe(2.4); // 4.0 - 1.6 = 2.4
    expect(sgTarget.radiusM).toBeCloseTo(8.3, 1); // 0.3m knockback!

    // 2. Revolver Lv.1: 0.75 DMG + pierces 1 rear target at 0.35 DMG
    engine.weaponSystem.selectWeapon('revolver', 1);
    const revFront = {
      id: 'rev_front',
      kind: 'bottle' as const,
      hp: 4.0,
      maxHp: 4.0,
      radiusM: 6.0,
      thetaRad: 0,
      x: 0,
      z: -6.0,
      speedMps: 1.5,
      hitRadiusM: 1.15,
      killBonusScore: 160,
      breached: false,
    };
    const revRear = {
      id: 'rev_rear',
      kind: 'hanmac' as const,
      hp: 3.0,
      maxHp: 3.0,
      radiusM: 9.0, // Behind revFront
      thetaRad: 0,
      x: 0,
      z: -9.0,
      speedMps: 2.0,
      hitRadiusM: 0.95,
      killBonusScore: 90,
      breached: false,
    };
    engine.activeTargets = [revFront, revRear];
    const projRev = engine.computeTargetAimCoords(revFront);

    const shot2 = engine.shootAt(projRev.targetNormX, projRev.targetNormY, 2000);
    expect(shot2.fired).toBe(true);
    expect(shot2.hitTargets?.length).toBe(2);
    expect(revFront.hp).toBe(3.25); // 4.0 - 0.75 = 3.25
    expect(revRear.hp).toBe(2.65); // 3.0 - (0.75 * 0.467 = 0.35) = 2.65

    // 3. Gatling Lv.1: 0.15 DMG rapid fire
    engine.weaponSystem.selectWeapon('gatling', 1);
    const gatTarget = {
      id: 'gat_dummy',
      kind: 'obi' as const,
      hp: 2.0,
      maxHp: 2.0,
      radiusM: 7.0,
      thetaRad: 0,
      x: 0,
      z: -7.0,
      speedMps: 1.9,
      hitRadiusM: 0.95,
      killBonusScore: 70,
      breached: false,
    };
    engine.activeTargets = [gatTarget];
    const projGat = engine.computeTargetAimCoords(gatTarget);

    const shot3 = engine.shootAt(projGat.targetNormX, projGat.targetNormY, 3000);
    expect(shot3.fired).toBe(true);
    expect(gatTarget.hp).toBe(1.85); // 2.0 - 0.15 = 1.85
  });

  it('should execute 3 distinct active skills (Plunger Storm stun, Opener slow, Foam Tsunami knockback)', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();

    const m1: ActiveTargetEntity = {
      id: 'm1',
      kind: 'bottle' as const,
      hp: 4.0,
      maxHp: 4.0,
      radiusM: 7.0,
      thetaRad: 0,
      x: 0,
      z: -7.0,
      speedMps: 1.5,
      hitRadiusM: 1.15,
      killBonusScore: 160,
      breached: false,
    };
    const m2: ActiveTargetEntity = {
      id: 'm2',
      kind: 'hanmac' as const,
      hp: 3.0,
      maxHp: 3.0,
      radiusM: 8.0,
      thetaRad: 0.2,
      x: Math.sin(0.2) * 8.0,
      z: -Math.cos(0.2) * 8.0,
      speedMps: 2.0,
      hitRadiusM: 0.95,
      killBonusScore: 90,
      breached: false,
    };
    engine.activeTargets = [m1, m2];

    // 1. Shotgun skill: 사방 뚫어뻥 폭풍 (AoE 0.5 DMG + 1000ms Stun)
    engine.weaponSystem.selectWeapon('shotgun', 1);
    const sgSkill = engine.triggerWeaponSkill(1000);
    expect(sgSkill.activated).toBe(true);
    expect(sgSkill.weaponKind).toBe('shotgun');
    expect(m1.hp).toBe(3.5); // 4.0 - 0.5
    expect(m1.stunUntilMs).toBe(2000); // 1000 + 1000ms stun
    expect(m1.stuckPlungerCount).toBe(2);

    // Stunned target has 0 movement speed during update
    engine.update(1500, 0.5);
    expect(m1.radiusM).toBe(7.0); // No movement!

    // 2. Revolver skill: 오프너 불릿 타임 & 참격 (AoE 0.6 DMG + 3500ms 40% Slow)
    engine.weaponSystem.selectWeapon('revolver', 1);
    const revSkill = engine.triggerWeaponSkill(3000);
    expect(revSkill.activated).toBe(true);
    expect(m2.slowUntilMs).toBe(6500); // 3000 + 3500ms slow
    expect(m2.slowRatio).toBe(0.40);

    // 3. Gatling skill: 거품 해일 160도 오버히트 (AoE 0.4 DMG + 1.0m Knockback)
    engine.weaponSystem.selectWeapon('gatling', 1);
    const initialRadius = m1.radiusM;
    const gatSkill = engine.triggerWeaponSkill(5000);
    expect(gatSkill.activated).toBe(true);
    expect(m1.radiusM).toBe(initialRadius + 1.0); // 1.0m knockback!
  });

  it('should handle Shoot-to-Select Weapon & Reward Cards, Golden Can and Projectile Interception', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame();

    // 1. Weapon selection targets
    engine.spawnWeaponSelectTargets();
    expect(engine.isWeaponSelectPending).toBe(true);
    expect(engine.activeTargets.length).toBe(3);

    const gatTarget = engine.activeTargets.find((t) => t.weaponSelectKind === 'gatling')!;
    expect(gatTarget).toBeDefined();

    const projGat = engine.computeTargetAimCoords(gatTarget);
    const selectShot = engine.shootAt(projGat.targetNormX, projGat.targetNormY, 1000);
    expect(selectShot.fired).toBe(true);
    expect(selectShot.selectedWeapon).toBe('gatling');
    expect(engine.weaponSystem.getState().weaponKind).toBe('gatling');
    expect(engine.isWeaponSelectPending).toBe(false);
    expect(engine.activeTargets.length).toBe(0);

    // 2. Reward Card selection targets
    engine.spawnWaveRewardCards(2000);
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.activeTargets.length).toBe(3);

    const lvlUpCard = engine.activeTargets.find((t) => t.rewardCardKind === 'weapon_level_up')!;
    const projCard = engine.computeTargetAimCoords(lvlUpCard);
    const cardShot = engine.shootAt(projCard.targetNormX, projCard.targetNormY, 2100);
    expect(cardShot.fired).toBe(true);
    expect(cardShot.selectedCard).toBe('weapon_level_up');
    expect(engine.weaponSystem.getState().weaponLevel).toBe(2); // Upgraded!
    expect(engine.isRewardCardPending).toBe(false);
    expect(engine.currentWave).toBe(2); // Advanced to wave 2!

    // 3. Golden Can Bonus
    const goldenCan = engine.spawnGoldenCanTarget(3000);
    expect(goldenCan.isGoldenCan).toBe(true);
    const projGold = engine.computeTargetAimCoords(goldenCan);
    const goldShot = engine.shootAt(projGold.targetNormX, projGold.targetNormY, 3100);
    expect(goldShot.fired).toBe(true);
    expect(goldShot.goldenCanKilled).toBe(true);
    expect(engine.scoreManager.getState().isFeverReady).toBe(true); // Full fever!
    expect(engine.weaponSystem.getState().skillStock).toBe(engine.weaponSystem.getMaxSkillStock()); // Full skill!

    // 4. Projectile Interception
    const proj = engine.spawnMonsterProjectile(4000, 'hanmac');
    expect(proj.isProjectile).toBe(true);
    const projAim = engine.computeTargetAimCoords(proj);
    const interceptShot = engine.shootAt(projAim.targetNormX, projAim.targetNormY, 4100);
    expect(interceptShot.fired).toBe(true);
    expect(interceptShot.interceptedProjectile).toBe(true);
    expect(interceptShot.killed).toBe(true);
  });
});
