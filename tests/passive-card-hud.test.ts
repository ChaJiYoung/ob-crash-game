import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildHudSnapshot, isHudSnapshotEqual } from '../src/pc/hudSnapshot';
import { PassiveCardBar } from '../src/pc/components/ArcadeOverlayHUD';
import { REWARD_CARD_SPECS } from '../src/shared/constants';

const start = () => {
  const e = new BeerCrusherEngine();
  e.startGame({ withWeaponSelect: false });
  return e;
};
const apply = (e: BeerCrusherEngine, kind: string) => (e as any).applyRewardCard(kind, 1000);

describe('passive card HUD', () => {
  it('lists only stacking cards with their counts and resets with a new game', () => {
    const e = start();
    expect(e.getPassiveCardStacks()).toEqual([]);
    apply(e, 'damage_up');
    apply(e, 'damage_up');
    apply(e, 'rapid_reload');
    apply(e, 'lucky_drop');
    apply(e, 'bar_repair');
    apply(e, 'fever_boost');
    apply(e, 'weapon_level_up');
    expect(e.getPassiveCardStacks()).toEqual([
      { kind: 'damage_up', count: 2 },
      { kind: 'rapid_reload', count: 1 },
      { kind: 'lucky_drop', count: 1 },
    ]);
    e.startGame({ withWeaponSelect: false });
    expect(e.getPassiveCardStacks()).toEqual([]);
  });

  it('the snapshot stays equal until a card changes', () => {
    const e = start();
    const a = buildHudSnapshot(e, 1000);
    expect(isHudSnapshotEqual(a, buildHudSnapshot(e, 1000))).toBe(true);
    apply(e, 'hit_zone_up');
    expect(isHudSnapshotEqual(a, buildHudSnapshot(e, 1000))).toBe(false);
  });

  it('draws icons and counts, nothing when empty, and icons do not collide', () => {
    expect(renderToStaticMarkup(React.createElement(PassiveCardBar, { cards: [] }))).toBe('');
    const html = renderToStaticMarkup(React.createElement(PassiveCardBar, { cards: [{ kind: 'damage_up', count: 2 }] }));
    expect(html).toContain(REWARD_CARD_SPECS.damage_up.icon);
    expect(html).toContain('×');
    expect(html).toContain('공격력 강화');
    const icons = (['damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up', 'rapid_reload', 'lucky_drop'] as const).map((k) => REWARD_CARD_SPECS[k].icon);
    expect(new Set(icons).size).toBe(6);
  });
});
