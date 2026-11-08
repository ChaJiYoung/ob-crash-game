import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { isValidPlayRunStats } from '../server/PlayRecordStore';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { PlayRunStats, ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';
import { beginGame, Inbox, open } from './helpers/wsHarness';
import { coopStats, makeEnv, playCoop, playSolo, register } from './helpers/dbFixtures';

function makeDummyStats(mode: 'solo' | 'coop' = 'solo', teamScore = 200): PlayRunStats {
  const base: PlayRunStats = {
    outcome: 'VICTORY',
    waveReached: 10,
    livesLeft: 3,
    durationSec: 120,
    totalScore: 100,
    baseScore: 80,
    timeBonus: 10,
    precisionBonus: 10,
    levelBonus: 0,
    maxCombo: 15,
    kills: 40,
    waves: [{ wave: 1, seconds: 12, bonus: 10 }],
    shots: { PERFECT: 20, GREAT: 10, GOOD: 5, MISS: 5 },
    accuracy: 0.875,
    weaponKind: 'shotgun',
    weaponLevel: 2,
    cardStacks: { damage_up: 1, skill_cooldown: 0, fever_extend: 1, hit_zone_up: 0 },
    mode,
  };
  if (mode === 'coop') {
    base.coop = {
      slot: 1,
      teamScore,
      partnerScore: teamScore - 100,
      partnerDeviceId: 'dev_partner_xyz',
      partnerNickname: '맥주동료',
      leftEarly: false,
    };
  }
  return base;
}

describe('coop records and stats (P03-T03)', () => {
  describe('isValidPlayRunStats', () => {
    it('validates mode and coop structure', () => {
      const validSolo = makeDummyStats('solo');
      expect(isValidPlayRunStats(validSolo)).toBe(true);

      const validCoop = makeDummyStats('coop', 250);
      expect(isValidPlayRunStats(validCoop)).toBe(true);

      // coop mode without coop field -> false
      const coopNoField = { ...validCoop, coop: undefined };
      expect(isValidPlayRunStats(coopNoField)).toBe(false);

      // solo mode with coop field -> false
      const soloWithCoop = { ...validSolo, coop: validCoop.coop };
      expect(isValidPlayRunStats(soloWithCoop)).toBe(false);

      // slot 3 -> false
      const invalidSlot = {
        ...validCoop,
        coop: { ...validCoop.coop!, slot: 3 as any },
      };
      expect(isValidPlayRunStats(invalidSlot)).toBe(false);

      // partnerDeviceId too long (>64) -> false
      const longPartner = {
        ...validCoop,
        coop: { ...validCoop.coop!, partnerDeviceId: 'a'.repeat(65) },
      };
      expect(isValidPlayRunStats(longPartner)).toBe(false);
    });
  });

  describe('coop games in the DB', () => {
    it('keeps coop runs off the solo Top5 and finishes the game on the first submit', () => {
      const env = makeEnv();
      register(env, 'dev_solo_1', 'dev_c1', 'dev_c2');
      playSolo(env, { playerId: 'dev_solo_1', score: 50, at: 1 });
      const gameId = playCoop(env, { a: 'dev_c1', b: 'dev_c2', teamScore: 1000, scoreA: 600, scoreB: 400, at: 2 });
      expect(env.records.getTopRuns()).toHaveLength(1);
      expect(env.records.getTopRuns()[0].deviceId).toBe('dev_solo_1');
      expect(env.db.conn.prepare('SELECT status, mode, total_score, team_key FROM games WHERE id = ?').get(gameId)).toEqual({
        status: 'finished', mode: 'coop', total_score: 1000, team_key: 'dev_c1|dev_c2',
      });
      env.db.close();
    });

    it('first submit reports finishedGame, the second does not, and a slot mismatch is rejected', () => {
      const env = makeEnv();
      register(env, 'a', 'b');
      const gameId = env.records.beginGame({
        roomId: 'ROOM', mode: 'coop', rulesetVersion: RANKING_RULESET_VERSION, startedAt: 't0',
        players: [{ slot: 1, playerId: 'a', inputKind: null }, { slot: 2, playerId: 'b', inputKind: null }],
      });
      const partner = (id: string) => ({ id, nickname: id });
      const send = (playerId: string, slot: 1 | 2) =>
        env.records.submitResult({ gameId, roomId: 'ROOM', playerId, submittedAt: 't1', stats: coopStats(slot, 400, 200, partner('x')) });
      expect(send('a', 2)).toEqual({ ok: false, reason: 'SLOT_MISMATCH' });
      expect(send('a', 1)).toEqual({ ok: true, finishedGame: true });
      expect(send('b', 2)).toEqual({ ok: true, finishedGame: false });
      env.db.close();
    });

    it('leaves solo bestScore untouched, counts totalGames, and tracks coopBests per partner', () => {
      const env = makeEnv();
      register(env, 'dev_p1', 'dev_p2', 'dev_p3');
      playSolo(env, { playerId: 'dev_p1', score: 100, at: 1 });
      expect(env.players.findByDeviceId('dev_p1')).toMatchObject({ bestScore: 100, totalGames: 1 });

      playCoop(env, { a: 'dev_p1', b: 'dev_p2', teamScore: 300, scoreA: 120, scoreB: 180, at: 2 });
      playCoop(env, { a: 'dev_p2', b: 'dev_p1', teamScore: 250, scoreA: 150, scoreB: 100, at: 3 });
      playCoop(env, { a: 'dev_p1', b: 'dev_p3', teamScore: 90, scoreA: 40, scoreB: 50, at: 4 });

      const p1 = env.players.findByDeviceId('dev_p1')!;
      expect(p1.bestScore).toBe(100);
      expect(p1.totalGames).toBe(4);
      expect(Object.keys(p1.coopBests!).sort()).toEqual(['dev_p2', 'dev_p3']);
      expect(p1.coopBests!.dev_p2).toMatchObject({
        partnerDeviceId: 'dev_p2', partnerNickname: '닉_dev_p2', teamScore: 300, myScore: 120, partnerScore: 180, waveReached: 7,
      });
      // playedAt is the game's ended_at (the PC compares it with its submit time)
      expect(p1.coopBests!.dev_p2.playedAt).toBe(env.db.conn.prepare(`SELECT ended_at FROM games WHERE total_score = 300`).pluck().get());
      env.db.close();
    });
  });

  describe('WebSocket Server GAME_SCORE_SUBMIT coop flow', () => {
    let serverInstance: BeerCrusherServerInstance | undefined;

    afterEach(async () => {
      if (serverInstance) {
        await serverInstance.close();
        serverInstance = undefined;
      }
    });

    function waitForMessage<K extends ServerToClientMessage['type']>(
      ws: WebSocket,
      type: K,
      filter?: (msg: Extract<ServerToClientMessage, { type: K }>) => boolean,
      timeoutMs = 3000
    ): Promise<Extract<ServerToClientMessage, { type: K }>> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for message type: ${type}`));
        }, timeoutMs);

        const listener = (data: Buffer | string) => {
          try {
            const parsed = JSON.parse(data.toString()) as ServerToClientMessage;
            if (parsed.type === type) {
              const typedMsg = parsed as Extract<ServerToClientMessage, { type: K }>;
              if (!filter || filter(typedMsg)) {
                clearTimeout(timeout);
                ws.off('message', listener);
                resolve(typedMsg);
              }
            }
          } catch {
            // ignore
          }
        };

        ws.on('message', listener);
      });
    }

    it('processes coop submissions for both players without affecting solo top5', async () => {
      serverInstance = await createBeerCrusherServer({ port: 0, dbPath: ':memory:' });
      const server = serverInstance;
      const url = `ws://localhost:${server.port}`;
      const pc = new Inbox(await open(url));
      pc.ws.send(JSON.stringify({ type: 'CREATE_ROOM' }));
      await pc.waitFor(() => pc.of('ROOM_CREATED').length > 0);
      const roomId = pc.of('ROOM_CREATED')[0].roomId;

      server.playerStore.registerOrUpdateNickname('dev_p1_slot1', '폰유저1');
      server.playerStore.registerOrUpdateNickname('dev_p2_slot2', '폰유저2');
      const phone1 = new Inbox(await open(url));
      phone1.ws.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'dev_p1_slot1', slot: 1 }));
      const phone2 = new Inbox(await open(url));
      phone2.ws.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'dev_p2_slot2', slot: 2 }));
      await pc.waitFor(() => pc.of('CONTROLLER_PAIRED').length >= 2);

      const gameId = await beginGame(pc, roomId, 'coop', [
        { slot: 1, deviceId: 'dev_p1_slot1', inputKind: 'mobile' },
        { slot: 2, deviceId: 'dev_p2_slot2', inputKind: 'mobile' },
      ]);

      const submit = (deviceId: string, slot: 1 | 2, score: number, partner: string) => {
        const stats = makeDummyStats('coop', 400);
        stats.totalScore = score;
        stats.coop!.slot = slot;
        stats.coop!.partnerDeviceId = partner;
        stats.coop!.partnerNickname = '파트너';
        stats.coop!.partnerScore = 400 - score;
        pc.ws.send(JSON.stringify({
          type: 'GAME_SCORE_SUBMIT', roomId, deviceId, gameId, score, waveReached: 10, maxCombo: 15,
          stats, rulesetVersion: RANKING_RULESET_VERSION, mode: 'coop',
        }));
      };

      submit('dev_p1_slot1', 1, 150, 'dev_p2_slot2');
      await pc.waitFor(() => pc.of('RANKING_UPDATED').length >= 1);
      const resP1 = pc.of('RANKING_UPDATED')[0];
      expect(resP1.updatedPlayer?.deviceId).toBe('dev_p1_slot1');
      expect(resP1.updatedPlayer?.bestScore).toBe(0); // not a solo score
      expect(resP1.updatedPlayer?.totalGames).toBe(1);
      expect(resP1.updatedPlayer?.coopBests?.dev_p2_slot2.teamScore).toBe(400);
      expect(resP1.rankings).toHaveLength(0);
      expect(resP1.teamRankings).toHaveLength(1);

      submit('dev_p2_slot2', 2, 250, 'dev_p1_slot1');
      await pc.waitFor(() => pc.of('RANKING_UPDATED').length >= 2);
      const resP2 = pc.of('RANKING_UPDATED')[1];
      expect(resP2.updatedPlayer?.deviceId).toBe('dev_p2_slot2');
      expect(resP2.updatedPlayer?.bestScore).toBe(0);
      expect(resP2.updatedPlayer?.totalGames).toBe(1);
      expect(resP2.updatedPlayer?.coopBests?.dev_p1_slot1.teamScore).toBe(400);
      expect(resP2.rankings).toHaveLength(0);
      expect(resP2.teamRankings![0].members.map((m) => m.score)).toEqual([150, 250]);

      // Both controllers also get the update
      await phone1.waitFor(() => phone1.of('RANKING_UPDATED').length >= 2);

      pc.ws.close();
      phone1.ws.close();
      phone2.ws.close();
    });
  });
});
