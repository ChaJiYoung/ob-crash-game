import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GunGripTracker } from '../src/controller/sensors/GunGripTracker';

describe('Gameplay Polish Quality Package (P0~P2)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
  });

  describe('D03 & D07: Reward Card Grace Period & Card Upscaling', () => {
    it('should upscale card placement to z=-5.0m and hitRadiusM to 1.75m', () => {
      engine.spawnWaveRewardCards(1000);
      expect(engine.activeTargets.length).toBe(3);

      const firstCard = engine.activeTargets[0];
      expect(firstCard.z).toBe(-5.0);
      expect(firstCard.hitRadiusM).toBe(1.75);
    });

    it('should ignore shots within 800ms grace period and accept shots after 800ms', () => {
      engine.spawnWaveRewardCards(1000);
      const card = engine.activeTargets[0];
      const proj = engine.computeTargetAimCoords(card);

      // Shot at 1400ms (400ms after spawn) -> Ignored by grace period
      const earlyShot = engine.shootAt(proj.targetNormX, proj.targetNormY, 1400);
      expect(earlyShot.fired).toBe(true);
      expect(earlyShot.selectedCard).toBeUndefined();
      expect(engine.isRewardCardPending).toBe(true);
      expect(engine.activeTargets.length).toBe(3);

      // Shot at 1850ms (850ms after spawn) -> Successfully selected
      const validShot = engine.shootAt(proj.targetNormX, proj.targetNormY, 1850);
      expect(validShot.fired).toBe(true);
      expect(validShot.selectedCard).toBeDefined();
      expect(engine.isRewardCardPending).toBe(false);
      expect(engine.currentWave).toBe(2);
    });
  });

  describe('D04: Fever Burst Instant Ammo Refill & Reload Cancel', () => {
    it('should instantly refill ammo to 100% and cancel reload when fever activates', () => {
      const weaponSystem = engine.weaponSystem;
      weaponSystem.selectWeapon('shotgun', 1);

      // Empty magazine completely
      for (let i = 0; i < 5; i++) {
        weaponSystem.consumeShot(1000 + i * 400, false);
      }

      const stateBefore = weaponSystem.getState();
      expect(stateBefore.ammo).toBe(0);
      expect(stateBefore.isReloading).toBe(true);

      // Activate Fever
      engine.scoreManager.forceSetFeverGauge(100);
      const activated = engine.activateFever(3000);
      expect(activated).toBe(true);

      const stateAfter = weaponSystem.getState();
      expect(stateAfter.ammo).toBe(stateAfter.maxAmmo);
      expect(stateAfter.isReloading).toBe(false);
    });
  });

  describe('D05: Mobile Snap Aim Tracker Lock / Freeze', () => {
    it('should lock aim on snap gesture and retain aim until unlocked', () => {
      const tracker = new GunGripTracker();
      tracker.calibrateZero({ alpha: 0, beta: 45, gamma: 0 });

      // Normal aim update
      const initialAim = tracker.computeAim({ alpha: 10, beta: 50, gamma: 0 });
      expect(tracker.isAimLocked()).toBe(false);

      // Lock aim at current orientation
      tracker.lockAim({ alpha: 10, beta: 50, gamma: 0 });
      expect(tracker.isAimLocked()).toBe(true);

      // Move phone wildly (e.g. wrist recoil flying to ceiling beta: 90)
      const recoilAim = tracker.getEffectiveAim({ alpha: 10, beta: 90, gamma: 0 });
      expect(recoilAim.isLocked).toBe(true);
      // Effective aim should still match locked aim rather than flying to ceiling
      expect(recoilAim.aim.aimY).toBeCloseTo(initialAim.aimY, 2);

      // Unlock after freeze timer expires
      tracker.unlockAim();
      expect(tracker.isAimLocked()).toBe(false);
    });
  });
});
