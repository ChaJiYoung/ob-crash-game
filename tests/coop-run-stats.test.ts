import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('coop run stats (P02-T05)', () => {
  it('returns solo stats with mode: solo and no coop field for 1-player game', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.getPlayer(0).scoreManager.addBonusScore(500);
    engine.gamePhase = 'GAMEOVER';

    const stats = engine.getPlayRunStats(0);
    expect(stats).not.toBeNull();
    expect(stats!.mode).toBe('solo');
    expect(stats!.coop).toBeUndefined();
    expect(stats!.totalScore).toBe(500);
  });

  it('generates per-player stats with coop team info for 2-player game', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(2);

    // Give different scores to P0 and P1
    engine.getPlayer(0).scoreManager.addBonusScore(1000);
    engine.getPlayer(1).scoreManager.addBonusScore(1500);

    engine.getPlayer(0).totalKills = 5;
    engine.getPlayer(1).totalKills = 8;

    engine.lives = 3;
    engine.gamePhase = 'GAMEOVER';

    const stats0 = engine.getPlayRunStats(0)!;
    const stats1 = engine.getPlayRunStats(1)!;

    expect(stats0.mode).toBe('coop');
    expect(stats1.mode).toBe('coop');

    // Individual stats differ
    expect(stats0.totalScore).toBe(1000);
    expect(stats1.totalScore).toBe(1500);
    expect(stats0.kills).toBe(5);
    expect(stats1.kills).toBe(8);

    // Shared game stats match
    expect(stats0.waveReached).toBe(2);
    expect(stats1.waveReached).toBe(2);
    expect(stats0.livesLeft).toBe(3);
    expect(stats1.livesLeft).toBe(3);

    // Coop team breakdown
    expect(stats0.coop).toBeDefined();
    expect(stats1.coop).toBeDefined();

    expect(stats0.coop!.slot).toBe(1);
    expect(stats1.coop!.slot).toBe(2);

    expect(stats0.coop!.teamScore).toBe(2500);
    expect(stats1.coop!.teamScore).toBe(2500);

    expect(stats0.coop!.partnerScore).toBe(1500);
    expect(stats1.coop!.partnerScore).toBe(1000);

    expect(stats0.coop!.leftEarly).toBe(false);
    expect(stats1.coop!.leftEarly).toBe(false);
  });

  it('records leftEarly: true if a player was away when game ended', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    engine.getPlayer(0).scoreManager.addBonusScore(800);
    engine.getPlayer(1).scoreManager.addBonusScore(400);

    // Player 1 goes away
    engine.setPlayerAway(1, true, 2000);

    engine.gamePhase = 'GAMEOVER';

    const stats0 = engine.getPlayRunStats(0)!;
    const stats1 = engine.getPlayRunStats(1)!;

    expect(stats0.coop!.leftEarly).toBe(false);
    expect(stats1.coop!.leftEarly).toBe(true);
  });
});
