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
    e.getPlayer(0).weaponSystem.selectWeapon(weapon, 1);
    if (fever) {
      e.getPlayer(0).scoreManager.forceSetFeverGauge(100);
      e.getPlayer(0).scoreManager.activateFever(0);
    }
    const t = makeTarget('t');
    e.activeTargets.push(t);
    const p = e.computeTargetAimCoords(t);
    const res = e.shootAt(p.targetNormX, p.targetNormY, 1000, source);
    expect(res.fired).toBe(true);
    return 100 - t.hp;
  };

  it("deals the same damage for 'hold' versus 'press' (no hold penalty since 2026-11-09)", () => {
    expect(GAME_TUNING.fire.holdDamageByWeapon).toEqual({ shotgun: 1.0, revolver: 1.0, gatling: 1.0 });
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

  it("fires 'hold' shots at a fixed per-weapon interval that does not change with the weapon level", () => {
    expect(GAME_TUNING.fire.holdIntervalMsByWeapon).toEqual({ shotgun: 250, revolver: 200, gatling: 67 });
    for (const w of ['shotgun', 'revolver', 'gatling'] as const) {
      const ws = new WeaponSystem(w, 1);
      const fixed = GAME_TUNING.fire.holdIntervalMsByWeapon[w];
      for (const lv of [1, 2, 3, 4] as const) {
        ws.selectWeapon(w, lv);
        expect(ws.getFireIntervalMs('hold')).toBe(fixed);
      }
    }
  });

  it("keeps the real-gun order for hold fire (shotgun slower than revolver, revolver slower than gatling)", () => {
    const h = GAME_TUNING.fire.holdIntervalMsByWeapon;
    expect(h.shotgun).toBeGreaterThan(h.revolver);
    expect(h.revolver).toBeGreaterThan(h.gatling);
  });

  it("press shots still use the per-level interval, and fever auto-fire uses the press interval", () => {
    const ws = new WeaponSystem('gatling', 1);
    const l1 = ws.getFireIntervalMs('press');
    ws.selectWeapon('gatling', 4);
    expect(ws.getFireIntervalMs('press')).toBeLessThan(l1);
  });

  it("blocks a second hold shot before the hold interval has passed", () => {
    const ws = new WeaponSystem('shotgun', 1);
    const hold = ws.getFireIntervalMs('hold');
    expect(ws.consumeShot(1000, false, 'hold').fired).toBe(true);
    expect(ws.canFire(1000 + hold - 1, false, 'hold')).toBe(false);
    expect(ws.canFire(1000 + hold, false, 'hold')).toBe(true);
  });

  it('scales base fire interval by 0.7 and reload by 2.0', () => {
    expect(WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].fireIntervalMs).toBe(Math.round(320 * 0.7));
    expect(WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].reloadDurationMs).toBe(Math.round(1400 * GAME_TUNING.fire.reloadScale));
    expect(WEAPON_ARCHETYPE_SPECS.gatling.levels[3].maxAmmo).toBe(GAME_TUNING.maxAmmoByWeapon.gatling[3]);
  });

  it('makes the same aim offset miss on an ultrawide screen but hit on 16:9 (aspect correction)', () => {
    engine.getPlayer(0).weaponSystem.selectWeapon('revolver', 1);
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
    // 카드는 무기 성능과 무관한 메뉴라서 몬스터 판정(0.75 스케일·판정 강화·와이드 스코프)을 받지 않고 카드 실제 크기로 판정한다.
    expect(cardRadius).toBeGreaterThan(0);
    expect(cardRadius).not.toBeCloseTo(unscaledCard.apparentHitRadius, 5);
  });

  it('keeps the legacy (non aspect-corrected) zone in the sandbox', () => {
    engine.startSandboxMode();
    engine.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
    const t = makeTarget('s');
    engine.activeTargets.push(t);
    const p = engine.computeTargetAimCoords(t);
    // Offset that would miss with aspect correction (x1.78) but sits inside the legacy circle
    const res = engine.shootAt(p.targetNormX + p.apparentHitRadius * 0.9, p.targetNormY, 1000, 'hold');
    expect(res.grade).not.toBe('MISS');
  });
});
