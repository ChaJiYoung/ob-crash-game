import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { STAGE_CONSTANTS } from '../src/shared/constants';
import type { DebugStartConfig } from '../src/shared/types';

const breacher = (id: string, kind: string = 'pilgood'): ActiveTargetEntity =>
  ({ id, kind, hp: 1, maxHp: 1, radiusM: 0.1, thetaRad: 0, initialThetaRad: 0, x: 0, z: -0.1, speedMps: 1, hitRadiusM: 0.8, killBonusScore: 0, breached: false }) as ActiveTargetEntity;

function takeHit(engine: any, nowMs: number, kind?: string): void {
  // 멀리 있는 몬스터 하나를 남겨 웨이브 클리어(카드 라운드)로 넘어가지 않게 한다.
  const far = { ...breacher(`far${nowMs}`), z: -30, radiusM: 30, speedMps: 0 } as ActiveTargetEntity;
  engine.activeTargets = [breacher(`b${nowMs}`, kind), far];
  engine.spawnedInWave = 0;
  engine.lastSpawnTimeMs = nowMs;
  engine.update(nowMs, 0.05);
}

const cfg = (over: Partial<DebugStartConfig> = {}): DebugStartConfig => ({
  startAt: 'W6',
  weaponLevel: 3,
  cards: { damage_up: 2, skill_cooldown: 1, fever_extend: 2, hit_zone_up: 2, rapid_reload: 1, lucky_drop: 3 },
  ...over,
});

/** 모든 플레이어가 무기 선택 카드를 직접 쏴서 고른다. */
function pickWeapons(e: any, nowMs = 1000): void {
  for (const p of e.players) {
    const t = e.activeTargets.find((x: any) => !!x.weaponSelectKind && x.ownerIndex === p.index);
    const aim = e.computeTargetAimCoords(t, 1.0, p.index);
    e.shootCardSelect(aim.targetNormX, aim.targetNormY, nowMs, p.index);
  }
}

describe('debug invincibility', () => {
  it('목숨이 줄지 않고 피격은 센다', () => {
    const e: any = new BeerCrusherEngine();
    e.debugInvincible = true;
    e.startGame({ withWeaponSelect: false });
    for (let i = 0; i < 5; i += 1) takeHit(e, 100_000 + i * 1000);
    expect(e.lives).toBe(e.maxLives);
    expect(e.gamePhase).toBe('PLAYING');
    expect(e.damageTaken).toBe(5);
    expect(e.waveDamageTaken).toBe(5);
  });

  it('무적이 꺼져 있으면 기존처럼 GAMEOVER', () => {
    const e: any = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    for (let i = 0; i < e.maxLives; i += 1) takeHit(e, 100_000 + i * 1000);
    expect(e.gamePhase).toBe('GAMEOVER');
  });
});

describe('debug start', () => {
  it('W6 시작: 무기 선택 직후 웨이브 6, 레벨·카드 적용, 카드 기록 없음', () => {
    const e: any = new BeerCrusherEngine();
    e.debugStart = cfg();
    e.startGame({ withWeaponSelect: true });
    pickWeapons(e);
    const p = e.getPlayer(0);
    expect(e.currentWave).toBe(6);
    expect(p.weaponSystem.getState().weaponLevel).toBe(3);
    expect(p.cardStacks).toEqual({ damage_up: 2, skill_cooldown: 1, fever_extend: 2, hit_zone_up: 2 });
    expect(p.weaponSystem.getRapidReloadStacks()).toBe(1);
    expect(p.luckyDropStacks).toBe(3);
    expect(p.cardPicks).toEqual([]);
  });

  it('2인 W6: 두 플레이어 모두 적용', () => {
    const e: any = new BeerCrusherEngine();
    e.debugStart = cfg({ weaponLevel: 4 });
    e.startGame({ withWeaponSelect: true, playerCount: 2 });
    pickWeapons(e);
    expect(e.currentWave).toBe(6);
    for (const p of e.players) expect(p.weaponSystem.getState().weaponLevel).toBe(4);
  });

  it('EX 시작: 바로 EX, MAX 강화, 체크포인트 가능', () => {
    const e: any = new BeerCrusherEngine();
    e.debugStart = cfg({ startAt: 'EX', weaponLevel: 1 });
    e.startGame({ withWeaponSelect: true });
    pickWeapons(e);
    expect(e.isExActive).toBe(true);
    expect(e.mainCleared).toBe(true);
    expect(e.getPlayer(0).weaponSystem.getState().weaponLevel).toBe(4);
    const stats = e.getPlayRunStats(0, { allowExCheckpoint: true });
    expect(stats.waveReached).toBe(STAGE_CONSTANTS.TOTAL_WAVES + 1);
    expect(stats.exDangers).toEqual([{ danger: 1, damageTaken: 0 }]);
  });

  it('W1 시작은 웨이브를 바꾸지 않는다', () => {
    const e: any = new BeerCrusherEngine();
    e.debugStart = cfg({ startAt: 'W1', weaponLevel: 2 });
    e.startGame({ withWeaponSelect: true });
    pickWeapons(e);
    expect(e.currentWave).toBe(1);
    expect(e.getPlayer(0).weaponSystem.getState().weaponLevel).toBe(2);
  });

  it('debugStart가 없으면 일반 시작', () => {
    const e: any = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: true });
    pickWeapons(e);
    expect(e.currentWave).toBe(1);
    expect(e.getPlayer(0).weaponSystem.getState().weaponLevel).toBe(1);
  });
});

describe('EX danger damage', () => {
  it('EX 중 피격이 DANGER별로 쌓인다', () => {
    const e: any = new BeerCrusherEngine();
    e.debugInvincible = true;
    e.debugStart = cfg({ startAt: 'EX' });
    e.startGame({ withWeaponSelect: true });
    pickWeapons(e);
    for (const t of [2000, 2100]) {
      e.activeTargets = [breacher(`x${t}`)];
      e.update(t, 0.05);
    }
    expect(e.getExDangerDamage()).toEqual([{ danger: 1, damageTaken: 2 }]);
    expect(e.lives).toBe(e.maxLives);
  });
});
