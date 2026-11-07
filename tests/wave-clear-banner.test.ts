import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildHudSnapshot, isHudSnapshotEqual, WAVE_CLEAR_BANNER_MS } from '../src/pc/hudSnapshot';

/** Runs an empty wave to completion at endMs so the engine records a wave clear. */
function clearWave(engine: any, startMs: number, endMs: number): void {
  engine.update(startMs, 0.016);
  engine.spawnedInWave = engine.waveDefinitions[engine.currentWave].totalSpawns;
  engine.activeTargets = [];
  engine.bossSpawned = true;
  engine.update(endMs, 0.016);
}

describe('wave clear banner and score breakdown (score-differentiation P01-T02)', () => {
  let engine: any;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
  });

  it('has no banner key before any wave is cleared', () => {
    expect(buildHudSnapshot(engine, 1000).waveClearKey).toBe('');
  });

  it('shows wave, seconds and bonus for the banner duration, then clears', () => {
    clearWave(engine, 1000, 6000);
    const bonus = engine.lastWaveClear.bonus;
    const key = buildHudSnapshot(engine, 6000).waveClearKey;
    expect(key).toBe(`1|5.0|${bonus}`);
    expect(buildHudSnapshot(engine, 6000 + WAVE_CLEAR_BANNER_MS - 1).waveClearKey).toBe(key);
    expect(buildHudSnapshot(engine, 6000 + WAVE_CLEAR_BANNER_MS).waveClearKey).toBe('');
  });

  it('is a stable string so the snapshot equality check treats repeated frames as equal', () => {
    clearWave(engine, 1000, 6000);
    const a = buildHudSnapshot(engine, 6100);
    const b = buildHudSnapshot(engine, 6200);
    expect(isHudSnapshotEqual(a, b)).toBe(true);
  });

  it('changes the snapshot when the banner appears or disappears', () => {
    clearWave(engine, 1000, 6000);
    const shown = buildHudSnapshot(engine, 6100);
    const hidden = buildHudSnapshot(engine, 6000 + WAVE_CLEAR_BANNER_MS + 100);
    expect(isHudSnapshotEqual(shown, hidden)).toBe(false);
  });

  it('breakdown parts add up to the total score', () => {
    clearWave(engine, 1000, 6000);
    engine.getPlayer(0).scoreManager.registerHit('GREAT', 30, true);
    const b = engine.getScoreBreakdown();
    expect(b.timeBonus).toBe(engine.lastWaveClear.bonus);
    expect(b.base).toBeGreaterThan(0);
    expect(b.base + b.timeBonus + b.precisionBonus).toBe(engine.getPlayer(0).scoreManager.getState().totalScore);
  });
});
