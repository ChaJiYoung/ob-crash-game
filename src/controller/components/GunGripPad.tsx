import React, { useEffect, useRef, useState } from 'react';
import { UnifiedTouchPadController } from '../sensors/UnifiedTouchPad';
import { triggerHaptic } from '../sensors/HapticFeedback';

export interface GunGripPadProps {
  onRecalibrateZero: () => void;
  onFeverTrigger: () => void;
  onCockingChange?: (cocked: boolean) => void;
  isFeverReady?: boolean;
  isCocked?: boolean;
}

export const GunGripPad: React.FC<GunGripPadProps> = ({
  onRecalibrateZero,
  onFeverTrigger,
  onCockingChange,
  isFeverReady = false,
  isCocked: isCockedProp,
}) => {
  const [internalCocked, setInternalCocked] = useState(false);
  const isCocked = isCockedProp !== undefined ? isCockedProp : internalCocked;
  const touchPadRef = useRef<UnifiedTouchPadController | null>(null);

  const onFeverTriggerRef = useRef(onFeverTrigger);
  onFeverTriggerRef.current = onFeverTrigger;
  const onCockingChangeRef = useRef(onCockingChange);
  onCockingChangeRef.current = onCockingChange;

  useEffect(() => {
    const pad = new UnifiedTouchPadController({
      onFeverTrigger: () => {
        triggerHaptic([50, 50, 100]);
        onFeverTriggerRef.current();
      },
    });

    touchPadRef.current = pad;
    return () => {
      pad.dispose();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setInternalCocked(true);
    triggerHaptic(35);
    onCockingChangeRef.current?.(true);
    touchPadRef.current?.handlePointerDown();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    setInternalCocked(false);
    onCockingChangeRef.current?.(false);
    touchPadRef.current?.handlePointerUp();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#05070a',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', sans-serif",
        userSelect: 'none',
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 1. FRONT 15% STRIP: Zero Recalibration (Towards Monitor) */}
      <div
        style={{
          height: '15%',
          width: '100%',
          background: 'rgba(245, 158, 11, 0.15)',
          borderBottom: '2px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={() => {
            triggerHaptic([40, 60]);
            onRecalibrateZero();
          }}
          style={{
            height: '100%',
            width: '100%',
            maxWidth: '360px',
            borderRadius: '12px',
            border: '2px solid #f59e0b',
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.25), rgba(19, 26, 41, 0.95))',
            color: '#fbbf24',
            fontSize: '15px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 0 16px rgba(245, 158, 11, 0.2)',
          }}
        >
          <span>🎯</span>
          <span>정면 영점 맞추기 (모니터 겨누고 탭)</span>
        </button>
      </div>

      {/* 2. REAR 85% UNIFIED ACTION TOUCH PAD (Towards Body) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          height: '85%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          cursor: 'pointer',
          background: isFeverReady
            ? 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, #05070a 70%)'
            : isCocked
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, #05070a 75%)'
            : 'radial-gradient(circle, rgba(30, 41, 59, 0.5) 0%, #05070a 80%)',
          border: isFeverReady
            ? '4px solid #fbbf24'
            : isCocked
            ? '4px solid #10b981'
            : '4px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isFeverReady
            ? 'inset 0 0 30px #fbbf24'
            : isCocked
            ? 'inset 0 0 30px #10b981'
            : 'none',
          transition: 'border 0.15s, box-shadow 0.15s',
        }}
      >
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>
          {isFeverReady ? '🔥' : isCocked ? '🔒' : '👆'}
        </div>

        <div
          style={{
            fontSize: '22px',
            fontWeight: 900,
            color: isFeverReady ? '#fbbf24' : isCocked ? '#34d399' : '#f8fafc',
            marginBottom: '20px',
            textAlign: 'center',
            letterSpacing: '0.5px',
          }}
        >
          {isFeverReady
            ? '🔥 따닥 더블탭하여 FEVER 발동!'
            : isCocked
            ? '🔒 철컥! 조준 고정 중 (위로 휙 채면 발사)'
            : '화면을 터치하여 코킹 장전'}
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '340px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '14px',
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#34d399', fontWeight: 900, fontSize: '15px' }}>🔒 화면 터치:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>"철컥!" 코킹 장전 & 조준 고정</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '15px' }}>⚡ 위로 휙 채기:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>"탕!" 1발 단발 사격</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '15px' }}>🔥 빠르게 두번 탭:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>피버 모드 발동 (자동 10연사)</span>
          </div>
        </div>

        {/* 100% Auto Reload Reminder */}
        <div style={{ marginTop: '24px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
          ⚡ 10발 소진 시 1.2초 뒤 자동으로 재장전됩니다
        </div>
      </div>
    </div>
  );
};
