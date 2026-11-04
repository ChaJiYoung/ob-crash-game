import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const cfg = GAME_TUNING.score.timeBonus;
const par = (wave: number) => (GAME_TUNING.waves as any)[wave - 1].parTimeSec as number;

/** Runs an empty wave to completion: no spawns left, no monsters. */
function finishEmptyWave(engine: any, startMs: number, endMs: number): void {
  engine.update(startMs, 0.016); // starts the wave clock
  engine.spawnedInWave = engine.waveDefinitions[engine.currentWave].totalSpawns;
  engine.activeTargets = [];
  engine.bossSpawned = true; // skip the boss encounter so the wave just ends
  engine.update(endMs, 0.016);
}

describe('wave time bonus (score-differentiation P01-T01)', () => {
  let engine: any;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
  });

  describe('computeWaveTimeBonus', () => {
    it('is full at or under par, half at 1.5x par, zero at 2x par and beyond', () => {
      expect(engine.computeWaveTimeBonus(1, 0)).toBe(cfg.maxPerWave);
      expect(engine.computeWaveTimeBonus(1, par(1))).toBe(cfg.maxPerWave);
      expect(engine.computeWaveTimeBonus(1, par(1) * 1.5)).toBe(Math.round(cfg.maxPerWave / 2));
      expect(engine.computeWaveTimeBonus(1, par(1) * cfg.zeroAtParMult)).toBe(0);
      expect(engine.computeWaveTimeBonus(1, par(1) * 5)).toBe(0);
    });

    it('weights boss waves', () => {
      expect(engine.computeWaveTimeBonus(3, 0)).toBe(cfg.maxPerWave * cfg.bossWaveWeight);
      expect(engine.computeWaveTimeBonus(5, 0)).toBe(cfg.maxPerWave * cfg.bossWaveWeight);
      expect(engine.computeWaveTimeBonus(7, 0)).toBe(cfg.maxPerWave * cfg.bossWaveWeight);
      expect(engine.computeWaveTimeBonus(2, 0)).toBe(cfg.maxPerWave);
    });

    it('falls linearly between par and the zero point', () => {
      const a = engine.computeWaveTimeBonus(1, par(1) * 1.25);
      const b = engine.computeWaveTimeBonus(1, par(1) * 1.75);
      expect(a + b).toBe(cfg.maxPerWave);
    });
  });

  describe('wave clock and payment', () => {
    it('pays once on wave clear and records it', () => {
      const before = engine.scoreManager.getState().totalScore;
      finishEmptyWave(engine, 1000, 1000 + 5000);
      expect(engine.lastWaveClear).not.toBeNull();
      expect(engine.lastWaveClear.wave).toBe(1);
      expect(engine.lastWaveClear.seconds).toBeCloseTo(5, 1);
      expect(engine.lastWaveClear.bonus).toBe(cfg.maxPerWave);
      expect(engine.scoreManager.getState().totalScore).toBe(before + cfg.maxPerWave);
      expect(engine.waveTimeBonusTotal).toBe(cfg.maxPerWave);
    });

    it('pays less for a slow wave', () => {
      finishEmptyWave(engine, 1000, 1000 + par(1) * 1.5 * 1000);
      expect(engine.lastWaveClear.bonus).toBe(Math.round(cfg.maxPerWave / 2));
    });

    it('does not pay twice for the same wave', () => {
      finishEmptyWave(engine, 1000, 6000);
      const total = engine.scoreManager.getState().totalScore;
      engine.awardWaveTimeBonus(7000);
      expect(engine.scoreManager.getState().totalScore).toBe(total);
    });

    it('excludes frozen time (card selection / pause) from the wave time', () => {
      engine.update(1000, 0.016); // clock starts
      engine.freezeTimers(30_000); // 30s of card selection
      engine.spawnedInWave = engine.waveDefinitions[1].totalSpawns;
      engine.activeTargets = [];
      engine.bossSpawned = true;
      engine.update(1000 + 30_000 + 4000, 0.016);
      expect(engine.lastWaveClear.seconds).toBeCloseTo(4, 1);
    });

    it('starts a new clock for the next wave', () => {
      finishEmptyWave(engine, 1000, 3000);
      expect(engine.waveStartMs).not.toBeNull();
      engine.startWave(2);
      expect(engine.waveStartMs).toBeNull();
      engine.update(10_000, 0.016);
      expect(engine.waveStartMs).toBe(10_000);
    });

    it('pays the last wave before victory so it is part of the final score', () => {
      engine.startWave(7);
      engine.update(1000, 0.016);
      const before = engine.scoreManager.getState().totalScore;
      engine.currentWave = 7;
      engine.isBossEncounterActive = true;
      engine.activeTargets = [];
      engine.handleMonsterKilled({ kind: 'boss', bossRole: 'cooler', isItem: false } as any, 1000 + 20_000);
      expect(engine.gamePhase).toBe('VICTORY');
      expect(engine.lastWaveClear.wave).toBe(7);
      expect(engine.scoreManager.getState().totalScore).toBeGreaterThan(before + engine.lastWaveClear.bonus - 1);
      expect(engine.lastWaveClear.bonus).toBeGreaterThan(0);
    });

    it('is not paid in the tutorial or sandbox', () => {
      engine.isSandboxMode = true;
      const before = engine.scoreManager.getState().totalScore;
      engine.awardWaveTimeBonus(5000);
      expect(engine.scoreManager.getState().totalScore).toBe(before);
      expect(engine.lastWaveClear).toBeNull();
    });

    it('resets on a new game', () => {
      finishEmptyWave(engine, 1000, 3000);
      engine.startGame({ withWeaponSelect: false });
      expect(engine.waveTimeBonusTotal).toBe(0);
      expect(engine.lastWaveClear).toBeNull();
    });
  });

  it('getScoreBreakdown parts add up to the total', () => {
    finishEmptyWave(engine, 1000, 3000);
    const b = engine.getScoreBreakdown();
    expect(b.timeBonus).toBe(cfg.maxPerWave);
    expect(b.base + b.timeBonus + b.precisionBonus).toBe(b.total);
    expect(b.total).toBe(engine.scoreManager.getState().totalScore);
  });
});
