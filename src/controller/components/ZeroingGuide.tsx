import React, { useState } from 'react';
import { triggerHaptic } from '../sensors/HapticFeedback';

export interface ZeroingGuideProps {
  onCalibrateZero: () => void;
  onStartRangeMeasure?: () => void;
  onFinishRangeMeasure?: () => void;
  currentAngles?: { yawDeg: number; pitchDeg: number };
}

export const ZeroingGuide: React.FC<ZeroingGuideProps> = ({
  onCalibrateZero,
  onStartRangeMeasure,
  onFinishRangeMeasure,
  currentAngles,
}) => {
  const [subStep, setSubStep] = useState<'STEP1_CENTER' | 'STEP2_RANGE'>('STEP1_CENTER');

  const handleStep1Complete = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(50);
    onCalibrateZero();
    if (onStartRangeMeasure) {
      setSubStep('STEP2_RANGE');
      onStartRangeMeasure();
    }
  };

  const handleQuickFinish = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic([30, 30]);
    onCalibrateZero();
  };

  const handleStep2Complete = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic([40, 60]);
    if (onFinishRangeMeasure) {
      onFinishRangeMeasure();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        padding: '24px',
        backgroundColor: '#0a0d14',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', sans-serif",
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(19, 26, 41, 0.95)',
          border: '2px solid #f59e0b',
          borderRadius: '24px',
          padding: '28px 22px',
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '44px', marginBottom: '10px' }}>
          {subStep === 'STEP1_CENTER' ? '🎯' : '📐'}
        </div>

        <div style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24', marginBottom: '12px' }}>
          {subStep === 'STEP1_CENTER' ? '1단계: 정면 영점 맞추기' : '2단계: 손목 가동 범위 측정'}
        </div>

        {subStep === 'STEP1_CENTER' ? (
          <>
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '16px',
                borderRadius: '14px',
                textAlign: 'left',
                fontSize: '13px',
                color: '#cbd5e1',
                lineHeight: 1.6,
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div>
                <b style={{ color: '#38bdf8' }}>1. 총구 방향 (+Y):</b> 휴대폰 윗부분을 <b>PC 모니터 정중앙</b>으로 겨누세요.
              </div>
              <div>
                <b style={{ color: '#38bdf8' }}>2. 파지 자세:</b> 편안하게 겨눈 상태를 유지하세요.
              </div>
            </div>

            <button
              onClick={handleStep1Complete}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                color: '#111827',
                fontSize: '16px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                marginBottom: '10px',
              }}
            >
              🎯 정면 영점 고정하기
            </button>

            <button
              onClick={handleQuickFinish}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚡ 빠른 기본 영점으로 건너뛰기
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '14px',
                borderRadius: '14px',
                textAlign: 'left',
                fontSize: '13px',
                color: '#cbd5e1',
                lineHeight: 1.5,
                marginBottom: '16px',
              }}
            >
              폰을 <b>상·하·좌·우(모니터 네 모서리)</b>로 자연스럽게 움직여보세요! 사용자의 손목 움직임 폭에 맞춰 조준 감도가 자동 설정됩니다.
              {currentAngles && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#38bdf8' }}>
                  현재 각도: 좌우 {currentAngles.yawDeg.toFixed(1)}° / 상하 {currentAngles.pitchDeg.toFixed(1)}°
                </div>
              )}
            </div>

            <button
              onClick={handleStep2Complete}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
              }}
            >
              ✅ 가동 범위 측정 완료!
            </button>
          </>
        )}
      </div>
    </div>
  );
};
