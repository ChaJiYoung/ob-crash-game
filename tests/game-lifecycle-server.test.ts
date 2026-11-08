import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startHarness, beginGame, Harness, Inbox, open } from './helpers/wsHarness';
import { stats } from './helpers/dbFixtures';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';
import type { GameBeginPlayer } from '../src/shared/types';

describe('game lifecycle over the websocket', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await startHarness({});
  });
  afterEach(async () => {
    await h.cleanup();
  });

  const send = (inbox: Inbox, msg: Record<string, unknown>) => inbox.ws.send(JSON.stringify(msg));
  const solo = (deviceId = 'dev1'): GameBeginPlayer[] => [{ slot: 1, deviceId, inputKind: 'mobile' }];
  const errors = (inbox: Inbox, code: string) => inbox.messages.filter((m) => m.type === 'ERROR' && m.code === code);
  const waitError = async (inbox: Inbox, code: string) => {
    await inbox.waitFor(() => errors(inbox, code).length > 0);
  };
  const count = (sql: string) => h.server.db.conn.prepare(sql).pluck().get() as number;
  const game = (id: number) => h.server.db.conn.prepare('SELECT * FROM games WHERE id = ?').get(id) as any;
  const submit = (gameId: unknown, score = 20000, over: Record<string, unknown> = {}) =>
    send(h.pc, {
      type: 'GAME_SCORE_SUBMIT', roomId: h.roomId, deviceId: 'dev1', gameId, score, waveReached: 7, maxCombo: 90,
      rulesetVersion: RANKING_RULESET_VERSION, stats: stats({ totalScore: score }), ...over,
    });

  it('rejects GAME_BEGIN from a phone socket', async () => {
    const phone = await h.phone('dev1', 1);
    send(phone, { type: 'GAME_BEGIN', roomId: h.roomId, beginId: 'x', mode: 'solo', players: solo() });
    await waitError(phone, 'NOT_ROOM_HOST');
    expect(count('SELECT COUNT(*) FROM games')).toBe(0);
  });

  it('rejects mismatched, unregistered and malformed participants', async () => {
    await h.phone('dev1', 1);
    const begin = (mode: string, players: unknown[]) =>
      send(h.pc, { type: 'GAME_BEGIN', roomId: h.roomId, beginId: 'x', mode, players });
    const rejections = () => errors(h.pc, 'GAME_BEGIN_REJECTED').length;

    // seat holds dev1, message claims another device
    h.server.playerStore.registerOrUpdateNickname('other', '다른사람');
    begin('solo', [{ slot: 1, deviceId: 'other', inputKind: 'mobile' }]);
    await h.pc.waitFor(() => rejections() === 1);

    // seated but never registered: DEVICE_CHECK seats without a profile
    const ghost = new Inbox(await open(`ws://localhost:${h.server.port}`));
    send(ghost, { type: 'DEVICE_CHECK', roomId: h.roomId, deviceId: 'ghost', slot: 2 });
    await ghost.waitFor(() => ghost.of('AUTH_RESULT').length > 0);
    begin('solo', [{ slot: 2, deviceId: 'ghost', inputKind: 'mobile' }]);
    await h.pc.waitFor(() => rejections() === 2);
    expect(count(`SELECT COUNT(*) FROM players WHERE id = 'ghost'`)).toBe(0);

    // malformed: coop with one player, duplicate slot, two mice
    begin('coop', [{ slot: 1, deviceId: 'dev1', inputKind: 'mobile' }]);
    await h.pc.waitFor(() => rejections() === 3);
    begin('coop', [{ slot: 1, deviceId: 'dev1', inputKind: 'mobile' }, { slot: 1, deviceId: 'other', inputKind: 'mouse' }]);
    await h.pc.waitFor(() => rejections() === 4);
    h.server.playerStore.registerOrUpdateNickname('mouse1', '마우스일');
    h.server.playerStore.registerOrUpdateNickname('mouse2', '마우스이');
    begin('coop', [{ slot: 1, deviceId: 'mouse1', inputKind: 'mouse' }, { slot: 2, deviceId: 'mouse2', inputKind: 'mouse' }]);
    await h.pc.waitFor(() => rejections() === 5);

    expect(count('SELECT COUNT(*) FROM games')).toBe(0);
    ghost.ws.close();
  });

  it('checks mouse participants against the registered local player of the slot', async () => {
    h.server.playerStore.registerOrUpdateNickname('mouse1', '마우스일');
    const begin = (beginId: string) =>
      send(h.pc, { type: 'GAME_BEGIN', roomId: h.roomId, beginId, mode: 'solo', players: [{ slot: 1, deviceId: 'mouse1', inputKind: 'mouse' }] });
    // never looked up / registered: rejected
    begin('m1');
    await h.pc.waitFor(() => errors(h.pc, 'GAME_BEGIN_REJECTED').length === 1);
    // after LOOKUP_LOCAL_PLAYER: accepted
    send(h.pc, { type: 'LOOKUP_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'mouse1', slot: 1 });
    await h.pc.waitFor(() => h.pc.of('LOCAL_PLAYER_REGISTERED').length > 0);
    begin('m2');
    await h.pc.waitFor(() => h.pc.of('GAME_STARTED', (m) => m.beginId === 'm2').length > 0);
    // registered to slot 1, claimed on slot 2: rejected
    send(h.pc, { type: 'GAME_BEGIN', roomId: h.roomId, beginId: 'm3', mode: 'solo', players: [{ slot: 2, deviceId: 'mouse1', inputKind: 'mouse' }] });
    await h.pc.waitFor(() => errors(h.pc, 'GAME_BEGIN_REJECTED').length === 2);
  });

  it('creates a game on GAME_BEGIN and abandons the previous one in the same room', async () => {
    await h.phone('dev1', 1);
    const beginId = 'fixed-begin-id';
    send(h.pc, { type: 'GAME_BEGIN', roomId: h.roomId, beginId, mode: 'solo', players: solo() });
    await h.pc.waitFor(() => h.pc.of('GAME_STARTED').length > 0);
    const started = h.pc.of('GAME_STARTED')[0];
    expect(started.beginId).toBe(beginId);
    expect(typeof started.gameId).toBe('number');
    expect(game(started.gameId)).toMatchObject({ status: 'playing', room_id: h.roomId, mode: 'solo' });

    const second = await beginGame(h.pc, h.roomId, 'solo', solo());
    expect(game(started.gameId).status).toBe('abandoned');
    expect(game(second).status).toBe('playing');
  });

  it('records the chosen weapon', async () => {
    await h.phone('dev1', 1);
    const gameId = await beginGame(h.pc, h.roomId, 'solo', solo());
    send(h.pc, { type: 'WEAPON_CHOSEN', roomId: h.roomId, gameId, slot: 1, weaponKind: 'revolver' });
    await h.pc.waitFor(() => count(`SELECT COUNT(*) FROM game_players WHERE weapon_kind = 'revolver'`) === 1);
  });

  it('GAME_ABANDON abandons the game and later submissions are refused', async () => {
    await h.phone('dev1', 1);
    const gameId = await beginGame(h.pc, h.roomId, 'solo', solo());
    send(h.pc, { type: 'GAME_ABANDON', roomId: h.roomId, gameId });
    await h.pc.waitFor(() => game(gameId).status === 'abandoned');
    submit(gameId);
    await waitError(h.pc, 'GAME_NOT_PLAYING');
  });

  it('refuses a submit without gameId or with broken stats', async () => {
    await h.phone('dev1', 1);
    const gameId = await beginGame(h.pc, h.roomId, 'solo', solo());
    submit(undefined);
    await waitError(h.pc, 'GAME_NOT_FOUND');
    submit(gameId, 100, { stats: { nonsense: true } });
    await waitError(h.pc, 'INVALID_STATS');
    expect(game(gameId).status).toBe('playing');
  });

  it('answers INVALID_STATS, not INTERNAL_ERROR, for stats the DB would refuse', async () => {
    await h.phone('dev1', 1);
    const gameId = await beginGame(h.pc, h.roomId, 'solo', solo());
    submit(gameId, 100, { stats: stats({ totalScore: 100, weaponLevel: 5 as any }) });
    await waitError(h.pc, 'INVALID_STATS');
    expect(errors(h.pc, 'INTERNAL_ERROR')).toHaveLength(0);
    expect(game(gameId).status).toBe('playing');
  });

  it('accepts a submit with the earlier gameId after the PC reconnects to the same room', async () => {
    await h.phone('dev1', 1);
    const gameId = await beginGame(h.pc, h.roomId, 'solo', solo());
    h.pc.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(game(gameId).status).toBe('playing'); // a dropped socket must not clean up the game

    const pc2 = new Inbox(await open(`ws://localhost:${h.server.port}`));
    send(pc2, { type: 'CREATE_ROOM', roomId: h.roomId });
    await pc2.waitFor(() => pc2.of('ROOM_CREATED').length > 0);
    send(pc2, {
      type: 'GAME_SCORE_SUBMIT', roomId: h.roomId, deviceId: 'dev1', gameId, score: 4321, waveReached: 7, maxCombo: 9,
      rulesetVersion: RANKING_RULESET_VERSION, stats: stats({ totalScore: 4321 }),
    });
    await pc2.waitFor(() => pc2.of('RANKING_UPDATED').length > 0);
    expect(pc2.of('RANKING_UPDATED')[0].updatedPlayer).toMatchObject({ bestScore: 4321, totalGames: 1 });
    expect(game(gameId).status).toBe('finished');
    pc2.ws.close();
  });
});
