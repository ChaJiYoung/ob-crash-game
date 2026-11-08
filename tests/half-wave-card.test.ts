import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

/** 웨이브 절반 중간 카드(2026-11-08-half-wave-card-and-coop-density D01·D02). */
describe('half-wave mid card', () => {
  const plain = (t: any) => !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind;

  /** 필드 몬스터 하나를 처치 처리 경로로 죽인다(killedInWave를 올린 뒤 handleMonsterKilled). */
  const killOne = (e: any, now: number) => {
    const m = e.activeTargets.find(plain) ?? (e.spawnMonster ? null : null);
    const target = m ?? { kind: 'pilgood', thetaRad: 0, radiusM: 8, x: 0, z: -8, hp: 0, maxHp: 1, killBonusScore: 0 };
    if (m) e.activeTargets.splice(e.activeTargets.indexOf(m), 1);
    e.killedInWave += 1;
    e.handleMonsterKilled(target, now, 0);
  };

  const setup = (playerCount: 1 | 2, wave: number) => {
    const e: any = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false, playerCount });
    e.dropRng = () => 1; // 아이템 드롭 없음
    e.startWave(wave);
    return e;
  };

  it('deals the card exactly when kills reach half of the wave (wave 4 solo: 17)', () => {
    const e = setup(1, 4);
    expect(e.getCardKillTarget()).toBe(17);
    for (let i = 0; i < 16; i++) killOne(e, 1000 + i);
    expect(e.isRewardCardPending).toBe(false);
    killOne(e, 2000);
    expect(e.isRewardCardPending).toBe(true);
    expect(e.midCardGranted).toBe(true);
    expect(e.getWaveProgress().midCardGranted).toBe(true);
  });

  it('never deals a second mid card in the same wave', () => {
    const e = setup(1, 4);
    for (let i = 0; i < 17; i++) killOne(e, 1000 + i);
    expect(e.isRewardCardPending).toBe(true);
    e.isRewardCardPending = false;
    e.activeTargets = e.activeTargets.filter((t: any) => !t.rewardCardKind);
    for (let i = 0; i < 30; i++) killOne(e, 3000 + i);
    expect(e.isRewardCardPending).toBe(false);
  });

  it('resets on the next wave', () => {
    const e = setup(1, 4);
    for (let i = 0; i < 17; i++) killOne(e, 1000 + i);
    e.startWave(6);
    expect(e.midCardGranted).toBe(false);
    expect(e.getCardKillTarget()).toBe(20);
  });

  it('has no mid card in boss waves even past half', () => {
    const e = setup(1, 3);
    expect(e.getCardKillTarget()).toBeNull();
    for (let i = 0; i < 12; i++) killOne(e, 1000 + i);
    expect(e.isRewardCardPending).toBe(false);
  });

  it('scales with the 2-player wave size (wave 4: 68 spawns -> 34)', () => {
    const e = setup(2, 4);
    expect(e.waveDefinitions[4].totalSpawns).toBe(68);
    expect(e.getCardKillTarget()).toBe(34);
  });
});
