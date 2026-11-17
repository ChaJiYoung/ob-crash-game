import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidDebugStartConfig, isValidPlayRunStats } from '../server/PlayRecordStore';
import { Env, debugCfg, makeEnv, playCoop, playSolo, register, stats } from './helpers/dbFixtures';

describe('debug games (DB)', () => {
  let env: Env;
  beforeEach(() => {
    env = makeEnv();
    register(env, 'd1', 'd2', 'd3', 'd4');
  });
  afterEach(() => env.db.close());

  it('디버그 판은 is_debug=1과 debug_config JSON으로 저장된다', () => {
    const id = playSolo(env, { playerId: 'd2', score: 99999, debug: debugCfg() });
    const row = env.db.conn.prepare('SELECT is_debug, debug_config FROM games WHERE id = ?').get(id) as any;
    expect(row.is_debug).toBe(1);
    expect(JSON.parse(row.debug_config)).toEqual(debugCfg());
  });

  it('디버그 판은 솔로·무기별 랭킹, 최고점, 판 수에서 빠진다', () => {
    playSolo(env, { playerId: 'd1', score: 10000 });
    playSolo(env, { playerId: 'd2', score: 99999, debug: debugCfg() });
    expect(env.records.getTopRuns().map((r) => r.deviceId)).toEqual(['d1']);
    const byWeapon = env.records.getTopRunsByWeapon();
    expect(Object.values(byWeapon).flat().map((r) => r.deviceId)).not.toContain('d2');
    const p = env.players.findByDeviceId('d2')!;
    expect(p.bestScore).toBe(0);
    expect(p.totalGames).toBe(0);
  });

  it('디버그 협동 판은 팀 랭킹과 협동 최고 기록에서 빠진다', () => {
    playCoop(env, { a: 'd1', b: 'd2', teamScore: 5000 });
    playCoop(env, { a: 'd3', b: 'd4', teamScore: 88888, debug: debugCfg() });
    const teams = env.records.getTopTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].teamScore).toBe(5000);
    const p = env.players.findByDeviceId("d3")!;
    expect(p.coopBests ?? {}).toEqual({});
  });
});

describe('isValidDebugStartConfig', () => {
  it('정상값', () => {
    expect(isValidDebugStartConfig(debugCfg())).toBe(true);
    expect(isValidDebugStartConfig(debugCfg({ startAt: 'EX', weaponLevel: 4 }))).toBe(true);
  });
  it('잘못된 값', () => {
    expect(isValidDebugStartConfig(null)).toBe(false);
    expect(isValidDebugStartConfig({ ...debugCfg(), startAt: 'W3' })).toBe(false);
    expect(isValidDebugStartConfig({ ...debugCfg(), weaponLevel: 5 })).toBe(false);
    expect(isValidDebugStartConfig(debugCfg({ cards: { ...debugCfg().cards, hit_zone_up: 3 } }))).toBe(false);
    expect(isValidDebugStartConfig(debugCfg({ cards: { ...debugCfg().cards, damage_up: -1 } }))).toBe(false);
    expect(isValidDebugStartConfig({ ...debugCfg(), cards: undefined })).toBe(false);
  });
});

describe('EX DANGER 피격 저장과 최근 디버그 기록', () => {
  let env: Env;
  beforeEach(() => {
    env = makeEnv();
    register(env, 'd1', 'd2');
  });
  afterEach(() => env.db.close());

  const waves = (id: number) =>
    env.db.conn.prepare('SELECT wave_num, damage_taken FROM game_waves WHERE game_id = ? ORDER BY wave_num').all(id) as { wave_num: number; damage_taken: number | null }[];

  it('체크포인트와 EX 갱신 모두에서 wave 7+n으로 upsert된다', () => {
    const sevenWaves = Array.from({ length: 7 }, (_, i) => ({ wave: i + 1, seconds: 10, bonus: 100, damageTaken: 0 }));
    const id = playSolo(env, {
      playerId: 'd1', score: 1000, debug: debugCfg({ startAt: 'EX' }),
      over: { waveReached: 8, waves: sevenWaves, exDangers: [{ danger: 1, damageTaken: 2 }] },
    });
    expect(waves(id).find((w) => w.wave_num === 8)?.damage_taken).toBe(2);

    const roomId = env.db.conn.prepare('SELECT room_id FROM games WHERE id = ?').pluck().get(id) as string;
    const res = env.records.submitResult({
      gameId: id, roomId, playerId: 'd1', submittedAt: '2026-11-17T00:10:00.000Z', isExUpdate: true,
      stats: stats({ totalScore: 5000, waveReached: 10, waves: sevenWaves, exDangers: [{ danger: 1, damageTaken: 2 }, { danger: 2, damageTaken: 1 }, { danger: 3, damageTaken: 4 }] }),
    });
    expect(res.ok).toBe(true);
    const w = waves(id);
    expect(w.filter((x) => x.wave_num <= 7)).toHaveLength(7);
    expect(w.filter((x) => x.wave_num >= 8).map((x) => [x.wave_num, x.damage_taken])).toEqual([[8, 2], [9, 1], [10, 4]]);
  });

  it('exDangers 형식 오류는 거절된다', () => {
    expect(isValidPlayRunStats(stats({ exDangers: [{ danger: 1, damageTaken: 1 }] }))).toBe(true);
    expect(isValidPlayRunStats(stats({ exDangers: [{ danger: 1, damageTaken: 1 }, { danger: 1, damageTaken: 2 }] }))).toBe(false);
    expect(isValidPlayRunStats(stats({ exDangers: [{ danger: 0, damageTaken: 1 }] }))).toBe(false);
    expect(isValidPlayRunStats(stats({ exDangers: Array.from({ length: 51 }, (_, i) => ({ danger: i + 1, damageTaken: 0 })) }))).toBe(false);
  });

  it('getRecentDebugRuns는 최신 디버그 판 10개만 돌려준다', () => {
    playSolo(env, { playerId: 'd1', score: 1, at: 1 });
    for (let i = 0; i < 12; i += 1) playSolo(env, { playerId: 'd2', score: 100 + i, at: 10 + i, debug: debugCfg() });
    const runs = env.records.getRecentDebugRuns(10);
    expect(runs).toHaveLength(10);
    expect(runs[0].totalScore).toBe(111);
    expect(runs.every((r) => r.members[0].nickname === '닉_d2')).toBe(true);
    expect(runs[0].config).toEqual(debugCfg());
    expect(runs[0].waves[0]).toEqual({ wave: 1, damageTaken: null });
    expect(runs[0].mode).toBe('solo');
  });

  it('깨진 debug_config는 config: null', () => {
    const id = playSolo(env, { playerId: 'd2', score: 1, debug: debugCfg() });
    env.db.conn.prepare(`UPDATE games SET debug_config = '{oops' WHERE id = ?`).run(id);
    expect(env.records.getRecentDebugRuns()[0].config).toBeNull();
  });
});
