import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS } from '../src/shared/constants';

describe('BeerCrusherEngine playerCountRules (P02-T02)', () => {
  it('defaults to 1 player and applies solo rules', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    expect(engine.players.length).toBe(1);
    expect(engine.playerCount).toBe(1);
    expect(engine.rules).toEqual(GAME_TUNING.playerCountRules[1]);
  });

  it('sets up 2 players with 2P rules when requested', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    expect(engine.players.length).toBe(2);
    expect(engine.playerCount).toBe(2);
    expect(engine.rules).toEqual(GAME_TUNING.playerCountRules[2]);
  });

  describe.each([1, 2] as const)('playerCount = %d scaling', (count) => {
    it('applies rules to wave spawns, monster HP, and boss cooler HP', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ withWeaponSelect: false, playerCount: count });
      const rules = GAME_TUNING.playerCountRules[count];

      // Wave 1 total spawns check
      const prog = engine.getWaveProgress();
      expect(prog.totalSpawns).toBe(Math.ceil(20 * rules.spawnCountMult));

      // First spawned monster HP
      engine.startWave(1);
      engine.update(1000, 0.016);
      expect(engine.activeTargets.length).toBeGreaterThan(0);
      const firstTarget = engine.activeTargets[0];
      const expectedHp = Number((TARGET_SPECS[firstTarget.kind].maxHp * rules.monsterHpMult).toFixed(3));
      expect(firstTarget.maxHp).toBe(expectedHp);
      expect(firstTarget.hp).toBe(expectedHp);

      // Wave 3 boss cooler HP
      engine.startWave(3);
      // Fast forward until boss encounter spawns
      (engine as any).spawnedInWave = Math.ceil(15 * rules.spawnCountMult);
      engine.update(2000, 0.016);
      const boss = engine.getBossEntities().find((b) => b.bossRole === 'cooler');
      expect(boss).toBeDefined();
      const expectedCoolerHp = Number((100 * rules.bossHpMult).toFixed(3));
      expect(boss!.maxHp).toBe(expectedCoolerHp);
      expect(boss!.hp).toBe(expectedCoolerHp);
    });

    it('applies the card kill target and boss summon multipliers', () => {
      const engine: any = new BeerCrusherEngine();
      engine.startGame({ withWeaponSelect: false, playerCount: count });
      const rules = GAME_TUNING.playerCountRules[count];

      expect(engine.waveCardKillTargets[4]).toBe(Math.ceil(22 * rules.cardKillTargetMult));

      engine.startWave(3);
      engine.spawnedInWave = Math.ceil(15 * rules.spawnCountMult);
      engine.update(2000, 0.016);
      const cooler = engine.getBossEntities().find((b: any) => b.bossRole === 'cooler')!;
      const before = engine.activeTargets.filter((t: any) => t.isSummonedMinion).length;
      cooler.hp = cooler.maxHp * GAME_TUNING.boss.summonHpThresholds[0];
      engine.update(2100, 0.016);
      const after = engine.activeTargets.filter((t: any) => t.isSummonedMinion).length;
      expect(after - before).toBe(Math.round(GAME_TUNING.boss.summonCountByStep[0] * rules.summonCountMult));
    });
  });

  it('resets to 1 player and solo rules when entering tutorial or sandbox after coop', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    expect(engine.playerCount).toBe(2);
    expect(engine.rules.bossHpMult).toBe(2);

    engine.startTutorialMode();
    expect(engine.playerCount).toBe(1);
    expect(engine.rules.bossHpMult).toBe(1);

    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    expect(engine.playerCount).toBe(2);

    engine.startSandboxMode();
    expect(engine.playerCount).toBe(1);
    expect(engine.rules.bossHpMult).toBe(1);
  });
});
