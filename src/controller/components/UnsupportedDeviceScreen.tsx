import React from 'react';
import type { UnsupportedReason } from '../../shared/types';

export interface UnsupportedDeviceScreenProps {
  reason: UnsupportedReason;
}

/** 자이로가 확인되지 않은 폰에 보이는 전체 화면. 버튼이 없다: 우회·재시도 수단을 두지 않는다. */
export const UnsupportedDeviceScreen: React.FC<UnsupportedDeviceScreenProps> = ({ reason }) => {
  return (
    <div
      data-testid="unsupported-device-screen"
      data-reason={reason}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        padding: '24px',
        backgroundColor: '#0a0d14',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', sans-serif",
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(19, 26, 41, 0.95)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ fontSize: '44px', marginBottom: '12px' }}>📵</div>
        <div style={{ fontSize: '21px', fontWeight: 900, color: '#f87171', marginBottom: '12px' }}>
          이 기기는 지원하지 않아요
        </div>
        <div style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: 1.6 }}>
          조준에 필요한 자이로 센서를 확인할 수 없어서 게임을 할 수 없어요. 다른 폰으로 PC 화면의 QR을 다시 찍어
          접속해 주세요.
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px' }}>
          {reason === 'NO_EVENTS' ? '센서 신호가 들어오지 않았어요.' : '자이로 값이 확인되지 않았어요.'}
        </div>
      </div>
    </div>
  );
};
