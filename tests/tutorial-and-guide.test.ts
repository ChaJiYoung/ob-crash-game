import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('BeerCrusher 3-Step Interactive Tutorial & Shooting Range', () => {
  it('should initialize tutorial mode with 3 static 1HP can targets for Step 1', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();

    expect(engine.gamePhase).toBe('TUTORIAL');
    expect(engine.isTutorialMode).toBe(true);
    expect(engine.tutorialStep).toBe(1);
    expect(engine.lives).toBe(5);
    expect(engine.activeTargets.length).toBe(3);

    // All Step 1 targets should be stationary (speed = 0) and 1HP
    engine.activeTargets.forEach((target) => {
      expect(target.speedMps).toBe(0);
      expect(target.hp).toBe(1);
      expect(target.maxHp).toBe(1);
    });
  });

  it('should advance from Step 1 to Step 2 when all 3 targets are destroyed', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    expect(engine.activeTargets.length).toBe(3);

    // Manually advance to Step 2
    engine.advanceTutorialStep(2);

    expect(engine.tutorialStep).toBe(2);
    expect(engine.activeTargets.length).toBe(1);
    const bottleTarget = engine.activeTargets[0];
    expect(bottleTarget.kind).toBe('bottle');
    expect(bottleTarget.hp).toBe(3);
    expect(bottleTarget.speedMps).toBeGreaterThan(0);
  });

  it('should advance from Step 2 to Step 3 and charge fever to 100%', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    engine.advanceTutorialStep(2);

    expect(engine.tutorialStep).toBe(2);
    expect(engine.scoreManager.getState().isFeverReady).toBe(false);

    // Advance to Step 3
    engine.advanceTutorialStep(3);

    expect(engine.tutorialStep).toBe(3);
    const feverState = engine.scoreManager.getState();
    expect(feverState.feverGauge).toBe(100);
    expect(feverState.isFeverReady).toBe(true);
  });

  it('should activate fever and spawn Step 3 enemies, then complete tutorial on clear', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    engine.advanceTutorialStep(3);

    const now = 2000;
    const activated = engine.scoreManager.activateFever(now);
    expect(activated).toBe(true);
    expect(engine.scoreManager.getState().isFeverActive).toBe(true);

    engine.spawnTutorialStep3Enemies();
    expect(engine.activeTargets.length).toBe(6);

    // Clear all Step 3 enemies
    engine.activeTargets = [];
    engine.advanceTutorialStep('COMPLETED');

    expect(engine.tutorialStep).toBe('COMPLETED');
    expect(engine.tutorialCompleted).toBe(true);
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
});
