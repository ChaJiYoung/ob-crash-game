import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';

describe('server coop controller slots (P03-T01)', () => {
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
          // ignore non-json
        }
      };
      ws.on('message', listener);
    });
  }

  it('handles two controller slots, slot relays, slot isolation, and moved slots', async () => {
    serverInstance = await createBeerCrusherServer({ port: 0, dbPath: ':memory:' });
    const wsUrl = `ws://localhost:${serverInstance.port}`;

    // Pre-register phoneA and phoneB
    serverInstance.playerStore.registerOrUpdateNickname('phone-A', 'PlayerA');
    serverInstance.playerStore.registerOrUpdateNickname('phone-B', 'PlayerB');

    // 1. PC connects and creates room
    const pcWs = new WebSocket(wsUrl);
    await new Promise((res) => pcWs.on('open', res));
    pcWs.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    const roomCreated = await waitForMessage(pcWs, 'ROOM_CREATED');
    const roomId = roomCreated.roomId;

    // 2. Phone A connects to slot 1
    const phoneAWs = new WebSocket(wsUrl);
    await new Promise((res) => phoneAWs.on('open', res));
    const p1PairedPromise = waitForMessage(pcWs, 'CONTROLLER_PAIRED', (m) => m.slot === 1);
    phoneAWs.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'phone-A', slot: 1 }));
    const p1Paired = await p1PairedPromise;
    expect(p1Paired.slot).toBe(1);
    expect(p1Paired.player.nickname).toBe('PlayerA');

    // 3. Phone B connects to slot 2
    const phoneBWs = new WebSocket(wsUrl);
    await new Promise((res) => phoneBWs.on('open', res));
    const p2PairedPromise = waitForMessage(pcWs, 'CONTROLLER_PAIRED', (m) => m.slot === 2);
    phoneBWs.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'phone-B', slot: 2 }));
    const p2Paired = await p2PairedPromise;
    expect(p2Paired.slot).toBe(2);
    expect(p2Paired.player.nickname).toBe('PlayerB');

    // 4. Phone B sends SENSOR_FRAME (without slot in message) -> PC receives relay with slot === 2
    const sensorPromise = waitForMessage(pcWs, 'SENSOR_RELAY');
    phoneBWs.send(JSON.stringify({
      type: 'SENSOR_FRAME',
      roomId,
      deviceId: 'phone-B',
      payload: {
        aimX: 0.5,
        aimY: -0.2,
        pitchDeg: 10,
        yawDeg: 20,
        rollDeg: 0,
        snapFire: true,
        rapidFireHold: false,
        feverTriggered: false,
        isCocked: false,
        timestamp: Date.now(),
      },
    }));
    const sensorRelay = await sensorPromise;
    expect(sensorRelay.slot).toBe(2);
    expect(sensorRelay.deviceId).toBe('phone-B');

    // 5. PC sends SKILL_STATE_SYNC for slot 2 -> Only Phone B receives it
    let phoneAGotSkill = false;
    const phoneAListener = (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'SKILL_STATE_SYNC') phoneAGotSkill = true;
      } catch {}
    };
    phoneAWs.on('message', phoneAListener);

    const skillPromiseB = waitForMessage(phoneBWs, 'SKILL_STATE_SYNC');
    pcWs.send(JSON.stringify({
      type: 'SKILL_STATE_SYNC',
      roomId,
      weaponKind: 'gatling',
      weaponLevel: 2,
      skillStock: 1,
      maxSkillStock: 2,
      skillCooldownRemainingMs: 5000,
      skillCooldownTotalMs: 15000,
      slot: 2,
    }));
    const skillB = await skillPromiseB;
    expect(skillB.weaponKind).toBe('gatling');
    phoneAWs.off('message', phoneAListener);
    expect(phoneAGotSkill).toBe(false);

    // 6. Device C attempts to connect to occupied slot 2 -> ERROR SLOT_OCCUPIED
    const phoneCWs = new WebSocket(wsUrl);
    await new Promise((res) => phoneCWs.on('open', res));
    const occupiedPromise = waitForMessage(phoneCWs, 'ERROR');
    phoneCWs.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'phone-C', slot: 2 }));
    const errOccupied = await occupiedPromise;
    expect(errOccupied.code).toBe('SLOT_OCCUPIED');
    expect(errOccupied.slot).toBe(2);
    phoneCWs.close();

    // 7. Phone B closes -> PC receives CONTROLLER_DISCONNECTED with slot === 2
    const disconnectPromiseB = waitForMessage(pcWs, 'ERROR', (m) => m.code === 'CONTROLLER_DISCONNECTED' && m.slot === 2);
    phoneBWs.close();
    const disconnectB = await disconnectPromiseB;
    expect(disconnectB.slot).toBe(2);

    // 8. Phone A moves to slot 2 -> PC receives CONTROLLER_DISCONNECTED slot 1, then CONTROLLER_PAIRED slot 2
    const disconnectPromiseA1 = waitForMessage(pcWs, 'ERROR', (m) => m.code === 'CONTROLLER_DISCONNECTED' && m.slot === 1);
    const pairedPromiseA2 = waitForMessage(pcWs, 'CONTROLLER_PAIRED', (m) => m.slot === 2);
    phoneAWs.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'phone-A', slot: 2 }));
    const discA1 = await disconnectPromiseA1;
    expect(discA1.slot).toBe(1);
    const pairA2 = await pairedPromiseA2;
    expect(pairA2.slot).toBe(2);
    expect(pairA2.player.nickname).toBe('PlayerA');

    // Clean up
    phoneAWs.close();
    pcWs.close();
  });
});
