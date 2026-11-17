import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { ScoreAndFeverManager } from '../src/pc/engine/ScoreAndFeverManager';
import { FEVER_CONSTANTS, JUDGMENT_SPECS, TARGET_SPECS, WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';
import { GAME_TUNING } from '../src/shared/gameTuning';

const mk = (
  kind: ActiveTargetEntity['kind'],
  thetaRad: number,
  radiusM: number,
  extra: Partial<ActiveTargetEntity> = {}
): ActiveTargetEntity => ({
  id: `${kind}_${thetaRad}_${radiusM}_${Math.random()}`,
  kind,
  hp: 99,
  maxHp: 99,
  radiusM,
  thetaRad,
  x: Math.sin(thetaRad) * radiusM,
  z: -Math.cos(thetaRad) * radiusM,
  speedMps: 0,
  hitRadiusM: TARGET_SPECS[kind].hitRadiusM,
  killBonusScore: 10,
  breached: false,
  ...extra,
});

let engine: BeerCrusherEngine;
let now = 1000;

beforeEach(() => {
  engine = new BeerCrusherEngine();
  engine.startGame({ withWeaponSelect: false });
  engine.startWave(6);
  (engine as any).spawnedInWave = 999;
  (engine as any).goldenCanSpawnedInWave = true;
  engine.activeTargets = [];
  now = 1000;
});

const shootGood = (primary: ActiveTargetEntity) => {
  const proj = engine.computeTargetAimCoords(primary);
  now += 1000;
  // errorRatio = 0.75 -> GREAT(0.55) 초과, GOOD(1.00) 이내 (왼쪽으로 비켜 쏴 오른쪽 side 대상이 주 대상이 되지 않게)
  const aimX = proj.targetNormX - (proj.apparentHitRadius * 0.75) / engine.aspect;
  return engine.shootAt(aimX, proj.targetNormY, now, 'press');
};

describe('side-kill judgment grade (D11) and revolver pierce order (D10)', () => {
  it('scores revolver pierce kills using the shot judgment grade (GOOD) without PERFECT fever bonus', () => {
    engine.getPlayer(0).weaponSystem.selectWeapon('revolver', 4);
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);

    const front = mk('pilgood', 0, 8, { hp: 99, maxHp: 99, killBonusScore: 10 });
    const rear = mk('pilgood', 0, 11, { hp: 0.1, maxHp: 1, killBonusScore: 25 });
    engine.activeTargets = [front, rear];

    const res = shootGood(front);
    expect(res.fired).toBe(true);
    expect(res.grade).toBe('GOOD');
    expect(res.killed).toBe(false);
    expect(engine.activeTargets).not.toContain(rear);

    const expected = new ScoreAndFeverManager();
    // 1. 관통 처치가 먼저 registerHit 호출, 2. 주 대상 명중이 다음으로 registerHit 호출
    expected.registerHit('GOOD', rear.killBonusScore, true);
    expected.registerHit('GOOD', 0, false, { scoreMultiplier: 1.0, feverMultiplier: 1.0 });

    const playerState = engine.getPlayer(0).scoreManager.getState();
    const expectedState = expected.getState();
    expect(playerState.totalScore).toBe(expectedState.totalScore);
    expect(playerState.totalScore).toBeGreaterThanOrEqual(
      Math.round(JUDGMENT_SPECS.GOOD.baseScore * GAME_TUNING.score.scale) * 2
    );
    expect(playerState.feverGauge).toBeCloseTo(FEVER_CONSTANTS.KILL_FEVER_DELTA, 5);
    expect(GAME_TUNING.fever.perfectDelta).toBeGreaterThan(0);
  });

  it('scores shotgun spread kills using the shot judgment grade (GOOD) without PERFECT fever bonus', () => {
    engine.getPlayer(0).weaponSystem.selectWeapon('shotgun', 4);
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);

    const front = mk('pilgood', 0, 8, { hp: 99, maxHp: 99, killBonusScore: 10 });
    const side = mk('pilgood', 0.04, 8.2, { hp: 0.1, maxHp: 1, killBonusScore: 30 });
    engine.activeTargets = [front, side];

    const res = shootGood(front);
    expect(res.fired).toBe(true);
    expect(res.grade).toBe('GOOD');
    expect(res.killed).toBe(false);
    expect(engine.activeTargets).not.toContain(side);

    const expected = new ScoreAndFeverManager();
    // 샷건은 주 대상 명중이 먼저 registerHit 호출, 그 다음 추가 타격 처치가 registerHit 호출
    expected.registerHit('GOOD', 0, false, { scoreMultiplier: 1.0, feverMultiplier: 1.0 });
    expected.registerHit('GOOD', side.killBonusScore, true);

    const playerState = engine.getPlayer(0).scoreManager.getState();
    const expectedState = expected.getState();
    expect(playerState.totalScore).toBe(expectedState.totalScore);
    expect(playerState.feverGauge).toBeCloseTo(FEVER_CONSTANTS.KILL_FEVER_DELTA, 5);
  });

  it('applies 60% damage to the 1st pierced target and 40% to the 2nd at revolver Lv.4', () => {
    engine.getPlayer(0).weaponSystem.selectWeapon('revolver', 4);
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);

    const front = mk('pilgood', 0, 7, { hp: 99, maxHp: 99 });
    const rear1 = mk('pilgood', 0, 9, { hp: 10, maxHp: 10 });
    const rear2 = mk('pilgood', 0, 12, { hp: 10, maxHp: 10 });
    engine.activeTargets = [front, rear1, rear2];

    const proj = engine.computeTargetAimCoords(front);
    now += 1000;
    const res = engine.shootAt(proj.targetNormX, proj.targetNormY, now, 'press');
    expect(res.fired).toBe(true);
    expect(res.grade).toBe('PERFECT');

    const baseDmg = Number(
      (WEAPON_ARCHETYPE_SPECS.revolver.levels[4].damagePerHit * JUDGMENT_SPECS.PERFECT.damageMultiplier).toFixed(3)
    );
    const dmg1 = Number((baseDmg * 0.6).toFixed(3));
    const dmg2 = Number((baseDmg * 0.4).toFixed(3));

    expect(rear1.hp).toBeCloseTo(10 - dmg1, 3);
    expect(rear2.hp).toBeCloseTo(10 - dmg2, 3);
  });
});
