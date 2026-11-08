import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { FEVER_CONSTANTS } from '../src/shared/constants';

/**
 * 피버와 탄창은 별개다 (fever-ammo-and-aim-source D01, D02):
 * 피버는 총알 소모만 면제하고 탄창 수·장전 상태는 건드리지 않는다. 스킬은 피버·탄창과 독립이다.
 */
describe('fever and magazine are separate', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
    engine.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
  });

  const weapon = () => engine.getPlayer(0).weaponSystem;
  const startFever = (nowMs: number) => {
    engine.getPlayer(0).scoreManager.forceSetFeverGauge(100);
    expect(engine.activateFever(nowMs)).toBe(true);
  };
  /** 시간 흐름: 엔진과 같은 순서로 무기·피버 타이머를 한 칸 진행한다. */
  const tick = (nowMs: number, dtMs: number) => {
    const res = weapon().update(nowMs, dtMs);
    engine.getPlayer(0).scoreManager.updateFeverTimer(nowMs);
    return res;
  };

  /** 탄창을 left발 남기고 쓴다. */
  const spendDownTo = (left: number, startMs = 1000) => {
    let t = startMs;
    while (weapon().getState().ammo > left) {
      expect(weapon().consumeShot(t, false).fired).toBe(true);
      t += 400;
    }
    return t;
  };

  it('피버를 켜도, 피버 중 쏴도, 피버가 끝나도 탄창이 그대로다', () => {
    const t0 = spendDownTo(2);
    const before = weapon().getState();
    expect(before.ammo).toBe(2);
    expect(before.isReloading).toBe(false);

    startFever(t0);
    expect(weapon().getState().ammo).toBe(2);

    for (let i = 0; i < 5; i++) {
      const res = weapon().consumeShot(t0 + 1000 + i * 400, true);
      expect(res.fired).toBe(true);
      expect(res.ammo).toBe(2);
      expect(res.isReloading).toBe(false);
    }
    tick(t0 + 3000, 3000);
    expect(weapon().getState().ammo).toBe(2);

    tick(t0 + FEVER_CONSTANTS.DURATION_MS + 1, 1000);
    expect(engine.getPlayer(0).scoreManager.getState().isFeverActive).toBe(false);
    expect(weapon().getState().ammo).toBe(2);
    expect(weapon().getState().isReloading).toBe(false);
  });

  it('빈 탄창으로 장전 중일 때 피버를 켜도 장전이 취소되지 않고 탄창은 빈 채다', () => {
    const t0 = spendDownTo(0);
    const before = weapon().getState();
    expect(before.isReloading).toBe(true);

    startFever(t0);
    const after = weapon().getState();
    expect(after.ammo).toBe(0);
    expect(after.isReloading).toBe(true);
    expect(after.reloadEndTimeMs).toBe(before.reloadEndTimeMs);
  });

  it('피버 중에도 장전이 계속 진행되어 끝나면 탄창이 찬다', () => {
    const t0 = spendDownTo(0);
    const reloadEnd = weapon().getState().reloadEndTimeMs;
    startFever(t0);

    expect(tick(t0 + 10, 10).reloadedJustNow).toBe(false);
    expect(weapon().getState().ammo).toBe(0);

    const res = tick(reloadEnd + 1, reloadEnd + 1 - t0 - 10);
    expect(res.reloadedJustNow).toBe(true);
    expect(weapon().getState().ammo).toBe(weapon().getState().maxAmmo);
    expect(weapon().getState().isReloading).toBe(false);
    // 피버는 아직 진행 중일 수 있다: 장전 완료와 피버는 서로 영향이 없다.
    expect(engine.getPlayer(0).scoreManager.getState().isFeverActive).toBe(reloadEnd + 1 < t0 + FEVER_CONSTANTS.DURATION_MS);
  });

  it('피버 중 장전 중이어도 쏠 수 있고(무한 탄창) 반환값은 실제 상태다', () => {
    const t0 = spendDownTo(0);
    startFever(t0);
    expect(weapon().canFire(t0 + 500, true)).toBe(true);
    const res = weapon().consumeShot(t0 + 500, true);
    expect(res).toEqual({ fired: true, ammo: 0, isReloading: true });
    expect(weapon().getState().ammo).toBe(0);
  });

  it('피버가 아닐 때 빈 탄창은 여전히 쏠 수 없다', () => {
    const t0 = spendDownTo(0);
    expect(weapon().canFire(t0 + 500, false)).toBe(false);
  });

  describe('스킬은 피버·탄창과 독립이다', () => {
    const SKILL_COOLDOWN = () => weapon().getState().skillCooldownTotalMs;

    it('피버를 켜도 스킬 스택이 바뀌지 않는다', () => {
      weapon().refillSkillInstant();
      const before = weapon().getState();
      startFever(1000);
      const after = weapon().getState();
      expect(after.skillStock).toBe(before.skillStock);
      expect(after.skillCooldownRemainingMs).toBe(before.skillCooldownRemainingMs);
    });

    it('탄창이 0이고 장전 중이어도 스킬이 발동한다', () => {
      weapon().refillSkillInstant();
      const t0 = spendDownTo(0);
      expect(weapon().getState().isReloading).toBe(true);
      const stockBefore = weapon().getState().skillStock;
      const res = engine.triggerWeaponSkill(t0 + 100, 0);
      expect(res.activated).toBe(true);
      expect(weapon().getState().skillStock).toBe(stockBefore - 1);
    });

    it('피버 중에도 스킬이 발동하고 스택을 평소처럼 쓴다', () => {
      weapon().refillSkillInstant();
      startFever(1000);
      const stockBefore = weapon().getState().skillStock;
      const res = engine.triggerWeaponSkill(1500, 0);
      expect(res.activated).toBe(true);
      expect(weapon().getState().skillStock).toBe(stockBefore - 1);
    });

    it('스킬 충전은 피버 유무와 상관없이 같은 속도로 진행한다', () => {
      // 스택을 하나 쓰고 쿨다운이 시작된 상태를 두 무기 시스템에 똑같이 만든다.
      const other = new BeerCrusherEngine();
      other.startGame({ withWeaponSelect: false });
      other.getPlayer(0).weaponSystem.selectWeapon('shotgun', 1);
      weapon().refillSkillInstant();
      other.getPlayer(0).weaponSystem.refillSkillInstant();
      expect(engine.triggerWeaponSkill(1000, 0).activated).toBe(true);
      expect(other.triggerWeaponSkill(1000, 0).activated).toBe(true);

      startFever(1000);
      weapon().update(2000, 1000);
      other.getPlayer(0).weaponSystem.update(2000, 1000);
      expect(weapon().getState().skillCooldownRemainingMs).toBe(
        other.getPlayer(0).weaponSystem.getState().skillCooldownRemainingMs
      );
      expect(SKILL_COOLDOWN()).toBeGreaterThan(0);
    });
  });
});
