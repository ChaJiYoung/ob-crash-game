import React from 'react';
import { ActiveBuffState, TargetKind, WeaponKind, WeaponLevel } from '../../shared/types';
import { ITEM_BUFF_SPECS, REWARD_CARD_SPECS, STAGE_CONSTANTS, WEAPON_ARCHETYPE_SPECS } from '../../shared/constants';
import { PassiveCardStack, WaveProgressInfo } from '../engine/BeerCrusherEngine';
import type { BossHudInfo, PlayerHudSnapshot } from '../hudSnapshot';
import type { PanelInputKind, PlayerPresentation } from '../playerPresentation';
import { PlayerPanel } from './PlayerPanel';
import { GAME_TUNING } from '../../shared/gameTuning';

export interface MonsterHudProjection {
  id: string;
  kind: TargetKind;
  hp: number;
  maxHp: number;
  leftPercent: number;
  topPercent: number;
  isStunned?: boolean;
  isSlowed?: boolean;
  isBoss?: boolean;
  cardTitle?: string;
  isItem?: boolean;
  isProjectile?: boolean;
}

/**
 * D03 & D06 Specification:
 * - 1HP air cans ('pilgood', 'caslight') and items/projectiles return false by default to reduce HUD clutter
 * - If a 1HP can took damage (currentHp < maxHp && currentHp > 0), return true immediately so player sees remaining health
 * - Multi-hit monsters with maxHp >= 2 ('obi: 2', 'hanmac: 3', 'bottle: 4', 'boss: 60') return true
 */
export function shouldRenderMonsterHpBar(
  maxHp: number,
  isItem?: boolean,
  isProjectile?: boolean,
  currentHp?: number
): boolean {
  if (isItem || isProjectile) return false;
  if (currentHp !== undefined && currentHp < maxHp && currentHp > 0) return true;
  return maxHp >= 2;
}

/** 상단 중앙에 무엇을 그릴지. 보스가 나오면 웨이브 진행 바(처치 수가 totalSpawns에서 멈춘다)는 숨기고 보스 체력 바만 보여 준다. */
export function getWaveHudMode(bossCount: number): { showProgressBar: boolean } {
  return { showProgressBar: bossCount === 0 };
}

export function formatWeaponSkillBadge(
  weaponKind: WeaponKind,
  weaponLevel: WeaponLevel,
  skillStock: number,
  maxSkillStock: number,
  cooldownRemainingMs: number,
  inputKind: PanelInputKind = 'mobile'
): {
  weaponTitle: string;
  levelBadge: string;
  skillStatusText: string;
  isReady: boolean;
  accentColor: string;
} {
  const spec = WEAPON_ARCHETYPE_SPECS[weaponKind];
  const weaponTitle = spec ? spec.nameKo : weaponKind;
  const levelBadge = weaponLevel >= 4 ? 'Lv.MAX' : `Lv.${weaponLevel}`;
  const isReady = skillStock > 0;
  const accentColor =
    weaponKind === 'shotgun'
      ? '#ef4444'
      : weaponKind === 'revolver'
      ? '#fbbf24'
      : '#06b6d4';

  let skillStatusText = '';
  if (isReady) {
    const nextCharge =
      skillStock < maxSkillStock && cooldownRemainingMs > 0 ? ` · 다음 ${(cooldownRemainingMs / 1000).toFixed(1)}s` : '';
    const stockBadge = maxSkillStock > 1 ? ` [★${skillStock}/${maxSkillStock}${nextCharge}]` : '';
    skillStatusText = `⚡ SKILL READY!${stockBadge} [${inputKind === 'mouse' ? '우클릭' : '위로 휙!'}]`;
  } else {
    skillStatusText = `쿨다운 ${(Math.max(0, cooldownRemainingMs) / 1000).toFixed(1)}s`;
  }

  return {
    weaponTitle,
    levelBadge,
    skillStatusText,
    isReady,
    accentColor,
  };
}

