import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';
import { coopStats, makeEnv, playCoop, register } from './helpers/dbFixtures';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

describe('team rankings (P03-T04)', () => {
  it('keeps the best game per team, orders members by slot, ties go to the earlier game', () => {
    const env = makeEnv();
    register(env, 'dev_A', 'dev_B', 'dev_C', 'dev_D');

    playCoop(env, { a: 'dev_A', b: 'dev_B', teamScore: 500, at: 1 });
    const teams1 = env.records.getTopTeams(5);
    expect(teams1).toHaveLength(1);
    expect(teams1[0]).toMatchObject({ teamScore: 500, teamKey: 'dev_A|dev_B' });
    expect(teams1[0].members.map((m) => m.deviceId)).toEqual(['dev_A', 'dev_B']);

    // Same pair with swapped slots and a higher score: still one entry, now 1P is B
    playCoop(env, { a: 'dev_B', b: 'dev_A', teamScore: 700, at: 2 });
    const teams2 = env.records.getTopTeams(5);
    expect(teams2).toHaveLength(1);
    expect(teams2[0].teamScore).toBe(700);
    expect(teams2[0].members.map((m) => m.deviceId)).toEqual(['dev_B', 'dev_A']);

    // A lower later game does not replace it
    playCoop(env, { a: 'dev_A', b: 'dev_B', teamScore: 100, at: 3 });
    expect(env.records.getTopTeams(5)[0].teamScore).toBe(700);

    // Another team, and a tie keeps the earlier game
    playCoop(env, { a: 'dev_C', b: 'dev_D', teamScore: 600, at: 4 });
    playCoop(env, { a: 'dev_D', b: 'dev_C', teamScore: 600, at: 5 });
    const teams3 = env.records.getTopTeams(5);
    expect(teams3.map((t) => [t.teamKey, t.teamScore])).toEqual([['dev_A|dev_B', 700], ['dev_C|dev_D', 600]]);
    expect(teams3[1].members.map((m) => m.deviceId)).toEqual(['dev_C', 'dev_D']);

    expect(env.records.getTopRuns()).toHaveLength(0);
    env.db.close();
  });

  it('a member who has not submitted has no score or weapon key', () => {
    const env = makeEnv();
    register(env, 'a', 'b');
    playCoop(env, { a: 'a', b: 'b', teamScore: 300, scoreA: 300, submitB: false });
    const [team] = env.records.getTopTeams(5);
    expect(team.members[0]).toMatchObject({ deviceId: 'a', score: 300, weaponKind: 'gatling' });
    expect(team.members[1]).toEqual({ deviceId: 'b', nickname: '닉_b' });
    env.db.close();
  });

  it('only counts games of the current ruleset', () => {
    const env = makeEnv();
    register(env, 'a', 'b');
    playCoop(env, { a: 'a', b: 'b', teamScore: 900, rv: RANKING_RULESET_VERSION - 1 });
    expect(env.records.getTopTeams(5)).toEqual([]);
    env.db.close();
  });

  it('carries each member score, weapon and input', () => {
    const env = makeEnv();
    register(env, 'd1', 'd2');
    const gameId = env.records.beginGame({
      roomId: 'ROOM', mode: 'coop', rulesetVersion: RANKING_RULESET_VERSION, startedAt: 't0',
      players: [{ slot: 1, playerId: 'd1', inputKind: 'mobile' }, { slot: 2, playerId: 'd2', inputKind: 'mouse' }],
    });
    env.records.submitResult({ gameId, roomId: 'ROOM', playerId: 'd2', submittedAt: 't1',
      stats: coopStats(2, 20000, 8000, { id: 'd1', nickname: 'x' }, { weaponKind: 'revolver' }) });
    env.records.submitResult({ gameId, roomId: 'ROOM', playerId: 'd1', submittedAt: 't2',
      stats: coopStats(1, 20000, 12000, { id: 'd2', nickname: 'x' }, { weaponKind: 'shotgun' }) });
    expect(env.records.getTopTeams()[0].members).toEqual([
      { deviceId: 'd1', nickname: '닉_d1', score: 12000, weaponKind: 'shotgun', inputKind: 'mobile' },
      { deviceId: 'd2', nickname: '닉_d2', score: 8000, weaponKind: 'revolver', inputKind: 'mouse' },
    ]);
    env.db.close();
  });

  describe('WebSocket Server teamRankings in responses', () => {
    let serverInstance: BeerCrusherServerInstance | undefined;

    afterEach(async () => {
      if (serverInstance) {
        await serverInstance.close();
        serverInstance = undefined;
      }
    });

    it('includes teamRankings in ROOM_CREATED', async () => {
      serverInstance = await createBeerCrusherServer({ port: 0, dbPath: ':memory:' });
      const port = serverInstance.port;

      const ws = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((res) => ws.on('open', () => res()));

      const msgPromise = new Promise<Extract<ServerToClientMessage, { type: 'ROOM_CREATED' }>>((resolve) => {
        ws.on('message', (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'ROOM_CREATED') {
            resolve(parsed);
          }
        });
      });

      ws.send(JSON.stringify({ type: 'CREATE_ROOM' }));
      const res = await msgPromise;
      expect(res.teamRankings).toBeDefined();
      expect(Array.isArray(res.teamRankings)).toBe(true);

      ws.close();
    });
  });
});
