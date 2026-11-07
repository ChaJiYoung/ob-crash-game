import { describe, it, expect } from 'vitest';
import { PlayerCombatState } from '../src/pc/engine/PlayerCombatState';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('PlayerCombatState', () => {
  it('reset() initializes all counters, maps, and weapon state correctly', () => {
    const player = new PlayerCombatState(0);
    player.shotStats.PERFECT = 10;
    player.totalKills = 5;
    player.itemsCollected = 3;
    player.luckyDropStacks = 2;
    player.buffUntilMs.set('power_shot', 5000);
    player.cardStacks.damage_up = 2;
    player.precisionBonusApplied = 100;
    player.levelBonusApplied = 200;
    player.waveTimeBonusTotal = 300;
    player.waveClears.push({ wave: 1, seconds: 15, bonus: 100 });

    player.reset();

    expect(player.shotStats).toEqual({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 });
    expect(player.totalKills).toBe(0);
    expect(player.itemsCollected).toBe(0);
    expect(player.luckyDropStacks).toBe(0);
    expect(player.buffUntilMs.size).toBe(0);
    expect(player.cardStacks).toEqual({ damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 });
    expect(player.precisionBonusApplied).toBe(0);
    expect(player.levelBonusApplied).toBe(0);
    expect(player.waveTimeBonusTotal).toBe(0);
    expect(player.waveClears).toEqual([]);
    expect(player.weaponSystem.getState().skillStock).toBe(0);
    expect(player.scoreManager.getState().totalScore).toBe(0);
  });

  it('freezeTimers shifts buff expiry and fever timer', () => {
    const player = new PlayerCombatState(0);
    player.buffUntilMs.set('power_shot', 2000);

    const startMs = 1000;
    player.scoreManager.forceSetFeverGauge(100);
    const activated = player.scoreManager.activateFever(startMs);
    expect(activated).toBe(true);
    const feverDuration = player.scoreManager.getFeverDurationMs();

    player.freezeTimers(500);

    expect(player.buffUntilMs.get('power_shot')).toBe(2500);

    // After feverDuration + 499 ms, fever should still be active because of the 500ms shift
    player.scoreManager.updateFeverTimer(startMs + feverDuration + 499);
    expect(player.scoreManager.getState().isFeverActive).toBe(true);

    // After feverDuration + 501 ms, fever should expire
    player.scoreManager.updateFeverTimer(startMs + feverDuration + 501);
    expect(player.scoreManager.getState().isFeverActive).toBe(false);
  });

  it('BeerCrusherEngine delegates legacy fields to players[0]', () => {
    const engine = new BeerCrusherEngine();
    expect(engine.players.length).toBe(1);
    expect(engine.scoreManager).toBe(engine.players[0].scoreManager);
    expect(engine.weaponSystem).toBe(engine.players[0].weaponSystem);
    expect(engine.getPlayer(0)).toBe(engine.players[0]);

    // Mutation via engine accessor / any-cast
    (engine as any).shotStats = { PERFECT: 5, GREAT: 4, GOOD: 3, MISS: 2 };
    expect(engine.players[0].shotStats.PERFECT).toBe(5);

    engine.luckyDropStacks = 3;
    expect(engine.players[0].luckyDropStacks).toBe(3);

    (engine as any).activeBuffUntilMs.set('power_shot', 9999);
    expect(engine.players[0].buffUntilMs.get('power_shot')).toBe(9999);
  });
});
