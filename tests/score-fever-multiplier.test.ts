import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreAndFeverManager } from '../src/pc/engine/ScoreAndFeverManager';
import { JUDGMENT_SPECS, FEVER_CONSTANTS } from '../src/shared/constants';

describe('ScoreAndFeverManager Multipliers', () => {
  let manager: ScoreAndFeverManager;

  beforeEach(() => {
    manager = new ScoreAndFeverManager();
  });

  it('should preserve default behavior when options are omitted', () => {
    const perfectSpec = JUDGMENT_SPECS.PERFECT;
    const res = manager.registerHit('PERFECT', 100, true);

    // Default earnedScore = baseScore (150) + killBonusScore (100) = 250
    expect(res.earnedScore).toBe(perfectSpec.baseScore + 100);
    expect(res.totalScore).toBe(250);

    // Default fever delta = 8 + 12 = 20
    expect(res.feverGauge).toBe(perfectSpec.feverDelta + FEVER_CONSTANTS.KILL_FEVER_DELTA);
    expect(res.isFeverReady).toBe(false);
  });

  it('should scale baseScore by scoreMultiplier without penalizing killBonusScore', () => {
    // 50% score multiplier (e.g. gatling)
    const res = manager.registerHit('PERFECT', 100, false, {
      scoreMultiplier: 0.5,
    });

    // baseScore: 150 * 0.5 = 75, killBonus: 100 => 175
    expect(res.earnedScore).toBe(175);
    expect(res.totalScore).toBe(175);
  });

  it('should scale fever delta by feverMultiplier', () => {
    // 0.33x fever multiplier (e.g. gatling)
    const res = manager.registerHit('PERFECT', 0, false, {
      feverMultiplier: 0.33,
    });

    // feverDelta: round(2 * 0.33) = 1
    expect(res.feverGauge).toBe(1);
    expect(res.isFeverReady).toBe(false);
  });

  it('should scale both base and kill fever delta by feverMultiplier on kill', () => {
    const res = manager.registerHit('PERFECT', 50, true, {
      scoreMultiplier: 0.5,
      feverMultiplier: 0.33,
    });

    // baseScore: 150 * 0.5 = 75, kill: 50 => earned: 125
    expect(res.earnedScore).toBe(125);

    // fever: round(2 * 0.33) = 1 + round(4 * 0.33) = 1 => delta = 2
    expect(res.feverGauge).toBe(2);
  });

  it('should prevent fever overcharge while respecting MAX_GAUGE', () => {
    manager.forceSetFeverGauge(98);
    const res = manager.registerHit('PERFECT', 0, true, {
      feverMultiplier: 0.5,
    });

    // 98 + (round(2 * 0.5) + round(4 * 0.5)) = 98 + (1 + 2) = 101 => clamped to 100
    expect(res.feverGauge).toBe(100);
    expect(res.isFeverReady).toBe(true);
  });
});
