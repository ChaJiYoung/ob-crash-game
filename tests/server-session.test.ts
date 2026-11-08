import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';
import { makeEnv, playSolo, register } from './helpers/dbFixtures';

describe('PlayerStore & WebSocket Server', () => {
  let serverInstance: BeerCrusherServerInstance | undefined;

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.close();
      serverInstance = undefined;
    }
  });

  describe('PlayerStore on the DB', () => {
    it('validates nicknames, registers, renames and reports unknown devices', () => {
      const env = makeEnv();
      expect(env.players.findByDeviceId('device-001')).toBeUndefined();
      expect(() => env.players.registerOrUpdateNickname('device-001', ' ')).toThrow('INVALID_NICKNAME: Nickname must be 2 to 10 characters');
      expect(() => env.players.registerOrUpdateNickname('device-001', 'a')).toThrow('INVALID_NICKNAME');
      expect(() => env.players.registerOrUpdateNickname('device-001', '이것은열한글자가넘는닉네임입니다')).toThrow('INVALID_NICKNAME');
      const p1 = env.players.registerOrUpdateNickname('device-001', ' 맥주고수 ');
      expect(p1).toMatchObject({ deviceId: 'device-001', nickname: '맥주고수', bestScore: 0, totalGames: 0 });
      const p2 = env.players.registerOrUpdateNickname('device-001', '새닉네임');
      expect(p2.nickname).toBe('새닉네임');
      expect(env.db.conn.prepare('SELECT COUNT(*) AS c FROM players').pluck().get()).toBe(1);
      env.db.close();
    });

    it('derives bestScore and totalGames from finished games of the current ruleset', () => {
      const env = makeEnv();
      register(env, 'device-001');
      playSolo(env, { playerId: 'device-001', score: 100, at: 1 });
      playSolo(env, { playerId: 'device-001', score: 300, at: 2 });
      playSolo(env, { playerId: 'device-001', score: 9999, at: 3, rv: RANKING_RULESET_VERSION - 1 });
      const ab = playSolo(env, { playerId: 'device-001', score: 5000, at: 4, submit: false, roomId: 'AB' });
      env.records.abandonGame(ab, 'AB', 't');
      playSolo(env, { playerId: 'device-001', score: 7777, at: 5, submit: false });
      const p = env.players.findByDeviceId('device-001')!;
      expect(p.bestScore).toBe(300);
      expect(p.totalGames).toBe(2);
      expect(p.coopBests).toBeUndefined();
      env.db.close();
    });

    it('ranks players by best score, skipping zeros, ties by earlier last_seen_at', () => {
      const env = makeEnv();
      register(env, 'a', 'b', 'c', 'd');
      playSolo(env, { playerId: 'a', score: 500, at: 1 });
      playSolo(env, { playerId: 'b', score: 900, at: 2 });
      playSolo(env, { playerId: 'c', score: 500, at: 3 });
      env.db.conn.prepare(`UPDATE players SET last_seen_at = ? WHERE id = 'a'`).run('2026-11-08T00:00:02.000Z');
      env.db.conn.prepare(`UPDATE players SET last_seen_at = ? WHERE id = 'c'`).run('2026-11-08T00:00:01.000Z');
      const top = env.players.getTopRankings(5);
      expect(top.map((p) => p.deviceId)).toEqual(['b', 'c', 'a']);
      expect(top.map((p) => p.deviceId)).not.toContain('d');
      env.db.close();
    });
  });

  it('should relay QR pairing, device check, nickname register, and sensor frames over WebSocket', async () => {
    serverInstance = await createBeerCrusherServer({ port: 0, dbPath: ':memory:' });
    const wsUrl = `ws://localhost:${serverInstance.port}`;

    // Helper to wait for specific message type using exact union extraction
    function waitForMessage<K extends ServerToClientMessage['type']>(
      ws: WebSocket,
      type: K
    ): Promise<Extract<ServerToClientMessage, { type: K }>> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for message type: ${type}`));
        }, 3000);

        const listener = (data: Buffer | string) => {
          try {
            const parsed = JSON.parse(data.toString()) as ServerToClientMessage;
            if (parsed.type === type) {
              clearTimeout(timeout);
              ws.off('message', listener);
              resolve(parsed as Extract<ServerToClientMessage, { type: K }>);
            }
          } catch {
            // ignore non-json
          }
        };
        ws.on('message', listener);
      });
    }

    // 1. PC Client connects and creates room
    const pcWs = new WebSocket(wsUrl);
    await new Promise((res) => pcWs.on('open', res));

    pcWs.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    const roomCreated = await waitForMessage(pcWs, 'ROOM_CREATED');
    expect(roomCreated.roomId).toHaveLength(4);
    const roomId = roomCreated.roomId;

    // 2. Mobile Controller connects and performs DEVICE_CHECK
    const mobileWs = new WebSocket(wsUrl);
    await new Promise((res) => mobileWs.on('open', res));

    mobileWs.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'phone-xyz-123' }));
    const auth1 = await waitForMessage(mobileWs, 'AUTH_RESULT');
    expect(auth1.isNewUser).toBe(true);

    // 3. Mobile registers nickname
    const pairedPromise = waitForMessage(pcWs, 'CONTROLLER_PAIRED');
    mobileWs.send(
      JSON.stringify({
        type: 'REGISTER_NICKNAME',
        roomId,
        deviceId: 'phone-xyz-123',
        nickname: '치맥러버',
      })
    );
    const auth2 = await waitForMessage(mobileWs, 'AUTH_RESULT');
    expect(auth2.isNewUser).toBe(false);
    expect(auth2.player?.nickname).toBe('치맥러버');

    const pairedMsg = await pairedPromise;
    expect(pairedMsg.player.nickname).toBe('치맥러버');

    // 4. Zero calibration relay
    const zeroPromise = waitForMessage(pcWs, 'ZERO_CALIBRATED');
    mobileWs.send(JSON.stringify({ type: 'CALIBRATE_ZERO', roomId, deviceId: 'phone-xyz-123' }));
    const zeroMsg = await zeroPromise;
    expect(zeroMsg.deviceId).toBe('phone-xyz-123');

    // 4-B. Start game request relay & 2-way countdown broadcast
    const startPromise = waitForMessage(pcWs, 'GAME_START_RELAY');
    const countdownMobilePromise = waitForMessage(mobileWs, 'GAME_COUNTDOWN_START');
    const countdownPcPromise = waitForMessage(pcWs, 'GAME_COUNTDOWN_START');
    mobileWs.send(JSON.stringify({ type: 'START_GAME_REQUEST', roomId, deviceId: 'phone-xyz-123' }));
    const startMsg = await startPromise;
    const countdownMobileMsg = await countdownMobilePromise;
    const countdownPcMsg = await countdownPcPromise;
    expect(startMsg.roomId).toBe(roomId);
    expect(startMsg.deviceId).toBe('phone-xyz-123');
    expect(countdownMobileMsg.roomId).toBe(roomId);
    expect(countdownMobileMsg.sec).toBe(3);
    expect(countdownPcMsg.roomId).toBe(roomId);
    expect(countdownPcMsg.sec).toBe(3);

    // 5. Sensor frame relay
    const sensorPromise = waitForMessage(pcWs, 'SENSOR_RELAY');

    mobileWs.send(
      JSON.stringify({
        type: 'SENSOR_FRAME',
        roomId,
        deviceId: 'phone-xyz-123',
        payload: {
          aimX: 0.12,
          aimY: -0.34,
          pitchDeg: 12.5,
          yawDeg: -5.2,
          rollDeg: 0,
          snapFire: true,
          rapidFireHold: false,
          feverTriggered: false,
          timestamp: Date.now(),
        },
      })
    );

    const relayMsg = await sensorPromise;
    expect(relayMsg.payload.aimX).toBe(0.12);
    expect(relayMsg.payload.snapFire).toBe(true);

    // 5-B. Fever status sync from PC to mobile controller
    const feverPromise = waitForMessage(mobileWs, 'FEVER_STATUS_RELAY');
    pcWs.send(
      JSON.stringify({
        type: 'FEVER_STATUS_SYNC',
        roomId,
        isFeverReady: true,
      })
    );
    const feverRelay = await feverPromise;
    expect(feverRelay.roomId).toBe(roomId);
    expect(feverRelay.isFeverReady).toBe(true);

    // 5-C. Sensor config update relay from PC to mobile controller
    const sensorConfigPromise = waitForMessage(mobileWs, 'SENSOR_CONFIG_UPDATE');
    pcWs.send(
      JSON.stringify({
        type: 'SENSOR_CONFIG_UPDATE',
        roomId,
        config: {
          isStabilizedMode: true,
          preset: 'stabilized_galaxy',
          minCutoff: 0.4,
          beta: 2.0,
        },
      })
    );
    const configRelay = await sensorConfigPromise;
    expect(configRelay.roomId).toBe(roomId);
    expect(configRelay.config.isStabilizedMode).toBe(true);
    expect(configRelay.config.preset).toBe('stabilized_galaxy');

    // 6a. A client built for other ranking rules (or an old build without a version) is rejected and records nothing
    for (const stale of [{ rulesetVersion: RANKING_RULESET_VERSION - 1 }, {}]) {
      const rejected = waitForMessage(pcWs, 'ERROR');
      pcWs.send(
        JSON.stringify({
          type: 'GAME_SCORE_SUBMIT',
          roomId,
          deviceId: 'phone-xyz-123',
          score: 99999,
          waveReached: 7,
          maxCombo: 99,
          ...stale,
        })
      );
      const rejection = await rejected;
      expect(rejection.code).toBe('RULESET_MISMATCH');
    }

    // 6b. Only the PC socket may submit scores
    const notHost = waitForMessage(mobileWs, 'ERROR');
    mobileWs.send(
      JSON.stringify({ type: 'GAME_SCORE_SUBMIT', roomId, deviceId: 'phone-xyz-123', score: 1, waveReached: 1, maxCombo: 1, rulesetVersion: RANKING_RULESET_VERSION })
    );
    expect((await notHost).code).toBe('NOT_ROOM_HOST');

    // 6. PC begins a game, then submits; the rejected 99999 must not appear
    const beginId = 'b-1';
    const startedPromise = waitForMessage(pcWs, 'GAME_STARTED');
    pcWs.send(JSON.stringify({ type: 'GAME_BEGIN', roomId, beginId, mode: 'solo', players: [{ slot: 1, deviceId: 'phone-xyz-123', inputKind: 'mobile' }] }));
    const started = await startedPromise;
    expect(started.beginId).toBe(beginId);
    const gameId = started.gameId;

    const runStats = {
      outcome: 'GAMEOVER', waveReached: 3, livesLeft: 0, durationSec: 60, totalScore: 7000, baseScore: 7000, timeBonus: 0,
      precisionBonus: 0, levelBonus: 0, maxCombo: 24, kills: 40, waves: [], shots: { PERFECT: 1, GREAT: 1, GOOD: 1, MISS: 1 }, accuracy: 0.5,
      weaponKind: 'shotgun', weaponLevel: 2, cardStacks: { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 },
    };
    const submitRun = (score: number, extra: Record<string, unknown> = {}) =>
      pcWs.send(JSON.stringify({ type: 'GAME_SCORE_SUBMIT', roomId, deviceId: 'phone-xyz-123', gameId, score, waveReached: 3, maxCombo: 24, rulesetVersion: RANKING_RULESET_VERSION, stats: runStats, ...extra }));

    // Without stats nothing is recorded
    const noStats = waitForMessage(pcWs, 'ERROR');
    submitRun(6400, { stats: undefined });
    expect((await noStats).code).toBe('INVALID_STATS');
    // A mismatched total is rejected too
    const mismatch = waitForMessage(pcWs, 'ERROR');
    submitRun(9999);
    expect((await mismatch).code).toBe('INVALID_STATS');
    // Valid stats finish the game
    const accepted = waitForMessage(pcWs, 'RANKING_UPDATED');
    submitRun(7000);
    const rankingMsg = await accepted;
    expect(rankingMsg.rankings[0]).toMatchObject({ score: 7000, waveReached: 3, weaponKind: 'shotgun' });
    expect(rankingMsg.updatedPlayer).toMatchObject({ bestScore: 7000, totalGames: 1 });

    // 7. Verify disconnect notification when controller closes
    const disconnectPromise = waitForMessage(pcWs, 'ERROR');
    mobileWs.close();
    const disconnectMsg = await disconnectPromise;
    expect(disconnectMsg.code).toBe('CONTROLLER_DISCONNECTED');

    pcWs.close();
  });
});