export function formatAmmoStatusText(
  ammo: number,
  maxAmmo: number,
  isReloading: boolean,
  isFeverActive: boolean
): string {
  if (isFeverActive) {
    return '🔥 FEVER UNLIMITED AMMO';
  }
  if (isReloading) {
    return '⚡ 자동 장전 중...';
  }
  return `${ammo} / ${maxAmmo}`;
}

export function formatFeverStatusBadge(
  feverGauge: number,
  isFeverReady: boolean,
  isFeverActive: boolean
): {
  label: string;
  isLocked: boolean;
  accentColor: string;
} {
  if (isFeverActive) {
    return {
      label: `🔥 FEVER ACTIVE (무한 탄창·점수 ${GAME_TUNING.fever.scoreMult}배·대미지 ${GAME_TUNING.judgment.feverDamage}배)`,
      isLocked: false,
      accentColor: '#ef4444',
    };
  }
  if (isFeverReady) {
    return {
      label: '🔒 FEVER LOCK 100%',
      isLocked: true,
      accentColor: '#fbbf24',
    };
  }
  return {
    label: `FEVER ${feverGauge}%`,
    isLocked: false,
    accentColor: '#38bdf8',
  };
}

export function formatActiveBuffBadge(buff: ActiveBuffState): {
  label: string;
  icon: string;
  percent: number;
  colorHex: string;
  timeSecText: string;
} {
  const spec = ITEM_BUFF_SPECS[buff.kind];
  if (!spec) {
    return {
      label: buff.kind,
      icon: '✨',
      percent: 100,
      colorHex: '#38bdf8',
      timeSecText: '',
    };
  }

  const percent = Math.max(0, Math.min(100, (buff.remainingMs / (buff.totalDurationMs || 8000)) * 100));
  const timeSecText = `${(buff.remainingMs / 1000).toFixed(1)}s`;

  return {
    label: spec.shortLabel,
    icon: spec.icon,
    percent,
    colorHex: spec.auraColorHex,
    timeSecText,
  };
}

export interface ArcadeOverlayHUDProps {
  lives: number;
  maxLives?: number;
  wave: number;
  totalWaves?: number;
  bosses?: BossHudInfo[];
  activeBuffs?: ActiveBuffState[];
  waveProgress?: WaveProgressInfo;
  players: PlayerHudSnapshot[];
  presentations: PlayerPresentation[];
  team: { livesTitle: string };
  onOpenGuide?: () => void;
  onPause?: () => void;
}

