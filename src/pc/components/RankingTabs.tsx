import React, { useEffect } from 'react';
import { RunRankingEntry, TeamRankingEntry, WeaponKind } from '../../shared/types';
import { WEAPON_RANKING_LABEL } from '../../shared/constants';

export type RankingTab = 'solo' | 'team';

export interface RankingTabsProps {
  soloRankings: RunRankingEntry[];
  teamRankings: TeamRankingEntry[];
  activeTab: RankingTab;
  onChangeTab: (tab: RankingTab) => void;
  /** 강조할 팀 키(지금 참여한 두 사람). 없으면 강조 없음. */
  highlightTeamKey?: string;
  /** 강조할 개인 deviceId 목록(참여자). */
  highlightDeviceIds?: string[];
  compact?: boolean; // 로비 하단 한 줄형(시안) vs 결과 화면 목록형
}

export function getDefaultRankTab(joinedCount: number): RankingTab {
  return joinedCount === 2 ? 'team' : 'solo';
}

export function buildTeamKey(deviceA?: string, deviceB?: string): string | null {
  if (!deviceA || !deviceB) return null;
  return [deviceA, deviceB].sort().join('|');
}

export const RankingTabs: React.FC<RankingTabsProps> = ({
  soloRankings,
  teamRankings,
  activeTab,
  onChangeTab,
  highlightTeamKey,
  highlightDeviceIds,
  compact = false,
}) => {
  // D38: 키보드 Tab 키로 탭 전환 (입력창에 포커스가 없을 때)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const activeEl = document.activeElement;
        const isInputFocused =
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            (activeEl as HTMLElement).isContentEditable);
        if (!isInputFocused) {
          e.preventDefault();
          onChangeTab(activeTab === 'solo' ? 'team' : 'solo');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, onChangeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '8px' : '10px', width: '100%' }}>
      {/* Tab Header */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '6px',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'solo'}
          onClick={() => onChangeTab('solo')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'solo' ? '2px solid #f59e0b' : '2px solid transparent',
            color: activeTab === 'solo' ? '#fbbf24' : '#94a3b8',
            fontWeight: activeTab === 'solo' ? 900 : 600,
            fontSize: compact ? '12px' : '13px',
            padding: '4px 6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🏆</span>
          <span>개인 랭킹</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'team'}
          onClick={() => onChangeTab('team')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'team' ? '2px solid #f59e0b' : '2px solid transparent',
            color: activeTab === 'team' ? '#fbbf24' : '#94a3b8',
            fontWeight: activeTab === 'team' ? 900 : 600,
            fontSize: compact ? '12px' : '13px',
            padding: '4px 6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>👥</span>
          <span>팀 랭킹</span>
        </button>
      </div>

      {/* Tab Body: Solo Rankings */}
      {activeTab === 'solo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '4px' : '6px' }}>
          {soloRankings.length === 0 ? (
            <div
              style={{
                fontSize: compact ? '12px' : '13px',
                color: '#64748b',
                textAlign: 'center',
                padding: compact ? '14px 0' : '20px 0',
              }}
            >
              {compact ? (
                <>
                  아직 등록된 기록이 없습니다.
                  <br />
                  첫 번째 주인공이 되어보세요!
                </>
              ) : (
                '아직 기록이 없습니다. 첫 기록의 주인공이 되어 보세요!'
              )}
            </div>
          ) : (
            soloRankings.slice(0, 5).map((entry, index) => {
              const isHighlighted = highlightDeviceIds?.includes(entry.deviceId);
              return (
                <div
                  key={`${entry.deviceId}-${entry.playedAt}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: compact ? '5px 8px' : '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: isHighlighted
                      ? '1px solid rgba(245, 158, 11, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: compact ? '11px' : '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 900,
                        color:
                          index === 0
                            ? '#fbbf24'
                            : index === 1
                            ? '#e2e8f0'
                            : index === 2
                            ? '#b45309'
                            : '#94a3b8',
                        width: '16px',
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#f8fafc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: compact ? '100px' : '140px',
                      }}
                    >
                      {entry.nickname}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                      {WEAPON_RANKING_LABEL[entry.weaponKind as WeaponKind] ?? entry.weaponKind}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: compact ? '#f59e0b' : '#38bdf8' }}>
                      {compact ? entry.score.toLocaleString() : `${entry.score}점`}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>W{entry.waveReached}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Body: Team Rankings */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '4px' : '6px' }}>
          {teamRankings.length === 0 ? (
            <div
              style={{
                fontSize: compact ? '12px' : '13px',
                color: '#64748b',
                textAlign: 'center',
                padding: compact ? '14px 0' : '20px 0',
              }}
            >
              아직 팀 기록이 없습니다.
            </div>
          ) : (
            teamRankings.slice(0, 5).map((entry, index) => {
              const isHighlighted = highlightTeamKey && entry.teamKey === highlightTeamKey;
              const p1 = entry.members?.[0]?.nickname ?? '1P';
              const p2 = entry.members?.[1]?.nickname ?? '2P';
              return (
                <div
                  key={`${entry.teamKey}-${entry.playedAt}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: compact ? '5px 8px' : '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: isHighlighted
                      ? '1px solid rgba(245, 158, 11, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: compact ? '11px' : '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 900,
                        color:
                          index === 0
                            ? '#fbbf24'
                            : index === 1
                            ? '#e2e8f0'
                            : index === 2
                            ? '#b45309'
                            : '#94a3b8',
                        width: '16px',
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#f8fafc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: compact ? '140px' : '180px',
                      }}
                    >
                      {p1} & {p2}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: compact ? '#f59e0b' : '#38bdf8' }}>
                      {compact ? entry.teamScore.toLocaleString() : `${entry.teamScore.toLocaleString()}점`}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>W{entry.waveReached}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
