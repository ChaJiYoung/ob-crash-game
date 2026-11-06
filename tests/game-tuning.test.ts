import { describe, it, expect } from 'vitest';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { FEVER_CONSTANTS, JUDGMENT_SPECS, WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { WeaponSystem } from '../src/pc/engine/WeaponSystem';

describe('GAME_TUNING (gameplay-polish P03-T01)', () => {
  it('feeds judgment, fever and skill cooldown constants', () => {
    expect(JUDGMENT_SPECS.PERFECT.damageMultiplier).toBe(GAME_TUNING.judgment.perfectDamage);
    expect(JUDGMENT_SPECS.GREAT.damageMultiplier).toBe(GAME_TUNING.judgment.greatDamage);
    expect(JUDGMENT_SPECS.GOOD.damageMultiplier).toBe(GAME_TUNING.judgment.goodDamage);
    expect(JUDGMENT_SPECS.PERFECT.feverDelta).toBe(GAME_TUNING.fever.perfectDelta);
    expect(FEVER_CONSTANTS.KILL_FEVER_DELTA).toBe(GAME_TUNING.fever.killDelta);
    ([1, 2, 3, 4] as const).forEach((lv) => {
      (['shotgun', 'revolver', 'gatling'] as const).forEach((kind) => {
        expect(WEAPON_ARCHETYPE_SPECS[kind].levels[lv].skillCooldownMs).toBe(GAME_TUNING.skillCooldownMsByLevel[lv]);
      });
    });
  });

  it('golden can adds only +30% fever and one skill charge', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    engine.weaponSystem.selectWeapon('shotgun', 4);
    engine.weaponSystem.consumeSkill(0);
    engine.weaponSystem.consumeSkill(0);
    expect(engine.weaponSystem.getState().skillStock).toBe(0);

    const can = engine.spawnGoldenCanTarget(1000);
    const p = engine.computeTargetAimCoords(can);
    const res = engine.shootAt(p.targetNormX, p.targetNormY, 1100);
    expect(res.goldenCanKilled).toBe(true);
    expect(engine.weaponSystem.getState().skillStock).toBe(1);
    const fever = engine.scoreManager.getState();
    expect(fever.isFeverReady).toBe(false);
    expect(fever.feverGauge).toBeGreaterThanOrEqual(GAME_TUNING.goldenCan.feverGain);
    expect(fever.feverGauge).toBeLessThan(60);
  });

  it('fever_boost card adds exactly +50 gauge', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.applyRewardCard('fever_boost', 1000);
    expect(engine.scoreManager.getState().feverGauge).toBe(50);
    engine.applyRewardCard('fever_boost', 2000);
    expect(engine.scoreManager.getState().feverGauge).toBe(100);
  });

  it('addSkillStock never exceeds max stock and clears cooldown when full', () => {
    const ws = new WeaponSystem('shotgun', 1);
    ws.consumeSkill(0);
    ws.addSkillStock(5);
    expect(ws.getState().skillStock).toBe(ws.getMaxSkillStock());
    expect(ws.getState().skillCooldownRemainingMs).toBe(0);
  });

  it('does not mutate the base weapon spec table', () => {
    // 35s Lv.1 comes from tuning, not the literal table
    expect(WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].skillCooldownMs).toBe(21000);
  });
});

describe('fever only lifts the ammo limit', () => {
  it('keeps the weapon fire interval during fever', () => {
    const ws = new WeaponSystem();
    const interval = ws.getFireIntervalMs('press');
    expect(ws.consumeShot(1000, true, 'fever').fired).toBe(true);
    expect(ws.canFire(1000 + interval - 1, true, 'fever')).toBe(false);
    expect(ws.canFire(1000 + interval, true, 'fever')).toBe(true);
  });
});

describe('wave time bonus tuning', () => {
  it('has a positive par time for every wave and a sane bonus table', () => {
    for (const w of GAME_TUNING.waves as readonly any[]) expect(w.parTimeSec).toBeGreaterThan(0);
    const t = GAME_TUNING.score.timeBonus;
    expect(t.maxPerWave).toBeGreaterThan(0);
    expect(t.bossWaveWeight).toBeGreaterThanOrEqual(1);
    expect(t.zeroAtParMult).toBeGreaterThan(1);
  });
});

describe('2026-11-05 skill / guard / magazine tuning', () => {
  const kinds = ['shotgun', 'revolver', 'gatling'] as const;
  const levels = [1, 2, 3, 4] as const;

  it('feeds every weapon level magazine from GAME_TUNING.maxAmmoByWeapon', () => {
    kinds.forEach((kind) =>
      levels.forEach((lv) => {
        expect(WEAPON_ARCHETYPE_SPECS[kind].levels[lv].maxAmmo).toBe(GAME_TUNING.maxAmmoByWeapon[kind][lv]);
      })
    );
  });

  it('starts the revolver with 10 rounds, gives the shotgun +4 over it (no pierce to make up for), and never shrinks the magazine on level up', () => {
    expect(GAME_TUNING.maxAmmoByWeapon.revolver[1]).toBe(10);
    expect(GAME_TUNING.maxAmmoByWeapon.shotgun[1]).toBe(14);
    ([1, 2, 3, 4] as const).forEach((l) => {
      expect(GAME_TUNING.maxAmmoByWeapon.shotgun[l] - GAME_TUNING.maxAmmoByWeapon.revolver[l]).toBe(4);
    });
    kinds.forEach((kind) => {
      for (let lv = 2; lv <= 4; lv++) {
        const l = lv as 2 | 3 | 4;
        expect(GAME_TUNING.maxAmmoByWeapon[kind][l]).toBeGreaterThanOrEqual(GAME_TUNING.maxAmmoByWeapon[kind][(l - 1) as 1 | 2 | 3]);
      }
    });
  });

  it('keeps the obi shield down at least 70% of its cycle', () => {
    const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;
    expect(guardDownMs / (guardUpMs + guardDownMs)).toBeGreaterThanOrEqual(0.7);
  });

  it('shortens the skill cooldown strictly with weapon level', () => {
    const cd = GAME_TUNING.skillCooldownMsByLevel;
    expect(cd[1]).toBeGreaterThan(cd[2]);
    expect(cd[2]).toBeGreaterThan(cd[3]);
    expect(cd[3]).toBeGreaterThan(cd[4]);
  });
});
