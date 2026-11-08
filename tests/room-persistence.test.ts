import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { ServerToClientMessage } from '../src/shared/types';
import { loadSavedRoomId, saveRoomId, clearSavedRoomId, PC_ROOM_STORAGE_KEY } from '../src/pc/roomMemory';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe('PC room code memory', () => {
  it('round-trips a saved room code and upper-cases it', () => {
    const storage = memoryStorage();
    saveRoomId('ab12', storage);
    expect(storage.map.get(PC_ROOM_STORAGE_KEY)).toBe('AB12');
    expect(loadSavedRoomId(storage)).toBe('AB12');
    clearSavedRoomId(storage);
    expect(loadSavedRoomId(storage)).toBeUndefined();
  });

  it('rejects malformed codes', () => {
    const storage = memoryStorage();
    saveRoomId('a b', storage);
    saveRoomId('', storage);
    saveRoomId('TOOLONGCODE', storage);
    expect(storage.map.size).toBe(0);
    expect(loadSavedRoomId(memoryStorage({ [PC_ROOM_STORAGE_KEY]: 'x y' }))).toBeUndefined();
  });

  it('never throws when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSavedRoomId(blocked)).toBeUndefined();
    expect(() => saveRoomId('AB12', blocked)).not.toThrow();
    expect(() => clearSavedRoomId(blocked)).not.toThrow();
  });
});

describe('room persistence on the server', () => {
  let server: BeerCrusherServerInstance;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    server = await createBeerCrusherServer({ port: 0, dbPath: ':memory:' });
  });

  afterEach(async () => {
    for (const s of sockets.splice(0)) s.close();
    await server.close();
  });

  /** Opens a socket that records every message so none are missed between awaits. */
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const inbox: ServerToClientMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    sockets.push(ws);
    const waitFor = async <T extends ServerToClientMessage['type']>(
      type: T,
      predicate: (m: Extract<ServerToClientMessage, { type: T }>) => boolean = () => true
    ) => {
      for (let i = 0; i < 100; i++) {
        const found = inbox.find((m) => m.type === type && predicate(m as never));
        if (found) return found as Extract<ServerToClientMessage, { type: T }>;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`timed out waiting for ${type}`);
    };
    return { ws, inbox, waitFor, send: (m: unknown) => ws.send(JSON.stringify(m)) };
  }

  it('hands the same room back and keeps the live controller socket', async () => {
    const pcA = await connect();
    pcA.send({ type: 'CREATE_ROOM' });
    const { roomId } = await pcA.waitFor('ROOM_CREATED');

    const phone = await connect();
    phone.send({ type: 'DEVICE_CHECK', roomId, deviceId: 'dev-1' });
    await phone.waitFor('AUTH_RESULT');
    const phoneSocket = server.roomManager.getRoom(roomId)?.controllerSocket;
    expect(phoneSocket).toBeDefined();

    pcA.ws.close();
    await phone.waitFor('ERROR', (m) => m.code === 'PC_DISCONNECTED');

    const pcB = await connect();
    pcB.send({ type: 'CREATE_ROOM', roomId });
    const again = await pcB.waitFor('ROOM_CREATED');
    expect(again.roomId).toBe(roomId);
    expect(server.roomManager.getRoom(roomId)?.controllerSocket).toBe(phoneSocket);
  });

  it('issues a different valid code when the requested one is malformed', async () => {
    const pc = await connect();
    pc.send({ type: 'CREATE_ROOM', roomId: 'a b!' });
    const { roomId } = await pc.waitFor('ROOM_CREATED');
    expect(roomId).toMatch(/^[A-Z0-9]{3,8}$/);
  });
});

describe('resume flag relay', () => {
  let server: BeerCrusherServerInstance;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    server = await createBeerCrusherServer({ port: 0, dbPath: ':memory:' });
  });

  afterEach(async () => {
    for (const s of sockets.splice(0)) s.close();
    await server.close();
  });

  async function open() {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const inbox: ServerToClientMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    sockets.push(ws);
    const waitFor = async (type: ServerToClientMessage['type'], from = 0) => {
      for (let i = 0; i < 100; i++) {
        const found = inbox.slice(from).find((m) => m.type === type);
        if (found) return found;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`timed out waiting for ${type}`);
    };
    return { ws, inbox, waitFor, send: (m: unknown) => ws.send(JSON.stringify(m)) };
  }

  it('relays resume only when the phone asked for it', async () => {
    const pc = await open();
    pc.send({ type: 'CREATE_ROOM' });
    const { roomId } = (await pc.waitFor('ROOM_CREATED')) as { roomId: string };
    const phone = await open();

    phone.send({ type: 'CALIBRATE_ZERO', roomId, deviceId: 'dev-1', resume: true });
    const resumed = (await pc.waitFor('ZERO_CALIBRATED')) as { resume?: boolean };
    expect(resumed.resume).toBe(true);

    const before = pc.inbox.length;
    phone.send({ type: 'CALIBRATE_ZERO', roomId, deviceId: 'dev-1' });
    const plain = (await pc.waitFor('ZERO_CALIBRATED', before)) as Record<string, unknown>;
    expect('resume' in plain).toBe(false);
  });

  it('tells the PC when a registered phone drops and comes back', async () => {
    const pc = await open();
    pc.send({ type: 'CREATE_ROOM' });
    const { roomId } = (await pc.waitFor('ROOM_CREATED')) as { roomId: string };

    const phone1 = await open();
    phone1.send({ type: 'REGISTER_NICKNAME', roomId, deviceId: 'dev-9', nickname: '재접속' });
    await pc.waitFor('CONTROLLER_PAIRED');

    const mark = pc.inbox.length;
    phone1.ws.close();
    const dropped = (await pc.waitFor('ERROR', mark)) as { code: string };
    expect(dropped.code).toBe('CONTROLLER_DISCONNECTED');

    const mark2 = pc.inbox.length;
    const phone2 = await open();
    phone2.send({ type: 'DEVICE_CHECK', roomId, deviceId: 'dev-9' });
    await pc.waitFor('CONTROLLER_PAIRED', mark2);
  });
});
