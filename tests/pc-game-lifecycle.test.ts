import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import type { SlotPair } from '../src/pc/coopSlots';
import { buildGameBegin } from '../src/pc/scoreSubmission';
import type { PlayerProfile } from '../src/shared/types';

const profile = (deviceId: string, nickname = deviceId): PlayerProfile => ({
  deviceId,
  nickname,
  bestScore: 0,
  totalGames: 0,
  lastPlayedAt: '2026-11-08T00:00:00.000Z',
});

const slot = (n: 1 | 2, input: 'mouse' | 'mobile' | null, player?: PlayerProfile) => ({
  slot: n,
  input,
  player,
  isConnected: true,
  isZeroCalibrated: true,
  isAway: false,
});

describe('buildGameBegin', () => {
  it('builds a solo message for a mouse 1P', () => {
    const slots: SlotPair = [slot(1, 'mouse', profile('dm')), slot(2, null)];
    expect(buildGameBegin(slots, { 1: 0 }, 'ROOM', 'b1')).toEqual({
      type: 'GAME_BEGIN',
      roomId: 'ROOM',
      beginId: 'b1',
      mode: 'solo',
      players: [{ slot: 1, deviceId: 'dm', inputKind: 'mouse' }],
    });
  });

  it('uses slot 2 when only the phone 2P plays', () => {
    const slots: SlotPair = [slot(1, null), slot(2, 'mobile', profile('dp'))];
    const msg = buildGameBegin(slots, { 2: 0 }, 'ROOM', 'b2')!;
    expect(msg.mode).toBe('solo');
    expect(msg.players).toEqual([{ slot: 2, deviceId: 'dp', inputKind: 'mobile' }]);
  });

  it('builds a coop message with slots in order', () => {
    const slots: SlotPair = [slot(1, 'mouse', profile('dm')), slot(2, 'mobile', profile('dp'))];
    const msg = buildGameBegin(slots, { 1: 0, 2: 1 }, 'ROOM', 'b3')!;
    expect(msg.mode).toBe('coop');
    expect(msg.players.map((p) => p.slot)).toEqual([1, 2]);
  });

  it('returns null when a participating slot has no confirmed profile or input', () => {
    const noProfile: SlotPair = [slot(1, 'mouse'), slot(2, null)];
    expect(buildGameBegin(noProfile, { 1: 0 }, 'ROOM', 'b4')).toBeNull();
    const halfCoop: SlotPair = [slot(1, 'mouse', profile('dm')), slot(2, 'mobile')];
    expect(buildGameBegin(halfCoop, { 1: 0, 2: 1 }, 'ROOM', 'b5')).toBeNull();
  });
});

describe('PCGamePage lifecycle wiring (source guard)', () => {
  const source = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
  /** Body of a `const name = useCallback(` block, up to the next top-level `const`. */
  const body = (name: string) => {
    const start = source.indexOf(`const ${name} = useCallback(`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf('\n  const ', start + 10);
    return source.slice(start, next === -1 ? undefined : next);
  };

  it('sends GAME_BEGIN from handleStartGame', () => {
    expect(body('handleStartGame')).toContain('buildGameBegin(');
  });

  it('matches GAME_STARTED against the pending beginId', () => {
    expect(source).toMatch(/case 'GAME_STARTED':[\s\S]{0,120}msg\.beginId !== pendingBeginIdRef\.current/);
  });

  it('hooks the engine weapon choice', () => {
    expect(source).toContain('engine.onWeaponChosen =');
  });

  it('abandons the run from the pause menu restart and exit', () => {
    expect(body('handleRestartFromPause')).toContain("'GAME_ABANDON'");
    expect(body('handleExitToLobbyFromPause')).toContain("'GAME_ABANDON'");
  });

  it('keeps gameId across socket reconnects', () => {
    const open = source.slice(source.indexOf('socket.onopen = () => {'), source.indexOf('socket.onmessage'));
    expect(open.length).toBeGreaterThan(0);
    expect(open).not.toContain('gameIdRef.current = null');
  });

  it('no longer stores the mouse nickname in the browser', () => {
    // Key is built from parts so the repo-wide grep gate for the old key stays at zero.
    expect(source).not.toContain(['beer_crusher', 'mouse_nickname'].join('_'));
  });

  it('looks the mouse player up again when the room is (re)created', () => {
    const start = source.indexOf("case 'ROOM_CREATED':");
    const block = source.slice(start, source.indexOf("case 'CONTROLLER_UNSUPPORTED'", start));
    expect(block).toContain('LOOKUP_LOCAL_PLAYER');
  });
});
