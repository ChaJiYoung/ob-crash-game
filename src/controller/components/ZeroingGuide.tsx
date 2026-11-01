import React from 'react';

export interface ZeroingGuideProps {
  onCalibrateZero: () => void;
}

export const ZeroingGuide: React.FC<ZeroingGuideProps> = ({ onCalibrateZero }) => {
  return (
    <div
      onClick={onCalibrateZero}
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
        cursor: 'pointer',
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
          padding: '30px 24px',
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>

        <div style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24', marginBottom: '16px' }}>
          권총 파지법 및 영점 조절
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '16px',
            borderRadius: '14px',
            textAlign: 'left',
            fontSize: '13px',
            color: '#cbd5e1',
            lineHeight: 1.6,
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div>
            <b style={{ color: '#38bdf8' }}>1. 총구 방향 (+Y):</b> 휴대폰 윗부분(충전단자 반대쪽)을 PC 모니터 정중앙으로 겨누세요.
          </div>
          <div>
            <b style={{ color: '#38bdf8' }}>2. 화면 방향 (+Z):</b> 휴대폰 화면이 <b>왼쪽</b>을 바라보도록 세워 쥐세요.
          </div>
          <div>
            <b style={{ color: '#38bdf8' }}>3. 격발 파지:</b> 오른손 엄지나 반대손으로 화면을 편안하게 터치할 수 있게 쥐세요.
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            color: '#111827',
            fontSize: '16px',
            fontWeight: 900,
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
            animation: 'pulse 1.5s infinite',
          }}
        >
          🎯 모니터를 겨눈 상태로 화면을 터치하여 영점 고정!
        </div>
      </div>
    </div>
  );
};
