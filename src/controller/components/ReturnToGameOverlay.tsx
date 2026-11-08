import React from 'react';

export interface ReturnToGameOverlayProps {
  onReturn: () => void;
}

/** 화면이 꺼졌다 돌아온 폰을 덮어, 버튼을 누르기 전에는 패드 조작을 막는다. 누른 방향이 새 정면 영점이 된다. */
export const ReturnToGameOverlay: React.FC<ReturnToGameOverlayProps> = ({ onReturn }) => (
  <div
    data-testid="return-to-game-overlay"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 900, // under the reconnect banner and slot badge, over the pad
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '24px',
      background: 'rgba(10, 13, 20, 0.94)',
      color: '#ffffff',
      fontFamily: "'Noto Sans KR', sans-serif",
      textAlign: 'center',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ fontSize: '40px' }}>🎯</div>
    <div style={{ fontSize: '22px', fontWeight: 800 }}>게임으로 돌아가기</div>
    <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.6, maxWidth: '320px' }}>
      폰 윗부분으로 모니터 중앙을 겨누고 누르세요.
      <br />
      누른 방향이 새 정면이 됩니다.
    </div>
    <button
      type="button"
      onClick={onReturn}
      style={{
        marginTop: '8px',
        width: '100%',
        maxWidth: '320px',
        // same look as the green "allow sensors" button
        padding: '15px',
        fontSize: '16px',
        fontWeight: 800,
        color: '#ffffff',
        background: 'linear-gradient(90deg, #10b981, #059669)',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
      }}
    >
      게임으로 돌아가기
    </button>
  </div>
);
