import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import { PlayerStore } from '../server/PlayerStore';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

describe('PlayerStore & WebSocket Server', () => {
  let tempDir: string;
  let testStorePath: string;
  let serverInstance: BeerCrusherServerInstance | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-test-'));
    testStorePath = path.join(tempDir, 'players.json');
  });

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.close();
      serverInstance = undefined;
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('ranking ruleset migration (gameplay-polish P05-T03)', () => {
    const oldFile = () =>
      JSON.stringify(
        {
          players: {
            'device-1': { deviceId: 'device-1', nickname: '맥주고수', bestScore: 9000, totalGames: 7, lastPlayedAt: '2026-10-01T00:00:00.000Z' },
            'device-2': { deviceId: 'device-2', nickname: '필굿요정', bestScore: 4000, totalGames: 2, lastPlayedAt: '2026-10-02T00:00:00.000Z' },
          },
        },
        null,
        2
      );

    it('backs up a versionless file byte for byte, then resets scores but keeps nicknames', () => {
      const original = oldFile();
      fs.writeFileSync(testStorePath, original, 'utf-8');

      const store = new PlayerStore(testStorePath);
      const backupPath = `${testStorePath}.ruleset-1.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.readFileSync(backupPath, 'utf-8')).toBe(original);

      const p1 = store.findByDeviceId('device-1')!;
      expect(p1.nickname).toBe('맥주고수');
      expect(p1.bestScore).toBe(0);
      expect(p1.totalGames).toBe(0);
      expect(p1.lastPlayedAt).toBe('2026-10-01T00:00:00.000Z');
      expect(store.getTopRankings(5).every((p) => p.bestScore === 0)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(testStorePath, 'utf-8'));
      expect(saved.rulesetVersion).toBe(RANKING_RULESET_VERSION);
    });

    it('keeps new scores and the first backup on later loads', () => {
      const original = oldFile();
      fs.writeFileSync(testStorePath, original, 'utf-8');
      const first = new PlayerStore(testStorePath);
      first.recordGameScore('device-1', 3210);

      const second = new PlayerStore(testStorePath);
      expect(second.findByDeviceId('device-1')?.bestScore).toBe(3210);
      expect(second.findByDeviceId('device-1')?.totalGames).toBe(1);
      expect(fs.readFileSync(`${testStorePath}.ruleset-1.bak`, 'utf-8')).toBe(original);
    });

    it('does not reset anything when the backup cannot be written', () => {
      fs.writeFileSync(testStorePath, oldFile(), 'utf-8');
      const realWrite = fs.writeFileSync;
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(((file: any, ...rest: any[]) => {
        if (String(file).endsWith('.bak')) throw new Error('disk full');
        return (realWrite as any)(file, ...rest);
      }) as any);

      try {
        const store = new PlayerStore(testStorePath);
        expect(store.findByDeviceId('device-1')?.bestScore).toBe(9000);
        expect(fs.existsSync(`${testStorePath}.ruleset-1.bak`)).toBe(false);
        expect(JSON.parse(fs.readFileSync(testStorePath, 'utf-8')).rulesetVersion).toBeUndefined();
      } finally {
        spy.mockRestore();
        errSpy.mockRestore();
      }
    });

    it('leaves a current-version file untouched', () => {
      const current = JSON.stringify(
        {
          rulesetVersion: RANKING_RULESET_VERSION,
          players: { 'device-1': { deviceId: 'device-1', nickname: '맥주고수', bestScore: 777, totalGames: 3, lastPlayedAt: '2026-11-01T00:00:00.000Z' } },
        },
        null,
        2
      );
      fs.writeFileSync(testStorePath, current, 'utf-8');
      const store = new PlayerStore(testStorePath);
      expect(store.findByDeviceId('device-1')?.bestScore).toBe(777);
      expect(fs.readdirSync(tempDir).filter((f) => f.endsWith('.bak'))).toEqual([]);
      expect(fs.readFileSync(testStorePath, 'utf-8')).toBe(current);
    });

    it('writes the current version when the store file does not exist yet', () => {
      new PlayerStore(testStorePath);
      expect(JSON.parse(fs.readFileSync(testStorePath, 'utf-8')).rulesetVersion).toBe(RANKING_RULESET_VERSION);
    });
  });

  it('should handle PlayerStore registration, score recording, and ranking', () => {
    const store = new PlayerStore(testStorePath);

    expect(store.findByDeviceId('device-001')).toBeUndefined();

    // Nickname validation
    expect(() => store.registerOrUpdateNickname('device-001', ' ')).toThrow('INVALID_NICKNAME');
    expect(() => store.registerOrUpdateNickname('device-001', 'a')).toThrow('INVALID_NICKNAME');
    expect(() => store.registerOrUpdateNickname('device-001', '이것은열한글자가넘는닉네임입니다')).toThrow('INVALID_NICKNAME');

    const p1 = store.registerOrUpdateNickname('device-001', '맥주고수');
    expect(p1.nickname).toBe('맥주고수');
    expect(p1.bestScore).toBe(0);

    // Record scores
    const r1 = store.recordGameScore('device-001', 3500);
    expect(r1.isNewRecord).toBe(true);
    expect(r1.profile.bestScore).toBe(3500);
    expect(r1.profile.totalGames).toBe(1);

    const r2 = store.recordGameScore('device-001', 2100); // Lower score
    expect(r2.isNewRecord).toBe(false);
    expect(r2.profile.bestScore).toBe(3500);
    expect(r2.profile.totalGames).toBe(2);

    // Add more players
    store.registerOrUpdateNickname('device-002', '카스마스터');
    store.recordGameScore('device-002', 4500);

    store.registerOrUpdateNickname('device-003', '라거황제');
    store.recordGameScore('device-003', 1200);

    store.registerOrUpdateNickname('device-004', '한맥장인');
    store.recordGameScore('device-004', 5600);

    store.registerOrUpdateNickname('device-005', '필굿요정');
    store.recordGameScore('device-005', 2800);

    store.registerOrUpdateNickname('device-006', '생맥폭격기');
    store.recordGameScore('device-006', 7200);

    const top5 = store.getTopRankings(5);
    expect(top5).toHaveLength(5);
    expect(top5[0].nickname).toBe('생맥폭격기');
    expect(top5[0].bestScore).toBe(7200);
    expect(top5[1].nickname).toBe('한맥장인');
    expect(top5[1].bestScore).toBe(5600);
    expect(top5[2].nickname).toBe('카스마스터');
    expect(top5[2].bestScore).toBe(4500);

    // Verify persistence by loading into a new instance
    const store2 = new PlayerStore(testStorePath);
    expect(store2.findByDeviceId('device-001')?.nickname).toBe('맥주고수');
    expect(store2.getTopRankings(5)[0].nickname).toBe('생맥폭격기');
  });

  it('should relay QR pairing, device check, nickname register, and sensor frames over WebSocket', async () => {
    serverInstance = await createBeerCrusherServer({ port: 0, storePath: testStorePath });
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

    // 6. Submit score and receive updated rankings
    const rankingPromise = waitForMessage(pcWs, 'RANKING_UPDATED');
    mobileWs.send(
      JSON.stringify({
        type: 'GAME_SCORE_SUBMIT',
        roomId,
        deviceId: 'phone-xyz-123',
        score: 6400,
        waveReached: 3,
        maxCombo: 24,
      })
    );
    const rankingMsg = await rankingPromise;
    expect(rankingMsg.updatedPlayer?.bestScore).toBe(6400);

    // 7. Verify disconnect notification when controller closes
    const disconnectPromise = waitForMessage(pcWs, 'ERROR');
    mobileWs.close();
    const disconnectMsg = await disconnectPromise;
    expect(disconnectMsg.code).toBe('CONTROLLER_DISCONNECTED');

    pcWs.close();
  });
});
