import React, { useEffect, useRef, useState, useMemo } from 'react';
import { getOrCreateDeviceId } from './sensors/DeviceIdentity';
import { GunGripTracker, EulerOrientation } from './sensors/GunGripTracker';
import { LoginAndPermissionGate } from './components/LoginAndPermissionGate';
import { ZeroingGuide } from './components/ZeroingGuide';
import { GunGripPad } from './components/GunGripPad';
import { PlayerProfile, ServerToClientMessage } from '../shared/types';

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

  const wsRef = useRef<WebSocket | null>(null);
  const latestOrientationRef = useRef<EulerOrientation>({ alpha: 0, beta: 0, gamma: 0 });
  const snapFireRef = useRef<boolean>(false);
  const rapidFireHoldRef = useRef<boolean>(false);
  const feverTriggeredRef = useRef<boolean>(false);

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
          snapFireRef.current = true;
        }
      }
    };

    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);

    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, [sensorsActive, tracker]);

  const handlePermissionGranted = () => {
    setSensorsActive(true);
    setStep('ZEROING');
  };

  // 5. Zero Calibration
  const handleCalibrateZero = () => {
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
  };

  // 6. 60Hz Sensor Streaming Loop (every 16ms)
  useEffect(() => {
    if (step !== 'PAD') return;

    const streamInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId) {
        return;
      }

      const aim = tracker.computeAim(latestOrientationRef.current);
      const snapFire = snapFireRef.current;
      snapFireRef.current = false;

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
            pitchDeg: aim.pitchDeg,
            yawDeg: aim.yawDeg,
            rollDeg: aim.rollDeg,
            snapFire,
            rapidFireHold: rapidFireHoldRef.current,
            feverTriggered,
            timestamp: Date.now(),
          },
        })
      );
    }, 16);

    return () => clearInterval(streamInterval);
  }, [step, roomId, deviceId, tracker]);

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

      {step === 'ZEROING' && <ZeroingGuide onCalibrateZero={handleCalibrateZero} />}

      {step === 'PAD' && (
        <GunGripPad
          onRecalibrateZero={handleCalibrateZero}
          onRapidFireChange={(active) => {
            rapidFireHoldRef.current = active;
          }}
          onFeverTrigger={() => {
            feverTriggeredRef.current = true;
          }}
          isFeverReady={isFeverReady}
        />
      )}
    </>
  );
};
