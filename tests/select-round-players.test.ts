import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('select-round-players (P02-T03)', () => {
  describe.each([1, 2] as const)('playerCount = %d select flow', (count) => {
    it('spawns 3 x n targets and ends only when all players pick', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ withWeaponSelect: true, playerCount: count });
      expect(engine.isWeaponSelectPending).toBe(true);

      const status = engine.getSelectionStatus();
      expect(status.kind).toBe('weapon');
      expect(status.done).toEqual(Array(count).fill(false));

      const selectTargets = engine.activeTargets.filter((t) => !!t.weaponSelectKind);
      expect(selectTargets.length).toBe(3 * count);

      for (let p = 0; p < count; p++) {
        const pTargets = selectTargets.filter((t) => t.ownerIndex === p);
        expect(pTargets.length).toBe(3);
      }

      // First player picks
      const p0Target = selectTargets.find((t) => t.ownerIndex === 0)!;
      const aim0 = engine.computeTargetAimCoords(p0Target, 1.0, 0);
      const res0 = engine.shootAt(aim0.targetNormX, aim0.targetNormY, 1000, 'press', 0);
      expect(res0.fired).toBe(true);

      if (count === 1) {
        expect(engine.isWeaponSelectPending).toBe(false);
        expect(engine.getSelectionStatus().kind).toBeNull();
      } else {
        expect(engine.isWeaponSelectPending).toBe(true);
        expect(engine.getSelectionStatus().done).toEqual([true, false]);

        // P2 targets remain
        const remainingP2 = engine.activeTargets.filter(
          (t) => !!t.weaponSelectKind && t.ownerIndex === 1
        );
        expect(remainingP2.length).toBe(3);

        // Second player picks
        const p1Target = remainingP2[0];
        const aim1 = engine.computeTargetAimCoords(p1Target, 1.0, 1);
        const res1 = engine.shootAt(aim1.targetNormX, aim1.targetNormY, 1100, 'press', 1);
        expect(res1.fired).toBe(true);

        expect(engine.isWeaponSelectPending).toBe(false);
        expect(engine.getSelectionStatus().kind).toBeNull();
      }
    });
  });

  it('has no time limit: waits indefinitely even after 60 seconds with 1P picked', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: true, playerCount: 2 });

    const p0Target = engine.activeTargets.find((t) => !!t.weaponSelectKind && t.ownerIndex === 0)!;
    const aim0 = engine.computeTargetAimCoords(p0Target, 1.0, 0);
    engine.shootAt(aim0.targetNormX, aim0.targetNormY, 1000, 'press', 0);

    expect(engine.getSelectionStatus().done).toEqual([true, false]);

    // Advance engine by 60 seconds
    for (let t = 2000; t <= 62000; t += 1000) {
      engine.update(t, 1.0);
    }

    expect(engine.isWeaponSelectPending).toBe(true);
    expect(engine.getSelectionStatus().done).toEqual([true, false]);
  });

  it('rejects cross-player target shots: P1 shooting P2 target returns fired: false', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: true, playerCount: 2 });

    // Pick P1's rightmost target (furthest from P0's group)
    const p1Targets = engine.activeTargets.filter((t) => !!t.weaponSelectKind && t.ownerIndex === 1);
    const p1Target = p1Targets[p1Targets.length - 1];
    const aimCross = engine.computeTargetAimCoords(p1Target, 1.0, 0);

    // Player 0 shoots at Player 1's target
    const res = engine.shootAt(aimCross.targetNormX, aimCross.targetNormY, 1000, 'press', 0);
    expect(res.fired).toBe(false);
    expect(engine.getSelectionStatus().done).toEqual([false, false]);
  });

  it('autoPickFor picks random card from player targets and finishes round if all done', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: true, playerCount: 2 });

    // P0 picks manually
    const p0Target = engine.activeTargets.find((t) => !!t.weaponSelectKind && t.ownerIndex === 0)!;
    const aim0 = engine.computeTargetAimCoords(p0Target, 1.0, 0);
    engine.shootAt(aim0.targetNormX, aim0.targetNormY, 1000, 'press', 0);
    expect(engine.getSelectionStatus().done).toEqual([true, false]);

    // Set dropRng to select the first remaining target (index 0)
    engine.dropRng = () => 0;
    engine.autoPickFor(1, 1500);

    expect(engine.isWeaponSelectPending).toBe(false);
    expect(engine.getPlayer(1).weaponSystem.getState().weaponKind).toBe('shotgun');
    expect(engine.getSelectionStatus().kind).toBeNull();
  });

  it('requires both players to select reward cards before wave advances', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.startWave(1);

    // Open reward card round at wave clear
    engine.openSelectRound('card', 5000, true);
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.getSelectionStatus().done).toEqual([false, false]);

    const cards0 = engine.activeTargets.filter((t) => !!t.rewardCardKind && t.ownerIndex === 0);
    const cards1 = engine.activeTargets.filter((t) => !!t.rewardCardKind && t.ownerIndex === 1);
    expect(cards0.length).toBe(3);
    expect(cards1.length).toBe(3);

    // P0 picks
    const aim0 = engine.computeTargetAimCoords(cards0[0], 1.0, 0);
    engine.shootAt(aim0.targetNormX, aim0.targetNormY, 6000, 'press', 0);
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.getSelectionStatus().done).toEqual([true, false]);

    // P1 picks
    const aim1 = engine.computeTargetAimCoords(cards1[0], 1.0, 1);
    engine.shootAt(aim1.targetNormX, aim1.targetNormY, 6100, 'press', 1);
    expect(engine.isRewardCardPending).toBe(false);
    expect(engine.getSelectionStatus().kind).toBeNull();
  });
});

