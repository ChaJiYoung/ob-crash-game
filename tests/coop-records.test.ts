import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { PlayRecordStore, isValidPlayRunStats } from '../server/PlayRecordStore';
import { PlayerStore } from '../server/PlayerStore';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { PlayRunStats, ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

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
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(process.cwd(), 'data', `test-coop-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

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

  describe('PlayRecordStore', () => {
    it('appends coop runs to file with mode:"coop" but excludes them from Top5 and reloads', () => {
      const recFile = path.join(tmpDir, 'records.jsonl');
      const store = new PlayRecordStore(recFile, RANKING_RULESET_VERSION);

      // Append a solo record
      const soloStats = makeDummyStats('solo');
      soloStats.totalScore = 50;
      store.append({
        playedAt: '2026-11-07T10:00:00.000Z',
        deviceId: 'dev_solo_1',
        nickname: '솔로맨',
        rulesetVersion: RANKING_RULESET_VERSION,
        stats: soloStats,
      });

      expect(store.getTopRuns()).toHaveLength(1);
      expect(store.getTopRuns()[0].score).toBe(50);

      // Append a coop record with huge score
      const coopStats = makeDummyStats('coop', 1000);
      coopStats.totalScore = 600;
      store.append({
        playedAt: '2026-11-07T10:05:00.000Z',
        deviceId: 'dev_coop_1',
        nickname: '협동맨',
        rulesetVersion: RANKING_RULESET_VERSION,
        stats: coopStats,
      });

      // Top runs should STILL only have solo 50!
      expect(store.getTopRuns()).toHaveLength(1);
      expect(store.getTopRuns()[0].deviceId).toBe('dev_solo_1');

      // Verify file content has mode:"coop"
      const content = fs.readFileSync(recFile, 'utf-8');
      expect(content).toContain('"mode":"coop"');
      expect(content).toContain('"mode":"solo"');

      // New store reloading from file must also exclude coop from Top5
      const reloadedStore = new PlayRecordStore(recFile, RANKING_RULESET_VERSION);
      expect(reloadedStore.getTopRuns()).toHaveLength(1);
      expect(reloadedStore.getTopRuns()[0].deviceId).toBe('dev_solo_1');
    });
  });

  describe('PlayerStore.recordCoopResult', () => {
    it('leaves solo bestScore untouched, increments totalGames, and tracks coopBests per partner', () => {
      const playerFile = path.join(tmpDir, 'players.json');
      const store = new PlayerStore(playerFile);

      // 1. Player has an existing solo bestScore 100
      store.registerOrUpdateNickname('dev_p1', '원조선수');
      store.recordGameScore('dev_p1', 100);
      const initial = store.findByDeviceId('dev_p1');
      expect(initial?.bestScore).toBe(100);
      expect(initial?.totalGames).toBe(1);

      // 2. Play coop match with partner P2: teamScore 300, myScore 120
      const res1 = store.recordCoopResult('dev_p1', {
        partnerDeviceId: 'dev_p2',
        partnerNickname: '동반자A',
        teamScore: 300,
        myScore: 120,
        partnerScore: 180,
        waveReached: 10,
        playedAt: '2026-11-07T10:10:00.000Z',
      });

      expect(res1.isNewTeamBest).toBe(true);
      expect(res1.profile.bestScore).toBe(100); // solo best UNTOUCHED!
      expect(res1.profile.totalGames).toBe(2);
      expect(res1.profile.coopBests?.dev_p2.teamScore).toBe(300);
      expect(res1.profile.coopBests?.dev_p2.partnerNickname).toBe('동반자A');

      // 3. Lower score with same partner: teamScore 250 -> not new team best, updates nickname if changed
      const res2 = store.recordCoopResult('dev_p1', {
        partnerDeviceId: 'dev_p2',
        partnerNickname: '동반자A_개명',
        teamScore: 250,
        myScore: 100,
        partnerScore: 150,
        waveReached: 8,
        playedAt: '2026-11-07T10:15:00.000Z',
      });

      expect(res2.isNewTeamBest).toBe(false);
      expect(res2.profile.totalGames).toBe(3);
      expect(res2.profile.coopBests?.dev_p2.teamScore).toBe(300); // kept 300
      expect(res2.profile.coopBests?.dev_p2.partnerNickname).toBe('동반자A_개명');

      // 4. Empty partnerDeviceId -> only totalGames increments
      const res3 = store.recordCoopResult('dev_p1', {
        partnerDeviceId: '',
        partnerNickname: '',
        teamScore: 0,
        myScore: 50,
        partnerScore: 0,
        waveReached: 3,
        playedAt: '2026-11-07T10:20:00.000Z',
      });
      expect(res3.profile.totalGames).toBe(4);
      expect(res3.profile.coopBests?.dev_p2.teamScore).toBe(300);
    });

    it('clears coopBests on ruleset migration', () => {
      const playerFile = path.join(tmpDir, 'players.json');
      // Create players file with rulesetVersion: 1
      const oldData = {
        rulesetVersion: 1,
        players: {
          dev_mig: {
            deviceId: 'dev_mig',
            nickname: '구버전유저',
            bestScore: 200,
            totalGames: 5,
            lastPlayedAt: '2026-11-01T00:00:00.000Z',
            coopBests: {
              dev_other: {
                partnerDeviceId: 'dev_other',
                partnerNickname: '파트너',
                teamScore: 500,
                myScore: 250,
                partnerScore: 250,
                waveReached: 10,
                playedAt: '2026-11-01T00:00:00.000Z',
              },
            },
          },
        },
      };
      fs.writeFileSync(playerFile, JSON.stringify(oldData, null, 2), 'utf-8');

      // Load with current ruleset
      const store = new PlayerStore(playerFile);
      const migrated = store.findByDeviceId('dev_mig');
      expect(migrated).toBeDefined();
      expect(migrated?.bestScore).toBe(0);
      expect(migrated?.totalGames).toBe(0);
      expect(migrated?.coopBests).toBeUndefined();
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
      serverInstance = await createBeerCrusherServer({
        port: 0,
        storePath: path.join(tmpDir, 'players.json'),
        recordPath: path.join(tmpDir, 'records.jsonl'),
      });
      const port = serverInstance.port;

      const pcWs = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((res) => pcWs.on('open', () => res()));

      const roomCreatedPromise = waitForMessage(pcWs, 'ROOM_CREATED');
      pcWs.send(JSON.stringify({ type: 'CREATE_ROOM' }));
      const { roomId } = await roomCreatedPromise;

      // Submit coop score for player 1 (score 150, team 400)
      const p1Stats = makeDummyStats('coop', 400);
      p1Stats.totalScore = 150;
      p1Stats.coop!.slot = 1;
      p1Stats.coop!.partnerDeviceId = 'dev_p2_slot2';
      p1Stats.coop!.partnerNickname = '폰유저2';
      p1Stats.coop!.partnerScore = 250;

      const p1RankingPromise = waitForMessage(pcWs, 'RANKING_UPDATED');
      pcWs.send(
        JSON.stringify({
          type: 'GAME_SCORE_SUBMIT',
          roomId,
          deviceId: 'dev_p1_slot1',
          score: 150,
          waveReached: 10,
          maxCombo: 15,
          stats: p1Stats,
          rulesetVersion: RANKING_RULESET_VERSION,
          mode: 'coop',
        })
      );
      const resP1 = await p1RankingPromise;
      expect(resP1.updatedPlayer?.deviceId).toBe('dev_p1_slot1');
      expect(resP1.updatedPlayer?.bestScore).toBe(0); // not solo score
      expect(resP1.updatedPlayer?.totalGames).toBe(1);
      expect(resP1.updatedPlayer?.coopBests?.dev_p2_slot2.teamScore).toBe(400);
      expect(resP1.rankings).toHaveLength(0); // Top5 untouched

      // Submit coop score for player 2 (score 250, team 400)
      const p2Stats = makeDummyStats('coop', 400);
      p2Stats.totalScore = 250;
      p2Stats.coop!.slot = 2;
      p2Stats.coop!.partnerDeviceId = 'dev_p1_slot1';
      p2Stats.coop!.partnerNickname = resP1.updatedPlayer?.nickname || '맥주고수';
      p2Stats.coop!.partnerScore = 150;

      const p2RankingPromise = waitForMessage(pcWs, 'RANKING_UPDATED');
      pcWs.send(
        JSON.stringify({
          type: 'GAME_SCORE_SUBMIT',
          roomId,
          deviceId: 'dev_p2_slot2',
          score: 250,
          waveReached: 10,
          maxCombo: 15,
          stats: p2Stats,
          rulesetVersion: RANKING_RULESET_VERSION,
          mode: 'coop',
        })
      );
      const resP2 = await p2RankingPromise;
      expect(resP2.updatedPlayer?.deviceId).toBe('dev_p2_slot2');
      expect(resP2.updatedPlayer?.bestScore).toBe(0);
      expect(resP2.updatedPlayer?.totalGames).toBe(1);
      expect(resP2.updatedPlayer?.coopBests?.dev_p1_slot1.teamScore).toBe(400);
      expect(resP2.rankings).toHaveLength(0); // Top5 still 0!

      pcWs.close();
    });
  });
});
