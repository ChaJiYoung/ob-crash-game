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

    it('stores EX run with outcome VICTORY and waveReached >= 8 in score order', () => {
      playSolo(env, { playerId: 'd1', score: 3000, at: 1, over: { outcome: 'VICTORY', waveReached: 7 } });
      const exId = playSolo(env, { playerId: 'd2', score: 8500, at: 2, over: { outcome: 'VICTORY', waveReached: 10 } });
      expect(row(env, 'SELECT outcome, wave_reached, total_score FROM games WHERE id = ?', exId)).toEqual({
        outcome: 'VICTORY',
        wave_reached: 10,
        total_score: 8500,
      });
      const top = env.records.getTopRuns();
      expect(top.map((r) => [r.deviceId, r.outcome, r.waveReached, r.score])).toEqual([
        ['d2', 'VICTORY', 10, 8500],
        ['d1', 'VICTORY', 7, 3000],
      ]);
    });

    it('updates EX checkpoint record when isExUpdate is true, while rejecting normal duplicate submits', () => {
      const id = playSolo(env, {
        playerId: 'd1',
        roomId: 'R1',
        score: 5000,
        at: 1,
        over: { outcome: 'VICTORY', waveReached: 8 },
      });
      // 일반 중복 제출은 여전히 거절
      expect(
        env.records.submitResult({
          gameId: id,
          roomId: 'R1',
          playerId: 'd1',
          submittedAt: 't2',
          stats: stats({ outcome: 'VICTORY', waveReached: 10, totalScore: 9000 }),
        })
      ).toEqual({ ok: false, reason: 'ALREADY_SUBMITTED' });

      // isExUpdate=true 이면 EX 최종 점수/DANGER로 갱신
      expect(
        env.records.submitResult({
          gameId: id,
          roomId: 'R1',
          playerId: 'd1',
          submittedAt: 't3',
          stats: stats({ outcome: 'VICTORY', waveReached: 11, totalScore: 9500 }),
          isExUpdate: true,
        })
      ).toEqual({ ok: true, finishedGame: false });

      expect(row(env, 'SELECT outcome, wave_reached, total_score FROM games WHERE id = ?', id)).toEqual({
        outcome: 'VICTORY',
        wave_reached: 11,
        total_score: 9500,
      });
      expect(row(env, 'SELECT score FROM game_players WHERE game_id = ?', id)).toEqual({ score: 9500 });
      // game_waves는 중복 삽입되지 않음
      expect(rows(env, 'SELECT * FROM game_waves WHERE game_id = ?', id)).toHaveLength(1);

      // 점수 하락 / waveReached 하락 갱신 거절
      expect(
        env.records.submitResult({
          gameId: id,
          roomId: 'R1',
          playerId: 'd1',
          submittedAt: 't4',
          stats: stats({ outcome: 'VICTORY', waveReached: 11, totalScore: 9000 }),
          isExUpdate: true,
        })
      ).toEqual({ ok: false, reason: 'ALREADY_SUBMITTED' });
      expect(
        env.records.submitResult({
          gameId: id,
          roomId: 'R1',
          playerId: 'd1',
          submittedAt: 't5',
          stats: stats({ outcome: 'VICTORY', waveReached: 10, totalScore: 9999 }),
          isExUpdate: true,
        })
      ).toEqual({ ok: false, reason: 'ALREADY_SUBMITTED' });
    });

    it('rejects isExUpdate on non-EX games and treats first-time isExUpdate without checkpoint as normal submit', () => {
      // 본편 VICTORY(waveReached=7)에는 isExUpdate 거절
      const w7 = playSolo(env, { playerId: 'd1', roomId: 'R1', score: 3000, at: 1, over: { outcome: 'VICTORY', waveReached: 7 } });
      expect(
        env.records.submitResult({
          gameId: w7,
          roomId: 'R1',
          playerId: 'd1',
          submittedAt: 't2',
          stats: stats({ outcome: 'VICTORY', waveReached: 9, totalScore: 5000 }),
          isExUpdate: true,
        })
      ).toEqual({ ok: false, reason: 'ALREADY_SUBMITTED' });

      // GAMEOVER 기록에는 isExUpdate 거절
      const dead = playSolo(env, { playerId: 'd2', roomId: 'R2', score: 1000, at: 2, over: { outcome: 'GAMEOVER', waveReached: 4 } });
      expect(
        env.records.submitResult({
          gameId: dead,
          roomId: 'R2',
          playerId: 'd2',
          submittedAt: 't3',
          stats: stats({ outcome: 'VICTORY', waveReached: 9, totalScore: 5000 }),
          isExUpdate: true,
        })
      ).toEqual({ ok: false, reason: 'ALREADY_SUBMITTED' });

      // 체크포인트 없이 isExUpdate: true가 와도 일반 첫 제출로 정상 저장
      const fresh = playSolo(env, { playerId: 'd3', roomId: 'R3', score: 0, at: 3, submit: false });
      expect(
        env.records.submitResult({
          gameId: fresh,
          roomId: 'R3',
          playerId: 'd3',
          submittedAt: 't4',
          stats: stats({ outcome: 'VICTORY', waveReached: 9, totalScore: 7000 }),
          isExUpdate: true,
        })
      ).toEqual({ ok: true, finishedGame: true });
    });

    it('updates both players in 2P coop checkpoint -> final EX update order', () => {
      register(env, 'c1', 'c2');
      const coopId = env.records.beginGame({
        roomId: 'COOP1',
        mode: 'coop',
        rulesetVersion: 6,
        startedAt: 's1',
        players: [
          { slot: 1, playerId: 'c1', inputKind: 'mouse' },
          { slot: 2, playerId: 'c2', inputKind: 'mobile' },
        ],
      });
      const mkCoop = (slot: 1 | 2, myScore: number, partnerScore: number, waveReached: number) =>
        stats({
          mode: 'coop',
          outcome: 'VICTORY',
          waveReached,
          totalScore: myScore,
          coop: {
            slot,
            teamScore: myScore + partnerScore,
            partnerScore,
            partnerDeviceId: slot === 1 ? 'c2' : 'c1',
            partnerNickname: slot === 1 ? '협동2' : '협동1',
            leftEarly: false,
          },
        });

      // 1) EX 진입 체크포인트 (두 플레이어 모두 제출)
      expect(env.records.submitResult({ gameId: coopId, roomId: 'COOP1', playerId: 'c1', submittedAt: 't1', stats: mkCoop(1, 3000, 2000, 8) })).toEqual({ ok: true, finishedGame: true });
      expect(env.records.submitResult({ gameId: coopId, roomId: 'COOP1', playerId: 'c2', submittedAt: 't1', stats: mkCoop(2, 2000, 3000, 8) })).toEqual({ ok: true, finishedGame: false });

      // 2) EX 종료 최종 갱신 (1P 먼저, 2P 다음)
      expect(env.records.submitResult({ gameId: coopId, roomId: 'COOP1', playerId: 'c1', submittedAt: 't2', stats: mkCoop(1, 6000, 5000, 10), isExUpdate: true })).toEqual({ ok: true, finishedGame: false });
      expect(env.records.submitResult({ gameId: coopId, roomId: 'COOP1', playerId: 'c2', submittedAt: 't2', stats: mkCoop(2, 5000, 6000, 10), isExUpdate: true })).toEqual({ ok: true, finishedGame: false });

      expect(row(env, 'SELECT outcome, wave_reached, total_score FROM games WHERE id = ?', coopId)).toEqual({
        outcome: 'VICTORY',
        wave_reached: 10,
        total_score: 11000,
      });
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

  it('rejects values the DB constraints would refuse', () => {
    for (const bad of [{ weaponLevel: 0 }, { weaponLevel: 5 }, { weaponLevel: 2.5 }, { accuracy: 1.5 }]) {
      expect(isValidPlayRunStats({ ...stats(), ...bad })).toBe(false);
    }
    expect(isValidPlayRunStats(stats({ accuracy: 1, weaponLevel: 4 }))).toBe(true);
    expect(isValidPlayRunStats(stats({ accuracy: 0, weaponLevel: 1 }))).toBe(true);
    expect(isValidPlayRunStats(stats({ waves: [{ wave: 1, seconds: 1, bonus: 0 }, { wave: 1, seconds: 2, bonus: 0 }] }))).toBe(false);
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
