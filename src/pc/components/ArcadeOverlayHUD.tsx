import React from 'react';
import { ActiveBuffState, PlayerProfile, TargetKind, WeaponKind, WeaponLevel } from '../../shared/types';
import { ITEM_BUFF_SPECS, STAGE_CONSTANTS, WEAPON_ARCHETYPE_SPECS } from '../../shared/constants';
import { ActiveTargetEntity, WaveProgressInfo } from '../engine/BeerCrusherEngine';

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
 * D03 Specification:
 * - 1HP air cans ('pilgood', 'caslight') and items/projectiles return false to reduce HUD clutter
 * - Multi-hit monsters with maxHp >= 2 ('obi: 2', 'hanmac: 3', 'bottle: 4', 'boss: 60') return true
 */
export function shouldRenderMonsterHpBar(
  maxHp: number,
  isItem?: boolean,
  isProjectile?: boolean
): boolean {
  if (isItem || isProjectile) return false;
  return maxHp >= 2;
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
    skillStatusText = `⚡ SKILL READY!${stockBadge} [위로 휙! / R키]`;
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
    return '⚡ 자동 장전 중 (1.2s)...';
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
      label: '🔥 FEVER MODE ACTIVE (무한 연사 & 2배 데미지)',
      isLocked: false,
      accentColor: '#f59e0b',
    };
  }

  if (isFeverReady || feverGauge >= 100) {
    return {
      label: '🔥 LOCK 100% — READY! (더블탭/Space로 발동)',
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
  feverGauge: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
  bossEntity?: ActiveTargetEntity;
  activeBuffs?: ActiveBuffState[];
  waveProgress?: WaveProgressInfo;
  monsterProjections?: MonsterHudProjection[];
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
  skillStock?: number;
  maxSkillStock?: number;
  skillCooldownRemainingMs?: number;
  onOpenGuide?: () => void;
}

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
  feverGauge,
  isFeverReady,
  isFeverActive,
  bossEntity,
  activeBuffs = [],
  waveProgress,
  monsterProjections = [],
  weaponKind = 'shotgun',
  weaponLevel = 1,
  skillStock = 1,
  maxSkillStock = 1,
  skillCooldownRemainingMs = 0,
  onOpenGuide,
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
      {/* 3D TRACKING MONSTER NEON DOT HP BARS */}
      {monsterProjections.map((proj) => {
        if (!shouldRenderMonsterHpBar(proj.maxHp, proj.isItem, proj.isProjectile)) return null;
        if (proj.leftPercent < -5 || proj.leftPercent > 105 || proj.topPercent < -5 || proj.topPercent > 105) return null;

        const hpRatio = Math.max(0, Math.min(1, proj.hp / proj.maxHp));
        const color = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        const segments = Math.min(10, Math.ceil(proj.maxHp));
        const currentSegments = Math.round(hpRatio * segments);

        return (
          <div
            key={proj.id}
            style={{
              position: 'absolute',
              left: `${proj.leftPercent}%`,
              top: `${proj.topPercent}%`,
              transform: 'translate(-50%, -100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
              zIndex: 10,
            }}
          >
            {/* Status tags */}
            {(proj.isStunned || proj.isSlowed) && (
              <div style={{ display: 'flex', gap: '3px', marginBottom: '1px' }}>
                {proj.isStunned && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 900,
                      color: '#111827',
                      background: '#fbbf24',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    ⚡STUN
                  </span>
                )}
                {proj.isSlowed && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 900,
                      color: '#111827',
                      background: '#67e8f9',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    ❄️SLOW
                  </span>
                )}
              </div>
            )}

            {/* Neon Segments Dot Bar */}
            <div
              style={{
                display: 'flex',
                gap: '2.5px',
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '2px 4px',
                borderRadius: '5px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              {Array.from({ length: segments }).map((_, segIdx) => {
                const filled = segIdx < currentSegments;
                return (
                  <div
                    key={segIdx}
                    style={{
                      width: segments <= 4 ? '10px' : '7px',
                      height: '5px',
                      borderRadius: '2px',
                      background: filled ? color : 'rgba(255, 255, 255, 0.15)',
                      boxShadow: filled ? `0 0 6px ${color}` : 'none',
                      transition: 'background 0.1s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* TOP-LEFT: Player Badge, Score, Combo, Lives */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
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
            {combo > 0 && (
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#fbbf24',
                  background: 'rgba(245, 158, 11, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                }}
              >
                {combo} COMBO ({comboMultiplier.toFixed(1)}x)
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
                  filter: i < lives ? 'none' : 'grayscale(1)',
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
              background: 'rgba(17, 24, 39, 0.88)',
              border: '2px solid #f59e0b',
              borderRadius: '20px',
              padding: '6px 24px',
              fontWeight: 900,
              fontSize: '17px',
              color: '#f59e0b',
              boxShadow: '0 0 18px rgba(245, 158, 11, 0.45)',
              letterSpacing: '1px',
            }}
          >
            WAVE {wave} / {totalWaves}
          </div>

          {/* Compact Wave Progress Bar */}
          {waveProgress && (
            <div
              style={{
                width: '320px',
                background: 'rgba(17, 24, 39, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '4px 8px',
                boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)',
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
                <span>{waveProgress.progressPercent}% (남은 적 {waveProgress.remainingInWave})</span>
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
                    boxShadow: '0 0 8px rgba(245, 158, 11, 0.7)',
                    borderRadius: '4px',
                    transition: 'width 0.25s ease-out',
                  }}
                />
              </div>
            </div>
          )}

          {bossEntity && (
            <div
              style={{
                width: '420px',
                background: 'rgba(17, 24, 39, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(239, 68, 68, 0.7)',
                borderRadius: '12px',
                padding: '10px 14px',
                boxShadow: '0 0 24px rgba(239, 68, 68, 0.35)',
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
                }}
              >
                <span>🧊 BOSS: 업소용 생맥주 냉각기</span>
                <span>
                  HP {bossEntity.hp} / {bossEntity.maxHp}
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
                    width: `${Math.max(0, (bossEntity.hp / bossEntity.maxHp) * 100)}%`,
                    background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
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
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              style={{
                pointerEvents: 'auto',
                background: 'rgba(17, 24, 39, 0.88)',
                backdropFilter: 'blur(8px)',
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
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                marginBottom: '4px',
              }}
            >
              📖 가이드 & 도감
            </button>
          )}

          {activeBuffs.map((buff) => {
            const badge = formatActiveBuffBadge(buff);
            return (
              <div
                key={buff.kind}
                style={{
                  background: 'rgba(17, 24, 39, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: `1.5px solid ${badge.colorHex}`,
                  borderRadius: '12px',
                  padding: '8px 14px',
                  width: '210px',
                  boxShadow: `0 0 14px ${badge.colorHex}55`,
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
        {/* BOTTOM-LEFT: Weapon Archetype, Dynamic Ammo & Active Skill Badge */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '16px',
            padding: '14px 20px',
            minWidth: '290px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
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
                      boxShadow: filled
                        ? isFeverActive
                          ? '0 0 8px #fbbf24'
                          : `0 0 6px ${skillBadge.accentColor}`
                        : 'none',
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
                  boxShadow: `0 0 8px ${skillBadge.accentColor}`,
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

        {/* BOTTOM-RIGHT: Fever Gauge & Lock Badge */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.8)',
            backdropFilter: 'blur(8px)',
            border: feverBadge.isLocked ? '2px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px 20px',
            width: '320px',
            boxShadow: feverBadge.isLocked
              ? '0 0 24px rgba(251, 191, 36, 0.45)'
              : '0 8px 24px rgba(0, 0, 0, 0.45)',
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
                boxShadow: feverBadge.isLocked ? '0 0 12px #fbbf24' : 'none',
                transition: isFeverActive ? 'none' : 'width 0.25s',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
