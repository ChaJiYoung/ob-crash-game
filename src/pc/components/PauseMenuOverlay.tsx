import React from 'react';
import type { PauseReason } from '../pauseFlow';
import type { PlayerSlot } from '../../shared/types';

export interface PauseMenuOverlayProps {
  reason: PauseReason;
  isControllerConnected: boolean;
  onResume: () => void;
  onRestart: () => void;
  isExitConfirmOpen: boolean;
  onRequestExit: () => void;
  onCancelExit: () => void;
  onConfirmExit: () => void;
  /** PLAYER_LOST일 때 끊긴 슬롯과 남은 초(올림). */
  lostSlot?: PlayerSlot;
  graceRemainingSec?: number;
  /** PLAYER_LOST일 때 "혼자 계속하기". */
  onContinueAlone?: () => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export const PauseMenuOverlay: React.FC<PauseMenuOverlayProps> = ({
  reason,
  isControllerConnected,
  onResume,
  onRestart,
  isExitConfirmOpen,
  onRequestExit,
  onCancelExit,
  onConfirmExit,
  lostSlot,
  graceRemainingSec,
  onContinueAlone,
}) => {
  const waitingForController = (reason === 'CONTROLLER_LOST' && !isControllerConnected) || reason === 'PLAYER_LOST';
  const title = isExitConfirmOpen
    ? '🏠 로비로 나갈까요?'
    : reason === 'PLAYER_LOST'
    ? `📡 ${lostSlot ?? ''}P 재접속 대기 중 · ${graceRemainingSec ?? 0}초`
    : waitingForController
    ? '📡 폰 재연결 중...'
    : reason === 'CONTROLLER_LOST'
      ? '✅ 폰이 다시 연결되었습니다'
      : '⏸ 일시정지';
  const subtitle = isExitConfirmOpen
    ? '이번 판 점수는 저장되지 않습니다'
    : reason === 'PLAYER_LOST'
    ? `${lostSlot ?? ''}P 폰 화면을 켜 주세요. 시간이 지나면 ${lostSlot ?? ''}P는 '나감' 처리되고 남은 사람이 계속합니다.`
    : waitingForController
    ? '폰 화면을 켜고 연결을 기다려 주세요'
    : reason === 'CONTROLLER_LOST'
      ? '준비되면 이어하기를 눌러 주세요'
      : '게임이 멈춰 있습니다';

  return (
    <div
      onMouseDown={stop}
      onClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 8, 15, 0.72)',
        pointerEvents: 'auto',
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <div
        style={{
          width: 'min(420px, 90vw)',
          padding: '28px 26px',
          borderRadius: '18px',
          background: 'rgba(17, 24, 39, 0.98)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
          color: '#f8fafc',
        }}
      >
        <div style={{ fontSize: '26px', fontWeight: 900, color: '#fbbf24' }}>{title}</div>
        <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>{subtitle}</div>

        {isExitConfirmOpen ? (
          <>
            <button
              onClick={onConfirmExit}
              style={{
                width: '100%',
                marginTop: '22px',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(180deg, #ef4444, #b91c1c)',
                color: '#fff',
                fontSize: '17px',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              나가기
            </button>
            <button
              onClick={onCancelExit}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                background: 'rgba(148, 163, 184, 0.08)',
                color: '#cbd5e1',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              취소 (Esc)
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onResume}
              disabled={waitingForController}
              style={{
                width: '100%',
                marginTop: '22px',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: waitingForController ? 'rgba(100, 116, 139, 0.35)' : 'linear-gradient(180deg, #f59e0b, #d97706)',
                color: waitingForController ? '#64748b' : '#1c1917',
                fontSize: '17px',
                fontWeight: 900,
                cursor: waitingForController ? 'not-allowed' : 'pointer',
              }}
            >
              ▶ 이어하기 (Esc)
            </button>

            {reason === 'PLAYER_LOST' && onContinueAlone && (
              <button
                onClick={onContinueAlone}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                혼자 계속하기
              </button>
            )}

            <button
              onClick={onRestart}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(248, 113, 113, 0.5)',
                background: 'rgba(248, 113, 113, 0.08)',
                color: '#fca5a5',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔁 다시시작 (무기 선택부터)
            </button>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
              다시시작하면 이번 판 점수는 저장되지 않습니다
            </div>

            <button
              onClick={onRequestExit}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                background: 'rgba(148, 163, 184, 0.08)',
                color: '#cbd5e1',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🏠 로비로 나가기
            </button>
          </>
        )}
      </div>
    </div>
  );
};
