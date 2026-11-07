import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectRoundOverlay } from '../src/pc/components/SelectRoundOverlay';
import { getPlayerPresentation } from '../src/pc/playerPresentation';
import { createInitialSlots, chooseSlotInput } from '../src/pc/coopSlots';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';
import { buildHudSnapshot } from '../src/pc/hudSnapshot';

describe('Co-op Select Round Overlay (P05-T03)', () => {
  it('renders solo selection view without split background, wait box, or player badges', () => {
    const soloSlots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    const presentations = getPlayerPresentation({
      playerCount: 1,
      slotIndexMap: { 1: 0 },
      slots: soloSlots,
    });

    const html = renderToStaticMarkup(
      <SelectRoundOverlay
        selection={{
          kind: 'weapon',
          done: [false],
          pickedLabels: [null],
        }}
        presentations={presentations}
        cardAnchors={[{ ownerIndex: 0, leftPercent: 50, topPercent: 50 }]}
      />
    );

    expect(html).toContain('시작 무기를 쏴서 고르세요');
    expect(html).toContain('카드를 맞히면 해당 무기로 게임이 시작됩니다');
    expect(html).not.toContain('select-split-left');
    expect(html).not.toContain('select-split-right');
    expect(html).not.toContain('select-done-box');
    expect(html).not.toContain('card-owner-badge');
  });

  it('renders co-op both-selecting view with split background and owner badges', () => {
    const p1Res = chooseSlotInput(createInitialSlots(), 1, 'mobile');
    const coopSlots = chooseSlotInput(p1Res.slots, 2, 'mouse').slots;
    const presentations = getPlayerPresentation({
      playerCount: 2,
      slotIndexMap: { 1: 0, 2: 1 },
      slots: coopSlots,
    });

    const html = renderToStaticMarkup(
      <SelectRoundOverlay
        selection={{
          kind: 'weapon',
          done: [false, false],
          pickedLabels: [null, null],
        }}
        presentations={presentations}
        cardAnchors={[
          { ownerIndex: 0, leftPercent: 30, topPercent: 50 },
          { ownerIndex: 1, leftPercent: 70, topPercent: 50 },
        ]}
      />
    );

    expect(html).toContain('각자 시작 무기를 쏴서 고르세요');
    expect(html).toContain('내 색 십자선으로 내 카드만 맞힐 수 있어요');
    expect(html).toContain('select-split-left');
    expect(html).toContain('select-split-right');
    expect(html).toContain('select-split-divider');
    expect(html).toContain('card-owner-badge-1P');
    expect(html).toContain('card-owner-badge-2P');
    expect(html).not.toContain('select-done-box');
  });

  it('renders waiting box and status banner when 2P picks first', () => {
    const p1Res = chooseSlotInput(createInitialSlots(), 1, 'mobile');
    const coopSlots = chooseSlotInput(p1Res.slots, 2, 'mouse').slots;
    const presentations = getPlayerPresentation({
      playerCount: 2,
      slotIndexMap: { 1: 0, 2: 1 },
      slots: coopSlots,
    });

    const html = renderToStaticMarkup(
      <SelectRoundOverlay
        selection={{
          kind: 'weapon',
          done: [false, true],
          pickedLabels: [null, '황금 병따개'],
        }}
        presentations={presentations}
        cardAnchors={[{ ownerIndex: 0, leftPercent: 30, topPercent: 50 }]}
      />
    );

    expect(html).toContain('1P 선택 중 · 2P 선택 완료');
    expect(html).toContain('1P가 고르면 게임이 시작됩니다');
    expect(html).toContain('select-done-box');
    expect(html).toContain('✓ 황금 병따개 선택 완료');
    expect(html).toContain('1P 선택을 기다리는 중…');
    expect(html).not.toContain('남은 시간');
  });

  it('records last pick in engine and exposes it in HudSnapshot selection', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ playerCount: 2 });
    engine.openSelectRound('weapon', 1000);

    const snapBefore = buildHudSnapshot(engine, 1000);
    expect(snapBefore.selection.kind).toBe('weapon');
    expect(snapBefore.selection.done).toEqual([false, false]);
    expect(snapBefore.selection.pickedLabels).toEqual([null, null]);

    // 2P (index 1) shoots their revolver card
    const p1Targets = engine.activeTargets.filter(
      (t) => t.weaponSelectKind === 'revolver' && t.ownerIndex === 1
    );
    expect(p1Targets.length).toBe(1);

    const aim = engine.computeTargetAimCoords(p1Targets[0], 1.0, 1);
    const hitResult = engine.shootCardSelect(aim.targetNormX, aim.targetNormY, 2000, 1);
    expect(hitResult.fired).toBe(true);
    expect(engine.getPlayer(1).selectionDone).toBe(true);
    expect(engine.getPlayer(1).lastPick?.weapon).toBe('revolver');

    const snapAfter = buildHudSnapshot(engine, 2000);
    expect(snapAfter.selection.done).toEqual([false, true]);
    expect(snapAfter.selection.pickedLabels[1]).toBe(WEAPON_ARCHETYPE_SPECS.revolver.nameKo);
  });
});
