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

  describe('real flows (regressions from the P01 review)', () => {
    it('pays the wave when the last kill also triggers the mid-wave card (waves 4 and 6)', () => {
      engine.startWave(4);
      engine.update(1000, 0.016);
      engine.spawnedInWave = engine.waveDefinitions[4].totalSpawns;
      engine.activeTargets = [];
      engine.cardKillCount = 0;
      // The final kill reaches the card count: the mid-wave cards are dealt before the wave-complete check runs
      engine.spawnWaveRewardCards(5000, false);
      expect(engine.isCardSelectPending).toBe(true);
      expect(engine.lastWaveClear).toBeNull();

      const card = engine.activeTargets.find((t: any) => t.rewardCardKind);
      const p = engine.computeTargetAimCoords(card);
      const res = engine.shootAt(p.targetNormX, p.targetNormY, 7000, 'press');
      expect(res.selectedCard).toBeDefined();
      expect(engine.currentWave).toBe(5);
      expect(engine.lastWaveClear).not.toBeNull();
      expect(engine.lastWaveClear.wave).toBe(4);
      expect(engine.lastWaveClear.bonus).toBeGreaterThan(0);
      expect(engine.waveTimeBonusTotal).toBe(engine.lastWaveClear.bonus);
    });

    it('does not count time spent choosing the card', () => {
      engine.startWave(4);
      engine.spawnedInWave = engine.waveDefinitions[4].totalSpawns;
      // One idle monster keeps the wave open for 4s of play
      engine.activeTargets = [
        { id: 'idle', kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 20, thetaRad: 0, x: 0, z: -20, speedMps: 0, hitRadiusM: 1, killBonusScore: 0, breached: false },
      ];
      for (let t = 1000; t <= 5000; t += 100) engine.update(t, 0.016); // 4s of play
      expect(engine.lastWaveClear).toBeNull();
      engine.activeTargets = [];
      engine.spawnWaveRewardCards(5000, false);
      // 20s of card selection passes in real update ticks
      for (let t = 5100; t <= 25_000; t += 100) engine.update(t, 0.016);
      const card = engine.activeTargets.find((t: any) => t.rewardCardKind);
      const p = engine.computeTargetAimCoords(card);
      engine.shootAt(p.targetNormX, p.targetNormY, 25_000, 'press');
      expect(engine.lastWaveClear.seconds).toBeCloseTo(4, 0);
    });

    it('pays nothing in the sandbox or the tutorial', () => {
      engine.startSandboxMode();
      engine.update(1000, 0.016);
      engine.spawnedInWave = 999;
      engine.activeTargets = [];
      engine.update(9000, 0.016);
      expect(engine.lastWaveClear).toBeNull();
      expect(engine.waveTimeBonusTotal).toBe(0);

      const tutorial: any = new BeerCrusherEngine();
      tutorial.startTutorialMode();
      tutorial.update(1000, 0.016);
      tutorial.update(9000, 0.016);
      expect(tutorial.lastWaveClear).toBeNull();
      expect(tutorial.waveTimeBonusTotal).toBe(0);
    });

    it('excludes paused time through the real pause API', () => {
      engine.update(1000, 0.016);
      engine.setPaused(true, 2000);
      engine.setPaused(false, 22_000); // 20s paused
      engine.spawnedInWave = engine.waveDefinitions[1].totalSpawns;
      engine.activeTargets = [];
      engine.bossSpawned = true;
      engine.update(26_000, 0.016);
      expect(engine.lastWaveClear.seconds).toBeLessThan(10);
    });
  });
});
