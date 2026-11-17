import React, { useState } from 'react';
import { REWARD_CARD_SPECS } from '../../shared/constants';
import type { DebugRunEntry, DebugStartConfig, DebugStartPoint, WeaponLevel } from '../../shared/types';
import { DEBUG_CARD_LIMITS, DebugCardKey, presetForStart } from '../debug/debugMode';

export type DebugPanelTab = 'config' | 'records';

export interface DebugLobbyPanelProps {
  config: DebugStartConfig;
  onChangeConfig: (cfg: DebugStartConfig) => void;
  /** null = 불러오는 중. */
  runs: DebugRunEntry[] | null;
  /** [최근 기록] 탭을 열 때 호출. */
  onRequestRuns: () => void;
  initialTab?: DebugPanelTab;
}

/** ≤7 → `W7`, ≥8 → `DANGER n`. */
export function formatDebugRunReach(waveReached: number): string {
  return waveReached >= 8 ? `DANGER ${waveReached - 7}` : `W${waveReached}`;
}

/** 카드 스택을 delta만큼 바꾼다(0..상한). 바뀌지 않으면 같은 객체를 돌려준다. */
export function stepDebugCard(config: DebugStartConfig, key: DebugCardKey, delta: number): DebugStartConfig {
  const next = Math.min(DEBUG_CARD_LIMITS[key], Math.max(0, config.cards[key] + delta));
  if (next === config.cards[key]) return config;
  return { ...config, cards: { ...config.cards, [key]: next } };
}

const CARD_ORDER: { key: DebugCardKey; label: string }[] = [
  { key: 'damage_up', label: '피해↑' },
  { key: 'skill_cooldown', label: '쿨감' },
  { key: 'fever_extend', label: '피버연장' },
  { key: 'hit_zone_up', label: '판정확대' },
  { key: 'rapid_reload', label: '빠른장전' },
  { key: 'lucky_drop', label: '행운' },
];

const WEAPON_LABEL: Record<string, string> = { shotgun: '샷건', revolver: '리볼버', gatling: '개틀링' };

const ACCENT = '#fb923c';

const chip = (active: boolean, disabled = false): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: '8px',
  border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.18)'}`,
  background: active ? 'rgba(234, 88, 12, 0.25)' : 'rgba(255,255,255,0.04)',
  color: disabled ? '#64748b' : active ? '#fed7aa' : '#cbd5e1',
  fontWeight: 800,
  fontSize: '12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
  color: active ? '#fdba74' : '#94a3b8',
  fontWeight: active ? 900 : 600,
  fontSize: '12px',
  padding: '4px 6px',
  cursor: 'pointer',
});

export const DebugLobbyPanel: React.FC<DebugLobbyPanelProps> = ({
  config,
  onChangeConfig,
  runs,
  onRequestRuns,
  initialTab = 'config',
}) => {
  const [tab, setTab] = useState<DebugPanelTab>(initialTab);
  const [openGameId, setOpenGameId] = useState<number | null>(null);
  const locked = config.startAt === 'EX';

  const openRecords = () => {
    setTab('records');
    onRequestRuns();
  };

  const setCard = (key: DebugCardKey, delta: number) => {
    const next = stepDebugCard(config, key, delta);
    if (next !== config) onChangeConfig(next);
  };

  return (
    <div data-testid="debug-lobby-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div role="tablist" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
        <button type="button" role="tab" aria-selected={tab === 'config'} onClick={() => setTab('config')} style={tabStyle(tab === 'config')}>
          🛠 시작 조건
        </button>
        <button type="button" role="tab" aria-selected={tab === 'records'} onClick={openRecords} style={tabStyle(tab === 'records')}>
          📋 최근 기록
        </button>
      </div>

      {/* RankingTabs compact 본문과 같은 고정 높이(290px) */}
      <div style={{ height: '290px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tab === 'config' && (
          <>
            <section>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>시작 지점</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['W1', 'W6', 'EX'] as DebugStartPoint[]).map((p) => (
                  <button key={p} type="button" data-testid={`debug-start-${p}`} style={chip(config.startAt === p)} onClick={() => onChangeConfig(presetForStart(p))}>
                    {p}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>무기 레벨</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([1, 2, 3, 4] as WeaponLevel[]).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    data-testid={`debug-level-${lv}`}
                    disabled={locked}
                    style={chip(config.weaponLevel === lv, locked)}
                    onClick={() => onChangeConfig({ ...config, weaponLevel: lv })}
                  >
                    Lv.{lv}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>카드 스택</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {CARD_ORDER.map(({ key, label }) => {
                  const icon = (REWARD_CARD_SPECS as Record<string, { icon: string }>)[key]?.icon ?? '';
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <span style={{ flex: 1, color: '#e2e8f0' }}>{icon} {label}</span>
                      <button type="button" data-testid={`debug-card-${key}-minus`} disabled={locked} style={chip(false, locked)} onClick={() => setCard(key, -1)}>−</button>
                      <span data-testid={`debug-card-${key}-value`} style={{ width: '28px', textAlign: 'center', fontWeight: 900 }}>
                        {config.cards[key]}/{DEBUG_CARD_LIMITS[key]}
                      </span>
                      <button type="button" data-testid={`debug-card-${key}-plus`} disabled={locked} style={chip(false, locked)} onClick={() => setCard(key, 1)}>+</button>
                    </div>
                  );
                })}
              </div>
            </section>
            {locked && <div style={{ fontSize: '11px', color: '#fdba74' }}>EX는 MAX 고정(무기 Lv.4, 카드 최대)</div>}
            <div style={{ fontSize: '11px', color: '#64748b' }}>무기 종류는 게임 시작 후 평소처럼 사격으로 고릅니다.</div>
          </>
        )}

        {tab === 'records' && (
          <>
            {runs === null && <div style={{ color: '#94a3b8', fontSize: '12px' }}>불러오는 중…</div>}
            {runs !== null && runs.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px' }}>디버그 기록 없음</div>}
            {runs?.map((r) => {
              const open = openGameId === r.gameId;
              const weapons = r.members.map((m) => (m.weaponKind ? WEAPON_LABEL[m.weaponKind] : '?')).join('+');
              return (
                <div key={r.gameId} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 8px', fontSize: '12px' }}>
                  <button
                    type="button"
                    data-testid={`debug-run-${r.gameId}`}
                    onClick={() => setOpenGameId(open ? null : r.gameId)}
                    style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}
                  >
                    <span style={{ color: '#fdba74', fontWeight: 900 }}>{r.mode === 'coop' ? '2P' : '1P'}</span>
                    <span>{weapons}</span>
                    <span style={{ color: '#94a3b8' }}>시작 {r.config?.startAt ?? '?'}</span>
                    <span style={{ fontWeight: 900 }}>{r.totalScore.toLocaleString()}점</span>
                    <span>{formatDebugRunReach(r.waveReached)}</span>
                    <span style={{ color: '#f87171' }}>피격 {r.damageTaken}</span>
                  </button>
                  {open && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {r.waves.map((w) => (
                        <span key={w.wave} style={{ padding: '1px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)' }}>
                          {formatDebugRunReach(w.wave)} · {w.damageTaken ?? '-'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
