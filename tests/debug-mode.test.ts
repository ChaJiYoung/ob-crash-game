import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveRouteMode } from '../src/App';
import {
  DEBUG_CONFIG_STORAGE_KEY,
  clampDebugStartConfig,
  isDebugModeSearch,
  loadDebugStartConfig,
  presetForStart,
  saveDebugStartConfig,
} from '../src/pc/debug/debugMode';
import { buildGameBegin } from '../src/pc/scoreSubmission';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildHudSnapshot } from '../src/pc/hudSnapshot';
import { ArcadeOverlayHUD } from '../src/pc/components/ArcadeOverlayHUD';
import type { SlotPair } from '../src/pc/coopSlots';

describe('isDebugModeSearch', () => {
  it('debug=1만 켠다', () => {
    expect(isDebugModeSearch('?debug=1')).toBe(true);
    expect(isDebugModeSearch('?foo=bar&debug=1')).toBe(true);
    expect(isDebugModeSearch('?debug=0')).toBe(false);
    expect(isDebugModeSearch('')).toBe(false);
  });
  it('?debug=1은 PC 라우트로 간다', () => {
    expect(resolveRouteMode('/', '?debug=1')).toBe('PC');
  });
});

describe('debug config storage', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('없으면 W1 프리셋', () => {
    expect(loadDebugStartConfig()).toEqual(presetForStart('W1'));
  });
  it('깨진 JSON이면 W1 프리셋', () => {
    store.set(DEBUG_CONFIG_STORAGE_KEY, '{oops');
    expect(loadDebugStartConfig()).toEqual(presetForStart('W1'));
  });
  it('저장 후 그대로 읽힌다', () => {
    const cfg = presetForStart('W6');
    saveDebugStartConfig(cfg);
    expect(loadDebugStartConfig()).toEqual(cfg);
  });
  it('localStorage가 throw해도 기본값', () => {
    (globalThis as any).window = { get localStorage() { throw new Error('blocked'); } };
    expect(loadDebugStartConfig()).toEqual(presetForStart('W1'));
    expect(() => saveDebugStartConfig(presetForStart('EX'))).not.toThrow();
  });
  it('범위 밖 값은 보정된다', () => {
    const c = clampDebugStartConfig({ startAt: 'W6', weaponLevel: 9, cards: { damage_up: 99, hit_zone_up: -3 } });
    expect(c.weaponLevel).toBe(4);
    expect(c.cards.damage_up).toBe(3);
    expect(c.cards.hit_zone_up).toBe(0);
    expect(c.cards.skill_cooldown).toBe(presetForStart('W6').cards.skill_cooldown);
    expect(clampDebugStartConfig('nope').startAt).toBe('W1');
  });
  it('EX 프리셋은 MAX', () => {
    expect(presetForStart('EX')).toEqual({
      startAt: 'EX', weaponLevel: 4,
      cards: { damage_up: 3, skill_cooldown: 3, fever_extend: 3, hit_zone_up: 2, rapid_reload: 3, lucky_drop: 3 },
    });
  });
});

describe('buildGameBegin debug', () => {
  const slots = [
    { slot: 1, input: 'mouse', player: { deviceId: 'dm', nickname: 'dm', bestScore: 0, totalGames: 0, lastPlayedAt: '' }, isConnected: true, isZeroCalibrated: true, isAway: false },
    { slot: 2, input: null, isConnected: false, isZeroCalibrated: false, isAway: false },
  ] as unknown as SlotPair;
  it('debug를 실어 보낸다', () => {
    expect(buildGameBegin(slots, { 1: 0 }, 'ROOM', 'b1', presetForStart('EX'))?.debug).toEqual(presetForStart('EX'));
  });
  it('없으면 debug 키가 없다', () => {
    expect(buildGameBegin(slots, { 1: 0 }, 'ROOM', 'b1')).not.toHaveProperty('debug');
  });
});

describe('HUD debug badge', () => {
  const render = (isDebug: boolean) => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const snap = buildHudSnapshot(engine, 1000);
    return renderToStaticMarkup(
      React.createElement(ArcadeOverlayHUD, {
        isDebug,
        lives: snap.lives, maxLives: snap.maxLives, wave: snap.wave, totalWaves: 7,
        players: snap.players, presentations: [{ title: 'P1', accent: '#38bdf8' } as any], team: { livesTitle: 'BAR DEFENSE' },
      }),
    );
  };
  it('isDebug면 배지', () => {
    expect(render(true)).toContain('DEBUG · 무적');
    expect(render(false)).not.toContain('DEBUG · 무적');
  });
});
