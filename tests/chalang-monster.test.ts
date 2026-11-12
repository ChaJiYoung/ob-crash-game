import { describe, it, expect } from 'vitest';
import { TARGET_SPECS, STAGE_CONSTANTS } from '../src/shared/constants';
import { GAME_TUNING } from '../src/shared/gameTuning';

describe('chalang spec and tuning registration', () => {
  it('registers the chalang target spec with 3 HP', () => {
    expect(TARGET_SPECS.chalang.kind).toBe('chalang');
    expect(TARGET_SPECS.chalang.maxHp).toBe(3);
  });

  it('keeps the chalang tuning values from the decisions', () => {
    const c = GAME_TUNING.monsters.chalang;
    expect(c.submergeMinMs).toBe(1500);
    expect(c.submergeMaxMs).toBe(3000);
    expect(c.surfacedMs).toBe(1000);
    expect(c.minRadiusM).toBe(8);
    expect(c.rushAfterAppearances).toBe(3);
    expect(c.rushSpeedMult).toBe(3);
  });

  it('orders the submerge range and keeps the teleport radius between the defense line and spawn', () => {
    const c = GAME_TUNING.monsters.chalang;
    expect(c.submergeMinMs).toBeLessThan(c.submergeMaxMs);
    expect(c.minRadiusM).toBeGreaterThan(STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M);
    expect(c.minRadiusM).toBeLessThan(STAGE_CONSTANTS.SPAWN_RADIUS_M);
  });
});
