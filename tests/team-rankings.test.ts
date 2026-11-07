import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { PlayRecordStore } from '../server/PlayRecordStore';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { PlayRunStats, ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

function makeCoopStats(slot: 1 | 2, teamScore: number, partnerDeviceId: string, partnerNickname: string): PlayRunStats {
  return {
    outcome: 'VICTORY',
    waveReached: 10,
    livesLeft: 3,
    durationSec: 120,
    totalScore: slot === 1 ? Math.floor(teamScore / 2) : Math.ceil(teamScore / 2),
    baseScore: 50,
    timeBonus: 10,
    precisionBonus: 10,
    levelBonus: 0,
    maxCombo: 10,
    kills: 20,
    waves: [{ wave: 1, seconds: 12, bonus: 10 }],
    shots: { PERFECT: 10, GREAT: 5, GOOD: 2, MISS: 1 },
    accuracy: 0.9,
    weaponKind: 'shotgun',
    weaponLevel: 2,
    cardStacks: { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 },
    mode: 'coop',
    coop: {
      slot,
      teamScore,
      partnerScore: slot === 1 ? Math.ceil(teamScore / 2) : Math.floor(teamScore / 2),
      partnerDeviceId,
      partnerNickname,
      leftEarly: false,
    },
  };
}

describe('team rankings (P03-T04)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(process.cwd(), 'data', `test-team-rankings-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('aggregates best team score per pair, maintains member ordering from best run, and reloads from file', () => {
    const recFile = path.join(tmpDir, 'records.jsonl');
    const store = new PlayRecordStore(recFile, RANKING_RULESET_VERSION);

    // 1. Match 1: Player A (slot 1) + Player B (slot 2) -> teamScore 500 (two lines)
    const statsA1 = makeCoopStats(1, 500, 'dev_B', '선수B');
    const statsB1 = makeCoopStats(2, 500, 'dev_A', '선수A');
    store.append({
      playedAt: '2026-11-07T10:00:00.000Z',
      deviceId: 'dev_A',
      nickname: '선수A',
      rulesetVersion: RANKING_RULESET_VERSION,
      stats: statsA1,
    });
    store.append({
      playedAt: '2026-11-07T10:00:00.000Z',
      deviceId: 'dev_B',
      nickname: '선수B',
      rulesetVersion: RANKING_RULESET_VERSION,
      stats: statsB1,
    });

    const teams1 = store.getTopTeams(5);
    expect(teams1).toHaveLength(1);
    expect(teams1[0].teamScore).toBe(500);
    expect(teams1[0].teamKey).toBe('dev_A|dev_B');
    expect(teams1[0].members[0].deviceId).toBe('dev_A'); // 1P
    expect(teams1[0].members[1].deviceId).toBe('dev_B'); // 2P

    // 2. Match 2: Same pair swap slots (B is 1P, A is 2P) and score higher: teamScore 700
    const statsB2 = makeCoopStats(1, 700, 'dev_A', '선수A');
    const statsA2 = makeCoopStats(2, 700, 'dev_B', '선수B');
    store.append({
      playedAt: '2026-11-07T10:10:00.000Z',
      deviceId: 'dev_B',
      nickname: '선수B',
      rulesetVersion: RANKING_RULESET_VERSION,
      stats: statsB2,
    });
    store.append({
      playedAt: '2026-11-07T10:10:00.000Z',
      deviceId: 'dev_A',
      nickname: '선수A',
      rulesetVersion: RANKING_RULESET_VERSION,
      stats: statsA2,
    });

    // Still only 1 entry for this pair, but updated to 700 and 1P is now B!
    const teams2 = store.getTopTeams(5);
    expect(teams2).toHaveLength(1);
    expect(teams2[0].teamScore).toBe(700);
    expect(teams2[0].members[0].deviceId).toBe('dev_B');
    expect(teams2[0].members[1].deviceId).toBe('dev_A');

    // 3. Match 3: Another team C & D with teamScore 600
    const statsC = makeCoopStats(1, 600, 'dev_D', '선수D');
    store.append({
      playedAt: '2026-11-07T10:20:00.000Z',
      deviceId: 'dev_C',
      nickname: '선수C',
      rulesetVersion: RANKING_RULESET_VERSION,
      stats: statsC,
    });

    const teams3 = store.getTopTeams(5);
    expect(teams3).toHaveLength(2);
    expect(teams3[0].teamScore).toBe(700);
    expect(teams3[0].teamKey).toBe('dev_A|dev_B');
    expect(teams3[1].teamScore).toBe(600);
    expect(teams3[1].teamKey).toBe('dev_C|dev_D');

    // Solo top runs must remain empty
    expect(store.getTopRuns()).toHaveLength(0);

    // 4. Reload from file into fresh instance
    const reloadedStore = new PlayRecordStore(recFile, RANKING_RULESET_VERSION);
    const reloadedTeams = reloadedStore.getTopTeams(5);
    expect(reloadedTeams).toHaveLength(2);
    expect(reloadedTeams[0].teamScore).toBe(700);
    expect(reloadedTeams[1].teamScore).toBe(600);
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
      serverInstance = await createBeerCrusherServer({
        port: 0,
        storePath: path.join(tmpDir, 'players.json'),
        recordPath: path.join(tmpDir, 'records.jsonl'),
      });
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
