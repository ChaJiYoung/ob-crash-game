import path from 'path';
import fs from 'node:fs'; // TEMP(sensor-debug)
import http from 'node:http';
import os from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { PlayerStore } from './PlayerStore';
import { RoomManager, normalizeSlot } from './RoomManager';
import { ClientToServerMessage, PlayerProfile, PlayerSlot, ServerToClientMessage } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';
import { PlayRecordStore, isValidPlayRunStats } from './PlayRecordStore';
import { ControllerWatch, watchKey, parseWatchKey } from './ControllerWatch';
import { CONTROLLER_LIFECYCLE } from '../src/shared/controllerLifecycle';
import type { RoomSession } from './RoomManager';

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
  recordPath?: string;
  /** 테스트용: 프레임 끊김 판정 시간(ms). 기본 CONTROLLER_LIFECYCLE.FRAME_TIMEOUT_MS */
  controllerFrameTimeoutMs?: number;
  /** 테스트용: 프레임 끊김 확인 주기(ms). 기본 CONTROLLER_LIFECYCLE.WATCH_INTERVAL_MS */
  watchIntervalMs?: number;
  /** 테스트용: 백그라운드 알림 대기(ms). 기본 CONTROLLER_LIFECYCLE.BACKGROUND_NOTIFY_DELAY_MS */
  backgroundNotifyDelayMs?: number;
}): Promise<BeerCrusherServerInstance> {
  const port = options?.port ?? 8787;
  const playerStore = new PlayerStore(options?.storePath);
  // 저장소 경로를 주면 기록도 같은 폴더에 둔다(테스트가 실제 data/에 쓰지 않게).
  const recordPath =
    options?.recordPath ?? (options?.storePath ? path.join(path.dirname(options.storePath), 'play-records.jsonl') : undefined);
  const playRecordStore = new PlayRecordStore(recordPath);
  const roomManager = new RoomManager();
  const watch = new ControllerWatch();

  /** 프레임이 다시 오기 시작한 컨트롤러를 PC에 복귀시킨다(폰이 재연결할 때와 같은 알림). */
  const notifyControllerBack = (session: RoomSession, slot: PlayerSlot) => {
    const pc = session.pcSocket;
    const seat = session.controllers[slot];
    if (!pc || !seat) return;
    const player = playerStore.findByDeviceId(seat.deviceId);
    if (player) {
      sendJson(pc, { type: 'CONTROLLER_PAIRED', roomId: session.roomId, player, slot });
    }
    sendJson(pc, { type: 'ZERO_CALIBRATED', roomId: session.roomId, deviceId: seat.deviceId, slot, resume: true });
  };

  /** 폰이 "화면 꺼짐"을 알린 뒤 PC에 알리기까지 대기 중인 타이머. key = watchKey(roomId, slot) */
  const pendingBackground = new Map<string, ReturnType<typeof setTimeout>>();
  /**
   * 폰이 "화면 꺼짐"을 알리고 아직 "다시 켜짐"을 알리지 않은 자리.
   * 숨겨진 폰이 느리게나마 프레임을 계속 보내도, 켜짐 신호 전에는 프레임을 복귀로 보지 않는다.
   */
  const backgrounded = new Set<string>();
  const clearBackground = (key: string) => {
    const timer = pendingBackground.get(key);
    if (timer) clearTimeout(timer);
    pendingBackground.delete(key);
    backgrounded.delete(key);
  };

  const watchTimer = setInterval(() => {
    try {
      for (const key of watch.check(Date.now(), options?.controllerFrameTimeoutMs)) {
        const { roomId, slot } = parseWatchKey(key);
        const session = roomManager.getRoom(roomId);
        // 이미 지워졌거나 닫힌 자리는 알리지 않고 추적만 끝낸다.
        if (session?.controllers[slot]?.socket?.readyState !== WebSocket.OPEN) {
          watch.forget(key);
          continue;
        }
        sendJson(session.pcSocket, {
          type: 'ERROR',
          code: 'CONTROLLER_DISCONNECTED',
          message: 'Controller stopped sending sensor frames',
          slot,
        });
      }
    } catch (err) {
      console.error('Controller watch failed', err);
    }
  }, options?.watchIntervalMs ?? CONTROLLER_LIFECYCLE.WATCH_INTERVAL_MS);
  watchTimer.unref?.();

  // TEMP(sensor-debug): append one line to data/sensor-debug.log; removed in P02-T03.
  const writeSensorDebug = (line: string) => {
    console.log('[sensor-debug]', line);
    try {
      const dir = path.resolve(process.cwd(), 'data');
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, 'sensor-debug.log'), `${line}\n`);
    } catch {
      // Diagnostics must never affect the game.
    }
  };
  // TEMP(sensor-debug): per-second summary of the SENSOR_FRAME stream, so the log does not depend on the phone's socket.
  const frameStats = new Map<
    string,
    { start: number; count: number; minX: number; maxX: number; minY: number; maxY: number; minYaw: number; maxYaw: number }
  >();

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
            const session = roomManager.getOrCreateRoom(msg.roomId);
            roomManager.attachPcSocket(session.roomId, ws);
            sendJson(ws, {
              type: 'ROOM_CREATED',
              roomId: session.roomId,
              rankings: playRecordStore.getTopRuns(5),
              teamRankings: playRecordStore.getTopTeams(5),
              lanIp: getLanIpAddress(),
            });
            break;
          }

          case 'DEVICE_CHECK': {
            const { roomId, deviceId } = msg;
            const slot = normalizeSlot(msg.slot);
            if (!roomId || !deviceId) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId and deviceId are required for DEVICE_CHECK',
                slot,
              });
              return;
            }

            const session = roomManager.getRoom(roomId);
            if (!session) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'ROOM_NOT_FOUND',
                message: `Room ${roomId} not found`,
                slot,
              });
              return;
            }

            const attachResult = roomManager.attachControllerSocket(roomId, ws, deviceId, slot);
            if ('error' in attachResult) {
              sendJson(ws, {
                type: 'ERROR',
                code: attachResult.error,
                message: attachResult.error === 'SLOT_OCCUPIED' ? `Slot ${slot} is occupied` : `Room ${roomId} not found`,
                slot,
              });
              return;
            }

            // 폰이 다시 인증을 보냈다면 돌아온 것이다: 화면 꺼짐 상태를 지운다.
            clearBackground(watchKey(roomId, slot));

            if (attachResult.movedFromSlot && session.pcSocket) {
              sendJson(session.pcSocket, {
                type: 'ERROR',
                code: 'CONTROLLER_DISCONNECTED',
                message: `Controller moved from slot ${attachResult.movedFromSlot}`,
                slot: attachResult.movedFromSlot,
              });
            }

            const player = playerStore.findByDeviceId(deviceId);
            const rankings = playRecordStore.getTopRuns(5);
            const teamRankings = playRecordStore.getTopTeams(5);

            if (player) {
              sendJson(ws, {
                type: 'AUTH_RESULT',
                roomId,
                isNewUser: false,
                player,
                rankings,
                teamRankings,
              });
              sendJson(session.pcSocket, {
                type: 'CONTROLLER_PAIRED',
                roomId,
                player,
                slot,
              });
            } else {
              sendJson(ws, {
                type: 'AUTH_RESULT',
                roomId,
                isNewUser: true,
                rankings,
                teamRankings,
              });
            }
            break;
          }

          case 'REGISTER_NICKNAME': {
            const { roomId, deviceId, nickname } = msg;
            const slot = normalizeSlot(msg.slot);
            if (!roomId || !deviceId || typeof nickname !== 'string') {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId, deviceId, and nickname are required for REGISTER_NICKNAME',
                slot,
              });
              return;
            }

            const session = roomManager.getRoom(roomId);
            if (!session) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'ROOM_NOT_FOUND',
                message: `Room ${roomId} not found`,
                slot,
              });
              return;
            }

            const attachResult = roomManager.attachControllerSocket(roomId, ws, deviceId, slot);
            if ('error' in attachResult) {
              sendJson(ws, {
                type: 'ERROR',
                code: attachResult.error,
                message: attachResult.error === 'SLOT_OCCUPIED' ? `Slot ${slot} is occupied` : `Room ${roomId} not found`,
                slot,
              });
              return;
            }

            if (attachResult.movedFromSlot && session.pcSocket) {
              sendJson(session.pcSocket, {
                type: 'ERROR',
                code: 'CONTROLLER_DISCONNECTED',
                message: `Controller moved from slot ${attachResult.movedFromSlot}`,
                slot: attachResult.movedFromSlot,
              });
            }

            try {
              const player = playerStore.registerOrUpdateNickname(deviceId, nickname);
              const rankings = playRecordStore.getTopRuns(5);
              const teamRankings = playRecordStore.getTopTeams(5);

              sendJson(ws, {
                type: 'AUTH_RESULT',
                roomId,
                isNewUser: false,
                player,
                rankings,
                teamRankings,
              });

              sendJson(session.pcSocket, {
                type: 'CONTROLLER_PAIRED',
                roomId,
                player,
                slot,
              });
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Failed to register nickname';
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_NICKNAME',
                message: errMsg,
                slot,
              });
            }
            break;
          }

          case 'REGISTER_LOCAL_PLAYER': {
            const { roomId, deviceId, nickname } = msg;
            const slot = normalizeSlot(msg.slot);
            if (!roomId || !deviceId || typeof nickname !== 'string') {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId, deviceId, and nickname are required for REGISTER_LOCAL_PLAYER',
                slot,
              });
              return;
            }

            const session = roomManager.getRoom(roomId);
            if (!session || session.pcSocket !== ws) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'NOT_ROOM_HOST',
                message: 'Only the room host can register a local player',
                slot,
              });
              return;
            }

            try {
              const player = playerStore.registerOrUpdateNickname(deviceId, nickname);
              sendJson(ws, {
                type: 'LOCAL_PLAYER_REGISTERED',
                roomId,
                slot,
                player,
              });
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Failed to register nickname';
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_NICKNAME',
                message: errMsg,
                slot,
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
              const slot = roomManager.getControllerSlot(session, ws) ?? normalizeSlot(msg.slot);
              sendJson(session.pcSocket, {
                type: 'ZERO_CALIBRATED',
                roomId,
                deviceId,
                slot,
                // Only a phone that re-attached its socket sets this; the PC then keeps its zero offset.
                ...(msg.resume === true ? { resume: true } : {}),
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
              const isPc = ws === session.pcSocket;
              const slot = isPc ? 1 : (roomManager.getControllerSlot(session, ws) ?? normalizeSlot(msg.slot));
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
                  slot,
                });
              }
              for (const cSocket of roomManager.getControllerSockets(session)) {
                sendJson(cSocket, {
                  type: 'GAME_COUNTDOWN_START',
                  roomId,
                  sec: 3,
                });
              }
            }
            break;
          }

          case 'SENSOR_FRAME': {
            // TEMP(sensor-debug)
            {
              const now = Date.now();
              const p = msg.payload;
              let s = frameStats.get(msg.deviceId);
              if (!s) {
                s = { start: now, count: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minYaw: Infinity, maxYaw: -Infinity };
                frameStats.set(msg.deviceId, s);
              }
              s.count += 1;
              s.minX = Math.min(s.minX, p.aimX);
              s.maxX = Math.max(s.maxX, p.aimX);
              s.minY = Math.min(s.minY, p.aimY);
              s.maxY = Math.max(s.maxY, p.aimY);
              s.minYaw = Math.min(s.minYaw, p.yawDeg);
              s.maxYaw = Math.max(s.maxYaw, p.yawDeg);
              if (now - s.start >= 1000) {
                const f = (n: number) => Math.round(n * 1000) / 1000;
                writeSensorDebug(
                  `${new Date(now).toISOString()} ${msg.deviceId} frames ${JSON.stringify({ n: s.count, aimX: [f(s.minX), f(s.maxX)], aimY: [f(s.minY), f(s.maxY)], yaw: [f(s.minYaw), f(s.maxYaw)] })}`
                );
                frameStats.delete(msg.deviceId);
              }
            }
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              // 슬롯은 메시지가 아니라 소켓 기준으로 찾는다(다른 슬롯 흉내 방지).
              const frameSlot = roomManager.getControllerSlot(session, ws);
              if (frameSlot !== undefined) {
                const frameKey = watchKey(session.roomId, frameSlot);
                const result = watch.onFrame(frameKey, Date.now());
                if (result === 'recovered') {
                  if (backgrounded.has(frameKey)) watch.markLost(frameKey);
                  else notifyControllerBack(session, frameSlot);
                }
              }
            }
            if (session && session.pcSocket) {
              const slot = roomManager.getControllerSlot(session, ws) ?? normalizeSlot(msg.slot);
              sendJson(session.pcSocket, {
                type: 'SENSOR_RELAY',
                roomId: msg.roomId,
                deviceId: msg.deviceId,
                payload: msg.payload,
                slot,
              });
            }
            break;
          }

          case 'CONTROLLER_BACKGROUND':
          case 'CONTROLLER_FOREGROUND': {
            // 슬롯은 메시지가 아니라 소켓 기준으로 찾고, 그 자리의 기기와 같을 때만 받는다.
            const session = roomManager.getRoom(msg.roomId);
            const slot = session ? roomManager.getControllerSlot(session, ws) : undefined;
            if (!session || slot === undefined || session.controllers[slot]?.deviceId !== msg.deviceId) break;
            const key = watchKey(session.roomId, slot);

            if (msg.type === 'CONTROLLER_FOREGROUND') {
              clearBackground(key);
              break;
            }
            backgrounded.add(key);
            if (pendingBackground.has(key)) break;

            const timer = setTimeout(() => {
              pendingBackground.delete(key);
              try {
                const current = roomManager.getRoom(session.roomId);
                // 그 사이 소켓이 바뀌었거나 PC가 없으면 알릴 필요가 없다.
                if (!current?.pcSocket || current.controllers[slot]?.socket !== ws) return;
                // 프레임 끊김 감지가 이미 알렸다면 다시 알리지 않는다.
                if (watch.markLost(key)) {
                  sendJson(current.pcSocket, {
                    type: 'ERROR',
                    code: 'CONTROLLER_DISCONNECTED',
                    message: 'Controller went to background',
                    slot,
                  });
                }
              } catch (err) {
                console.error('Background notify failed', err);
              }
            }, options?.backgroundNotifyDelayMs ?? CONTROLLER_LIFECYCLE.BACKGROUND_NOTIFY_DELAY_MS);
            pendingBackground.set(key, timer);
            break;
          }

          // TEMP(sensor-debug): phone sensor diagnostics, written to data/sensor-debug.log. Removed in P02-T03.
          case 'DEBUG_LOG': {
            const line = `${new Date(msg.ts).toISOString()} ${msg.deviceId} ${msg.tag} ${JSON.stringify(msg.data ?? {})}`;
            writeSensorDebug(line);
            break;
          }

          case 'FEVER_STATUS_SYNC': {
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              const targetSocket = session.controllers[normalizeSlot(msg.slot)]?.socket;
              if (targetSocket) {
                sendJson(targetSocket, {
                  type: 'FEVER_STATUS_RELAY',
                  roomId: msg.roomId,
                  isFeverReady: Boolean(msg.isFeverReady),
                });
              }
            }
            break;
          }

          case 'SKILL_STATE_SYNC': {
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              const targetSocket = session.controllers[normalizeSlot(msg.slot)]?.socket;
              if (targetSocket) {
                sendJson(targetSocket, {
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

            const now = new Date().toISOString();
            const isCoop = msg.mode === 'coop';
            let profile: PlayerProfile;

            if (!isCoop) {
              const res = playerStore.recordGameScore(deviceId, score);
              profile = res.profile;
              // 기록 실패는 랭킹 저장을 막지 않는다.
              if (isValidPlayRunStats(msg.stats) && msg.stats.totalScore === score) {
                playRecordStore.append({
                  playedAt: now,
                  deviceId,
                  nickname: profile.nickname,
                  rulesetVersion: RANKING_RULESET_VERSION,
                  stats: msg.stats,
                });
              } else if (msg.stats !== undefined) {
                console.warn('Ignored invalid play stats from', deviceId);
              }
            } else {
              const statsValid =
                isValidPlayRunStats(msg.stats) &&
                msg.stats.mode === 'coop' &&
                !!msg.stats.coop &&
                msg.stats.totalScore === score;

              if (statsValid && msg.stats && msg.stats.coop) {
                const res = playerStore.recordCoopResult(deviceId, {
                  partnerDeviceId: msg.stats.coop.partnerDeviceId,
                  partnerNickname: msg.stats.coop.partnerNickname,
                  teamScore: msg.stats.coop.teamScore,
                  myScore: score,
                  partnerScore: msg.stats.coop.partnerScore,
                  waveReached: msg.stats.waveReached,
                  playedAt: now,
                });
                profile = res.profile;

                playRecordStore.append({
                  playedAt: now,
                  deviceId,
                  nickname: profile.nickname,
                  rulesetVersion: RANKING_RULESET_VERSION,
                  stats: msg.stats,
                });
              } else {
                console.warn('Ignored invalid coop play stats from', deviceId);
                const res = playerStore.recordCoopResult(deviceId, {
                  partnerDeviceId: '',
                  partnerNickname: '',
                  teamScore: 0,
                  myScore: score,
                  partnerScore: 0,
                  waveReached: msg.waveReached,
                  playedAt: now,
                });
                profile = res.profile;
              }
            }

            const session = roomManager.getRoom(roomId);

            const response: ServerToClientMessage = {
              type: 'RANKING_UPDATED',
              rankings: playRecordStore.getTopRuns(5),
              teamRankings: playRecordStore.getTopTeams(5),
              updatedPlayer: profile,
            };

            sendJson(ws, response);
            if (session) {
              if (session.pcSocket && session.pcSocket !== ws) {
                sendJson(session.pcSocket, response);
              }
              for (const cSocket of roomManager.getControllerSockets(session)) {
                if (cSocket !== ws) {
                  sendJson(cSocket, response);
                }
              }
            }
            break;
          }

          case 'SENSOR_CONFIG_UPDATE': {
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              const isPc = ws === session.pcSocket;
              if (isPc) {
                for (const cSocket of roomManager.getControllerSockets(session)) {
                  sendJson(cSocket, {
                    type: 'SENSOR_CONFIG_UPDATE',
                    roomId: msg.roomId,
                    config: msg.config,
                  });
                }
              } else if (session.pcSocket) {
                sendJson(session.pcSocket, {
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
      const { roomId, role, slot } = roomManager.removeSocket(ws);
      if (roomId && role === 'CONTROLLER' && slot !== undefined) {
        watch.forget(watchKey(roomId, slot));
        clearBackground(watchKey(roomId, slot));
      }
      if (roomId && role) {
        const session = roomManager.getRoom(roomId);
        if (session) {
          if (role === 'CONTROLLER' && session.pcSocket) {
            sendJson(session.pcSocket, {
              type: 'ERROR',
              code: 'CONTROLLER_DISCONNECTED',
              message: 'Controller disconnected',
              slot,
            });
          } else if (role === 'PC') {
            for (const cSocket of roomManager.getControllerSockets(session)) {
              sendJson(cSocket, {
                type: 'ERROR',
                code: 'PC_DISCONNECTED',
                message: 'PC host disconnected',
              });
            }
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
          clearInterval(watchTimer);
          for (const timer of pendingBackground.values()) clearTimeout(timer);
          pendingBackground.clear();
          backgrounded.clear();
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
