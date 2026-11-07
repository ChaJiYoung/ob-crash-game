import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('coop-player-away (P02-T04)', () => {
  it('freezes skill cooldown for away player while active player cooldown advances', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    const p0 = engine.getPlayer(0);
    const p1 = engine.getPlayer(1);

    // Give both players 1 skill stock and consume at t=1000
    p0.weaponSystem.addSkillStock(1);
    p1.weaponSystem.addSkillStock(1);

    const res0 = engine.triggerWeaponSkill(1000, 0);
    const res1 = engine.triggerWeaponSkill(1000, 1);
    expect(res0.activated).toBe(true);
    expect(res1.activated).toBe(true);

    const cd0Initial = p0.weaponSystem.getState().skillCooldownRemainingMs;
    const cd1Initial = p1.weaponSystem.getState().skillCooldownRemainingMs;
    expect(cd0Initial).toBeGreaterThan(0);
    expect(cd1Initial).toBeGreaterThan(0);

    // Set player 1 away at t=1000
    engine.setPlayerAway(1, true, 1000);
    expect(p1.isAway).toBe(true);
    expect(engine.getActivePlayers().map((p) => p.index)).toEqual([0]);

    // Advance engine by 5 seconds (5000ms)
    for (let t = 2000; t <= 6000; t += 1000) {
      engine.update(t, 1.0);
    }

    const cd0After5s = p0.weaponSystem.getState().skillCooldownRemainingMs;
    const cd1After5s = p1.weaponSystem.getState().skillCooldownRemainingMs;

    expect(cd0After5s).toBeLessThan(cd0Initial);
    // Player 1 cooldown should NOT have decreased
    expect(cd1After5s).toBe(cd1Initial);

    // Return player 1 at t=6000
    engine.setPlayerAway(1, false, 6000);
    expect(p1.isAway).toBe(false);
    expect(engine.getActivePlayers().map((p) => p.index)).toEqual([0, 1]);

    // Advance by another 1 second
    engine.update(7000, 1.0);
    const cd1AfterReturn = p1.weaponSystem.getState().skillCooldownRemainingMs;
    expect(cd1AfterReturn).toBeLessThan(cd1Initial);
  });

  it('ignores input while away and keeps shotStats unchanged', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    engine.setPlayerAway(1, true, 1000);

    // Shooting while away returns fired: false
    const shootRes = engine.shootAt(0, 0, 1100, 'press', 1);
    expect(shootRes.fired).toBe(false);
    expect(engine.getPlayer(1).shotStats.MISS).toBe(0);

    // Skill while away returns activated: false
    engine.getPlayer(1).weaponSystem.addSkillStock(1);
    const skillRes = engine.triggerWeaponSkill(1100, 1);
    expect(skillRes.activated).toBe(false);

    // Fever while away returns false
    engine.getPlayer(1).scoreManager.forceSetFeverGauge(100);
    const feverRes = engine.activateFever(1100, 1);
    expect(feverRes).toBe(false);
  });

  it('freezes fever timer while away: remaining time matches before and after away', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    const p1 = engine.getPlayer(1);
    p1.scoreManager.forceSetFeverGauge(100);
    expect(engine.activateFever(1000, 1)).toBe(true);

    const fever0 = p1.scoreManager.getState();
    expect(fever0.isFeverActive).toBe(true);

    // Set away at 1000
    engine.setPlayerAway(1, true, 1000);

    // Run engine 5 seconds
    for (let t = 2000; t <= 6000; t += 1000) {
      engine.update(t, 1.0);
    }

    // Return at 6000
    engine.setPlayerAway(1, false, 6000);

    // Fever should still be active for player 1
    const feverAfter = p1.scoreManager.getState();
    expect(feverAfter.isFeverActive).toBe(true);
  });

  it('auto-picks reward card immediately when round opens while player is away', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    // Set player 1 away
    engine.setPlayerAway(1, true, 2000);

    // Open reward card round
    engine.openSelectRound('card', 3000, true);

    const status = engine.getSelectionStatus();
    // P1 was already auto-picked!
    expect(status.done).toEqual([false, true]);

    // Only P0 targets remain
    const remainingCards = engine.activeTargets.filter((t) => !!t.rewardCardKind);
    expect(remainingCards.length).toBe(3);
    expect(remainingCards.every((t) => t.ownerIndex === 0)).toBe(true);

    // P0 picks and round ends immediately
    const aim0 = engine.computeTargetAimCoords(remainingCards[0], 1.0, 0);
    engine.shootAt(aim0.targetNormX, aim0.targetNormY, 4000, 'press', 0);

    expect(engine.isRewardCardPending).toBe(false);
    expect(engine.getSelectionStatus().kind).toBeNull();
  });

  it('allows shooting again normally after return', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    engine.setPlayerAway(1, true, 1000);
    expect(engine.shootAt(0, 0, 1100, 'press', 1).fired).toBe(false);

    engine.setPlayerAway(1, false, 2000);

    // Spawn a target at center
    engine.activeTargets = [];
    const t = {
      id: 'dummy',
      kind: 'pilgood' as const,
      hp: 1,
      maxHp: 1,
      radiusM: 10,
      thetaRad: 0,
      x: 0,
      z: -10,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
    };
    engine.activeTargets.push(t);

    const aim = engine.computeTargetAimCoords(t, 1.0, 1);
    const res = engine.shootAt(aim.targetNormX, aim.targetNormY, 2100, 'press', 1);
    expect(res.fired).toBe(true);
    expect(engine.getPlayer(1).shotStats.PERFECT).toBe(1);
  });
});
