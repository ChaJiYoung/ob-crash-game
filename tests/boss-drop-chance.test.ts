import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const mon = (extra: Partial<ActiveTargetEntity>) =>
  ({ id: 'm', kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 10, thetaRad: 0, initialThetaRad: 0, x: 0, z: -10, speedMps: 0, hitRadiusM: 0.8, killBonusScore: 1, breached: false, ...extra }) as ActiveTargetEntity;

function dropped(roll: number, summoned: boolean): boolean {
  const e = new BeerCrusherEngine();
  e.startGame({ withWeaponSelect: false });
  e.activeTargets = [];
  e.dropRng = () => roll;
  (e as any).handleMonsterKilled(mon({ isSummonedMinion: summoned }), 1000);
  return e.activeTargets.some((t) => t.isItem);
}

describe('item drop chance', () => {
  it('summoned minions drop at 10%', () => {
    expect(GAME_TUNING.boss.summonDropChance).toBe(0.1);
    expect(dropped(0.09, true)).toBe(true);
    expect(dropped(0.11, true)).toBe(false);
  });
  it('regular monsters stay at 4%', () => {
    expect(dropped(0.03, false)).toBe(true);
    expect(dropped(0.05, false)).toBe(false);
  });
});
