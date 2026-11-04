import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getOrCreateDeviceId } from './sensors/DeviceIdentity';
import { GunGripTracker, EulerOrientation } from './sensors/GunGripTracker';
import { LoginAndPermissionGate } from './components/LoginAndPermissionGate';
import { ZeroingGuide } from './components/ZeroingGuide';
import { GunGripPad } from './components/GunGripPad';
import { triggerHaptic } from './sensors/HapticFeedback';
import { PlayerProfile, ServerToClientMessage, WeaponKind, WeaponLevel } from '../shared/types';

export const MobileControllerPage: React.FC = () => {
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const tracker = useMemo(() => new GunGripTracker(), []);

  const [step, setStep] = useState<'LOGIN_GATE' | 'ZEROING' | 'PAD'>('LOGIN_GATE');
  if (typeof window !== 'undefined') {
    (window as any).__setStep = setStep;
  }
  const [sensorsActive, setSensorsActive] = useState<boolean>(false);
  const [roomId, setRoomId] = useState<string>('');
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [player, setPlayer] = useState<PlayerProfile | undefined>();
  const [isFeverReady, setIsFeverReady] = useState<boolean>(false);
  const [isGameWaiting, setIsGameWaiting] = useState<boolean>(true);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [isCockedState, setIsCockedState] = useState<boolean>(false);
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
    skillStock: 1,
    maxSkillStock: 1,
    skillCooldownRemainingMs: 0,
    skillCooldownTotalMs: 25000,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startCountdownRef = useRef<(sec?: number) => void>(() => {});
  const latestOrientationRef = useRef<EulerOrientation>({ alpha: 0, beta: 0, gamma: 0 });
  const snapFireRef = useRef<boolean>(false);
  const skillSnapTriggeredRef = useRef<boolean>(false);
  const prevSkillStockRef = useRef<number>(1);
  const rapidFireHoldRef = useRef<boolean>(false);
  const feverTriggeredRef = useRef<boolean>(false);
  const isCockedRef = useRef<boolean>(false);
  const snapFreezeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Parse Room ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room.toUpperCase().trim());
    }
  }, []);

  // 2. Connect to WebSocket & send DEVICE_CHECK
  useEffect(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      socket = new WebSocket(`${protocol}//${window.location.hostname}:8787`);
    }

    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'DEVICE_CHECK',
          roomId,
          deviceId,
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMessage;
        switch (msg.type) {
          case 'AUTH_RESULT':
            setIsNewUser(msg.isNewUser);
            if (msg.player) {
              setPlayer(msg.player);
            }
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

          case 'ERROR':
            if (msg.code === 'PC_DISCONNECTED') {
              alert('PC 호스트와의 연결이 끊어졌습니다.');
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message on mobile', err);
      }
    };

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      socket.close();
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
        })
      );
    }
  };

  // Immediate frame flusher for zero-delay shooting and haptics
  const flushSensorFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId) {
      return;
    }

    const effective = tracker.getEffectiveAim(latestOrientationRef.current);
    const aim = effective.aim;
    const snapFire = snapFireRef.current;
    snapFireRef.current = false;

    const skillSnapTriggered = skillSnapTriggeredRef.current;
    skillSnapTriggeredRef.current = false;

    const feverTriggered = feverTriggeredRef.current;
    feverTriggeredRef.current = false;

    wsRef.current.send(
      JSON.stringify({
        type: 'SENSOR_FRAME',
        roomId,
        deviceId,
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
  useEffect(() => {
    if (!sensorsActive) return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      latestOrientationRef.current = {
        alpha: e.alpha || 0,
        beta: e.beta || 0,
        gamma: e.gamma || 0,
      };
    };

    const onMotion = (e: DeviceMotionEvent) => {
      if (e.acceleration) {
        const snap = tracker.detectSnapFire({
          x: e.acceleration.x || 0,
          y: e.acceleration.y || 0,
          z: e.acceleration.z || 0,
          timestampMs: performance.now(),
        });
        if (snap) {
          skillSnapTriggeredRef.current = true;

          // [손목 반동 흡수] 스킬 시전 시 에임을 350ms 동안 모니터 정면에 고정하여 천장으로 튀는 현상 방지
          tracker.lockAim(latestOrientationRef.current);
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
      }
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, [sensorsActive, tracker, flushSensorFrame]);

  const handlePermissionGranted = () => {
    setSensorsActive(true);
    setStep('PAD');
  };

  // 5. Zero Calibration
  const handleCalibrateZero = useCallback(() => {
    tracker.unlockAim();
    isCockedRef.current = false;
    setIsCockedState(false);
    tracker.calibrateZero(latestOrientationRef.current);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CALIBRATE_ZERO',
          roomId,
          deviceId,
        })
      );
    }

    setStep('PAD');
  }, [tracker, roomId, deviceId]);

  const startCountdown = useCallback(
    (initialSec = 3) => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      setCountdownSec(initialSec);
      setStep('PAD');
      setIsGameWaiting(false);
      triggerHaptic(60);

      let cur = initialSec;
      countdownTimerRef.current = setInterval(() => {
        cur -= 1;
        if (cur > 0) {
          setCountdownSec(cur);
          triggerHaptic(60);
        } else {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdownSec(null);
          handleCalibrateZero();
          triggerHaptic([100, 50, 150]);
        }
      }, 1000);
    },
    [handleCalibrateZero]
  );
  startCountdownRef.current = startCountdown;

  const handleStartRangeMeasure = () => {
    tracker.startRangeMeasurement();
  };

  const handleFinishRangeMeasure = () => {
    tracker.finishRangeMeasurement();
    setStep('PAD');
  };

  const handleRequestStartGame = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'START_GAME_REQUEST',
          roomId,
          deviceId,
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

  return (
    <>
      {step === 'LOGIN_GATE' && (
        <LoginAndPermissionGate
          isNewUser={isNewUser}
          player={player}
          onRegisterNickname={handleRegisterNickname}
          onPermissionGranted={handlePermissionGranted}
        />
      )}

      {step === 'ZEROING' && (
        <ZeroingGuide
          onCalibrateZero={handleCalibrateZero}
          onStartRangeMeasure={handleStartRangeMeasure}
          onFinishRangeMeasure={handleFinishRangeMeasure}
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
        />
      )}

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