/** 적용 중인 패시브 카드와 누적 수. 없으면 그리지 않는다. */
export const PassiveCardBar: React.FC<{ cards: PassiveCardStack[] }> = ({ cards }) => {
  if (cards.length === 0) return null;
  return (
    <div data-testid="passive-card-bar" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {cards.map((c) => (
        <div
          key={c.kind}
          title={REWARD_CARD_SPECS[c.kind].nameKo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '8px',
            background: 'rgba(17, 24, 39, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            fontSize: '13px',
            fontWeight: 800,
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{REWARD_CARD_SPECS[c.kind].icon}</span>
          <span>×{c.count}</span>
        </div>
      ))}
    </div>
  );
};

export const ArcadeOverlayHUD: React.FC<ArcadeOverlayHUDProps> = ({
  lives,
  maxLives = STAGE_CONSTANTS.PLAYER_MAX_LIVES,
  wave,
  totalWaves = STAGE_CONSTANTS.TOTAL_WAVES,
  bosses = [],
  activeBuffs = [],
  waveProgress,
  players,
  presentations,
  team,
  onOpenGuide,
  onPause,
}) => {
  const teamBuffs = activeBuffs.filter((b) => b.kind === 'ice_freeze');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 32px',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* TOP-LEFT: Lives (BAR DEFENSE) */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
              {team.livesTitle}:
            </span>
            {Array.from({ length: maxLives }).map((_, i) => (
              <span
                key={i}
                style={{
                  fontSize: '20px',
                  opacity: i < lives ? 1 : 0.22,
                  transition: 'opacity 0.2s',
                }}
              >
                🍺
              </span>
            ))}
          </div>
          {waveProgress && waveProgress.luckyDropMultiplier > 1 && (
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#c084fc',
                background: 'rgba(168, 85, 247, 0.2)',
                padding: '2px 6px',
                borderRadius: '6px',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                alignSelf: 'flex-start',
              }}
            >
              🍀 아이템 드롭 {waveProgress.luckyDropMultiplier}배
            </div>
          )}
        </div>

        {/* TOP-CENTER: Wave Badge & Boss Health Bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              background: 'rgba(17, 24, 39, 0.96)',
              border: '2px solid #f59e0b',
              borderRadius: '20px',
              padding: '6px 24px',
              fontWeight: 900,
              fontSize: '17px',
              color: '#f59e0b',
              letterSpacing: '1px',
            }}
          >
            WAVE {wave} / {totalWaves}
          </div>

          {/* Compact Wave Progress Bar */}
          {waveProgress && getWaveHudMode(bosses.length).showProgressBar && (
            <div
              style={{
                width: '320px',
                background: 'rgba(17, 24, 39, 0.96)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '4px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#94a3b8',
                }}
              >
                <span>WAVE 진행도</span>
                <span>
                  {waveProgress.killedInWave} / {waveProgress.totalSpawns}
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${waveProgress.progressPercent}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    transition: 'width 0.15s ease-out',
                  }}
                />
              </div>
            </div>
          )}

          {/* Boss Health Bar (Boss Encounters) */}
          {bosses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {bosses.map((boss) => {
                const roleColor = boss.role === 'king' ? '#ef4444' : '#06b6d4';
                const roleBadge = boss.role === 'king' ? '👑 BEER KING' : '🧊 COOLER';
                return (
                  <div
                    key={boss.id}
                    style={{
                      width: '380px',
                      background: 'rgba(17, 24, 39, 0.96)',
                      border: `2px solid ${roleColor}`,
                      borderRadius: '12px',
                      padding: '8px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        fontWeight: 900,
                        color: roleColor,
                      }}
                    >
                      <span>{roleBadge}</span>
                      <span>
                        {boss.hp} / {boss.maxHp} HP
                      </span>
                    </div>
                    <div
                      style={{
                        height: '12px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100))}%`,
                          background: `linear-gradient(90deg, ${roleColor}, #f59e0b)`,
                          transition: 'width 0.15s ease-out',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Buttons and Team Buff Status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                style={{
                  background: 'rgba(17, 24, 39, 0.92)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  color: '#fbbf24',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📖</span> 가이드
              </button>
            )}

            {onPause && (
              <button
                onClick={onPause}
                style={{
                  background: 'rgba(17, 24, 39, 0.92)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>⏸</span> 일시정지 (Esc)
              </button>
            )}
          </div>

          {/* Active Team Buffs (e.g. Ice Freeze) */}
          {teamBuffs.map((buff) => {
            const b = formatActiveBuffBadge(buff);
            return (
              <div
                key={buff.kind}
                style={{
                  background: 'rgba(17, 24, 39, 0.96)',
                  border: `1px solid ${b.colorHex}`,
                  borderRadius: '12px',
                  padding: '6px 12px',
                  minWidth: '160px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>{b.icon}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: b.colorHex,
                    }}
                  >
                    <span>{b.label}</span>
                    <span>{b.timeSecText}</span>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${b.percent}%`,
                        background: b.colorHex,
                        transition: 'width 0.1s linear',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM PANELS: Each player gets a PlayerPanel positioned at bottom-left / bottom-right */}
      {players.map((s, i) => (
        <PlayerPanel
          key={s.index}
          snapshot={s}
          presentation={presentations[i]}
        />
      ))}
    </div>
  );
};
