import React from 'react';
import { ActiveBuffState, PlayerProfile } from '../../shared/types';
import { ITEM_BUFF_SPECS, STAGE_CONSTANTS } from '../../shared/constants';
import { ActiveTargetEntity } from '../engine/BeerCrusherEngine';

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
}) => {
  const ammoText = formatAmmoStatusText(ammo, maxAmmo, isReloading, isFeverActive);
  const feverBadge = formatFeverStatusBadge(feverGauge, isFeverReady, isFeverActive);

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

        {/* TOP-RIGHT: Active Item Buffs Countdown Stack */}
        <div
          style={{
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
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
        {/* BOTTOM-LEFT: Magazine / Ammo Status */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px 20px',
            minWidth: '240px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: isReloading ? '#f87171' : isFeverActive ? '#fbbf24' : '#38bdf8',
              marginBottom: '8px',
            }}
          >
            {ammoText}
          </div>

          {/* 10 Bullets Indicator */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: maxAmmo }).map((_, idx) => {
              const filled = isFeverActive || idx < ammo;
              return (
                <div
                  key={idx}
                  style={{
                    width: '14px',
                    height: '24px',
                    borderRadius: '4px',
                    background: filled
                      ? isFeverActive
                        ? '#fbbf24'
                        : '#38bdf8'
                      : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: filled
                      ? isFeverActive
                        ? '0 0 8px #fbbf24'
                        : '0 0 6px #38bdf8'
                      : 'none',
                    transition: 'background 0.15s',
                  }}
                />
              );
            })}
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
