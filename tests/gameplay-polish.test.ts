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
    it('should upscale card placement to z=-3.5m and hitRadiusM to 1.75m', () => {
      engine.spawnWaveRewardCards(1000);
      expect(engine.activeTargets.length).toBe(3);

      const firstCard = engine.activeTargets[0];
      expect(firstCard.z).toBe(-3.5);
      expect(firstCard.hitRadiusM).toBe(1.75);
    });

    it('should ignore shots within 800ms grace period and accept shots after 800ms', () => {
      engine.spawnWaveRewardCards(1000);
      const card = engine.activeTargets[0];
      const proj = engine.computeTargetAimCoords(card);

      // Shot at 1400ms (400ms after spawn) -> Ignored by grace period
      const earlyShot = engine.shootAt(proj.targetNormX, proj.targetNormY, 1400);
      expect(earlyShot.fired).toBe(false);
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

  describe('T02: Kill-Gauge Reward Cards, Field Freeze & Roguelike Passives', () => {
    it('should spawn 3D cards at 10 kills in Wave 1 and freeze monsters on field', () => {
      engine.startGame({ withWeaponSelect: false });
      engine.activeTargets = [];
      engine.weaponSystem.selectWeapon('revolver', 1);
      engine.weaponSystem.setInfiniteAmmo(true);

      // Spawn 10 normal monsters and 1 extra monster that stays on field (placed at thetaRad = 0.35 outside revolver pierce cone)
      const extraMonster = engine.spawnSandboxTarget('bottle', { radiusM: 14.0, thetaRad: 0.35 });
      extraMonster.id = 'monster_survivor';
      engine.gamePhase = 'PLAYING';
      engine.isSandboxMode = false;
      engine.activeTargets = [extraMonster];

      // Simulate killing 10 monsters (Wave 1 target is 10)
      for (let i = 0; i < 10; i++) {
        const dummy = {
          id: `target_kill_${i}`,
          kind: 'pilgood' as const,
          hp: 1,
          maxHp: 1,
          radiusM: 8.0,
          thetaRad: 0,
          x: 0,
          z: -8.0,
          speedMps: 1.0,
          hitRadiusM: 1.0,
          killBonusScore: 50,
          breached: false,
        };
        engine.activeTargets.push(dummy);
        const proj = engine.computeTargetAimCoords(dummy);
        const res = engine.shootAt(proj.targetNormX, proj.targetNormY, 1000 + i * 500);
        expect(res.fired).toBe(true);
        expect(res.killed).toBe(true);
      }

      // Check that 10 kills triggered reward cards
      expect(engine.isRewardCardPending).toBe(true);
      expect(engine.pendingWaveAdvance).toBe(false);

      // The field should contain the 3 cards + the 1 surviving monster
      const cards = engine.activeTargets.filter((t) => t.rewardCardKind);
      expect(cards.length).toBe(3);
      expect(engine.activeTargets.some((t) => t.id === 'monster_survivor')).toBe(true);

      const survivorRadiusBefore = extraMonster.radiusM;
      // Advance engine by 5 seconds while cards are pending
      engine.update(10000, 5.0);

      // Field must be frozen: survivor has moved 0 meters
      expect(extraMonster.radiusM).toBe(survivorRadiusBefore);

      // Now select a card after 800ms cooldown (spawned at ~5500ms)
      const chosenCard = cards.find((c) => c.rewardCardKind === 'weapon_level_up')!;
      const cardProj = engine.computeTargetAimCoords(chosenCard);
      const cardShot = engine.shootAt(cardProj.targetNormX, cardProj.targetNormY, 12000);

      expect(cardShot.fired).toBe(true);
      expect(cardShot.selectedCard).toBe('weapon_level_up');
      expect(engine.isRewardCardPending).toBe(false);

      // The surviving monster must still be present on field and wave 1 continues
      expect(engine.activeTargets.some((t) => t.id === 'monster_survivor')).toBe(true);
      expect(engine.currentWave).toBe(1);

      // Next update should resume monster movement
      engine.update(13000, 1.0);
      expect(extraMonster.radiusM).toBeLessThan(survivorRadiusBefore);
    });

    it('should heal bar_repair reward card by 2 without raising maxLives', () => {
      engine.startGame({ withWeaponSelect: false });
      engine.lives = 2; // Damaged
      expect(engine.maxLives).toBe(5);

      engine.applyRewardCard('bar_repair', 1000);
      expect(engine.maxLives).toBe(5);
      expect(engine.lives).toBe(4);

      // Never heals past maxLives
      engine.lives = 4;
      engine.applyRewardCard('bar_repair', 1500);
      expect(engine.lives).toBe(5);

      // Normal item bar_repair only heals 1 HP up to maxLives
      engine.lives = 4;
      engine.activateItemBuff('bar_repair', 2000);
      expect(engine.lives).toBe(5);
    });

    it('should stack lucky_drop multiplier up to 4x and drop items on monster kill', () => {
      engine.startGame({ withWeaponSelect: false });
      expect(engine.getLuckyDropMultiplier()).toBe(1);

      engine.applyRewardCard('lucky_drop', 1000);
      expect(engine.getLuckyDropMultiplier()).toBe(2);

      engine.applyRewardCard('lucky_drop', 2000);
      expect(engine.getLuckyDropMultiplier()).toBe(3);

      engine.applyRewardCard('lucky_drop', 3000);
      expect(engine.getLuckyDropMultiplier()).toBe(4);

      // Cannot exceed 4x
      engine.applyRewardCard('lucky_drop', 4000);
      expect(engine.getLuckyDropMultiplier()).toBe(4);

      // Test drop probability with deterministic RNG
      // At 4x multiplier: dropProb = 0.04 * 4 = 0.16
      // Inject RNG returning 0.10 (< 0.16 -> drop item!)
      engine.dropRng = () => 0.10;
      const target = {
        id: 'test_drop_target',
        kind: 'pilgood' as const,
        hp: 1,
        maxHp: 1,
        radiusM: 10.0,
        thetaRad: 0.1,
        x: Math.sin(0.1) * 10,
        z: -Math.cos(0.1) * 10,
        speedMps: 1.0,
        hitRadiusM: 1.0,
        killBonusScore: 50,
        breached: false,
      };
      engine.activeTargets = [target];
      const proj = engine.computeTargetAimCoords(target);
      engine.shootAt(proj.targetNormX, proj.targetNormY, 5000);

      const items = engine.activeTargets.filter((t) => t.isItem);
      expect(items.length).toBe(1);
      expect(items[0].thetaRad).toBeCloseTo(0.1, 2);
    });
  });

  describe('T02: Wave 5 Cooler Boss 10m Stop, Minion Summons & Instant Victory', () => {
    it('should clamp cooler boss at 10.0m and summon minion wave on tap lever action', () => {
      engine.startGame({ withWeaponSelect: false });
      engine.startWave(5);
      engine.activeTargets = [];

      // Spawn boss at 11.0m
      const boss = {
        id: 'boss_unit',
        kind: 'boss' as const,
        hp: 50,
        maxHp: 50,
        radiusM: 11.0,
        thetaRad: 0,
        x: 0,
        z: -11.0,
        speedMps: 2.0,
        hitRadiusM: 2.5,
        killBonusScore: 5000,
        breached: false,
      };
      // Mark bossSpawned true
      // @ts-expect-error accessing private property for test setup
      engine.bossSpawned = true;
      engine.activeTargets = [boss];

      // Update by 2 seconds: speed is 2.0m/s so it would reach 7.0m, but clamped to 10.0m!
      engine.update(1000, 2.0);
      expect(boss.radiusM).toBe(10.0);
      expect(boss.breached).toBe(false);
      expect(engine.lives).toBe(5); // Defense line unharmed!

      // Boss summon action should have triggered since boss.radiusM <= 12.5 and lastBossSummonTimeMs was 0
      expect(engine.isBossSummoning(1500)).toBe(true);
      const minions = engine.activeTargets.filter((t) => t.id.startsWith('boss_minion_'));
      expect(minions.length).toBe(4);
    });

    it('should trigger instant victory and clear all entities when boss is killed', () => {
      engine.startGame({ withWeaponSelect: false });
      engine.startWave(5);
      engine.weaponSystem.selectWeapon('revolver', 1);

      const boss = {
        id: 'boss_unit',
        kind: 'boss' as const,
        hp: 1, // 1 HP left
        maxHp: 50,
        radiusM: 10.0,
        thetaRad: 0,
        x: 0,
        z: -10.0,
        speedMps: 0,
        hitRadiusM: 2.5,
        killBonusScore: 5000,
        breached: false,
      };
      const minion = {
        id: 'minion_remaining',
        kind: 'caslight' as const,
        hp: 10,
        maxHp: 10,
        radiusM: 8.0,
        thetaRad: 0.2,
        x: 1,
        z: -8,
        speedMps: 1.0,
        hitRadiusM: 1.0,
        killBonusScore: 50,
        breached: false,
      };
      engine.activeTargets = [boss, minion];

      const proj = engine.computeTargetAimCoords(boss);
      const killShot = engine.shootAt(proj.targetNormX, proj.targetNormY, 5000);

      expect(killShot.fired).toBe(true);
      expect(killShot.killed).toBe(true);
      expect(engine.gamePhase).toBe('VICTORY');
      // All remaining minions and projectiles cleared
      expect(engine.activeTargets.length).toBe(0);
    });
  });
});
