import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { PlayerStore } from './PlayerStore';
import { RoomManager } from './RoomManager';
import { ClientToServerMessage, ServerToClientMessage } from '../src/shared/types';

export interface BeerCrusherServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  playerStore: PlayerStore;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

export function sendJson(ws: WebSocket | undefined, message: ServerToClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export async function createBeerCrusherServer(options?: {
  port?: number;
  storePath?: string;
}): Promise<BeerCrusherServerInstance> {
  const port = options?.port ?? 8787;
  const playerStore = new PlayerStore(options?.storePath);
  const roomManager = new RoomManager();

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: string | Buffer) => {
      try {
        const text = raw.toString();
        const msg = JSON.parse(text) as ClientToServerMessage;

        switch (msg.type) {
          case 'CREATE_ROOM': {
            const session = roomManager.createRoom(msg.roomId);
            roomManager.attachPcSocket(session.roomId, ws);
            sendJson(ws, {
              type: 'ROOM_CREATED',
              roomId: session.roomId,
              rankings: playerStore.getTopRankings(5),
            });
            break;
          }

          case 'DEVICE_CHECK': {
            const { roomId, deviceId } = msg;
            if (!roomId || !deviceId) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId and deviceId are required for DEVICE_CHECK',
              });
              return;
            }

            const session = roomManager.getRoom(roomId);
            if (!session) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'ROOM_NOT_FOUND',
                message: `Room ${roomId} not found`,
              });
              return;
            }

            roomManager.attachControllerSocket(roomId, ws, deviceId);
            const player = playerStore.findByDeviceId(deviceId);
            const rankings = playerStore.getTopRankings(5);

            if (player) {
              sendJson(ws, {
                type: 'AUTH_RESULT',
                roomId,
                isNewUser: false,
                player,
                rankings,
              });
              sendJson(session.pcSocket, {
                type: 'CONTROLLER_PAIRED',
                roomId,
                player,
              });
            } else {
              sendJson(ws, {
                type: 'AUTH_RESULT',
                roomId,
                isNewUser: true,
                rankings,
              });
            }
            break;
          }

          case 'REGISTER_NICKNAME': {
            const { roomId, deviceId, nickname } = msg;
            try {
              const player = playerStore.registerOrUpdateNickname(deviceId, nickname);
              const rankings = playerStore.getTopRankings(5);
              const session = roomManager.getRoom(roomId);

              sendJson(ws, {
                type: 'AUTH_RESULT',
                roomId,
                isNewUser: false,
                player,
                rankings,
              });

              if (session) {
                sendJson(session.pcSocket, {
                  type: 'CONTROLLER_PAIRED',
                  roomId,
                  player,
                });
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Failed to register nickname';
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_NICKNAME',
                message: errMsg,
              });
            }
            break;
          }

          case 'CALIBRATE_ZERO': {
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              sendJson(session.pcSocket, {
                type: 'ZERO_CALIBRATED',
                roomId: msg.roomId,
                deviceId: msg.deviceId,
              });
            }
            break;
          }

          case 'SENSOR_FRAME': {
            const session = roomManager.getRoom(msg.roomId);
            if (session && session.pcSocket) {
              sendJson(session.pcSocket, {
                type: 'SENSOR_RELAY',
                roomId: msg.roomId,
                deviceId: msg.deviceId,
                payload: msg.payload,
              });
            }
            break;
          }

          case 'GAME_SCORE_SUBMIT': {
            const { deviceId, score, roomId } = msg;
            const { rankings, profile } = playerStore.recordGameScore(deviceId, score);
            const session = roomManager.getRoom(roomId);

            const response: ServerToClientMessage = {
              type: 'RANKING_UPDATED',
              rankings,
              updatedPlayer: profile,
            };

            sendJson(ws, response);
            if (session && session.pcSocket && session.pcSocket !== ws) {
              sendJson(session.pcSocket, response);
            }
            if (session && session.controllerSocket && session.controllerSocket !== ws) {
              sendJson(session.controllerSocket, response);
            }
            break;
          }

          default:
            sendJson(ws, {
              type: 'ERROR',
              code: 'UNKNOWN_MESSAGE',
              message: 'Unrecognized message type',
            });
        }
      } catch (err) {
        sendJson(ws, {
          type: 'ERROR',
          code: 'MALFORMED_JSON',
          message: 'Failed to parse JSON message',
        });
      }
    });

    ws.on('close', () => {
      roomManager.removeSocket(ws);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({
        server,
        wss,
        port: actualPort,
        playerStore,
        roomManager,
        close: async () => {
          return new Promise<void>((resClose) => {
            wss.close(() => {
              server.close(() => resClose());
            });
          });
        },
      });
    });
  });
}
