import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const stats = (engine: BeerCrusherEngine, s: Partial<Record<'PERFECT' | 'GREAT' | 'GOOD' | 'MISS', number>>) => {
  (engine as any).shotStats = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, ...s };
};

describe('precision bonus (score = hit points + one-off bonus at VICTORY)', () => {
  let engine: BeerCrusherEngine;
  const cfg = GAME_TUNING.score.precisionBonus;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
  });

  it('is k × weighted ratio^power, with MISS counting against the ratio', () => {
    stats(engine, { PERFECT: 50, GREAT: 30, GOOD: 10, MISS: 10 });
    const ratio = (50 * cfg.weights.PERFECT + 30 * cfg.weights.GREAT + 10 * cfg.weights.GOOD) / 100;
    const res = engine.getPrecisionStats();
    expect(res.shots).toBe(100);
    expect(res.ratio).toBeCloseTo(ratio, 6);
    expect(res.bonus).toBe(Math.round(cfg.k * Math.pow(ratio, cfg.power)));
  });

  it('does not grow with the number of shots (same ratio, same bonus)', () => {
    stats(engine, { PERFECT: 40, GREAT: 40, MISS: 20 });
    const small = engine.getPrecisionStats().bonus;
    stats(engine, { PERFECT: 400, GREAT: 400, MISS: 200 });
    expect(engine.getPrecisionStats().bonus).toBe(small);
  });

  it('rewards accuracy: a sloppier run earns a smaller bonus', () => {
    stats(engine, { PERFECT: 60, GREAT: 30, MISS: 10 });
    const sharp = engine.getPrecisionStats().bonus;
    stats(engine, { PERFECT: 20, GREAT: 40, GOOD: 20, MISS: 20 });
    expect(engine.getPrecisionStats().bonus).toBeLessThan(sharp);
  });

  it('gives nothing below the minimum shot count', () => {
    stats(engine, { PERFECT: cfg.minShots - 1 });
    expect(engine.getPrecisionStats().bonus).toBe(0);
  });

  it('is added exactly once, when the game is won', () => {
    stats(engine, { PERFECT: 60, GREAT: 30, MISS: 10 });
    const before = engine.scoreManager.getState().totalScore;
    const bonus = engine.getPrecisionStats().bonus;
    expect(bonus).toBeGreaterThan(0);
    (engine as any).declareVictory();
    (engine as any).declareVictory();
    expect(engine.gamePhase).toBe('VICTORY');
    expect(engine.scoreManager.getState().totalScore).toBe(before + bonus);
    expect(engine.getPrecisionStats().applied).toBe(bonus);
  });

  it('is not paid in the tutorial or sandbox', () => {
    const before = engine.scoreManager.getState().totalScore;
    stats(engine, { PERFECT: 100 });
    (engine as any).isTutorialMode = true;
    (engine as any).declareVictory();
    expect(engine.scoreManager.getState().totalScore).toBe(before);
  });

  it('counts a fired shot at an empty field as a MISS', () => {
    engine.activeTargets = [];
    // A shot at an empty field is a fired MISS; nothing else is recorded
    const r = engine.shootAt(0, 0, 5000, 'press');
    expect(r.fired).toBe(true);
    expect(engine.getPrecisionStats().shots).toBe(1);
    expect((engine as any).shotStats.MISS).toBe(1);
  });

  it('resets between games', () => {
    stats(engine, { PERFECT: 99 });
    engine.startGame({ withWeaponSelect: false });
    expect(engine.getPrecisionStats().shots).toBe(0);
    expect(engine.getPrecisionStats().applied).toBe(0);
  });
});
