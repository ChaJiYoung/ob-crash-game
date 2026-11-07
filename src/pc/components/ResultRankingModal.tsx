import React from 'react';
import { GamePhase, PlayerProfile, RunRankingEntry } from '../../shared/types';
import { WEAPON_RANKING_LABEL } from '../../shared/constants';

export interface ResultRankingModalProps {
  gamePhase: GamePhase;
  score: number;
  /** Score split shown under the total (base hits and kills / wave time / precision). */
  breakdown?: { base: number; timeBonus: number; precisionBonus: number; levelBonus?: number };
  /** The final wave ends the game, so its clear time/bonus is shown here instead of a banner. */
  lastWaveClear?: { wave: number; seconds: number; bonus: number } | null;
  maxCombo: number;
  /** 판 전체 처치 수. */
  kills?: number;
  waveReached: number;
  currentPlayer?: PlayerProfile;
  isNewRecord?: boolean;
  rankings: RunRankingEntry[];
  onRestart: () => void;
  onReturnToLobby: () => void;
  hoveredAction?: 'restart' | 'lobby' | null;
  restartButtonRef?: React.Ref<HTMLButtonElement>;
  lobbyButtonRef?: React.Ref<HTMLButtonElement>;
}

export const ResultRankingModal: React.FC<ResultRankingModalProps> = ({
  gamePhase,
  score,
  breakdown,
  lastWaveClear,
  maxCombo,
  kills = 0,
  waveReached,
  currentPlayer,
  isNewRecord,
  rankings,
  onRestart,
  onReturnToLobby,
  hoveredAction = null,
  restartButtonRef,
  lobbyButtonRef,
}) => {
  const isVictory = gamePhase === 'VICTORY';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
        color: '#ffffff',
      }}
    >
      <div
        style={{
          width: 'min(1100px, 94vw)',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: 'linear-gradient(145deg, #131a29, #0d121c)',
          border: isVictory ? '2px solid #fbbf24' : '2px solid #ef4444',
          borderRadius: '24px',
          padding: '36px 40px',
          boxShadow: isVictory
            ? '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(251, 191, 36, 0.3)'
            : '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(239, 68, 68, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 900,
              color: isVictory ? '#fbbf24' : '#ef4444',
              letterSpacing: '-0.5px',
            }}
          >
            {isVictory ? '🎉 VICTORY! 브루어리 수호 성공!' : '💥 GAME OVER! 바 방어선 함락!'}
          </div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px' }}>
            {isVictory
              ? '생맥주 냉각기 보스를 격퇴하고 오비 브루어리를 완벽히 지켜냈습니다!'
              : '맥주 몬스터들의 거센 공세에 방어선이 무너졌습니다.'}
          </div>
        </div>

        <style>{`.result-layout { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; } @media (max-width: 900px) { .result-layout { grid-template-columns: minmax(0, 1fr); } }`}</style>
        <div className="result-layout">
        <div>
        {/* Score & Record Summary */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '14px',
              textAlign: 'center',
              border: isNewRecord ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>최종 득점</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>
              {score}점
            </div>
            {breakdown && (breakdown.timeBonus > 0 || breakdown.precisionBonus > 0) && (
              <div
                data-testid="score-breakdown"
                style={{ marginTop: '8px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}
              >
                <div>기본 {breakdown.base}점</div>
                {breakdown.timeBonus > 0 && <div>시간 보너스 +{breakdown.timeBonus}점</div>}
                {isVictory && lastWaveClear && (
                  <div data-testid="last-wave-clear">
                    WAVE {lastWaveClear.wave} CLEAR · {lastWaveClear.seconds.toFixed(1)}초 · +{lastWaveClear.bonus}점
                  </div>
                )}
                {breakdown.precisionBonus > 0 && <div>정밀도 보너스 +{breakdown.precisionBonus}점</div>}
                {(breakdown.levelBonus ?? 0) > 0 && <div>저레벨 클리어 보너스 +{breakdown.levelBonus}점</div>}
              </div>
            )}
            {isNewRecord && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: '#fbbf24',
                  color: '#111827',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginTop: '4px',
                }}
              >
                NEW RECORD!
              </span>
            )}
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '14px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>누적 격파 (KILL)</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
              {kills} KILL
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '14px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>최대 콤보</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#f472b6', marginTop: '4px' }}>
              {maxCombo} COMBO
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '14px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>도달 웨이브</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>
              WAVE {waveReached}
            </div>
          </div>
        </div>

        </div>

        {/* TOP 5 Hall of Fame Table */}
        <div
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '18px 20px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#fbbf24',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🏆 명예의 전당 TOP 5
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rankings.length === 0 && (
              <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
                아직 기록이 없습니다. 첫 기록의 주인공이 되어 보세요!
              </div>
            )}
            {rankings.slice(0, 5).map((p, idx) => {
              const isCurrent = currentPlayer && p.deviceId === currentPlayer.deviceId;
              return (
                <div
                  key={`${p.deviceId}-${p.playedAt}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: isCurrent
                      ? 'rgba(245, 158, 11, 0.25)'
                      : idx === 0
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isCurrent
                      ? '1px solid #fbbf24'
                      : idx === 0
                      ? '1px solid rgba(245, 158, 11, 0.3)'
                      : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: '13px',
                        color: idx === 0 ? '#fbbf24' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#b45309' : '#94a3b8',
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: isCurrent ? 800 : 600 }}>
                      {p.nickname} {isCurrent && '(나)'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      W{p.waveReached} · {WEAPON_RANKING_LABEL[p.weaponKind]}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>
                    {p.score}점
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '14px', width: '100%' }}>
          <button
            ref={restartButtonRef}
            data-shootable="restart"
            onClick={onRestart}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: hoveredAction === 'restart' ? '2px solid #ffffff' : 'none',
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              color: '#111827',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
              transform: hoveredAction === 'restart' ? 'scale(1.05)' : 'scale(1.0)',
              boxShadow: hoveredAction === 'restart'
                ? '0 0 32px rgba(245, 158, 11, 0.9), 0 4px 14px rgba(245, 158, 11, 0.5)'
                : '0 4px 14px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {hoveredAction === 'restart' ? '🎯 🔄 다시 도전하기 (사격!)' : '🔄 다시 도전하기'}
          </button>
          <button
            ref={lobbyButtonRef}
            data-shootable="lobby"
            onClick={onReturnToLobby}
            style={{
              padding: '16px 24px',
              borderRadius: '12px',
              border: hoveredAction === 'lobby' ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.2)',
              background: hoveredAction === 'lobby' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              transform: hoveredAction === 'lobby' ? 'scale(1.05)' : 'scale(1.0)',
              boxShadow: hoveredAction === 'lobby'
                ? '0 0 32px rgba(56, 189, 248, 0.9)'
                : 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
            }}
          >
            {hoveredAction === 'lobby' ? '🎯 🏠 로비로 이동 (사격!)' : '🏠 로비로 이동'}
          </button>
        </div>
      </div>
    </div>
  );
};
