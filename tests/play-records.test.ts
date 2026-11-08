import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidPlayRunStats } from '../server/PlayRecordStore';
import { Env, makeEnv, playSolo, register, stats } from './helpers/dbFixtures';

const row = <T = any>(env: Env, sql: string, ...args: unknown[]) => env.db.conn.prepare(sql).get(...args) as T;
const rows = <T = any>(env: Env, sql: string, ...args: unknown[]) => env.db.conn.prepare(sql).all(...args) as T[];

describe('play records (DB)', () => {
  let env: Env;
  beforeEach(() => {
    env = makeEnv();
    register(env, 'd1', 'd2', 'd3');
  });
  afterEach(() => env.db.close());

  it('beginGame creates a playing game and empty game_players rows', () => {
    const id = env.records.beginGame({
      roomId: 'ROOM', mode: 'solo', rulesetVersion: 5, startedAt: '2026-11-08T00:00:00.000Z',
      players: [{ slot: 1, playerId: 'd1', inputKind: 'mobile' }],
    });
    expect(row(env, 'SELECT * FROM games WHERE id = ?', id)).toMatchObject({ status: 'playing', team_key: null, mode: 'solo', total_score: null });
    expect(row(env, 'SELECT * FROM game_players WHERE game_id = ?', id)).toMatchObject({
      player_id: 'd1', slot: 1, input_kind: 'mobile', submitted_at: null, score: null, weapon_kind: null,
    });
  });

  it('a solo submit finishes the game and stores waves and card picks', () => {
    const picks = [
      { wave: 1, kind: 'damage_up', midWave: false, auto: false },
      { wave: 2, kind: 'rapid_reload', midWave: true, auto: true },
    ] as const;
    const id = playSolo(env, {
      playerId: 'd1', score: 1234, at: 5,
      over: { waves: [{ wave: 1, seconds: 14.5, bonus: 500, damageTaken: 2 }, { wave: 2, seconds: 20, bonus: 100 }], cardPicks: [...picks] },
    });
    expect(row(env, 'SELECT * FROM games WHERE id = ?', id)).toMatchObject({ status: 'finished', total_score: 1234, outcome: 'VICTORY', wave_reached: 7 });
    const waves = rows(env, 'SELECT * FROM game_waves WHERE game_id = ? ORDER BY wave_num', id);
    expect(waves).toHaveLength(2);
    expect(waves[0]).toMatchObject({ seconds: 14.5, damage_taken: 2 });
    expect(waves[1].damage_taken).toBeNull();
    const gp = row(env, 'SELECT * FROM game_players WHERE game_id = ?', id);
    expect(gp).toMatchObject({ score: 1234, kills: 180, accuracy: 0.7, weapon_kind: 'gatling', weapon_level: 4, shots_perfect: 30, cards_fever_extend: 2 });
    const cp = rows(env, 'SELECT * FROM game_player_card_picks WHERE game_player_id = ? ORDER BY pick_order', gp.id);
    expect(cp.map((c) => [c.pick_order, c.card_kind, c.mid_wave, c.auto_picked])).toEqual([[0, 'damage_up', 0, 0], [1, 'rapid_reload', 1, 1]]);
  });

  it('rejects resubmits, wrong rooms, unknown games and non-participants', () => {
    const id = playSolo(env, { playerId: 'd1', score: 10, roomId: 'ROOM' });
    const base = { gameId: id, roomId: 'ROOM', playerId: 'd1', submittedAt: 't', stats: stats() };
    expect(env.records.submitResult(base)).toEqual({ ok: false, reason: 'ALREADY_SUBMITTED' });
    expect(env.records.submitResult({ ...base, roomId: 'OTHER' })).toEqual({ ok: false, reason: 'ROOM_MISMATCH' });
    expect(env.records.submitResult({ ...base, gameId: 9999 })).toEqual({ ok: false, reason: 'GAME_NOT_FOUND' });
    expect(env.records.submitResult({ ...base, playerId: 'd2' })).toEqual({ ok: false, reason: 'NOT_IN_GAME' });
  });

  it('rejects a mode mismatch', () => {
    const id = playSolo(env, { playerId: 'd1', score: 10, roomId: 'ROOM', submit: false });
    const coop = stats({ mode: 'coop', coop: { slot: 1, teamScore: 2, partnerScore: 1, partnerDeviceId: 'x', partnerNickname: 'x', leftEarly: false } });
    expect(env.records.submitResult({ gameId: id, roomId: 'ROOM', playerId: 'd1', submittedAt: 't', stats: coop })).toEqual({ ok: false, reason: 'MODE_MISMATCH' });
  });

  it('a new game in the same room abandons the previous one', () => {
    const first = playSolo(env, { playerId: 'd1', score: 1, roomId: 'ROOM', submit: false, at: 1 });
    playSolo(env, { playerId: 'd1', score: 1, roomId: 'ROOM', submit: false, at: 2 });
    expect(row(env, 'SELECT status, ended_at FROM games WHERE id = ?', first)).toMatchObject({ status: 'abandoned' });
    expect(row(env, 'SELECT ended_at FROM games WHERE id = ?', first).ended_at).not.toBeNull();
    expect(env.records.submitResult({ gameId: first, roomId: 'ROOM', playerId: 'd1', submittedAt: 't', stats: stats() })).toEqual({ ok: false, reason: 'GAME_NOT_PLAYING' });
  });

  it('chooseWeapon works while playing and not after abandon', () => {
    const id = playSolo(env, { playerId: 'd1', score: 1, roomId: 'ROOM', submit: false });
    expect(env.records.chooseWeapon(id, 'ROOM', 1, 'revolver')).toBe(true);
    expect(row(env, 'SELECT weapon_kind, weapon_level FROM game_players WHERE game_id = ?', id)).toEqual({ weapon_kind: 'revolver', weapon_level: 1 });
    expect(env.records.abandonGame(id, 'ROOM', 't')).toBe(true);
    expect(env.records.chooseWeapon(id, 'ROOM', 1, 'shotgun')).toBe(false);
    expect(env.records.abandonGame(id, 'ROOM', 't')).toBe(false);
  });

  describe('getTopRuns', () => {
    it('orders by score then earlier finish, skipping other rulesets, abandoned and playing games', () => {
      playSolo(env, { playerId: 'd1', score: 100, at: 3 });
      playSolo(env, { playerId: 'd2', score: 300, at: 5 });
      playSolo(env, { playerId: 'd3', score: 300, at: 4 });
      playSolo(env, { playerId: 'd1', score: 999, at: 6, rv: 4 });
      playSolo(env, { playerId: 'd2', score: 888, at: 7, submit: false });
      const ab = playSolo(env, { playerId: 'd3', score: 777, at: 8, submit: false, roomId: 'AB' });
      env.records.abandonGame(ab, 'AB', 't');
      const top = env.records.getTopRuns();
      expect(top.map((r) => [r.deviceId, r.score])).toEqual([['d3', 300], ['d2', 300], ['d1', 100]]);
      expect(top[0]).toMatchObject({ waveReached: 7, weaponKind: 'gatling', nickname: '닉_d3' });
      expect('inputKind' in top[0]).toBe(false);
    });

    it('limits to 5 and lets the same player repeat', () => {
      [10, 50, 30, 60, 20, 40].forEach((v, i) => playSolo(env, { playerId: 'd1', score: v, at: i + 1 }));
      expect(env.records.getTopRuns().map((r) => r.score)).toEqual([60, 50, 40, 30, 20]);
    });

    it('carries the input kind when known', () => {
      playSolo(env, { playerId: 'd1', score: 5, over: { inputKind: 'mobile' } });
      expect(env.records.getTopRuns()[0].inputKind).toBe('mobile');
    });
  });

  it('validates the stats shape', () => {
    expect(isValidPlayRunStats(stats())).toBe(true);
    for (const bad of [{ totalScore: NaN }, { kills: -1 }, { weaponKind: 'laser' }, { outcome: 'x' }, { waves: 'no' }]) {
      expect(isValidPlayRunStats({ ...stats(), ...bad })).toBe(false);
    }
    expect(isValidPlayRunStats({ ...stats(), shots: { PERFECT: 1 } })).toBe(false);
    expect(isValidPlayRunStats(undefined)).toBe(false);
    expect(isValidPlayRunStats({ ...stats(), damageTaken: -1 })).toBe(false);
  });

  it('validates wave damageTaken', () => {
    expect(isValidPlayRunStats(stats({ waves: [{ wave: 1, seconds: 1, bonus: 0, damageTaken: -1 }] }))).toBe(false);
    expect(isValidPlayRunStats(stats({ waves: [{ wave: 1, seconds: 1, bonus: 0 }] }))).toBe(true);
    expect(isValidPlayRunStats(stats({ waves: [{ wave: 1, seconds: 1, bonus: 0, damageTaken: 2 }] }))).toBe(true);
  });

  it('validates inputKind, partner fields and cardPicks', () => {
    expect(isValidPlayRunStats(stats({ inputKind: 'mouse' }))).toBe(true);
    expect(isValidPlayRunStats({ ...stats(), inputKind: 'keyboard' })).toBe(false);
    const pick = { wave: 4, kind: 'damage_up', midWave: true, auto: false };
    expect(isValidPlayRunStats(stats({ cardPicks: [pick as any] }))).toBe(true);
    expect(isValidPlayRunStats({ ...stats(), cardPicks: [{ ...pick, kind: 'nope' }] })).toBe(false);
    expect(isValidPlayRunStats({ ...stats(), cardPicks: Array(61).fill(pick) })).toBe(false);
    const coop = { slot: 1, teamScore: 3, partnerScore: 1, partnerDeviceId: 'p', partnerNickname: 'P', leftEarly: false };
    expect(isValidPlayRunStats({ ...stats(), mode: 'coop', coop: { ...coop, partnerWeaponKind: 'shotgun', partnerInputKind: 'mobile' } })).toBe(true);
    expect(isValidPlayRunStats({ ...stats(), mode: 'coop', coop: { ...coop, partnerWeaponKind: 'bazooka' } })).toBe(false);
    expect(isValidPlayRunStats({ ...stats(), mode: 'coop', coop: { ...coop, partnerInputKind: 'pad' } })).toBe(false);
  });
});
