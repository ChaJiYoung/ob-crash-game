import http from 'node:http';
import os from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { PlayerStore } from './PlayerStore';
import { RoomManager } from './RoomManager';
import { ClientToServerMessage, ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

export interface BeerCrusherServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  playerStore: PlayerStore;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

export function getLanIpAddress(): string | undefined {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name];
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('172.') || net.address.startsWith('10.')) {
          return net.address;
        }
      }
    }
  }
  return undefined;
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
      let msg: ClientToServerMessage;
      try {
        const text = raw.toString();
        msg = JSON.parse(text) as ClientToServerMessage;
      } catch {
        sendJson(ws, {
          type: 'ERROR',
          code: 'MALFORMED_JSON',
          message: 'Failed to parse JSON message',
        });
        return;
      }

      try {
        switch (msg.type) {
          case 'CREATE_ROOM': {
            const session = roomManager.createRoom(msg.roomId);
            roomManager.attachPcSocket(session.roomId, ws);
            sendJson(ws, {
              type: 'ROOM_CREATED',
              roomId: session.roomId,
              rankings: playerStore.getTopRankings(5),
              lanIp: getLanIpAddress(),
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
            if (!roomId || !deviceId || typeof nickname !== 'string') {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId, deviceId, and nickname are required for REGISTER_NICKNAME',
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

            try {
              const player = playerStore.registerOrUpdateNickname(deviceId, nickname);
              const rankings = playerStore.getTopRankings(5);

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
            const { roomId, deviceId } = msg;
            if (!roomId || !deviceId) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId and deviceId are required for CALIBRATE_ZERO',
              });
              return;
            }
            const session = roomManager.getRoom(roomId);
            if (session && session.pcSocket) {
              sendJson(session.pcSocket, {
                type: 'ZERO_CALIBRATED',
                roomId,
                deviceId,
              });
            }
            break;
          }

          case 'START_GAME_REQUEST': {
            const { roomId, deviceId } = msg;
            if (!roomId || !deviceId) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId and deviceId are required for START_GAME_REQUEST',
              });
              return;
            }
            const session = roomManager.getRoom(roomId);
            if (session) {
              if (session.pcSocket) {
                sendJson(session.pcSocket, {
                  type: 'GAME_COUNTDOWN_START',
                  roomId,
                  sec: 3,
                });
                sendJson(session.pcSocket, {
                  type: 'GAME_START_RELAY',
                  roomId,
                  deviceId,
                });
              }
              if (session.controllerSocket) {
                sendJson(session.controllerSocket, {
                  type: 'GAME_COUNTDOWN_START',
                  roomId,
                  sec: 3,
                });
              }
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

          case 'FEVER_STATUS_SYNC': {
            const session = roomManager.getRoom(msg.roomId);
            if (session && session.controllerSocket) {
              sendJson(session.controllerSocket, {
                type: 'FEVER_STATUS_RELAY',
                roomId: msg.roomId,
                isFeverReady: Boolean(msg.isFeverReady),
              });
            }
            break;
          }

          case 'SKILL_STATE_SYNC': {
            const session = roomManager.getRoom(msg.roomId);
            if (session && session.controllerSocket) {
              sendJson(session.controllerSocket, {
                type: 'SKILL_STATE_SYNC',
                roomId: msg.roomId,
                weaponKind: msg.weaponKind,
                weaponLevel: msg.weaponLevel,
                skillStock: msg.skillStock,
                maxSkillStock: msg.maxSkillStock,
                skillCooldownRemainingMs: msg.skillCooldownRemainingMs,
                skillCooldownTotalMs: msg.skillCooldownTotalMs,
              });
            }
            break;
          }

          case 'GAME_SCORE_SUBMIT': {
            const { deviceId, score, roomId } = msg;
            if (!deviceId || typeof score !== 'number' || isNaN(score) || !roomId) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId, valid deviceId, and numeric score are required for GAME_SCORE_SUBMIT',
              });
              return;
            }

            // A client built for other ranking rules (or an old build that sends no version) must not write into this board
            if (msg.rulesetVersion !== RANKING_RULESET_VERSION) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'RULESET_MISMATCH',
                message: `Score rejected: client ranking ruleset ${String(msg.rulesetVersion)} does not match server ruleset ${RANKING_RULESET_VERSION}. Reload the game.`,
              });
              return;
            }

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

          case 'SENSOR_CONFIG_UPDATE': {
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              const targetSocket = ws === session.pcSocket ? session.controllerSocket : session.pcSocket;
              if (targetSocket) {
                sendJson(targetSocket, {
                  type: 'SENSOR_CONFIG_UPDATE',
                  roomId: msg.roomId,
                  config: msg.config,
                });
              }
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
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Internal server error';
        sendJson(ws, {
          type: 'ERROR',
          code: 'INTERNAL_ERROR',
          message: errMsg,
        });
      }
    });

    ws.on('close', () => {
      const { roomId, role } = roomManager.removeSocket(ws);
      if (roomId && role) {
        const session = roomManager.getRoom(roomId);
        if (session) {
          if (role === 'CONTROLLER' && session.pcSocket) {
            sendJson(session.pcSocket, {
              type: 'ERROR',
              code: 'CONTROLLER_DISCONNECTED',
              message: 'Controller disconnected',
            });
          } else if (role === 'PC' && session.controllerSocket) {
            sendJson(session.controllerSocket, {
              type: 'ERROR',
              code: 'PC_DISCONNECTED',
              message: 'PC host disconnected',
            });
          }
        }
      }
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