describe('select targets need a body hit (P03-T02)', () => {
  const weapons = ['shotgun', 'revolver', 'gatling'] as const;

  function open(count: 1 | 2) {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: true, playerCount: count });
    return engine;
  }
  function cards(engine: BeerCrusherEngine, owner: number) {
    return engine.activeTargets
      .filter((t) => !!t.weaponSelectKind && t.ownerIndex === owner)
      .sort((a, b) => a.x - b.x);
  }

  it.each(weapons)('2P: shooting the other player card does nothing (%s)', (w) => {
    const engine = open(2);
    (engine as any).players[0].weaponSystem.selectWeapon(w);
    const inner2 = cards(engine, 1)[0];
    const aim = engine.computeTargetAimCoords(inner2, 1.0, 1);
    const res = engine.shootAt(aim.targetNormX, aim.targetNormY, 1000, 'press', 0);
    expect(res.fired).toBe(false);
    expect(engine.getSelectionStatus().done).toEqual([false, false]);
  });

  it('2P: the own inner card center selects that card', () => {
    const engine = open(2);
    const inner1 = cards(engine, 0)[2];
    const aim = engine.computeTargetAimCoords(inner1, 1.0, 0);
    const res = engine.shootAt(aim.targetNormX, aim.targetNormY, 1000, 'press', 0);
    expect(res.fired).toBe(true);
    expect(res.selectedWeapon).toBe(inner1.weaponSelectKind);
  });

  it('1P: center selects, 1.2x radius outside does not', () => {
    const engine = open(1);
    const mid = cards(engine, 0)[1];
    const aim = engine.computeTargetAimCoords(mid, 1.0, 0);
    const miss = engine.shootCardSelect(aim.targetNormX, aim.targetNormY + aim.apparentHitRadius * 1.2, 1000, 0);
    expect(miss.fired).toBe(false);
    const hit = engine.shootCardSelect(aim.targetNormX, aim.targetNormY, 1100, 0);
    expect(hit.fired).toBe(true);
  });

  it('hit radius is the same for every weapon', () => {
    const radii = weapons.map((w) => {
      const engine = open(1);
      (engine as any).players[0].weaponSystem.selectWeapon(w);
      return engine.computeTargetAimCoords(cards(engine, 0)[1], 1.0, 0).apparentHitRadius;
    });
    expect(radii[1]).toBeCloseTo(radii[0], 8);
    expect(radii[2]).toBeCloseTo(radii[0], 8);
  });
});
