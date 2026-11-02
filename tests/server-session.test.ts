import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import { PlayerStore } from '../server/PlayerStore';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';

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

    // 4-B. Start game request relay
    const startPromise = waitForMessage(pcWs, 'GAME_START_RELAY');
    mobileWs.send(JSON.stringify({ type: 'START_GAME_REQUEST', roomId, deviceId: 'phone-xyz-123' }));
    const startMsg = await startPromise;
    expect(startMsg.roomId).toBe(roomId);
    expect(startMsg.deviceId).toBe('phone-xyz-123');

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
