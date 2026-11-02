import { describe, it, expect } from 'vitest';
import {
  TARGET_SPECS,
  JUDGMENT_SPECS,
  FEVER_CONSTANTS,
  WEAPON_CONSTANTS,
  STAGE_CONSTANTS,
  ITEM_BUFF_SPECS,
} from '../src/shared/constants';
import { ItemBuffKind, TargetKind } from '../src/shared/types';

describe('Shared Protocol & Constants', () => {
  it('should define all 6 target specs with correct attributes', () => {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'];
    kinds.forEach((k) => {
      expect(TARGET_SPECS[k]).toBeDefined();
      expect(TARGET_SPECS[k].kind).toBe(k);
      expect(TARGET_SPECS[k].maxHp).toBeGreaterThan(0);
      expect(TARGET_SPECS[k].speedMps).toBeGreaterThan(0);
      expect(TARGET_SPECS[k].hitRadiusM).toBeGreaterThan(0);
      expect(TARGET_SPECS[k].killBonusScore).toBeGreaterThan(0);
    });

    // Check specific target specs
    expect(TARGET_SPECS.pilgood.maxHp).toBe(1);
    expect(TARGET_SPECS.caslight.maxHp).toBe(1);
    expect(TARGET_SPECS.obi.maxHp).toBe(2);
    expect(TARGET_SPECS.hanmac.maxHp).toBe(2);
    expect(TARGET_SPECS.bottle.maxHp).toBe(3);
    expect(TARGET_SPECS.bottle.speedMps).toBe(1.5);
    expect(TARGET_SPECS.bottle.killBonusScore).toBe(160);
    expect(TARGET_SPECS.bottle.isAirborne).toBe(false);
    expect(TARGET_SPECS.boss.maxHp).toBe(40);
    expect(TARGET_SPECS.boss.killBonusScore).toBe(1500);
  });

  it('should define 3-tier judgment thresholds and scores', () => {
    expect(JUDGMENT_SPECS.PERFECT.maxErrorRatio).toBe(0.25);
    expect(JUDGMENT_SPECS.PERFECT.baseScore).toBe(150);
    expect(JUDGMENT_SPECS.PERFECT.feverDelta).toBe(30);

    expect(JUDGMENT_SPECS.GREAT.maxErrorRatio).toBe(0.55);
    expect(JUDGMENT_SPECS.GREAT.baseScore).toBe(100);
    expect(JUDGMENT_SPECS.GREAT.feverDelta).toBe(20);

    expect(JUDGMENT_SPECS.GOOD.maxErrorRatio).toBe(1.00);
    expect(JUDGMENT_SPECS.GOOD.baseScore).toBe(50);
    expect(JUDGMENT_SPECS.GOOD.feverDelta).toBe(10);
  });

  it('should enforce fever rules and weapon specs', () => {
    expect(FEVER_CONSTANTS.MAX_GAUGE).toBe(100);
    expect(FEVER_CONSTANTS.MISS_PENALTY).toBe(5);
    expect(FEVER_CONSTANTS.DURATION_MS).toBe(6000);
    expect(FEVER_CONSTANTS.LOCK_WHEN_FULL).toBe(true);

    expect(WEAPON_CONSTANTS.MAX_AMMO).toBe(10);
    expect(WEAPON_CONSTANTS.AUTO_RELOAD_MS).toBe(1200);
    expect(WEAPON_CONSTANTS.RAPID_FIRE_HOLD_MS).toBe(250);
    expect(WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS).toBe(300);
    expect(WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2).toBe(4.8);
    expect(WEAPON_CONSTANTS.FEVER_AUTO_FIRE_INTERVAL_MS).toBe(95);

    expect(STAGE_CONSTANTS.SPAWN_RADIUS_M).toBe(24.0);
    expect(STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M).toBe(1.8);
    expect(STAGE_CONSTANTS.FAN_MARGIN_RATIO).toBe(0.80);
    expect(STAGE_CONSTANTS.PLAYER_MAX_LIVES).toBe(5);
    expect(STAGE_CONSTANTS.TOTAL_WAVES).toBe(5);
  });

  it('should define 4 item buff specs with 8s durations or instant life heal', () => {
    const itemKinds: ItemBuffKind[] = ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'];
    itemKinds.forEach((k) => {
      expect(ITEM_BUFF_SPECS[k]).toBeDefined();
      expect(ITEM_BUFF_SPECS[k].kind).toBe(k);
      expect(ITEM_BUFF_SPECS[k].displayName.length).toBeGreaterThan(0);
      expect(ITEM_BUFF_SPECS[k].auraColorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    expect(ITEM_BUFF_SPECS.power_shot.durationMs).toBe(8000);
    expect(ITEM_BUFF_SPECS.wide_scope.durationMs).toBe(8000);
    expect(ITEM_BUFF_SPECS.ice_freeze.durationMs).toBe(8000);
    expect(ITEM_BUFF_SPECS.bar_repair.durationMs).toBe(0);
  });
});
