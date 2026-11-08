import { WebSocket } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../../server/wsServer';
import type { GameBeginPlayer, PlayMode, ServerToClientMessage } from '../../src/shared/types';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 소켓이 받은 모든 메시지를 모아 둔다. 시간 경과 후 "오지 않았다"를 확인할 때 쓴다. */
export class Inbox {
  public readonly messages: ServerToClientMessage[] = [];
  constructor(public readonly ws: WebSocket) {
    ws.on('message', (data) => {
      try {
        this.messages.push(JSON.parse(data.toString()) as ServerToClientMessage);
      } catch {
        // ignore non-json
      }
    });
  }

  public of<K extends ServerToClientMessage['type']>(
    type: K,
    filter?: (m: Extract<ServerToClientMessage, { type: K }>) => boolean
  ): Array<Extract<ServerToClientMessage, { type: K }>> {
    return this.messages.filter(
      (m): m is Extract<ServerToClientMessage, { type: K }> =>
        m.type === type && (!filter || filter(m as Extract<ServerToClientMessage, { type: K }>))
    );
  }

  public disconnects(slot: number): ServerToClientMessage[] {
    return this.messages.filter((m) => m.type === 'ERROR' && m.code === 'CONTROLLER_DISCONNECTED' && m.slot === slot);
  }

  /** 조건을 만족하는 메시지가 올 때까지 기다린다. */
  public async waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) throw new Error('Timeout waiting for message');
      await sleep(10);
    }
  }
}

export const open = (url: string) =>
  new Promise<WebSocket>((resolve) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
  });

export const sensorFrame = (roomId: string, deviceId: string, aimX = 0.1) =>
  JSON.stringify({
    type: 'SENSOR_FRAME',
    roomId,
    deviceId,
    payload: {
      aimX,
      aimY: 0,
      pitchDeg: 0,
      yawDeg: 0,
      rollDeg: 0,
      snapFire: false,
      rapidFireHold: false,
      feverTriggered: false,
      isCocked: false,
      timestamp: Date.now(),
    },
  });

export interface Harness {
  server: BeerCrusherServerInstance;
  roomId: string;
  pc: Inbox;
  /** deviceId를 등록하고 slot에 붙은 폰을 만든다. */
  phone: (deviceId: string, slot: 1 | 2) => Promise<Inbox>;
  cleanup: () => Promise<void>;
}

export async function startHarness(options: {
  controllerFrameTimeoutMs?: number;
  watchIntervalMs?: number;
  backgroundNotifyDelayMs?: number;
}): Promise<Harness> {
  const server = await createBeerCrusherServer({ port: 0, dbPath: ':memory:', ...options });
  const url = `ws://localhost:${server.port}`;
  const pcWs = await open(url);
  const pc = new Inbox(pcWs);
  pcWs.send(JSON.stringify({ type: 'CREATE_ROOM' }));
  await pc.waitFor(() => pc.of('ROOM_CREATED').length > 0);
  const roomId = pc.of('ROOM_CREATED')[0].roomId;
  const sockets: WebSocket[] = [pcWs];

  return {
    server,
    roomId,
    pc,
    phone: async (deviceId, slot) => {
      server.playerStore.registerOrUpdateNickname(deviceId, `P-${deviceId}`);
      const ws = await open(url);
      sockets.push(ws);
      const inbox = new Inbox(ws);
      ws.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId, slot }));
      await pc.waitFor(() => pc.of('CONTROLLER_PAIRED', (m) => m.slot === slot).length > 0);
      return inbox;
    },
    cleanup: async () => {
      for (const s of sockets) s.close();
      await server.close();
    },
  };
}

/** PC 소켓으로 GAME_BEGIN을 보내고 gameId를 받는다. */
export async function beginGame(pc: Inbox, roomId: string, mode: PlayMode, players: GameBeginPlayer[]): Promise<number> {
  const beginId = `t-${Date.now()}-${Math.random()}`;
  pc.ws.send(JSON.stringify({ type: 'GAME_BEGIN', roomId, beginId, mode, players }));
  await pc.waitFor(() => pc.of('GAME_STARTED', (m) => m.beginId === beginId).length > 0);
  return pc.of('GAME_STARTED', (m) => m.beginId === beginId)[0].gameId;
}
