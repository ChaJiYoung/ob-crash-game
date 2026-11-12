import { describe, it, expect } from 'vitest';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('boss distance and wave mix', () => {
  it('bosses stand farther away and minions land farther away', () => {
    expect(GAME_TUNING.boss.startRadiusM).toBe(20);
    expect(GAME_TUNING.boss.stopRadiusM).toBe(14);
    expect(GAME_TUNING.boss.minionDrop.minRadiusM).toBe(10);
    expect(GAME_TUNING.boss.minionDrop.maxRadiusM).toBe(18);
  });

  it('gatling magazines are 35-50', () => {
    expect(GAME_TUNING.maxAmmoByWeapon.gatling).toEqual({ 1: 35, 2: 40, 3: 45, 4: 50 });
  });

  it('obi share falls in waves 2, 3 and 5', () => {
    const share = (w: number) => {
      const kinds = GAME_TUNING.waves[w - 1].kinds as readonly string[];
      return kinds.filter((k) => k === 'obi').length / kinds.length;
    };
    expect(share(2)).toBe(0.25);
    // 웨이브 3에 chalang이 추가되어(2026-11-12, 임시 배치 D09) 5개 중 obi 1개 = 0.2. 웨이브 5와 같아졌다.
    expect(share(3)).toBe(0.2);
    expect(share(5)).toBe(0.2);
  });

  it('a shell from a boss at its stop distance starts at the boss', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    const shell = e.spawnMonsterProjectile(1000, 'boss', { thetaRad: 0, radiusM: GAME_TUNING.boss.stopRadiusM });
    expect(shell.radiusM).toBe(GAME_TUNING.boss.stopRadiusM);
  });
});
