import path from 'path';
import http from 'node:http';
import os from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { PlayerStore } from './PlayerStore';
import { RoomManager, normalizeSlot } from './RoomManager';
import { ClientToServerMessage, PlayerProfile, PlayerSlot, ServerToClientMessage, UnsupportedReason } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';
import { PlayRecordStore, isValidPlayRunStats } from './PlayRecordStore';
import { ControllerWatch, watchKey, parseWatchKey } from './ControllerWatch';
import { CONTROLLER_LIFECYCLE } from '../src/shared/controllerLifecycle';

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

  /** 폰이 "화면 꺼짐"을 알린 뒤 PC에 알리기까지 대기 중인 타이머. key = watchKey(roomId, slot) */
  const pendingBackground = new Map<string, ReturnType<typeof setTimeout>>();
  const clearBackground = (key: string) => {
    const timer = pendingBackground.get(key);
    if (timer) clearTimeout(timer);
    pendingBackground.delete(key);
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

            // 폰이 다시 인증을 보냈다면 돌아온 것이다: 화면 꺼짐 상태와 끊김 표시를 지운다.
            // 이 뒤의 PC 복귀는 폰이 보내는 CALIBRATE_ZERO(resume)가 맡으므로, 다음 프레임이 복귀 알림을 또 보내지 않게 한다.
            clearBackground(watchKey(roomId, slot));
            watch.forget(watchKey(roomId, slot));

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
            // 폰이 영점을 보냈다 = 돌아왔다(버튼 또는 초록 버튼). 끊김 표시를 풀고 다시 지켜본다.
            const zeroSlot = session ? roomManager.getControllerSlot(session, ws) : undefined;
            if (session && zeroSlot !== undefined) {
              const key = watchKey(session.roomId, zeroSlot);
              clearBackground(key);
              const wasLost = watch.release(key, Date.now());
            }
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
            const session = roomManager.getRoom(msg.roomId);
            if (session) {
              // 슬롯은 메시지가 아니라 소켓 기준으로 찾는다(다른 슬롯 흉내 방지).
              const frameSlot = roomManager.getControllerSlot(session, ws);
              if (frameSlot !== undefined) {
                watch.onFrame(watchKey(session.roomId, frameSlot), Date.now());
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

          case 'DEVICE_UNSUPPORTED': {
            const { roomId, deviceId } = msg;
            if (!roomId || !deviceId) {
              sendJson(ws, {
                type: 'ERROR',
                code: 'INVALID_REQUEST',
                message: 'roomId and deviceId are required for DEVICE_UNSUPPORTED',
                slot: normalizeSlot(msg.slot),
              });
              return;
            }
            // 슬롯은 메시지가 아니라 소켓 기준으로 찾고, 그 자리의 기기와 같을 때만 인정한다.
            // 좌석에 안 붙은 소켓이 보낸 메시지는 다른 폰을 쫓아낼 수 없다.
            const session = roomManager.getRoom(roomId);
            const slot = session ? roomManager.getControllerSlot(session, ws) : undefined;
            if (!session || slot === undefined || session.controllers[slot]?.deviceId !== deviceId) {
              ws.close();
              break;
            }
            // 클라이언트 입력은 믿지 않는다: 알려진 이유가 아니면 NO_GYRO로 보정한다.
            const reason: UnsupportedReason = msg.reason === 'NO_EVENTS' ? 'NO_EVENTS' : 'NO_GYRO';
            console.warn(`[unsupported-device] room=${roomId} slot=${slot} device=${deviceId} reason=${reason}`);
            sendJson(session.pcSocket, { type: 'CONTROLLER_UNSUPPORTED', roomId, slot, reason });
            // 소켓을 닫으면 아래 close 핸들러가 좌석을 비우고 PC에 CONTROLLER_DISCONNECTED를 보낸다.
            // (removeSocket을 여기서 직접 부르면 close 핸들러가 빈 결과를 받아 PC가 끊김을 모른다.)
            ws.close();
            break;
          }

          case 'CONTROLLER_BACKGROUND':
          case 'CONTROLLER_FOREGROUND': {
            // 슬롯은 메시지가 아니라 소켓 기준으로 찾고, 그 자리의 기기와 같을 때만 받는다.
            const session = roomManager.getRoom(msg.roomId);
            const slot = session ? roomManager.getControllerSlot(session, ws) : undefined;
            if (!session || slot === undefined || session.controllers[slot]?.deviceId !== msg.deviceId) {
              break;
            }
            const key = watchKey(session.roomId, slot);

            if (msg.type === 'CONTROLLER_FOREGROUND') {
              clearBackground(key);
              break;
            }
            if (pendingBackground.has(key)) break;

            const timer = setTimeout(() => {
              pendingBackground.delete(key);
              try {
                const current = roomManager.getRoom(session.roomId);
                // 그 사이 소켓이 바뀌었거나 PC가 없으면 알릴 필요가 없다.
                if (!current?.pcSocket || current.controllers[slot]?.socket !== ws) {
                  return;
                }
                // 프레임 끊김 감지가 이미 알렸다면 다시 알리지 않는다.
                const newlyLost = watch.markLost(key);
                if (newlyLost) {
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
      // 화면 꺼짐/프레임 끊김으로 PC에 이미 알렸다면 소켓이 닫혀도 같은 슬롯을 다시 알리지 않는다.
      // (PC는 두 번째 알림을 새 이탈로 받아 유예를 새로 시작할 수 있다.)
      let alreadyReported = false;
      if (roomId && role === 'CONTROLLER' && slot !== undefined) {
        const key = watchKey(roomId, slot);
        alreadyReported = watch.isLost(key);
        watch.forget(key);
        clearBackground(key);
      }
      if (roomId && role) {
        const session = roomManager.getRoom(roomId);
        if (session) {
          if (role === 'CONTROLLER' && session.pcSocket) {
            if (alreadyReported) return;
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
