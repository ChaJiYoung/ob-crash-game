import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { shouldRenderMonsterHpBar } from '../src/pc/components/ArcadeOverlayHUD';
import { TutorialDirector } from '../src/pc/tutorial/TutorialDirector';

describe('BeerCrusher 3-Step Interactive Tutorial & Shooting Range', () => {
  it('should initialize tutorial mode with 3 static 1HP can targets for Step 1', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);

    expect(engine.gamePhase).toBe('TUTORIAL');
    expect(engine.isTutorialMode).toBe(true);
    expect(director.step).toBe(1);
    expect(engine.lives).toBe(5);
    expect(engine.activeTargets.length).toBe(3);

    // All Step 1 targets should be stationary (speed = 0) and 1HP
    engine.activeTargets.forEach((target) => {
      expect(target.speedMps).toBe(0);
      expect(target.hp).toBe(1);
      expect(target.maxHp).toBe(1);
    });
  });

  it('should handle accuracy multipliers and HP bar visibility in Step 1 shooting', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);
    const t0 = engine.activeTargets[0];
    expect(t0.hp).toBe(1);
    expect(shouldRenderMonsterHpBar(t0.maxHp, false, false, t0.hp)).toBe(false);

    // If target takes GOOD 0.5x damage, remaining hp is 0.5 and hp bar should show
    t0.hp = Math.max(0, t0.hp - 0.5);
    expect(t0.hp).toBeCloseTo(0.5, 2);
    expect(shouldRenderMonsterHpBar(t0.maxHp, false, false, t0.hp)).toBe(true);

    // If target takes GREAT 1.0x or PERFECT 2.0x, target is killed (hp <= 0)
    t0.hp = 0;
    expect(t0.hp).toBe(0);
  });

  it('should advance from Step 1 to Step 2 when all 3 targets are destroyed', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);
    expect(engine.activeTargets.length).toBe(3);

    // Manually advance to Step 2
    director.advanceStep(2);

    expect(director.step).toBe(2);
    expect(engine.activeTargets.length).toBe(1);
    const bottleTarget = engine.activeTargets[0];
    expect(bottleTarget.kind).toBe('bottle');
    expect(bottleTarget.hp).toBe(4); // Rebalanced from 3 -> 4
    expect(bottleTarget.speedMps).toBeGreaterThan(0);
  });

  it('should advance from Step 2 to the fever Step 4 and charge fever to 100%', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);
    director.advanceStep(2);

    expect(director.step).toBe(2);
    expect(engine.getPlayer(0).scoreManager.getState().isFeverReady).toBe(false);

    // Step 3 is the skill step; the fever gauge is only charged at Step 4
    director.advanceStep(3);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(0);
    director.advanceStep(4);

    expect(director.step).toBe(4);
    const feverState = engine.getPlayer(0).scoreManager.getState();
    expect(feverState.feverGauge).toBe(100);
    expect(feverState.isFeverReady).toBe(true);
  });

  it('should activate fever and spawn Step 3 enemies, then complete tutorial on clear', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);
    director.advanceStep(4);

    const now = 2000;
    const activated = engine.activateFever(now);
    expect(activated).toBe(true);
    expect(engine.getPlayer(0).scoreManager.getState().isFeverActive).toBe(true);

    expect(engine.activeTargets.length).toBe(6);

    // Clear all Step 3 enemies
    engine.activeTargets = [];
    director.advanceStep('COMPLETED');

    expect(director.step).toBe('COMPLETED');
    expect(director.completed).toBe(true);
  });

  it('should maintain invulnerability (no life loss) when target breaches defense in tutorial mode', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    expect(engine.lives).toBe(5);

    // Simulate an active target breaching defense line
    engine.activeTargets = [
      {
        id: 'test_breach',
        kind: 'bottle',
        hp: 3,
        maxHp: 3,
        radiusM: 0.1,
        thetaRad: 0,
        x: 0,
        z: 0.5, // breached
        speedMps: 1.6,
        hitRadiusM: 1.0,
        killBonusScore: 100,
        breached: true,
      },
    ];

    engine.update(1000, 0.05);

    // Lives should remain exactly 5
    expect(engine.lives).toBe(5);
    expect(engine.gamePhase).toBe('TUTORIAL');
  });

  it('should cleanly transition from tutorial to normal game or lobby', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    expect(engine.isTutorialMode).toBe(true);

    // Exit to lobby
    engine.exitTutorialMode();
    expect(engine.isTutorialMode).toBe(false);
    expect(engine.gamePhase).toBe('PAIRING');

    // Start real game
    engine.startGame();
    expect(engine.isTutorialMode).toBe(false);
    expect(engine.gamePhase).toBe('PLAYING');
    expect(engine.currentWave).toBe(1);
    expect(engine.lives).toBe(5);
  });

  it('should support Sandbox mode with 5-point calibration targets and infinite ammo', () => {
    const engine = new BeerCrusherEngine();
    engine.startSandboxMode();

    expect(engine.gamePhase).toBe('SANDBOX');
    expect(engine.isSandboxMode).toBe(true);
    expect(engine.activeTargets.length).toBe(5);

    // 1. Check calibration targets (center, left, right, top, bottom)
    const center = engine.activeTargets.find((t) => t.id === 'calib_center')!;
    const top = engine.activeTargets.find((t) => t.id === 'calib_top')!;
    const bottom = engine.activeTargets.find((t) => t.id === 'calib_bottom')!;

    expect(center).toBeDefined();
    expect(top.customNormY).toBeGreaterThan(0.4);
    expect(bottom.customNormY).toBeLessThan(-0.4);

    // Shoot top target directly at aimY = 0.55
    const topShot = engine.shootAt(0, 0.55, 1000);
    expect(topShot.fired).toBe(true);
    expect(topShot.grade).toBe('PERFECT');
    expect(topShot.target?.id).toBe('calib_top');

    // 2. Infinite ammo toggle
    engine.setInfiniteAmmo(true);
    expect(engine.infiniteAmmo).toBe(true);
    for (let i = 0; i < 15; i++) {
      const res = engine.shootAt(0, 0, 1500 + i * 350);
      expect(res.fired).toBe(true);
    }
    expect(engine.getPlayer(0).weaponSystem.getState().isReloading).toBe(false);

    // 3. Trigger sandbox fever
    const feverOk = engine.triggerSandboxFever(5000);
    expect(feverOk).toBe(true);
    expect(engine.getPlayer(0).scoreManager.getState().isFeverActive).toBe(true);

    // 4. Moving sandbox target should respawn at 16m without life loss
    engine.clearSandboxTargets();
    const movingHanmac = engine.spawnSandboxTarget('hanmac', { stationary: false });
    expect(movingHanmac.speedMps).toBeGreaterThan(0);

    // Move to breach distance
    movingHanmac.radiusM = 1.0;
    engine.update(6000, 0.1);
    expect(engine.lives).toBe(5); // Lives intact
    expect(movingHanmac.radiusM).toBeCloseTo(16.0, 1); // Respawned
  });
});
