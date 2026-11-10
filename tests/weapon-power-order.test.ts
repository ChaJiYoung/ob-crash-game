import { describe, it, expect } from 'vitest';
import { WEAPON_ARCHETYPE_SPECS as S } from '../src/shared/constants';
import { GAME_TUNING } from '../src/shared/gameTuning';

/** 2026-11-10 D01~D05: 한 발 피해(GREAT) 서열은 리볼버 > 샷건 > 개틀링, 판정 허용 배율은 세 무기가 같다. */
describe('weapon power order (one shot, GREAT)', () => {
  ([1, 2, 3, 4] as const).forEach((l) => {
    it(`Lv.${l}: revolver > shotgun (all pellets) > gatling`, () => {
      const sg = S.shotgun.levels[l];
      const shotgun = sg.pelletCount * sg.damagePerHit;
      expect(S.revolver.levels[l].damagePerHit).toBeGreaterThan(shotgun);
      expect(shotgun).toBeGreaterThan(S.gatling.levels[l].damagePerHit);
    });
  });

  it('Lv.1 shotgun still one-shots a 1HP can on GREAT (D02 rounding guard)', () => {
    const sg = S.shotgun.levels[1];
    expect(sg.pelletCount * sg.damagePerHit).toBeGreaterThanOrEqual(1);
  });

  it('pierce ratios are 0.5 / 0.5 / 0.6 / 0.7', () => {
    expect(([1, 2, 3, 4] as const).map((l) => S.revolver.levels[l].pierceDamageRatio)).toEqual([0.5, 0.5, 0.6, 0.7]);
  });

  it('hit tolerance is 1.0 for every weapon', () => {
    expect(GAME_TUNING.hitZone.toleranceByWeapon).toEqual({ shotgun: 1.0, revolver: 1.0, gatling: 1.0 });
  });
});
