import React from 'react';
import { ActiveBuffState, PlayerProfile, TargetKind, WeaponKind, WeaponLevel } from '../../shared/types';
import { ITEM_BUFF_SPECS, REWARD_CARD_SPECS, STAGE_CONSTANTS, WEAPON_ARCHETYPE_SPECS } from '../../shared/constants';
import { PassiveCardStack, WaveProgressInfo } from '../engine/BeerCrusherEngine';
import type { BossHudInfo } from '../hudSnapshot';

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
  cooldownRemainingMs: number
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
    const stockBadge = maxSkillStock > 1 ? ` [★${skillStock}/${maxSkillStock}]` : '';
    skillStatusText = `⚡ SKILL READY!${stockBadge} [위로 휙! / 우클릭]`;
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
      label: '🔥 FEVER ACTIVE (무한 탄창·명중 점수 1.5배)',
      isLocked: false,
      accentColor: '#f59e0b',
    };
  }

  if (isFeverReady || feverGauge >= 100) {
    return {
      label: '🔥 LOCK 100% — READY! (더블클릭/더블탭으로 발동)',
      isLocked: true,
      accentColor: '#fbbf24',
    };
  }

  return {
    label: `FEVER GAUGE ${feverGauge}%`,
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
  player?: PlayerProfile;
  score: number;
  combo: number;
  comboMultiplier: number;
  lives: number;
  maxLives?: number;
  wave: number;
  totalWaves?: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  passiveCards?: PassiveCardStack[];
  feverGauge: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
  bosses?: BossHudInfo[];
  activeBuffs?: ActiveBuffState[];
  waveProgress?: WaveProgressInfo;
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
  skillStock?: number;
  maxSkillStock?: number;
  skillCooldownRemainingMs?: number;
  onOpenGuide?: () => void;
  onOpenSensorLab?: () => void;
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
  player,
  score,
  combo,
  comboMultiplier,
  lives,
  maxLives = STAGE_CONSTANTS.PLAYER_MAX_LIVES,
  wave,
  totalWaves = STAGE_CONSTANTS.TOTAL_WAVES,
  ammo,
  maxAmmo,
  isReloading,
  passiveCards = [],
  feverGauge,
  isFeverReady,
  isFeverActive,
  bosses = [],
  activeBuffs = [],
  waveProgress,
  weaponKind = 'shotgun',
  weaponLevel = 1,
  skillStock = 1,
  maxSkillStock = 1,
  skillCooldownRemainingMs = 0,
  onOpenGuide,
  onOpenSensorLab,
  onPause,
}) => {
  const ammoText = formatAmmoStatusText(ammo, maxAmmo, isReloading, isFeverActive);
  const feverBadge = formatFeverStatusBadge(feverGauge, isFeverReady, isFeverActive);
  const skillBadge = formatWeaponSkillBadge(
    weaponKind,
    weaponLevel,
    skillStock,
    maxSkillStock,
    skillCooldownRemainingMs
  );

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
        {/* TOP-LEFT: Player Badge, Score, Combo, Lives */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                background: '#f59e0b',
                color: '#111827',
                padding: '2px 8px',
                borderRadius: '6px',
              }}
            >
              PLAYER
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>
              {player ? player.nickname : 'PC 게이머'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '1px' }}>
              {score.toString().padStart(6, '0')}
            </span>
            {waveProgress && waveProgress.luckyDropMultiplier > 1 && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#c084fc',
                  background: 'rgba(168, 85, 247, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                }}
              >
                🍀 아이템 드롭 {waveProgress.luckyDropMultiplier}배
              </span>
            )}
          </div>

          {/* Defense Line Lives (5 Beer Mugs) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>BAR DEFENSE:</span>
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
                gap: '3px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#fbbf24',
                  letterSpacing: '0.5px',
                }}
              >
                <span>🎯 웨이브 토벌 {waveProgress.killedInWave}/{waveProgress.totalSpawns}</span>
                <span>{waveProgress.progressPercent}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${waveProgress.progressPercent}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    borderRadius: '4px',
                    transition: 'width 0.25s ease-out',
                  }}
                />
              </div>
            </div>
          )}

          {bosses.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {bosses.map((boss) => {
                const width = bosses.length === 1 ? 420 : bosses.length === 2 ? 240 : 200;
                const compact = bosses.length >= 3;
                const label =
                  boss.role === 'king' ? (compact ? '👑 대왕' : '👑 대왕 냉각기') : '🧊 냉각기';
                return (
                  <div
                    key={boss.id}
                    style={{
                      width: `${width}px`,
                      background: 'rgba(17, 24, 39, 0.96)',
                      border: '1px solid rgba(239, 68, 68, 0.7)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        fontWeight: 800,
                        color: '#ef4444',
                        marginBottom: '6px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{label}</span>
                      <span>
                        HP {boss.hp}/{boss.maxHp}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`,
                          background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Active Item Buffs Countdown Stack & Guide Button */}
        <div
          style={{
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
            {onOpenSensorLab && (
              <button
                onClick={onOpenSensorLab}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(17, 24, 39, 0.96)',
                  border: '1px solid rgba(16, 185, 129, 0.6)',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  color: '#34d399',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🎯 센서 진단
              </button>
            )}

            {onPause && (
              <button
                onClick={onPause}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(17, 24, 39, 0.96)',
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ⏸ 일시정지
              </button>
            )}

            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(17, 24, 39, 0.96)',
                  border: '1px solid rgba(245, 158, 11, 0.6)',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  color: '#fbbf24',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                📖 가이드 & 도감
              </button>
            )}
          </div>

          {activeBuffs.map((buff) => {
            const badge = formatActiveBuffBadge(buff);
            return (
              <div
                key={buff.kind}
                style={{
                  background: 'rgba(17, 24, 39, 0.96)',
                  border: `1.5px solid ${badge.colorHex}`,
                  borderRadius: '12px',
                  padding: '8px 14px',
                  width: '210px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: badge.colorHex }}>
                    {badge.icon} {badge.label}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                    {badge.timeSecText}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${badge.percent}%`,
                      background: badge.colorHex,
                      transition: 'width 0.1s linear',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        {/* BOTTOM-LEFT: Weapon Archetype, Dynamic Ammo & Active Skill Badge */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '16px',
            padding: '14px 20px',
            minWidth: '290px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Weapon Name & Lv Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  background: skillBadge.accentColor,
                  color: '#111827',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {skillBadge.levelBadge}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                {skillBadge.weaponTitle}
              </span>
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: isReloading ? '#f87171' : isFeverActive ? '#fbbf24' : '#94a3b8',
              }}
            >
              {ammoText}
            </span>
          </div>

          {/* Dynamic Magazine (Discrete Bullets <= 12 vs Gauge Bar > 12) */}
          {maxAmmo <= 12 ? (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {Array.from({ length: maxAmmo }).map((_, idx) => {
                const filled = isFeverActive || idx < ammo;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '12px',
                      height: '20px',
                      borderRadius: '3px',
                      background: filled
                        ? isFeverActive
                          ? '#fbbf24'
                          : skillBadge.accentColor
                        : 'rgba(255, 255, 255, 0.1)',
                      transition: 'background 0.15s',
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div
              style={{
                height: '10px',
                background: 'rgba(255, 255, 255, 0.12)',
                borderRadius: '5px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(ammo / maxAmmo) * 100}%`,
                  background: isFeverActive
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : `linear-gradient(90deg, #0284c7, ${skillBadge.accentColor})`,
                  transition: 'width 0.08s ease-out',
                }}
              />
            </div>
          )}

          {/* Active Skill Slot */}
          <div
            style={{
              marginTop: '2px',
              padding: '6px 10px',
              borderRadius: '8px',
              background: skillBadge.isReady ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${skillBadge.isReady ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: skillBadge.isReady ? '#fbbf24' : '#94a3b8',
                letterSpacing: '0.3px',
              }}
            >
              {skillBadge.skillStatusText}
            </span>
          </div>
        </div>

        <PassiveCardBar cards={passiveCards} />
        </div>

        {/* BOTTOM-RIGHT: Fever Gauge & Lock Badge */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.96)',
            border: feverBadge.isLocked ? '2px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px 20px',
            width: '320px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: feverBadge.accentColor,
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{feverBadge.label}</span>
            <span>{feverGauge}%</span>
          </div>

          <div
            style={{
              height: '14px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '7px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${feverGauge}%`,
                background: feverBadge.isLocked
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : isFeverActive
                  ? '#ef4444'
                  : 'linear-gradient(90deg, #06b6d4, #38bdf8)',
                transition: isFeverActive ? 'none' : 'width 0.25s',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
