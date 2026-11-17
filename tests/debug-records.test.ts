import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidDebugStartConfig } from '../server/PlayRecordStore';
import { Env, debugCfg, makeEnv, playCoop, playSolo, register } from './helpers/dbFixtures';

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
