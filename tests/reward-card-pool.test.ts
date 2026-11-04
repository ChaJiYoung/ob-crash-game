import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { RewardCardKind } from '../src/shared/types';

const ALL: RewardCardKind[] = [
  'weapon_level_up', 'rapid_reload', 'bar_repair', 'fever_boost', 'lucky_drop',
  'damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up',
];

describe('reward card pool (gameplay-polish P03-T03)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
  });

  const cardsOnField = () => engine.activeTargets.filter((t) => t.rewardCardKind).map((t) => t.rewardCardKind!);

  it('has no weapon_level_up at Lv.4 and respects the per-wave level cap', () => {
    engine.weaponSystem.selectWeapon('shotgun', 4);
    engine.startWave(7);
    expect(engine.buildRewardCardPool()).not.toContain('weapon_level_up');

    engine.weaponSystem.selectWeapon('shotgun', 2);
    engine.startWave(1);
    expect(engine.buildRewardCardPool()).not.toContain('weapon_level_up'); // wave 1 cap is Lv.2
    engine.weaponSystem.selectWeapon('shotgun', 1);
    expect(engine.buildRewardCardPool()).toContain('weapon_level_up');

    engine.weaponSystem.selectWeapon('shotgun', 3);
    engine.startWave(3);
    expect(engine.buildRewardCardPool()).not.toContain('weapon_level_up'); // wave 3 cap is Lv.3
    engine.startWave(5);
    expect(engine.buildRewardCardPool()).toContain('weapon_level_up'); // MAX allowed from wave 5
  });

  it('excludes capped stack cards, full-health repair, and fever boost while fever is ready or active', () => {
    // Lucky drop x3
    for (let i = 0; i < 3; i++) engine.applyRewardCard('lucky_drop', 0);
    expect(engine.buildRewardCardPool()).not.toContain('lucky_drop');

    // Rapid reload x3
    for (let i = 0; i < 3; i++) engine.applyRewardCard('rapid_reload', 0);
    expect(engine.buildRewardCardPool()).not.toContain('rapid_reload');

    // Stack cards
    for (let i = 0; i < 3; i++) {
      engine.applyRewardCard('damage_up', 0);
      engine.applyRewardCard('skill_cooldown', 0);
      engine.applyRewardCard('fever_extend', 0);
    }
    for (let i = 0; i < 2; i++) engine.applyRewardCard('hit_zone_up', 0);
    const pool = engine.buildRewardCardPool();
    ['damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up'].forEach((k) => expect(pool).not.toContain(k));

    // Full health -> no repair; damaged -> repair
    expect(pool).not.toContain('bar_repair');
    engine.lives = engine.maxLives - 1;
    expect(engine.buildRewardCardPool()).toContain('bar_repair');

    // Fever ready / active -> no booster
    expect(engine.buildRewardCardPool()).toContain('fever_boost');
    engine.scoreManager.forceSetFeverGauge(100);
    expect(engine.buildRewardCardPool()).not.toContain('fever_boost');
    engine.scoreManager.activateFever(0);
    expect(engine.buildRewardCardPool()).not.toContain('fever_boost');
  });

  it('always deals three distinct cards, even when almost every card is capped', () => {
    for (let i = 0; i < 3; i++) {
      engine.applyRewardCard('lucky_drop', 0);
      engine.applyRewardCard('rapid_reload', 0);
      engine.applyRewardCard('damage_up', 0);
      engine.applyRewardCard('skill_cooldown', 0);
      engine.applyRewardCard('fever_extend', 0);
    }
    for (let i = 0; i < 2; i++) engine.applyRewardCard('hit_zone_up', 0);
    engine.weaponSystem.selectWeapon('shotgun', 4);
    engine.scoreManager.forceSetFeverGauge(100);
    for (let round = 0; round < 30; round++) {
      engine.spawnWaveRewardCards(1000 + round, false);
      const cards = cardsOnField();
      expect(cards.length).toBe(3);
      expect(new Set(cards).size).toBe(3);
    }
  });

  it('draws different compositions and is reproducible with a fixed RNG', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      engine.spawnWaveRewardCards(1000, false);
      seen.add(cardsOnField().slice().sort().join(','));
    }
    expect(seen.size).toBeGreaterThan(3);

    const draw = () => {
      const e = new BeerCrusherEngine();
      e.startGame({ withWeaponSelect: false });
      e.activeTargets = [];
      let s = 7;
      e.dropRng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      e.spawnWaveRewardCards(1000, false);
      return e.activeTargets.filter((t) => t.rewardCardKind).map((t) => t.rewardCardKind);
    };
    expect(draw()).toEqual(draw());
  });

  it('applies the four new card effects', () => {
    // damage +10% per stack
    engine.applyRewardCard('damage_up', 0);
    expect(engine.weaponSystem.getDamageBonusMultiplier()).toBeCloseTo(1.1, 5);

    // skill cooldown x0.9 per stack
    const base = engine.weaponSystem.getSkillCooldownTotalMs();
    engine.applyRewardCard('skill_cooldown', 0);
    expect(engine.weaponSystem.getSkillCooldownTotalMs()).toBe(Math.round(base * 0.9));
    engine.applyRewardCard('skill_cooldown', 0);
    expect(engine.weaponSystem.getSkillCooldownTotalMs()).toBe(Math.round(base * 0.81));

    // fever duration +500ms per stack
    engine.applyRewardCard('fever_extend', 0);
    expect(engine.scoreManager.getFeverDurationMs()).toBe(4500);
    engine.scoreManager.forceSetFeverGauge(100);
    engine.scoreManager.activateFever(1000);
    engine.scoreManager.updateFeverTimer(5400);
    expect(engine.scoreManager.getState().isFeverActive).toBe(true);
    engine.scoreManager.updateFeverTimer(5600);
    expect(engine.scoreManager.getState().isFeverActive).toBe(false);

    // hit zone +5% per stack, monsters only
    const t = {
      id: 'm', kind: 'bottle' as const, hp: 4, maxHp: 4, radiusM: 8, thetaRad: 0, x: 0, z: -8, speedMps: 0,
      hitRadiusM: 1, killBonusScore: 0, breached: false,
    };
    engine.activeTargets.push(t);
    const before = engine.computeTargetAimCoords(t).apparentHitRadius;
    engine.applyRewardCard('hit_zone_up', 0);
    expect(engine.computeTargetAimCoords(t).apparentHitRadius / before).toBeCloseTo(1.05, 3);
  });

  it('does not stack beyond the configured maximums', () => {
    for (let i = 0; i < 6; i++) engine.applyRewardCard('damage_up', 0);
    expect(engine.weaponSystem.getDamageBonusMultiplier()).toBeCloseTo(
      1 + GAME_TUNING.cards.damageUp.amount * GAME_TUNING.cards.damageUp.maxStacks,
      5
    );
  });

  it('resets every card effect when a new game starts', () => {
    engine.applyRewardCard('damage_up', 0);
    engine.applyRewardCard('skill_cooldown', 0);
    engine.applyRewardCard('fever_extend', 0);
    engine.applyRewardCard('hit_zone_up', 0);
    engine.startGame({ withWeaponSelect: false });

    expect(engine.weaponSystem.getDamageBonusMultiplier()).toBe(1);
    expect(engine.scoreManager.getFeverDurationMs()).toBe(4000);
    const pool = engine.buildRewardCardPool();
    ['damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up'].forEach((k) => expect(pool).toContain(k));
    expect(ALL.length).toBe(9);
  });

  it('resets card stacks when entering the sandbox or tutorial', () => {
    engine.applyRewardCard('damage_up', 0);
    engine.applyRewardCard('hit_zone_up', 0);
    engine.startSandboxMode();
    expect(engine.weaponSystem.getDamageBonusMultiplier()).toBe(1);
    expect(engine.buildRewardCardPool()).toContain('damage_up');

    engine.applyRewardCard('skill_cooldown', 0);
    engine.startTutorialMode();
    expect(engine.buildRewardCardPool()).toContain('skill_cooldown');
  });

  it('never deals an undefined card even if the RNG returns exactly 1', () => {
    engine.dropRng = () => 1;
    engine.spawnWaveRewardCards(1000, false);
    const cards = cardsOnField();
    expect(cards.length).toBe(3);
    cards.forEach((c) => expect(c).toBeDefined());
  });

  it('ignores fever gauge gains while fever is active (no ready flag mid-fever)', () => {
    engine.scoreManager.forceSetFeverGauge(100);
    engine.scoreManager.activateFever(0);
    engine.scoreManager.updateFeverTimer(1000); // gauge shows the countdown
    const before = engine.scoreManager.getState().feverGauge;
    engine.scoreManager.addFeverGauge(30);
    const after = engine.scoreManager.getState();
    expect(after.feverGauge).toBe(before);
    expect(after.isFeverReady).toBe(false);
  });

  it('wave-clear cards use the cap of the wave being cleared', () => {
    engine.weaponSystem.selectWeapon('shotgun', 2);
    engine.startWave(1);
    expect(engine.buildRewardCardPool()).not.toContain('weapon_level_up');
    engine.startWave(2);
    expect(engine.buildRewardCardPool()).toContain('weapon_level_up');
  });
});
