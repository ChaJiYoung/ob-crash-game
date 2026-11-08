import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';
import { startHarness, Harness } from './helpers/wsHarness';

describe('server local player registration (P03-T02)', () => {
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

  it('registers local mouse player from PC host socket and rejects non-host or invalid names', async () => {
    serverInstance = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
    });
    const port = serverInstance.port;

    const pcWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((res) => pcWs.on('open', () => res()));

    // 1. PC creates room
    const roomCreatedPromise = waitForMessage(pcWs, 'ROOM_CREATED');
    pcWs.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    const roomCreated = await roomCreatedPromise;
    const roomId = roomCreated.roomId;

    // 2. PC registers local player with valid nickname
    const localRegisteredPromise = waitForMessage(pcWs, 'LOCAL_PLAYER_REGISTERED');
    const pcDeviceId = 'pc_dev_mouse_123';
    pcWs.send(
      JSON.stringify({
        type: 'REGISTER_LOCAL_PLAYER',
        roomId,
        deviceId: pcDeviceId,
        nickname: '마우스왕',
        slot: 1,
      })
    );
    const registeredMsg = await localRegisteredPromise;
    expect(registeredMsg.roomId).toBe(roomId);
    expect(registeredMsg.slot).toBe(1);
    expect(registeredMsg.player.nickname).toBe('마우스왕');
    expect(registeredMsg.player.deviceId).toBe(pcDeviceId);

    // Verify playerStore has the profile
    const storedPlayer = serverInstance.playerStore.findByDeviceId(pcDeviceId);
    expect(storedPlayer).toBeDefined();
    expect(storedPlayer?.nickname).toBe('마우스왕');

    // Verify room controllers map is empty (PC socket is NOT seated as a controller)
    const session = serverInstance.roomManager.getRoom(roomId);
    expect(session).toBeDefined();
    expect(session?.controllers[1]).toBeUndefined();
    expect(session?.controllers[2]).toBeUndefined();

    // 3. Invalid nickname (1 char) -> ERROR INVALID_NICKNAME
    const invalidNickPromise = waitForMessage(pcWs, 'ERROR');
    pcWs.send(
      JSON.stringify({
        type: 'REGISTER_LOCAL_PLAYER',
        roomId,
        deviceId: pcDeviceId,
        nickname: 'A',
        slot: 1,
      })
    );
    const invalidErr = await invalidNickPromise;
    expect(invalidErr.code).toBe('INVALID_NICKNAME');

    // 4. Non-host socket (controller socket) tries to REGISTER_LOCAL_PLAYER -> ERROR NOT_ROOM_HOST
    const phoneWs = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((res) => phoneWs.on('open', () => res()));

    const notHostPromise = waitForMessage(phoneWs, 'ERROR');
    phoneWs.send(
      JSON.stringify({
        type: 'REGISTER_LOCAL_PLAYER',
        roomId,
        deviceId: 'phone_dev_fake',
        nickname: '스푸퍼',
        slot: 1,
      })
    );
    const notHostErr = await notHostPromise;
    expect(notHostErr.code).toBe('NOT_ROOM_HOST');

    pcWs.close();
    phoneWs.close();
  });
});

describe('LOOKUP_LOCAL_PLAYER and localPlayers (sqlite-db-design P02-T03)', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await startHarness({});
  });
  afterEach(async () => {
    await h.cleanup();
  });

  const send = (ws: WebSocket, msg: Record<string, unknown>) => ws.send(JSON.stringify(msg));
  const local = () => h.server.roomManager.getRoom(h.roomId)!.localPlayers;

  it('answers a known deviceId with LOCAL_PLAYER_REGISTERED and records the slot', async () => {
    h.server.playerStore.registerOrUpdateNickname('pc_dev', '두둥');
    send(h.pc.ws, { type: 'LOOKUP_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'pc_dev', slot: 1 });
    await h.pc.waitFor(() => h.pc.of('LOCAL_PLAYER_REGISTERED').length > 0);
    const msg = h.pc.of('LOCAL_PLAYER_REGISTERED')[0];
    expect(msg.slot).toBe(1);
    expect(msg.player.nickname).toBe('두둥');
    expect(local()[1]).toBe('pc_dev');
  });

  it('answers an unknown deviceId with LOCAL_PLAYER_UNKNOWN', async () => {
    send(h.pc.ws, { type: 'LOOKUP_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'nobody', slot: 2 });
    await h.pc.waitFor(() => h.pc.of('LOCAL_PLAYER_UNKNOWN').length > 0);
    expect(h.pc.of('LOCAL_PLAYER_UNKNOWN')[0].slot).toBe(2);
    expect(local()[2]).toBeUndefined();
  });

  it('rejects a lookup from a phone socket', async () => {
    const phone = await h.phone('dev1', 1);
    send(phone.ws, { type: 'LOOKUP_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'dev1', slot: 2 });
    await phone.waitFor(() => phone.messages.some((m) => m.type === 'ERROR' && m.code === 'NOT_ROOM_HOST'));
    expect(local()[2]).toBeUndefined();
  });

  it('records REGISTER_LOCAL_PLAYER and moves the entry when the same device takes another slot', async () => {
    send(h.pc.ws, { type: 'REGISTER_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'pc_dev', nickname: '마우스왕', slot: 1 });
    await h.pc.waitFor(() => h.pc.of('LOCAL_PLAYER_REGISTERED').length === 1);
    expect(local()[1]).toBe('pc_dev');
    send(h.pc.ws, { type: 'REGISTER_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'pc_dev', nickname: '마우스왕', slot: 2 });
    await h.pc.waitFor(() => h.pc.of('LOCAL_PLAYER_REGISTERED').length === 2);
    expect(local()[2]).toBe('pc_dev');
    expect(local()[1]).toBeUndefined();
  });

  it('clears the slot entry when a phone sits there', async () => {
    h.server.playerStore.registerOrUpdateNickname('pc_dev', '두둥');
    send(h.pc.ws, { type: 'LOOKUP_LOCAL_PLAYER', roomId: h.roomId, deviceId: 'pc_dev', slot: 1 });
    await h.pc.waitFor(() => local()[1] === 'pc_dev');
    await h.phone('dev1', 1);
    expect(local()[1]).toBeUndefined();
  });
});
