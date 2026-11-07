import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { WeaponSystem } from '../src/pc/engine/WeaponSystem';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';

const makeTarget = (id: string, hp = 100): ActiveTargetEntity => ({
  id, kind: 'bottle', hp, maxHp: hp, radiusM: 8, thetaRad: 0, x: 0, z: -8, speedMps: 0,
  hitRadiusM: 1.0, killBonusScore: 0, breached: false,
});

describe('weapon rules (gameplay-polish P03-T02)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
  });

  const damageOf = (weapon: 'shotgun' | 'revolver' | 'gatling', source: 'press' | 'hold' | 'fever', fever = false) => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.activeTargets = [];
    e.weaponSystem.selectWeapon(weapon, 1);
    if (fever) {
      e.scoreManager.forceSetFeverGauge(100);
      e.scoreManager.activateFever(0);
    }
    const t = makeTarget('t');
    e.activeTargets.push(t);
    const p = e.computeTargetAimCoords(t);
    const res = e.shootAt(p.targetNormX, p.targetNormY, 1000, source);
    expect(res.fired).toBe(true);
    return 100 - t.hp;
  };

  it("deals 0.6x (gatling 0.85x) damage for 'hold' versus 'press'", () => {
    for (const w of ['shotgun', 'revolver', 'gatling'] as const) {
      const press = damageOf(w, 'press');
      const hold = damageOf(w, 'hold');
      expect(hold / press).toBeCloseTo(GAME_TUNING.fire.holdDamageByWeapon[w], 2);
    }
  });

  it("does not reduce damage for 'fever' shots or 'hold' during fever", () => {
    const feverPress = damageOf('revolver', 'press', true);
    expect(damageOf('revolver', 'fever', true)).toBeCloseTo(feverPress, 5);
    expect(damageOf('revolver', 'hold', true)).toBeCloseTo(feverPress, 5);
  });

  it("fires 'hold' shots at a shorter interval than 'press' shots", () => {
    for (const w of ['shotgun', 'revolver', 'gatling'] as const) {
      const ws = new WeaponSystem(w, 1);
      expect(ws.getFireIntervalMs('hold')).toBeLessThan(ws.getFireIntervalMs('press'));
    }
    const ws = new WeaponSystem('shotgun', 1);
    const press = ws.getFireIntervalMs('press');
    const hold = ws.getFireIntervalMs('hold');
    expect(ws.consumeShot(1000, false, 'hold').fired).toBe(true);
    expect(ws.canFire(1000 + hold, false, 'hold')).toBe(true);
    expect(ws.canFire(1000 + hold, false, 'press')).toBe(hold >= press);
  });

  it('scales base fire interval by 0.7 and reload by 2.0', () => {
    expect(WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].fireIntervalMs).toBe(Math.round(320 * 0.7));
    expect(WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].reloadDurationMs).toBe(Math.round(1400 * GAME_TUNING.fire.reloadScale));
    expect(WEAPON_ARCHETYPE_SPECS.gatling.levels[3].maxAmmo).toBe(GAME_TUNING.maxAmmoByWeapon.gatling[3]);
  });

  it('makes the same aim offset miss on an ultrawide screen but hit on 16:9 (aspect correction)', () => {
    engine.weaponSystem.selectWeapon('revolver', 1);
    const t = makeTarget('t');
    engine.activeTargets.push(t);
    const p = engine.computeTargetAimCoords(t);
    const aimX = p.targetNormX + (p.apparentHitRadius * 0.9 * 0.95) / (16 / 9);

    engine.aspect = 16 / 9;
    const hit = engine.shootAt(aimX, p.targetNormY, 1000, 'press');
    expect(hit.grade).not.toBe('MISS');

    engine.aspect = 2.39;
    const miss = engine.shootAt(aimX, p.targetNormY, 2000, 'press');
    expect(miss.grade).toBe('MISS');
  });

  // D30: 모든 모드·표적이 실전 판정 기준 하나로 통일되어 샌드박스와 카드도 동일한 0.75 스케일을 사용한다.
  it('applies the 0.75 hit zone scale uniformly across modes and targets (D30)', () => {
    const monster = makeTarget('m');
    engine.activeTargets.push(monster);
    const scaled = engine.computeTargetAimCoords(monster).apparentHitRadius;

    engine.startSandboxMode();
    const sandbox = engine.computeTargetAimCoords(monster).apparentHitRadius;
    // D30에 따라 샌드박스 몬스터도 실전과 동일한 판정 범위를 갖는다.
    expect(sandbox).toBeCloseTo(scaled, 5);

    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    engine.spawnWaveRewardCards(1000, false);
    const card = engine.activeTargets[0];
    const cardRadius = engine.computeTargetAimCoords(card).apparentHitRadius;
    const unscaledCard = engine.computeTargetAimCoords({ ...card, rewardCardKind: undefined, weaponSelectKind: undefined } as ActiveTargetEntity);
    // D30에 따라 카드도 동일한 판정 규칙을 적용받는다.
    expect(cardRadius).toBeCloseTo(unscaledCard.apparentHitRadius, 5);
  });

  it('keeps the legacy (non aspect-corrected) zone in the sandbox', () => {
    engine.startSandboxMode();
    engine.weaponSystem.selectWeapon('shotgun', 1);
    const t = makeTarget('s');
    engine.activeTargets.push(t);
    const p = engine.computeTargetAimCoords(t);
    // Offset that would miss with aspect correction (x1.78) but sits inside the legacy circle
    const res = engine.shootAt(p.targetNormX + p.apparentHitRadius * 0.9, p.targetNormY, 1000, 'hold');
    expect(res.grade).not.toBe('MISS');
  });
});
