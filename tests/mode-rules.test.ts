import { describe, it, expect } from 'vitest';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';

describe('modeRules', () => {
  it('has identical keys for game, tutorial, and sandbox', () => {
    const keysGame = Object.keys(GAME_TUNING.modeRules.game).sort();
    const keysTutorial = Object.keys(GAME_TUNING.modeRules.tutorial).sort();
    const keysSandbox = Object.keys(GAME_TUNING.modeRules.sandbox).sort();

    expect(keysTutorial).toEqual(keysGame);
    expect(keysSandbox).toEqual(keysGame);

    // game rules are all true except breachEffect
    expect(GAME_TUNING.modeRules.game.waveSpawning).toBe(true);
    expect(GAME_TUNING.modeRules.game.breachEffect).toBe('damageLives');
    expect(GAME_TUNING.modeRules.game.pilgoodCharge).toBe(true);
    expect(GAME_TUNING.modeRules.game.hanmacBlast).toBe(true);
    expect(GAME_TUNING.modeRules.game.killEffects).toBe(true);
    expect(GAME_TUNING.modeRules.game.bossEncounter).toBe(true);
    expect(GAME_TUNING.modeRules.game.freezeOnSelect).toBe(true);
    expect(GAME_TUNING.modeRules.game.waveTimeBonus).toBe(true);
    expect(GAME_TUNING.modeRules.game.victoryBonus).toBe(true);
    expect(GAME_TUNING.modeRules.game.holdDamagePenalty).toBe(true);
  });

  it('respawns targets at radius 16 in sandbox when breached without losing lives', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.mode = 'sandbox';

    const target: ActiveTargetEntity = {
      id: 'test_breach',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 0.5, // breached
      thetaRad: 0.1,
      x: 0,
      z: 0,
      speedMps: 1.0,
      hitRadiusM: 1.0,
      killBonusScore: 10,
      breached: true,
    };

    engine.activeTargets = [target];
    const initialLives = engine.lives;

    const { breaches } = engine.update(1000, 0.05);

    expect(breaches.length).toBe(0);
    expect(engine.lives).toBe(initialLives);
    expect(target.radiusM).toBe(GAME_TUNING.breachRespawnRadiusM);
    expect(target.breached).toBe(false);
  });

  it('reduces lives on breach in game mode', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.mode = 'game';

    const target: ActiveTargetEntity = {
      id: 'test_breach_game',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 0.5,
      thetaRad: 0,
      x: 0,
      z: 0,
      speedMps: 1.0,
      hitRadiusM: 1.0,
      killBonusScore: 10,
      breached: true,
    };

    engine.activeTargets = [target];
    const initialLives = engine.lives;

    const { breaches } = engine.update(1000, 0.05);

    expect(breaches.length).toBe(1);
    expect(engine.lives).toBe(initialLives - 1);
  });

  it('triggers hanmac blast in game mode but not in tutorial mode', () => {
    // 1. In tutorial mode
    const engineTutorial = new BeerCrusherEngine();
    engineTutorial.startTutorialMode();

    const hanmacTut: ActiveTargetEntity = {
      id: 'tut_hanmac',
      kind: 'hanmac',
      hp: 1,
      maxHp: 1,
      radiusM: 10,
      thetaRad: 0,
      x: 0,
      z: -10,
      speedMps: 0,
      hitRadiusM: 1.5,
      killBonusScore: 50,
      breached: false,
    };
    engineTutorial.activeTargets = [hanmacTut];
    (engineTutorial as any).handleMonsterKilled(hanmacTut, 1000);
    expect((engineTutorial as any).pendingHanmacBlasts.length).toBe(0);

    // 2. In game mode
    const engineGame = new BeerCrusherEngine();
    engineGame.startGame({ withWeaponSelect: false });

    const hanmacGame: ActiveTargetEntity = {
      id: 'game_hanmac',
      kind: 'hanmac',
      hp: 1,
      maxHp: 1,
      radiusM: 10,
      thetaRad: 0,
      x: 0,
      z: -10,
      speedMps: 0,
      hitRadiusM: 1.5,
      killBonusScore: 50,
      breached: false,
    };
    engineGame.activeTargets = [hanmacGame];
    (engineGame as any).handleMonsterKilled(hanmacGame, 1000);
    expect((engineGame as any).pendingHanmacBlasts.length).toBe(1);
  });
});
