import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('card selection input gate and freeze (gameplay-polish P02-T03)', () => {
  let engine: BeerCrusherEngine;
  const SPAWN_MS = 10_000;

  const aimAtFirstCard = () => {
    const card = engine.activeTargets.find((t) => t.rewardCardKind)!;
    return engine.computeTargetAimCoords(card);
  };

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    engine.spawnWaveRewardCards(SPAWN_MS, false);
  });

  it("never selects a card with 'hold' or 'fever' shots, even when aimed exactly", () => {
    const p = aimAtFirstCard();
    const ammoBefore = engine.weaponSystem.getState().ammo;
    for (const source of ['hold', 'fever'] as const) {
      const res = engine.shootAt(p.targetNormX, p.targetNormY, SPAWN_MS + 2000, source);
      expect(res.fired).toBe(false);
      expect(res.selectedCard).toBeUndefined();
    }
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.weaponSystem.getState().ammo).toBe(ammoBefore);
  });

  it("selects a card with a fresh 'press' after the 800ms lock", () => {
    const p = aimAtFirstCard();
    const res = engine.shootAt(p.targetNormX, p.targetNormY, SPAWN_MS + 900, 'press');
    expect(res.fired).toBe(true);
    expect(res.selectedCard).toBeDefined();
    expect(engine.isRewardCardPending).toBe(false);
  });

  it("ignores a 'press' inside the 800ms lock without spending ammo", () => {
    const p = aimAtFirstCard();
    const ammoBefore = engine.weaponSystem.getState().ammo;
    const res = engine.shootAt(p.targetNormX, p.targetNormY, SPAWN_MS + 400, 'press');
    expect(res.fired).toBe(false);
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.weaponSystem.getState().ammo).toBe(ammoBefore);
  });

  it("does not spend ammo on a 'press' that misses every card", () => {
    // Card hit areas are large on screen, so shrink them to make a real miss possible.
    engine.activeTargets.forEach((t) => {
      t.hitRadiusM = 0.05;
    });
    const ammoBefore = engine.weaponSystem.getState().ammo;
    const res = engine.shootAt(0.9, -0.9, SPAWN_MS + 2000, 'press');
    expect(res.fired).toBe(false);
    expect(engine.weaponSystem.getState().ammo).toBe(ammoBefore);
    expect(engine.isRewardCardPending).toBe(true);
  });

  it('freezes skill cooldown, fever and buffs while cards are pending, then resumes', () => {
    // Fresh engine state with a running fever, a buff and a skill cooldown
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    const t0 = 5_000;
    engine.weaponSystem.consumeSkill(t0);
    engine.scoreManager.forceSetFeverGauge(100);
    expect(engine.activateFever(t0)).toBe(true);
    engine.activateItemBuff('power_shot', t0);

    engine.spawnWaveRewardCards(t0, false);
    const cooldownBefore = engine.weaponSystem.getState().skillCooldownRemainingMs;
    const buffBefore = engine.getActiveBuffs(t0).find((b) => b.kind === 'power_shot')!.remainingMs;

    // 10 seconds of waiting while the cards are up
    let now = t0;
    for (let i = 0; i < 100; i++) {
      now += 100;
      engine.update(now, 0.1);
    }

    expect(engine.weaponSystem.getState().skillCooldownRemainingMs).toBe(cooldownBefore);
    expect(engine.scoreManager.getState().isFeverActive).toBe(true);
    const buffAfter = engine.getActiveBuffs(now).find((b) => b.kind === 'power_shot')!.remainingMs;
    expect(buffAfter).toBeCloseTo(buffBefore, 0);

    // Pick a card, then time resumes
    const card = engine.activeTargets.find((t) => t.rewardCardKind)!;
    const p = engine.computeTargetAimCoords(card);
    const pick = engine.shootAt(p.targetNormX, p.targetNormY, now, 'press');
    expect(pick.fired).toBe(true);
    for (let i = 0; i < 10; i++) {
      now += 100;
      engine.update(now, 0.1);
    }
    expect(engine.weaponSystem.getState().skillCooldownRemainingMs).toBeLessThan(cooldownBefore);
  });

  it('keeps fever alive when only 1s remains and the player waits 10s', () => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    const t0 = 5_000;
    engine.scoreManager.forceSetFeverGauge(100);
    engine.activateFever(t0);
    // Burn most of the fever so ~1s remains
    let now = t0;
    // While fever runs the gauge shows the remaining time as a percentage of 4s: 25% ~ 1s left
    while (engine.scoreManager.getState().feverGauge > 25 && now < t0 + 20_000) {
      now += 100;
      engine.update(now, 0.1);
    }
    expect(engine.scoreManager.getState().isFeverActive).toBe(true);

    engine.spawnWaveRewardCards(now, false);
    for (let i = 0; i < 100; i++) {
      now += 100;
      engine.update(now, 0.1);
    }
    expect(engine.scoreManager.getState().isFeverActive).toBe(true);
  });

  it('blocks fever activation and skills while cards are pending', () => {
    engine.scoreManager.forceSetFeverGauge(100);
    expect(engine.activateFever(SPAWN_MS + 1000)).toBe(false);
    expect(engine.triggerWeaponSkill(SPAWN_MS + 1000).activated).toBe(false);
    expect(engine.weaponSystem.getState().skillStock).toBeGreaterThan(0);
  });
});
