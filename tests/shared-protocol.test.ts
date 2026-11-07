import { GAME_TUNING } from '../src/shared/gameTuning';
import { describe, it, expect } from 'vitest';
import {
  TARGET_SPECS,
  JUDGMENT_SPECS,
  FEVER_CONSTANTS,
  WEAPON_CONSTANTS,
  STAGE_CONSTANTS,
  ITEM_BUFF_SPECS,
  WEAPON_ARCHETYPE_SPECS,
  REWARD_CARD_SPECS,
} from '../src/shared/constants';
import { ItemBuffKind, RewardCardKind, TargetKind, WeaponKind, WeaponLevel } from '../src/shared/types';
import { WeaponSystem } from '../src/pc/engine/WeaponSystem';

describe('Shared Protocol, Constants & WeaponSystem', () => {
  it('should define all 6 target specs with rebalanced HP', () => {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'];
    kinds.forEach((k) => {
      expect(TARGET_SPECS[k]).toBeDefined();
      expect(TARGET_SPECS[k].kind).toBe(k);
      expect(TARGET_SPECS[k].maxHp).toBeGreaterThan(0);
      expect(TARGET_SPECS[k].speedMps).toBeGreaterThan(0);
      expect(TARGET_SPECS[k].hitRadiusM).toBeGreaterThan(0);
      expect(TARGET_SPECS[k].killBonusScore).toBeGreaterThan(0);
    });

    // Check specific rebalanced target specs (D03)
    expect(TARGET_SPECS.pilgood.maxHp).toBe(1);
    expect(TARGET_SPECS.caslight.maxHp).toBe(1);
    expect(TARGET_SPECS.obi.maxHp).toBe(2);
    expect(TARGET_SPECS.hanmac.maxHp).toBe(3); // Rebalanced from 2 -> 3
    expect(TARGET_SPECS.bottle.maxHp).toBe(4); // Rebalanced from 3 -> 4
    expect(TARGET_SPECS.bottle.speedMps).toBe(2.0);
    expect(TARGET_SPECS.bottle.killBonusScore).toBe(160);
    expect(TARGET_SPECS.bottle.isAirborne).toBe(false);
    expect(TARGET_SPECS.boss.maxHp).toBe(60); // Rebalanced from 50 -> 60
    expect(TARGET_SPECS.boss.killBonusScore).toBe(1500);
  });

  it('should define 3-tier judgment thresholds and scores', () => {
    expect(JUDGMENT_SPECS.PERFECT.maxErrorRatio).toBe(0.25);
    expect(JUDGMENT_SPECS.PERFECT.baseScore).toBe(150);
    expect(JUDGMENT_SPECS.PERFECT.feverDelta).toBe(2);
    expect(JUDGMENT_SPECS.PERFECT.damageMultiplier).toBe(2.0);

    expect(JUDGMENT_SPECS.GREAT.maxErrorRatio).toBe(0.55);
    expect(JUDGMENT_SPECS.GREAT.baseScore).toBe(100);
    expect(JUDGMENT_SPECS.GREAT.feverDelta).toBe(0);
    expect(JUDGMENT_SPECS.GREAT.damageMultiplier).toBe(1.0);

    expect(JUDGMENT_SPECS.GOOD.maxErrorRatio).toBe(1.00);
    expect(JUDGMENT_SPECS.GOOD.baseScore).toBe(50);
    expect(JUDGMENT_SPECS.GOOD.feverDelta).toBe(0);
    expect(JUDGMENT_SPECS.GOOD.damageMultiplier).toBe(0.5);
  });

  it('should enforce 4s fever burst rules and weapon constants (D04)', () => {
    expect(FEVER_CONSTANTS.MAX_GAUGE).toBe(100);
    expect(FEVER_CONSTANTS.MISS_PENALTY).toBe(0);
    expect(FEVER_CONSTANTS.KILL_FEVER_DELTA).toBe(4);
    expect(FEVER_CONSTANTS.DURATION_MS).toBe(4000); // 4s ultra burst
    expect(FEVER_CONSTANTS.LOCK_WHEN_FULL).toBe(true);

    expect(WEAPON_CONSTANTS.RAPID_FIRE_HOLD_MS).toBe(250);
    expect(WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS).toBe(300);
    expect(WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2).toBe(4.8);
    expect(WEAPON_CONSTANTS.SNAP_GRACE_PERIOD_MS).toBe(1500);

    expect(STAGE_CONSTANTS.SPAWN_RADIUS_M).toBe(24.0);
    expect(STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M).toBe(1.8);
    expect(STAGE_CONSTANTS.FAN_MARGIN_RATIO).toBe(0.80);
    expect(STAGE_CONSTANTS.PLAYER_MAX_LIVES).toBe(5);
    expect(STAGE_CONSTANTS.TOTAL_WAVES).toBe(7);
  });

  it('should define 3 weapon archetypes across Lv.1~MAX with nerfed balance specs (D07, D08, D09, D11)', () => {
    const weaponKinds: WeaponKind[] = ['shotgun', 'revolver', 'gatling'];
    const levels: WeaponLevel[] = [1, 2, 3, 4];

    weaponKinds.forEach((kind) => {
      const archetype = WEAPON_ARCHETYPE_SPECS[kind];
      expect(archetype).toBeDefined();
      expect(archetype.kind).toBe(kind);
      expect(archetype.nameKo.length).toBeGreaterThan(0);
      expect(archetype.badgeIcon.length).toBeGreaterThan(0);
      expect(archetype.accentColorHex).toMatch(/^#[0-9a-fA-F]{6}$/);

      levels.forEach((lvl) => {
        const spec = archetype.levels[lvl];
        expect(spec).toBeDefined();
        expect(spec.level).toBe(lvl);
        expect(spec.damagePerHit).toBeGreaterThan(0);
        expect(spec.maxAmmo).toBeGreaterThan(0);
        expect(spec.reloadDurationMs).toBeGreaterThan(0);
        expect(spec.fireIntervalMs).toBeGreaterThan(0);
        expect(spec.skillCooldownMs).toBeGreaterThan(0);
        // Every weapon level can hold two skill charges
        expect(spec.maxSkillStock).toBe(2);
      });
    });

    // Check Shotgun specifics
    const sg = WEAPON_ARCHETYPE_SPECS.shotgun;
    expect(sg.levels[1].pelletCount).toBe(3);
    expect(sg.levels[1].damagePerHit).toBe(0.42); // 0.35 x 1.2 (tuning) -> 1.26 total hit
    expect(sg.levels[2].knockbackM).toBe(0.3);
    expect(sg.levels[4].pelletCount).toBe(6);
    expect(sg.levels[4].slowDurationMs).toBe(1000);
    expect(sg.levels[4].skillPlungerCount).toBe(22);

    // Check Revolver specifics
    const rev = WEAPON_ARCHETYPE_SPECS.revolver;
    const revScale = GAME_TUNING.weaponDamageScale.revolver; // damagePerHit = base x tuning scale
    expect(rev.levels[1].damagePerHit).toBeCloseTo(1.0 * revScale, 3);
    expect(rev.levels[1].pierceCount).toBe(1);
    expect(rev.levels[3].pierceCount).toBe(2);
    expect(rev.levels[2].damagePerHit).toBeCloseTo(1.05 * revScale, 3);
    expect(rev.levels[3].damagePerHit).toBeCloseTo(1.1 * revScale, 3);
    expect(rev.levels[4].damagePerHit).toBeCloseTo(1.15 * revScale, 3);
    expect(rev.levels[4].pierceDamageRatio).toBe(1.0);

    // Check Gatling specifics
    const gat = WEAPON_ARCHETYPE_SPECS.gatling;
    expect(gat.levels[1].damagePerHit).toBe(0.375); // 0.25 x 1.5 (tuning)
    expect(gat.levels[1].maxAmmo).toBe(30);
    expect(gat.levels[4].damagePerHit).toBe(0.75); // 0.50 x 1.5
    expect(gat.levels[4].maxAmmo).toBe(50);
    expect(gat.levels[4].fireIntervalMs).toBe(Math.round(83 * 0.7));
    expect(gat.levels[4].skillKnockbackM).toBe(5);
    expect(gat.levels[4].skillDamage).toBe(0.5);
    expect(gat.levels[4].skillBossDamage).toBe(3.5);
    expect(gat.levels[4].skillFoamCount).toBe(280);
  });

  it('should define 9 shoot-to-select reward card specs (D08)', () => {
    const cardKinds: RewardCardKind[] = [
      'weapon_level_up', 'rapid_reload', 'bar_repair', 'fever_boost', 'lucky_drop',
      'damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up',
    ];
    expect(Object.keys(REWARD_CARD_SPECS).length).toBe(9);
    cardKinds.forEach((k) => {
      expect(REWARD_CARD_SPECS[k]).toBeDefined();
      expect(REWARD_CARD_SPECS[k].kind).toBe(k);
      expect(REWARD_CARD_SPECS[k].nameKo.length).toBeGreaterThan(0);
      expect(REWARD_CARD_SPECS[k].badgeText.length).toBeGreaterThan(0);
      expect(REWARD_CARD_SPECS[k].colorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(REWARD_CARD_SPECS[k].cardSubtitleKo.length).toBeGreaterThan(0);
      expect(REWARD_CARD_SPECS[k].icon.length).toBeGreaterThan(0);
    });
  });

  it('golden can (addSkillStock) adds one charge: 0 -> 1, 1 -> 2, and never exceeds the max', () => {
    const gain = GAME_TUNING.goldenCan.skillStockGain;
    expect(gain).toBe(1);
    const ws = new WeaponSystem('shotgun', 1);
    expect(ws.getState().skillStock).toBe(0);

    ws.update(1000, false, 1000); // a recharge is in progress
    ws.addSkillStock(gain);
    expect(ws.getState().skillStock).toBe(1);
    expect(ws.getState().skillCooldownRemainingMs).toBeGreaterThan(0); // still charging toward the second

    ws.addSkillStock(gain);
    expect(ws.getState().skillStock).toBe(2);
    expect(ws.getState().skillCooldownRemainingMs).toBe(0);

    ws.addSkillStock(gain);
    expect(ws.getState().skillStock).toBe(2); // capped at the max
  });

  it('does not refill skill charges when reaching Lv.4, and reset() empties them', () => {
    const ws = new WeaponSystem('revolver', 1);
    ws.refillSkillInstant();
    ws.consumeSkill(1000);
    ws.consumeSkill(1050);
    expect(ws.getState().skillStock).toBe(0);
    const cooldownBefore = ws.getState().skillCooldownRemainingMs;
    ws.upgradeWeaponLevel(); // Lv.2
    ws.upgradeWeaponLevel(); // Lv.3
    ws.upgradeWeaponLevel(); // Lv.4
    expect(ws.getState().skillStock).toBe(0);
    expect(ws.getState().skillCooldownRemainingMs).toBe(cooldownBefore);
    ws.reset();
    expect(ws.getState().skillStock).toBe(0);
  });

  it('should manage weapon archetype, level progression, and skill cooldown in WeaponSystem', () => {
    const ws = new WeaponSystem('shotgun', 1);
    const initial = ws.getState();

    expect(initial.weaponKind).toBe('shotgun');
    expect(initial.weaponLevel).toBe(1);
    expect(initial.maxAmmo).toBe(14);
    expect(initial.ammo).toBe(14);
    expect(initial.skillStock).toBe(0); // selecting a weapon starts with no charges
    expect(initial.maxSkillStock).toBe(2);
    expect(initial.skillCooldownRemainingMs).toBe(0);

    // The first charge only arrives after a full cooldown (21s at Lv.1)
    expect(ws.consumeSkill(500)).toBe(false);
    ws.update(21500, false, 21000);
    expect(ws.getState().skillStock).toBe(1);
    expect(ws.getState().skillCooldownRemainingMs).toBe(21000); // the second charge starts charging
    ws.refillSkillInstant();

    // 1. Consume active skill with both charges available
    expect(ws.consumeSkill(1000)).toBe(true);
    expect(ws.getState().skillStock).toBe(1);
    expect(ws.getState().skillCooldownRemainingMs).toBe(21000); // Lv.1 cooldown starts with the first cast
    expect(ws.consumeSkill(1050)).toBe(true);
    expect(ws.getState().skillStock).toBe(0);

    // Trying to use skill again without stock fails
    expect(ws.consumeSkill(1100)).toBe(false);

    // 2. Advance time by 10s -> 11s remaining
    ws.update(11000, false, 10000);
    expect(ws.getState().skillStock).toBe(0);
    expect(ws.getState().skillCooldownRemainingMs).toBe(11000);

    // Advance remaining 11s -> one charge is back, and the next one starts charging because the stock is below the max of 2
    ws.update(22000, false, 11000);
    expect(ws.getState().skillStock).toBe(1);
    expect(ws.getState().skillCooldownRemainingMs).toBe(21000);

    // 21s more -> the second charge arrives and the cooldown stops
    ws.update(43000, false, 21000);
    expect(ws.getState().skillStock).toBe(2);
    expect(ws.getState().skillCooldownRemainingMs).toBe(0);

    // 3. Upgrade weapon level up to MAX (Lv.4)
    ws.upgradeWeaponLevel(); // Lv.2
    expect(ws.getState().weaponLevel).toBe(2);
    expect(ws.getState().maxAmmo).toBe(14);

    ws.upgradeWeaponLevel(); // Lv.3
    expect(ws.getState().weaponLevel).toBe(3);
    expect(ws.getState().maxAmmo).toBe(16);

    ws.upgradeWeaponLevel(); // Lv.4 MAX
    expect(ws.getState().weaponLevel).toBe(4);
    expect(ws.getState().maxAmmo).toBe(16);
    expect(ws.getState().maxSkillStock).toBe(2);
    expect(ws.getState().skillStock).toBe(2); // already full before the upgrade; Lv.4 adds nothing

    // 4. Test Rapid Reload Card Buff
    ws.applyRapidReloadBuff();
    expect(ws.getState().hasRapidReloadBuff).toBe(true);
    expect(ws.getState().maxAmmo).toBe(18); // 16 + 2 = 18
    expect(ws.getReloadDurationMs()).toBe(1056); // 1100 * 1.2 (tuning) * 0.8 = 1056

    // 5. Select Gatling archetype
    ws.selectWeapon('gatling', 1);
    expect(ws.getState().weaponKind).toBe('gatling');
    expect(ws.getState().maxAmmo).toBe(GAME_TUNING.maxAmmoByWeapon.gatling[1] + 2); // Lv.1 magazine + 2 (rapid reload buff active)
    expect(ws.getState().skillStock).toBe(0); // choosing a weapon starts with no charges at any level
  });
});