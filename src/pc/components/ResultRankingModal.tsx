import React, { useState } from 'react';
import { CoopBestEntry, GamePhase, InputKind, PlayerProfile, RunRankingEntry, TeamRankingEntry, WeaponKind } from '../../shared/types';
import { INPUT_KIND_ICON, INPUT_KIND_LABEL, WEAPON_RANKING_LABEL } from '../../shared/constants';
import { RankingTabs, RankingTab } from './RankingTabs';

export interface CoopResultPlayer {
  slotLabel: '1P' | '2P';
  color: string;
  nickname: string;
  score: number;
  maxCombo: number;
  kills: number;
  /** 0..1 */
  accuracy: number;
  weaponKind: WeaponKind;
  inputKind?: InputKind;
  leftEarly: boolean;
}

/** "🖱 마우스" 형태. 값이 없으면 null. */
export function formatInputKind(kind?: InputKind): string | null {
  return kind ? `${INPUT_KIND_ICON[kind]} ${INPUT_KIND_LABEL[kind]}` : null;
}

export interface CoopResultInfo {
  players: [CoopResultPlayer, CoopResultPlayer];
  teamScore: number;
  /** undefined: 서버 응답 대기, null: 이 팀 첫 기록 없음(응답 실패 등). */
  teamBest?: CoopBestEntry | null;
  isNewTeamBest: boolean;
}

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
  teamRankings?: TeamRankingEntry[];
  highlightTeamKey?: string;
  highlightDeviceIds?: string[];
  initialRankTab?: RankingTab;
  coop?: CoopResultInfo;
  /** 1인 판 요약에 보일 무기·입력 방식. */
  soloWeaponKind?: WeaponKind;
  soloInputKind?: InputKind;
  onRestart: () => void;
  onReturnToLobby: () => void;
  hoveredAction?: 'restart' | 'lobby' | null;
  restartButtonRef?: React.Ref<HTMLButtonElement>;
  lobbyButtonRef?: React.Ref<HTMLButtonElement>;
}

const CoopResultSection: React.FC<{ coop: CoopResultInfo }> = ({ coop }) => {
  return (
    <div style={{ width: '100%', marginBottom: '24px' }}>
      {/* 2-Player Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {coop.players.map((p, idx) => (
          <div
            key={idx}
            data-testid={`coop-result-player-${idx}`}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1.5px solid ${p.color}`,
              borderRadius: '16px',
              padding: '16px 20px',
              opacity: p.leftEarly ? 0.5 : 1,
              position: 'relative',
            }}
          >
            {/* Header: Badge + Nickname + (Away) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: p.color,
                    color: '#111',
                    fontWeight: 900,
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {p.slotLabel}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  {p.nickname}
                </span>
              </div>
              {p.leftEarly && (
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid #ef4444',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  나감
                </span>
              )}
            </div>

            {/* Score */}
            <div style={{ fontSize: '32px', fontWeight: 900, color: p.color, margin: '8px 0' }}>
              {p.score.toLocaleString()} PTS
            </div>

            {/* Stats Breakdown */}
            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.8 }}>
              <div>최대 콤보: <strong style={{ color: '#fff' }}>{p.maxCombo} COMBO</strong></div>
              <div>처치 수: <strong style={{ color: '#fff' }}>{p.kills} KILL</strong></div>
              <div>명중률: <strong style={{ color: '#fff' }}>{Math.round(p.accuracy * 100)}%</strong></div>
              <div>선택 무기: <strong style={{ color: '#fff' }}>{WEAPON_RANKING_LABEL[p.weaponKind]}</strong></div>
              {p.inputKind && (
                <div data-testid={`coop-result-input-${idx}`}>
                  입력: <strong style={{ color: '#fff' }}>{formatInputKind(p.inputKind)}</strong>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Team Summary Bar */}
      <div
        data-testid="coop-team-summary"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>팀 합계</span>
          <span style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24' }}>
            {coop.teamScore.toLocaleString()} PTS
          </span>
          {coop.isNewTeamBest && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                background: '#fbbf24',
                color: '#111827',
                padding: '2px 8px',
                borderRadius: '6px',
                marginLeft: '4px',
              }}
            >
              🏆 팀 신기록!
            </span>
          )}
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          이 팀 최고:{' '}
          <strong style={{ color: '#e2e8f0', fontSize: '14px' }}>
            {coop.teamBest === undefined
              ? '기록 확인 중…'
              : coop.teamBest
              ? `${coop.teamBest.teamScore.toLocaleString()} PTS`
              : '기록 없음'}
          </strong>
        </div>
      </div>
    </div>
  );
};

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
  teamRankings = [],
  highlightTeamKey,
  highlightDeviceIds,
  initialRankTab,
  coop,
  soloWeaponKind,
  soloInputKind,
  onRestart,
  onReturnToLobby,
  hoveredAction = null,
  restartButtonRef,
  lobbyButtonRef,
}) => {
  const isVictory = gamePhase === 'VICTORY';
  const [activeRankTab, setActiveRankTab] = useState<RankingTab>(initialRankTab ?? (coop ? 'team' : 'solo'));

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
        {/* Score & Record Summary: Coop Section or Solo Grid */}
        {coop ? (
          <CoopResultSection coop={coop} />
        ) : (
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
              {(soloWeaponKind || soloInputKind) && (
                <div data-testid="solo-loadout" style={{ marginTop: '4px', fontSize: '12px', color: '#cbd5e1' }}>
                  {[soloWeaponKind ? WEAPON_RANKING_LABEL[soloWeaponKind] : null, formatInputKind(soloInputKind)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
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
        )}
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
          <RankingTabs
            soloRankings={rankings}
            teamRankings={teamRankings}
            activeTab={activeRankTab}
            onChangeTab={setActiveRankTab}
            highlightTeamKey={highlightTeamKey}
            highlightDeviceIds={highlightDeviceIds ?? (currentPlayer ? [currentPlayer.deviceId] : undefined)}
          />

          {coop && activeRankTab === 'solo' && (
            <div
              data-testid="coop-ranking-note"
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                textAlign: 'center',
                marginTop: '12px',
                letterSpacing: '-0.2px',
              }}
            >
              2인팟 점수는 솔로 랭킹에 오르지 않습니다
            </div>
          )}
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
