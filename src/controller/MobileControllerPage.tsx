import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getOrCreateDeviceId } from './sensors/DeviceIdentity';
import { GunGripTracker, EulerOrientation } from './sensors/GunGripTracker';
import { LoginAndPermissionGate } from './components/LoginAndPermissionGate';
import { GunGripPad } from './components/GunGripPad';
import { triggerHaptic } from './sensors/HapticFeedback';
import { requestSensorPermission } from './sensors/SensorPermission';
import { ReturnToGameOverlay } from './components/ReturnToGameOverlay';
import { UnsupportedDeviceScreen } from './components/UnsupportedDeviceScreen';
import { probeSensorSupport } from './sensors/SensorSupportProbe';
import { CONTROLLER_LIFECYCLE } from '../shared/controllerLifecycle';
import { PlayerProfile, PlayerSlot, ServerToClientMessage, UnsupportedReason, WeaponKind, WeaponLevel } from '../shared/types';
import { PLAYER_COLORS, WEAPON_CONSTANTS } from '../shared/constants';
import { GAME_TUNING } from '../shared/gameTuning';
import {
  getReconnectDelayMs,
  loadSavedControllerRoomId,
  loadSavedControllerSlot,
  parseControllerSlot,
  saveControllerRoomId,
  saveControllerSlot,
} from './sensors/ReconnectPolicy';

