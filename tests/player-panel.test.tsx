import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerPanel } from '../src/pc/components/PlayerPanel';
import { getPlayerPresentation, getTeamPresentation } from '../src/pc/playerPresentation';
import { buildHudSnapshot, PlayerHudSnapshot } from '../src/pc/hudSnapshot';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { createInitialSlots, chooseSlotInput, updateSlot, buildSlotIndexMap } from '../src/pc/coopSlots';

function createMockPlayerSnapshot(overrides: Partial<PlayerHudSnapshot> = {}): PlayerHudSnapshot {
  return {
    index: 0,
    score: 12500,
    combo: 5,
    comboMultiplier: 1.5,
    maxCombo: 10,
    ammo: 6,
    maxAmmo: 8,
    isReloading: false,
    reloadDurationMs: 1500,
    feverGauge: 75,
    isFeverReady: false,
    isFeverActive: false,
    weaponKind: 'shotgun',
    weaponLevel: 2,
    skillStock: 1,
    maxSkillStock: 1,
    skillCooldownRemainingMs: 0,
    personalBuffs: [],
    isWideScopeActive: false,
    isPowerShotActive: false,
    passiveCards: [],
    isAway: false,
    ...overrides,
  };
}

describe('PlayerPanel and PlayerPresentation (P05-T01)', () => {
  describe('getPlayerPresentation and getTeamPresentation', () => {
    it('returns solo presentation for 1 player (no badge, amber color, state ring, center popup)', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: { deviceId: 'd1', nickname: '솔로', bestScore: 0, totalGames: 0, lastPlayedAt: '' } });
      const map = buildSlotIndexMap(slots);

      const pres = getPlayerPresentation({
        playerCount: 1,
        slotIndexMap: map,
        slots,
      });

      expect(pres).toHaveLength(1);
      expect(pres[0].slotLabel).toBeNull();
      expect(pres[0].color).toBe('#f59e0b');
      expect(pres[0].ringColorMode).toBe('state');
      expect(pres[0].popupSide).toBe('center');
      expect(pres[0].panelSide).toBe('left');
      expect(pres[0].inputKind).toBe('mouse');

      const team = getTeamPresentation(1);
      expect(team.livesTitle).toBe('BAR DEFENSE');
    });

    it('returns coop presentation for 2 players (1P #38bdf8 left, 2P #ff6b3d right, player ring)', () => {
      let slots = createInitialSlots();
      slots = chooseSlotInput(slots, 1, 'mouse').slots;
      slots = updateSlot(slots, 1, { player: { deviceId: 'd1', nickname: 'P1', bestScore: 0, totalGames: 0, lastPlayedAt: '' } });
      slots = chooseSlotInput(slots, 2, 'mobile').slots;
      slots = updateSlot(slots, 2, { player: { deviceId: 'd2', nickname: 'P2', bestScore: 0, totalGames: 0, lastPlayedAt: '' } });
      const map = buildSlotIndexMap(slots);

      const pres = getPlayerPresentation({
        playerCount: 2,
        slotIndexMap: map,
        slots,
      });

      expect(pres).toHaveLength(2);
      expect(pres[0].slotLabel).toBe('1P');
      expect(pres[0].color).toBe('#38bdf8');
      expect(pres[0].ringColorMode).toBe('player');
      expect(pres[0].panelSide).toBe('left');
      expect(pres[0].popupSide).toBe('left');
      expect(pres[0].inputKind).toBe('mouse');

      expect(pres[1].slotLabel).toBe('2P');
      expect(pres[1].color).toBe('#ff6b3d');
      expect(pres[1].ringColorMode).toBe('player');
      expect(pres[1].panelSide).toBe('right');
      expect(pres[1].popupSide).toBe('right');
      expect(pres[1].inputKind).toBe('mobile');

      const team = getTeamPresentation(2);
      expect(team.livesTitle).toBe('TEAM · BAR DEFENSE');
    });
  });

  describe('PlayerPanel rendering', () => {
    it('renders solo panel without 1P badge and with amber border', () => {
      const snapshot = createMockPlayerSnapshot();
      const pres = getPlayerPresentation({
        playerCount: 1,
        slotIndexMap: { 1: 0 },
        slots: createInitialSlots(),
      })[0];

      const html = renderToStaticMarkup(
        React.createElement(PlayerPanel, {
          snapshot,
          presentation: pres,
        })
      );

      expect(html).not.toContain('1P');
      expect(html).toContain('#f59e0b');
      expect(html).toContain('12,500');
      expect(html).toContain('5 COMBO');
    });

    it('renders 2P panel with 2P badge and #ff6b3d border', () => {
      const snapshot = createMockPlayerSnapshot({ index: 1, score: 25000 });
      const pres = getPlayerPresentation({
        playerCount: 2,
        slotIndexMap: { 1: 0, 2: 1 },
        slots: createInitialSlots(),
      })[1];

      const html = renderToStaticMarkup(
        React.createElement(PlayerPanel, {
          snapshot,
          presentation: pres,
        })
      );

      expect(html).toContain('2P');
      expect(html).toContain('#ff6b3d');
      expect(html).toContain('25,000');
    });

    it('shows input-specific skill prompt (flick vs right click, never both)', () => {
      const snapshot = createMockPlayerSnapshot({ skillStock: 1 });

      const mousePres = getPlayerPresentation({
        playerCount: 1,
        slotIndexMap: { 1: 0 },
        slots: chooseSlotInput(createInitialSlots(), 1, 'mouse').slots,
      })[0];

      const mouseHtml = renderToStaticMarkup(
        React.createElement(PlayerPanel, { snapshot, presentation: mousePres })
      );
      expect(mouseHtml).toContain('우클릭');
      expect(mouseHtml).not.toContain('위로 휙!');

      const phonePres = getPlayerPresentation({
        playerCount: 1,
        slotIndexMap: { 1: 0 },
        slots: chooseSlotInput(createInitialSlots(), 1, 'mobile').slots,
      })[0];

      const phoneHtml = renderToStaticMarkup(
        React.createElement(PlayerPanel, { snapshot, presentation: phonePres })
      );
      expect(phoneHtml).toContain('위로 휙!');
      expect(phoneHtml).not.toContain('우클릭');
    });

    it('displays 나감 tag and pauses skill display when player is away', () => {
      const snapshot = createMockPlayerSnapshot({ isAway: true });
      const pres = getPlayerPresentation({
        playerCount: 2,
        slotIndexMap: { 1: 0, 2: 1 },
        slots: createInitialSlots(),
      })[1];

      const html = renderToStaticMarkup(
        React.createElement(PlayerPanel, { snapshot, presentation: pres })
      );

      expect(html).toContain('나감');
      expect(html).toContain('정지됨');
      expect(html).toContain('opacity:0.45');
    });
  });

  describe('HudSnapshot structure', () => {
    it('contains players array and no top-level personal fields', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 2 });
      engine.getPlayer(0).scoreManager.registerHit('PERFECT', 100, true);
      engine.getPlayer(1).scoreManager.registerHit('PERFECT', 300, true);

      const snapshot = buildHudSnapshot(engine, 1000);
      expect(snapshot.players).toHaveLength(2);
      expect(snapshot.players[0].score).toBe(engine.getPlayer(0).scoreManager.getState().totalScore);
      expect(snapshot.players[1].score).toBe(engine.getPlayer(1).scoreManager.getState().totalScore);
      expect(snapshot.players[0].score).toBeGreaterThan(0);
      expect(snapshot.players[1].score).toBeGreaterThan(0);

      // Verify personal keys do not exist on top-level
      const snapshotObj = snapshot as any;
      expect(snapshotObj.score).toBeUndefined();
      expect(snapshotObj.ammo).toBeUndefined();
      expect(snapshotObj.weaponKind).toBeUndefined();
      expect(snapshotObj.feverGauge).toBeUndefined();
    });
  });
});

describe('PlayerPanel without a presentation (player count changed between HUD ticks)', () => {
  it('renders nothing instead of crashing the whole PC page', () => {
    const render = () =>
      renderToStaticMarkup(
        <PlayerPanel snapshot={createMockPlayerSnapshot({ index: 1 })} presentation={undefined} />
      );
    expect(render).not.toThrow();
    expect(render()).toBe('');
  });
});
