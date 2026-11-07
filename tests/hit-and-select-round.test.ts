import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import type { ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';

describe('hit-and-select-round (P01-T04)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
  });

  describe('card selection hit resolution in 16:9', () => {
    beforeEach(() => {
      engine.startGame({ withWeaponSelect: false });
      engine.aspect = 16 / 9;
      engine.syncProjectionCamera();
      engine.activeTargets = [];
      engine.spawnWaveRewardCards(1000, false);
    });

    it('picks the nearest card for aimX = -0.9, -0.2, 0.2, 0.9', () => {
      // 3개의 카드 표적 (k=0, 1, 2)
      const cards = engine.activeTargets.filter((t) => !!t.rewardCardKind);
      expect(cards.length).toBe(3);

      const coords = cards.map((c) => engine.computeTargetAimCoords(c));
      // k=0은 왼쪽(음수 x), k=1은 중앙(x 근처 0), k=2는 오른쪽(양수 x)
      expect(coords[0].targetNormX).toBeLessThan(coords[1].targetNormX);
      expect(coords[1].targetNormX).toBeLessThan(coords[2].targetNormX);

      // x = -0.9 조준 시 첫 번째 카드(k=0)와 가장 가까움
      const aim1 = engine.computeTargetAimCoords(cards[0]);
      const resLeft = engine.shootCardSelect(-0.9, aim1.targetNormY, 2000, 0);
      expect(resLeft.fired).toBe(true);
      expect(resLeft.selectedCard).toBe(cards[0].rewardCardKind);
    });

    it('picks center card for aimX = -0.2 and 0.2', () => {
      // -0.2 조준 테스트
      const cards1 = engine.activeTargets.filter((t) => !!t.rewardCardKind);
      const aimY = engine.computeTargetAimCoords(cards1[1]).targetNormY;
      const resCenter1 = engine.shootCardSelect(-0.2, aimY, 2000, 0);
      expect(resCenter1.fired).toBe(true);
      expect(resCenter1.selectedCard).toBe(cards1[1].rewardCardKind);

      // 다시 카드 스폰 후 +0.2 조준 테스트
      engine.activeTargets = [];
      engine.spawnWaveRewardCards(3000, false);
      const cards2 = engine.activeTargets.filter((t) => !!t.rewardCardKind);
      const resCenter2 = engine.shootCardSelect(0.2, aimY, 4000, 0);
      expect(resCenter2.fired).toBe(true);
      expect(resCenter2.selectedCard).toBe(cards2[1].rewardCardKind);
    });

    it('picks right card for aimX = 0.9', () => {
      const cards = engine.activeTargets.filter((t) => !!t.rewardCardKind);
      const aimY = engine.computeTargetAimCoords(cards[2]).targetNormY;
      const resRight = engine.shootCardSelect(0.9, aimY, 2000, 0);
      expect(resRight.fired).toBe(true);
      expect(resRight.selectedCard).toBe(cards[2].rewardCardKind);
    });
  });

  describe('tutorial monster hit zone matches real game (D30)', () => {
    it('computes identical hit radius and zone scale for regular monster in tutorial vs normal mode', () => {
      const normalEngine = new BeerCrusherEngine();
      normalEngine.startGame({ withWeaponSelect: false });

      const tutorialEngine = new BeerCrusherEngine();
      tutorialEngine.startTutorialMode();

      const testTarget: ActiveTargetEntity = {
        id: 'test_monster',
        kind: 'pilgood',
        x: 0,
        customBaseY: 1.2,
        z: -5.0,
        radiusM: 5.0,
        thetaRad: 0,
        speedMps: 0,
        hp: 1,
        maxHp: 1,
        hitRadiusM: 0.8,
        killBonusScore: 10,
        breached: false,
        isItem: false,
        isProjectile: false,
        isGoldenCan: false,
      };

      const normalCoords = normalEngine.computeTargetAimCoords(testTarget);
      const tutorialCoords = tutorialEngine.computeTargetAimCoords(testTarget);

      expect(tutorialCoords.apparentHitRadius).toBeCloseTo(normalCoords.apparentHitRadius, 5);
      expect(tutorialCoords.targetNormX).toBeCloseTo(normalCoords.targetNormX, 5);
      expect(tutorialCoords.targetNormY).toBeCloseTo(normalCoords.targetNormY, 5);
    });
  });

  describe('unified select round for weapon and card', () => {
    it('sets ownerIndex 0 on all 3 weapon select targets, and selection closes round', () => {
      engine.startGame({ withWeaponSelect: false });
      engine.spawnWeaponSelectTargets(1000);

      expect(engine.selectRound?.kind).toBe('weapon');
      const weaponTargets = engine.activeTargets.filter((t) => !!t.weaponSelectKind);
      expect(weaponTargets.length).toBe(3);
      for (const target of weaponTargets) {
        expect(target.ownerIndex).toBe(0);
      }

      // 사격으로 무기 선택
      const aim = engine.computeTargetAimCoords(weaponTargets[0]);
      const res = engine.shootCardSelect(aim.targetNormX, aim.targetNormY, 2000, 0);
      expect(res.fired).toBe(true);
      expect(res.selectedWeapon).toBe(weaponTargets[0].weaponSelectKind);

      // 선택 라운드가 종료되어 표적이 제거되고 selectRound === null
      expect(engine.selectRound).toBeNull();
      expect(engine.isRewardCardPending).toBe(false);
      expect(engine.activeTargets.filter((t) => !!t.weaponSelectKind).length).toBe(0);
    });

    it('advances wave on card select when opened with isWaveClear = true', () => {
      engine.startGame({ withWeaponSelect: false });
      engine.currentWave = 1;
      engine.spawnWaveRewardCards(1000, true);

      expect(engine.selectRound?.kind).toBe('card');
      expect(engine.selectRound?.isWaveClear).toBe(true);

      const card = engine.activeTargets.find((t) => !!t.rewardCardKind)!;
      const aim = engine.computeTargetAimCoords(card);
      const res = engine.shootCardSelect(aim.targetNormX, aim.targetNormY, 2000, 0);

      expect(res.fired).toBe(true);
      expect(res.selectedCard).toBeDefined();
      expect(engine.selectRound).toBeNull();
      // 다음 웨이브로 진행됨
      expect(engine.currentWave).toBe(2);
    });
  });
});
