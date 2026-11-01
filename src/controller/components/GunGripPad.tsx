import React, { useEffect, useRef, useState } from 'react';
import { UnifiedTouchPadController } from '../sensors/UnifiedTouchPad';
import { triggerHaptic } from '../sensors/HapticFeedback';

export interface GunGripPadProps {
  onRecalibrateZero: () => void;
  onRapidFireChange: (active: boolean) => void;
  onFeverTrigger: () => void;
  isFeverReady?: boolean;
}

export const GunGripPad: React.FC<GunGripPadProps> = ({
  onRecalibrateZero,
  onRapidFireChange,
  onFeverTrigger,
  isFeverReady = false,
}) => {
  const [isRapidFiring, setIsRapidFiring] = useState(false);
  const touchPadRef = useRef<UnifiedTouchPadController | null>(null);

  useEffect(() => {
    const pad = new UnifiedTouchPadController({
      onRapidFireChange: (active) => {
        setIsRapidFiring(active);
        onRapidFireChange(active);
        if (active) triggerHaptic([30, 40, 30]);
      },
      onFeverTrigger: () => {
        triggerHaptic([50, 50, 100]);
        onFeverTrigger();
      },
    });

    touchPadRef.current = pad;
    return () => {
      pad.dispose();
    };
  }, [onRapidFireChange, onFeverTrigger]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    touchPadRef.current?.handlePointerDown();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
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
            triggerHaptic(40);
            onRecalibrateZero();
          }}
          style={{
            height: '100%',
            width: '100%',
            maxWidth: '360px',
            borderRadius: '10px',
            border: '1px solid #f59e0b',
            background: 'rgba(19, 26, 41, 0.85)',
            color: '#fbbf24',
            fontSize: '14px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <span>🎯</span>
          <span>정면 영점 재설정 (Recalibrate)</span>
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
          background: isRapidFiring
            ? 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, #05070a 70%)'
            : isFeverReady
            ? 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, #05070a 70%)'
            : 'radial-gradient(circle, rgba(30, 41, 59, 0.5) 0%, #05070a 80%)',
          border: isRapidFiring
            ? '4px solid #06b6d4'
            : isFeverReady
            ? '4px solid #fbbf24'
            : '4px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isRapidFiring
            ? 'inset 0 0 30px #06b6d4'
            : isFeverReady
            ? 'inset 0 0 30px #fbbf24'
            : 'none',
          transition: 'border 0.15s, box-shadow 0.15s',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {isRapidFiring ? '🔫' : isFeverReady ? '🔥' : '👆'}
        </div>

        <div
          style={{
            fontSize: '22px',
            fontWeight: 900,
            color: isRapidFiring ? '#06b6d4' : isFeverReady ? '#fbbf24' : '#f8fafc',
            marginBottom: '16px',
            textAlign: 'center',
            letterSpacing: '1px',
          }}
        >
          {isRapidFiring
            ? '🔫 AUTO RAPID FIRE!'
            : isFeverReady
            ? '🔥 따닥 더블탭하여 FEVER 발동!'
            : '통합 액션 터치패드'}
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '14px',
            padding: '16px 20px',
            maxWidth: '340px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '13px',
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 800 }}>꾹 누르기 (0.25s↑):</span>
            <span style={{ color: '#f8fafc' }}>기관총 자동 연사</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fbbf24', fontWeight: 800 }}>빠르게 두번 탭 (0.3s↓):</span>
            <span style={{ color: '#f8fafc' }}>피버 모드 발동</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#34d399', fontWeight: 800 }}>위로 톡 튀기기:</span>
            <span style={{ color: '#f8fafc' }}>권총 반동 스냅 단발 사격</span>
          </div>
        </div>

        {/* 100% Auto Reload Reminder */}
        <div style={{ marginTop: '20px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
          ⚡ 탄창 소진 시 1.2초 뒤 자동으로 재장전됩니다 (수동 조작 불필요)
        </div>
      </div>
    </div>
  );
};