export const MobileControllerPage: React.FC = () => {
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const tracker = useMemo(() => new GunGripTracker(), []);

  const [slot, setSlot] = useState<PlayerSlot>(1);
  const slotRef = useRef<PlayerSlot>(1);
  slotRef.current = slot;
  const [slotError, setSlotError] = useState<string | null>(null);
  const blockedRef = useRef<boolean>(false);
  // 센서 판별에서 미지원으로 나온 이유. 값이 있으면 차단 화면만 보인다.
  const [unsupportedReason, setUnsupportedReason] = useState<UnsupportedReason | null>(null);

  const [step, setStep] = useState<'LOGIN_GATE' | 'PAD'>('LOGIN_GATE');
  const [sensorsActive, setSensorsActive] = useState<boolean>(false);
  const sensorsActiveRef = useRef<boolean>(false);
  sensorsActiveRef.current = sensorsActive;
  const [roomId, setRoomId] = useState<string>('');
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [player, setPlayer] = useState<PlayerProfile | undefined>();
  const [isFeverReady, setIsFeverReady] = useState<boolean>(false);
  const [isGameWaiting, setIsGameWaiting] = useState<boolean>(true);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [isCockedState, setIsCockedState] = useState<boolean>(false);
  const [isStabilizedMode, setIsStabilizedMode] = useState<boolean>(false);
  const [skillState, setSkillState] = useState<{
    weaponKind: WeaponKind;
    weaponLevel: WeaponLevel;
    skillStock: number;
    maxSkillStock: number;
    skillCooldownRemainingMs: number;
    skillCooldownTotalMs: number;
  }>({
    weaponKind: 'shotgun',
    weaponLevel: 1,
    skillStock: 0,
    maxSkillStock: 2,
    skillCooldownRemainingMs: 0,
    skillCooldownTotalMs: GAME_TUNING.skillCooldownMsByLevel[1],
  });

  const [connectionState, setConnectionState] = useState<'CONNECTING' | 'CONNECTED' | 'RECONNECTING'>('CONNECTING');
  const hasConnectedBeforeRef = useRef<boolean>(false);
  // True when the socket that just opened replaced an earlier one (the phone slept, the PC reloaded, ...).
  const isReconnectOpenRef = useRef<boolean>(false);
  const stepRef = useRef<'LOGIN_GATE' | 'PAD'>('LOGIN_GATE');
  stepRef.current = step;
  const wsRef = useRef<WebSocket | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startCountdownRef = useRef<(sec?: number) => void>(() => {});
  const countdownSecRef = useRef<number | null>(null);
  const snapGraceUntilMsRef = useRef<number>(0);
  const latestOrientationRef = useRef<EulerOrientation>({ alpha: 0, beta: 0, gamma: 0 });

  useEffect(() => {
    countdownSecRef.current = countdownSec;
  }, [countdownSec]);
  const snapFireRef = useRef<boolean>(false);
  const skillSnapTriggeredRef = useRef<boolean>(false);
  const prevSkillStockRef = useRef<number>(1);
  const rapidFireHoldRef = useRef<boolean>(false);
  const feverTriggeredRef = useRef<boolean>(false);
  const isCockedRef = useRef<boolean>(false);
  const snapFreezeTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Bumped by the return button to tear the sensor effect down and register the listeners again.
  const [sensorEpoch, setSensorEpoch] = useState<number>(0);
  // The screen was off long enough that the PC paused: the player must press "return to game" (it re-zeroes).
  const [needsReturn, setNeedsReturn] = useState<boolean>(false);
  const needsReturnRef = useRef<boolean>(false);

  // Allowing the sensors zeroes the aim by itself (the PC then shows the crosshair). It waits for the first sensor reading,
  // because right after the permission nothing has arrived yet and latestOrientationRef is still (0,0,0).
  const autoZeroPendingRef = useRef<boolean>(false);
  const autoZeroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // handleCalibrateZero is declared further down, so it is reached through a ref.
  const calibrateZeroRef = useRef<() => void>(() => {});
  const runAutoZero = useCallback(() => {
    if (!autoZeroPendingRef.current) return;
    autoZeroPendingRef.current = false;
    if (autoZeroTimerRef.current) {
      clearTimeout(autoZeroTimerRef.current);
      autoZeroTimerRef.current = null;
    }
    calibrateZeroRef.current();
  }, []);
  useEffect(
    () => () => {
      if (autoZeroTimerRef.current) clearTimeout(autoZeroTimerRef.current);
    },
    []
  );

  // 1. Parse Room ID & Slot from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const parsedSlot = parseControllerSlot(window.location.search);
    if (room) {
      const normalized = room.toUpperCase().trim();
      setRoomId(normalized);
      saveControllerRoomId(normalized);
      setSlot(parsedSlot);
      saveControllerSlot(parsedSlot);
      return;
    }
    // No QR link this time: fall back to the room and slot this phone used last.
    const saved = loadSavedControllerRoomId();
    if (saved) setRoomId(saved);
    const savedSlot = loadSavedControllerSlot();
    setSlot(savedSlot);
  }, []);

  // 2. Connect to WebSocket & send DEVICE_CHECK
  useEffect(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const connect = () => {
      clearRetry();
      if (disposed) return;

      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        socket = new WebSocket(`${protocol}//${window.location.hostname}:8787`);
      }

      wsRef.current = socket;

      socket.onopen = () => {
        if (wsRef.current !== socket) return;
        attempt = 0;
        isReconnectOpenRef.current = hasConnectedBeforeRef.current;
        hasConnectedBeforeRef.current = true;
        setConnectionState('CONNECTED');
        socket.send(
          JSON.stringify({
            type: 'DEVICE_CHECK',
            roomId,
            deviceId,
            slot: slotRef.current,
          })
        );
      };

      socket.onclose = () => {
        // A replaced, disposed, or blocked socket must not start another retry loop.
        if (disposed || blockedRef.current || wsRef.current !== socket) return;
        setConnectionState('RECONNECTING');
        clearRetry();
        retryTimer = setTimeout(connect, getReconnectDelayMs(attempt));
        attempt += 1;
      };

      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return;
        try {
          const msg = JSON.parse(event.data) as ServerToClientMessage;
          switch (msg.type) {
            case 'AUTH_RESULT':
              setIsNewUser(msg.isNewUser);
              if (msg.player) {
                setPlayer(msg.player);
                // The phone is already aimed (pad screen) and only its socket came back: tell the PC so a reloaded
                // lobby can move on to the zeroing step. The phone's own zero is untouched.
                // While the return button is up it owns the comeback (with a fresh zero), so do not resume here.
                if (isReconnectOpenRef.current && stepRef.current === 'PAD' && !needsReturnRef.current) {
                  socket.send(
                    JSON.stringify({ type: 'CALIBRATE_ZERO', roomId, deviceId, resume: true, slot: slotRef.current })
                  );
                }
              }
              isReconnectOpenRef.current = false;
              break;

            case 'FEVER_STATUS_RELAY':
              setIsFeverReady(msg.isFeverReady);
              if (msg.isFeverReady) {
                triggerHaptic([60, 40, 80]);
              }
              break;

            case 'SKILL_STATE_SYNC':
              setSkillState({
                weaponKind: msg.weaponKind,
                weaponLevel: msg.weaponLevel,
                skillStock: msg.skillStock,
                maxSkillStock: msg.maxSkillStock,
                skillCooldownRemainingMs: msg.skillCooldownRemainingMs,
                skillCooldownTotalMs: msg.skillCooldownTotalMs,
              });
              if (prevSkillStockRef.current === 0 && msg.skillStock > 0) {
                triggerHaptic([60, 40, 90]);
              }
              prevSkillStockRef.current = msg.skillStock;
              break;

            case 'GAME_COUNTDOWN_START':
              startCountdownRef.current(msg.sec || 3);
              break;

            case 'SENSOR_CONFIG_UPDATE': {
              const cfg = msg.config;
              if (cfg) {
                if (typeof cfg.isStabilizedMode === 'boolean') {
                  tracker.setStabilizedMode(cfg.isStabilizedMode);
                  setIsStabilizedMode(cfg.isStabilizedMode);
                }
                tracker.setFilterConfig(cfg);
              }
              break;
            }

            case 'ERROR':
              if (msg.code === 'SLOT_OCCUPIED') {
                blockedRef.current = true;
                setSlotError(`이미 다른 폰이 ${slotRef.current}P로 연결돼 있습니다. PC 화면의 다른 슬롯 QR을 찍어 주세요.`);
                socket.close();
                return;
              }
              // The server keeps this socket open in both cases; close it so onclose runs the retry loop.
              // A PC that comes back never tells the phone, so the phone has to knock again.
              if (msg.code === 'PC_DISCONNECTED' || msg.code === 'ROOM_NOT_FOUND') {
                setConnectionState('RECONNECTING');
                socket.close();
              }
              break;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message on mobile', err);
        }
      };

    };

    connect();

    // A sleeping phone freezes its timers: reconnect the moment the screen is back instead of waiting for the next retry.
    const reviveIfDead = () => {
      if (disposed || blockedRef.current) return;
      if (document.visibilityState === 'hidden') return;
      const current = wsRef.current;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;
      attempt = 0;
      setConnectionState('RECONNECTING');
      connect();
    };
    document.addEventListener('visibilitychange', reviveIfDead);
    window.addEventListener('online', reviveIfDead);

    // The screen turning off freezes this page's timers, so both signals go out at once and the server does the waiting.
    // wall-clock time (not performance.now) because a sleeping phone can stop the monotonic clock.
    let hiddenAtMs: number | null = null;
    const onBackgroundSignals = () => {
      const cur = wsRef.current;
      const open = !!cur && cur.readyState === WebSocket.OPEN;
      if (document.visibilityState === 'hidden') {
        hiddenAtMs = Date.now();
        if (open) {
          cur!.send(JSON.stringify({ type: 'CONTROLLER_BACKGROUND', roomId, deviceId, slot: slotRef.current }));
        }
        return;
      }
      const hiddenForMs = hiddenAtMs === null ? 0 : Date.now() - hiddenAtMs;
      hiddenAtMs = null;
      // Same threshold as the server's pause notice: if it is up, the PC is paused, so ask the player to come back.
      if (hiddenForMs >= CONTROLLER_LIFECYCLE.FOREGROUND_RESUME_MIN_MS && stepRef.current === 'PAD') {
        needsReturnRef.current = true;
        setNeedsReturn(true);
      }
      // A closed socket is brought back by reviveIfDead.
      if (!open) return;
      cur!.send(JSON.stringify({ type: 'CONTROLLER_FOREGROUND', roomId, deviceId, slot: slotRef.current }));
    };
    document.addEventListener('visibilitychange', onBackgroundSignals);

    return () => {
      disposed = true;
      clearRetry();
      document.removeEventListener('visibilitychange', reviveIfDead);
      document.removeEventListener('visibilitychange', onBackgroundSignals);
      window.removeEventListener('online', reviveIfDead);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      const current = wsRef.current;
      wsRef.current = null;
      current?.close();
    };
  }, [roomId, deviceId]);

  // 3. Register Nickname
  const handleRegisterNickname = (nickname: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'REGISTER_NICKNAME',
          roomId,
          deviceId,
          nickname,
          slot: slotRef.current,
        })
      );
    }
  };

  // Immediate frame flusher for zero-delay shooting and haptics
  const flushSensorFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId) {
      return;
    }

    tracker.expireAimLock(performance.now());
    const effective = tracker.getEffectiveAim(latestOrientationRef.current);
    const aim = effective.aim;
    const snapFire = snapFireRef.current;
    snapFireRef.current = false;

    const now = performance.now();
    const isSnapAllowed = countdownSecRef.current === null && now >= snapGraceUntilMsRef.current;
    const skillSnapTriggered = isSnapAllowed && skillSnapTriggeredRef.current;
    skillSnapTriggeredRef.current = false;

    const feverTriggered = feverTriggeredRef.current;
    feverTriggeredRef.current = false;

    wsRef.current.send(
      JSON.stringify({
        type: 'SENSOR_FRAME',
        roomId,
        deviceId,
        slot: slotRef.current,
        payload: {
          aimX: aim.aimX,
          aimY: aim.aimY,
          rawAimX: aim.rawAimX,
          rawAimY: aim.rawAimY,
          pitchDeg: aim.pitchDeg,
          yawDeg: aim.yawDeg,
          rollDeg: aim.rollDeg,
          snapFire,
          rapidFireHold: rapidFireHoldRef.current,
          feverTriggered,
          isCocked: isCockedRef.current,
          skillSnapTriggered,
          timestamp: Date.now(),
        },
      })
    );
  }, [roomId, deviceId, tracker]);

  // 4. Start Sensors after permission granted with lifecycle cleanup
  // sensorEpoch is bumped by the return button to tear this effect down and register the listeners again.
  useEffect(() => {
    if (!sensorsActive) return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      latestOrientationRef.current = {
        alpha: e.alpha || 0,
        beta: e.beta || 0,
        gamma: e.gamma || 0,
      };
      // Must run after the line above: the zero is taken from this very reading.
      if (autoZeroPendingRef.current) runAutoZero();
    };

    const onMotion = (e: DeviceMotionEvent) => {
      if (e.acceleration) {
        const now = performance.now();
        const isSnapAllowed = countdownSecRef.current === null && now >= snapGraceUntilMsRef.current;
        if (!isSnapAllowed) {
          skillSnapTriggeredRef.current = false;
        }

        const snap = tracker.detectSnapFire({
          x: e.acceleration.x || 0,
          y: e.acceleration.y || 0,
          z: e.acceleration.z || 0,
          timestampMs: now,
        });
        if (snap && isSnapAllowed) {
          skillSnapTriggeredRef.current = true;

          // [손목 반동 흡수] 스킬 시전 시 에임을 350ms 동안 모니터 정면에 고정하여 천장으로 튀는 현상 방지
          tracker.lockAim(latestOrientationRef.current, performance.now());
          if (snapFreezeTimerRef.current) {
            clearTimeout(snapFreezeTimerRef.current);
          }
          snapFreezeTimerRef.current = setTimeout(() => {
            tracker.unlockAim();
          }, 350);

          if (isCockedRef.current) {
            snapFireRef.current = true;
            // [단발 안전장치] 격발 즉시 코킹 잠금 해제 (손을 뗄 때까지 2차 오발 원천 차단)
            isCockedRef.current = false;
            setIsCockedState(false);
          }
          // Send frame with skillSnapTriggered and aim coordinates
          flushSensorFrame();
        }
      }
    };

    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);

    return () => {
      if (snapFreezeTimerRef.current) {
        clearTimeout(snapFreezeTimerRef.current);
        snapFreezeTimerRef.current = null;
      }
      // The freeze timer above is the only thing that releases the lock: cancelling it must not leave the aim stuck.
      tracker.unlockAim();
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, [sensorsActive, sensorEpoch, tracker, flushSensorFrame]);

  // 미지원 기기: 서버에 알리고(서버가 슬롯을 비우고 소켓을 닫는다) 차단 화면만 보인다. 재연결·재시도는 하지 않는다.
  const rejectUnsupportedDevice = (reason: UnsupportedReason) => {
    // 재연결 루프(onclose), 화면 복귀 재연결(reviveIfDead)이 모두 blockedRef를 보고 멈춘다.
    blockedRef.current = true;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'DEVICE_UNSUPPORTED', roomId, deviceId, slot: slotRef.current, reason }));
    }
    setUnsupportedReason(reason);
  };

  const handlePermissionGranted = async () => {
    // 개발 모드에서는 PC 브라우저로도 폰 화면을 볼 수 있게 판별을 건너뛴다. 배포 빌드에는 우회가 없다.
    if (!import.meta.env.DEV) {
      const verdict = await probeSensorSupport();
      if (!verdict.supported) {
        rejectUnsupportedDevice(verdict.reason);
        return;
      }
    }
    setSensorsActive(true);
    setStep('PAD');
    autoZeroPendingRef.current = true;
    if (autoZeroTimerRef.current) clearTimeout(autoZeroTimerRef.current);
    // Browsers without orientation events (desktop) would wait forever, so go ahead after a short while.
    autoZeroTimerRef.current = setTimeout(runAutoZero, CONTROLLER_LIFECYCLE.AUTO_ZERO_FALLBACK_MS);
  };

  // 5. Zero Calibration
  const handleCalibrateZero = useCallback(() => {
    tracker.unlockAim();
    isCockedRef.current = false;
    setIsCockedState(false);
    skillSnapTriggeredRef.current = false;
    snapGraceUntilMsRef.current = performance.now() + WEAPON_CONSTANTS.SNAP_GRACE_PERIOD_MS;
    tracker.calibrateZero(latestOrientationRef.current);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CALIBRATE_ZERO',
          roomId,
          deviceId,
          slot: slotRef.current,
        })
      );
    }

    setStep('PAD');
  }, [tracker, roomId, deviceId]);
  calibrateZeroRef.current = handleCalibrateZero;

  // Called straight from the button's onClick: iOS only grants sensor access inside the user's tap.
  const handleReturnToGame = useCallback(async () => {
    // Without a socket the zero cannot reach the PC: keep the button until the reconnect banner is gone.
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const result = await requestSensorPermission();
    if (result !== 'granted') {
      alert('모션 센서 권한이 허용되어야 권총 조준이 가능합니다.');
      return;
    }
    setSensorEpoch((e) => e + 1);
    autoZeroPendingRef.current = true;
    if (autoZeroTimerRef.current) clearTimeout(autoZeroTimerRef.current);
    autoZeroTimerRef.current = setTimeout(runAutoZero, CONTROLLER_LIFECYCLE.AUTO_ZERO_FALLBACK_MS);
    needsReturnRef.current = false;
    setNeedsReturn(false);
  }, [runAutoZero]);

  const startCountdown = useCallback(
    (initialSec = 3) => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      setCountdownSec(initialSec);
      countdownSecRef.current = initialSec;
      skillSnapTriggeredRef.current = false;
      snapGraceUntilMsRef.current = performance.now() + (initialSec * 1000) + WEAPON_CONSTANTS.SNAP_GRACE_PERIOD_MS;
      // A freshly loaded page has no sensor permission yet: stay on the gate, the green button takes it to the pad.
      if (sensorsActiveRef.current) setStep('PAD');
      setIsGameWaiting(false);
      triggerHaptic(60);

      let cur = initialSec;
      countdownTimerRef.current = setInterval(() => {
        cur -= 1;
        if (cur > 0) {
          setCountdownSec(cur);
          countdownSecRef.current = cur;
          triggerHaptic(60);
        } else {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdownSec(null);
          countdownSecRef.current = null;
          // Zeroing without sensors would tell the PC the phone is back while it cannot aim.
          if (sensorsActiveRef.current) handleCalibrateZero();
          triggerHaptic([100, 50, 150]);
        }
      }, 1000);
    },
    [handleCalibrateZero]
  );
  startCountdownRef.current = startCountdown;

  const handleToggleStabilizedMode = useCallback(() => {
    const next = !tracker.isStabilized();
    tracker.setStabilizedMode(next);
    setIsStabilizedMode(next);

    // Relay to PC host via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SENSOR_CONFIG_UPDATE',
          roomId,
          deviceId,
          config: {
            isStabilizedMode: next,
            preset: next ? 'stabilized_galaxy' : 'default_iphone',
          },
        })
      );
    }
  }, [tracker, roomId, deviceId]);

  const handleRequestStartGame = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'START_GAME_REQUEST',
          roomId,
          deviceId,
          slot: slotRef.current,
        })
      );
    }
    startCountdown(3);
  };

  // 6. 60Hz Sensor Streaming Loop (every 16ms)
  useEffect(() => {
    if (step === 'LOGIN_GATE' || !sensorsActive) return;

    const streamInterval = setInterval(() => {
      flushSensorFrame();
    }, 16);

    return () => clearInterval(streamInterval);
  }, [step, sensorsActive, flushSensorFrame]);

  if (!roomId) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#0a0d14',
          color: '#ffffff',
          padding: '24px',
          textAlign: 'center',
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#f87171' }}>
          방 번호(Room ID)가 없습니다.
        </div>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>
          PC 화면의 QR 코드를 다시 스캔해주세요.
        </div>
      </div>
    );
  }

  if (unsupportedReason !== null) {
    return <UnsupportedDeviceScreen reason={unsupportedReason} />;
  }

  return (
    <>
      {/* 1P / 2P Slot Badge */}
      <div
        data-testid="controller-slot-badge"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 9998,
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 900,
          color: '#ffffff',
          backgroundColor: PLAYER_COLORS[slot],
          boxShadow: `0 0 12px ${PLAYER_COLORS[slot]}66`,
          letterSpacing: '0.05em',
          pointerEvents: 'none',
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        {slot}P
      </div>

      {slotError && (
        <div
          data-testid="slot-error-card"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 12, 0.95)',
            zIndex: 10001,
            padding: '24px',
            textAlign: 'center',
            fontFamily: "'Noto Sans KR', sans-serif",
            color: '#ffffff',
          }}
        >
          <div style={{ fontSize: '42px', marginBottom: '16px' }}>🚫</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#f87171', marginBottom: '12px' }}>
            슬롯 연결 실패
          </div>
          <div style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: 1.6, maxWidth: '320px' }}>
            {slotError}
          </div>
        </div>
      )}

      {connectionState !== 'CONNECTED' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10000,
            padding: '8px 12px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 800,
            color: '#fef3c7',
            background: 'rgba(180, 83, 9, 0.92)',
            pointerEvents: 'none',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          📡 PC와 다시 연결하는 중...
        </div>
      )}

      {step === 'LOGIN_GATE' && (
        <LoginAndPermissionGate
          isNewUser={isNewUser}
          player={player}
          onRegisterNickname={handleRegisterNickname}
          onPermissionGranted={handlePermissionGranted}
        />
      )}

      {step === 'PAD' && (
        <GunGripPad
          isCocked={isCockedState}
          onRecalibrateZero={handleCalibrateZero}
          onSingleTapFire={() => {
            snapFireRef.current = true;
            flushSensorFrame();
          }}
          onRapidFireHoldChange={(holding) => {
            rapidFireHoldRef.current = holding;
            flushSensorFrame();
          }}
          onFeverTrigger={() => {
            feverTriggeredRef.current = true;
            isCockedRef.current = false;
            tracker.unlockAim();
            setIsCockedState(false);
            flushSensorFrame();
          }}
          onCockingChange={(cocked) => {
            isCockedRef.current = cocked;
            setIsCockedState(cocked);
            flushSensorFrame();
          }}
          isFeverReady={isFeverReady}
          skillState={skillState}
          isStabilizedMode={isStabilizedMode}
          onToggleStabilizedMode={handleToggleStabilizedMode}
        />
      )}

      {step === 'PAD' && needsReturn && <ReturnToGameOverlay onReturn={handleReturnToGame} />}

      {countdownSec !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            userSelect: 'none',
            padding: '24px',
            textAlign: 'center',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          <div
            style={{
              fontSize: '110px',
              fontWeight: 900,
              background: 'linear-gradient(180deg, #f59e0b, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 35px rgba(245, 158, 11, 0.6)',
              animation: 'pulse 0.9s infinite',
            }}
          >
            {countdownSec}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', marginTop: '16px' }}>
            🎯 폰을 모니터 정중앙으로 겨누세요!
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>
            0초가 되면 현재 방향이 정면 영점으로 자동 고정됩니다
          </div>
        </div>
      )}
    </>
  );
};
