import React, { useState } from 'react';
import type { PlayerHudSnapshot } from '../hudSnapshot';
import type { PlayerPresentation } from '../playerPresentation';
import { formatAmmoStatusText, formatWeaponSkillBadge } from './ArcadeOverlayHUD';
import { ITEM_BUFF_SPECS, REWARD_CARD_SPECS } from '../../shared/constants';
import { GAME_TUNING } from '../../shared/gameTuning';
import { computeReloadRingTiming } from './CrosshairOverlay';
import { SCOPE_GAUGE_COLORS } from './scopeGauges';

/** 패널 피버 상태 문구. */
export function formatPanelFeverText(isActive: boolean, isReady: boolean, gauge: number): string {
  if (isActive) return '⚡ FEVER TIME!';
  if (isReady) return 'FEVER READY';
  return `FEVER GAUGE ${gauge}%`;
}

/** 피버 중에만 보여 주는 실제 보너스 배율(튜닝 값). */
export function formatPanelFeverBonus(): string {
  return `점수 ${GAME_TUNING.fever.scoreMult}배 · 대미지 ${GAME_TUNING.judgment.feverDamage}배`;
}

export interface PlayerPanelProps {
  snapshot: PlayerHudSnapshot;
  /**
   * The HUD snapshot is taken on a tick while presentations follow the engine's current player count, so for one
   * render they can disagree (e.g. right after "continue alone"). A missing presentation renders nothing: throwing
   * here would unmount the whole PC page and drop its socket, which deletes the room.
   */
  presentation: PlayerPresentation | undefined;
  /** 일시정지·카드 선택 중이면 true: 장전 막대 애니메이션을 멈춘다. */
  isPaused?: boolean;
}

/**
 * 장전 중 탄창 줄 자리에 그리는 채움 막대. 장전 중에만 마운트되므로 마운트 시점의 남은 시간을 한 번 고정한다
 * (조준경의 장전 호와 같은 방식: 스냅샷이 100ms 주기라 늦게 마운트된 만큼은 음수 지연으로 건너뛴다).
 * 높이는 평소 줄(칸 18px, 막대 10px)과 같게 해서 장전 때 패널 높이가 흔들리지 않게 한다.
 */
const PanelReloadBar: React.FC<{ durationMs: number; endTimeMs: number; heightPx: number; isPaused: boolean }> = ({
  durationMs,
  endTimeMs,
  heightPx,
  isPaused,
}) => {
  const [timing] = useState(() => computeReloadRingTiming(durationMs, endTimeMs - performance.now()));
  return (
    <div
      data-testid="panel-reload-bar"
      style={{ height: `${heightPx}px`, background: 'rgba(255, 255, 255, 0.12)', borderRadius: '5px', overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          width: '100%',
          background: SCOPE_GAUGE_COLORS.reload,
          transformOrigin: 'left',
          animation: `panel-reload-fill ${timing.durationMs}ms linear ${timing.delayMs}ms forwards`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      />
    </div>
  );
};

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ snapshot, presentation, isPaused = false }) => {
  if (!presentation) return null;
  const skillBadge = formatWeaponSkillBadge(
    snapshot.weaponKind,
    snapshot.weaponLevel,
    snapshot.skillStock,
    snapshot.maxSkillStock,
    snapshot.skillCooldownRemainingMs,
    presentation.inputKind
  );
  const ammoText = formatAmmoStatusText(
    snapshot.ammo,
    snapshot.maxAmmo,
    snapshot.isReloading,
    snapshot.isFeverActive
  );

  const isLeft = presentation.panelSide === 'left';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: isLeft ? '24px' : undefined,
        right: !isLeft ? '24px' : undefined,
        width: '292px',
        padding: '16px 20px',
        background: 'rgba(17, 24, 39, 0.96)',
        border: `1px solid ${presentation.color}`,
        borderRadius: '16px',
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        opacity: snapshot.isAway ? 0.45 : 1,
        pointerEvents: 'none',
        zIndex: 50,
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <style>{'@keyframes panel-reload-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }'}</style>
      {/* 1st row: Slot Badge, Nickname, Away Tag, Score, Combo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {presentation.slotLabel && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 900,
                background: presentation.color,
                color: '#0f172a',
                padding: '2px 8px',
                borderRadius: '6px',
                flexShrink: 0,
              }}
            >
              {presentation.slotLabel}
            </span>
          )}
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {presentation.nickname ?? '플레이어'}
          </span>
          {snapshot.isAway && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                background: '#475569',
                color: '#cbd5e1',
                padding: '2px 6px',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              나감
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
            {snapshot.score.toLocaleString()}
          </span>
          {snapshot.combo > 1 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#fbbf24',
                marginTop: '3px',
              }}
            >
              {snapshot.combo} COMBO (x{snapshot.comboMultiplier.toFixed(1)})
            </span>
          )}
        </div>
      </div>

      {/* 2nd row: Weapon Name & Ammo */}
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
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
            {skillBadge.weaponTitle}
          </span>
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: snapshot.isReloading ? '#f87171' : snapshot.isFeverActive ? '#fbbf24' : '#94a3b8',
          }}
        >
          {ammoText}
        </span>
      </div>

      {/* 3rd row: Dynamic Magazine. 피버는 탄창을 채우지 않으므로 피버 중에도 실제 탄창을 보여 주고, 장전 중에는 막대가 차오른다. */}
      {snapshot.isReloading ? (
        <PanelReloadBar
          durationMs={snapshot.reloadDurationMs}
          endTimeMs={snapshot.reloadEndTimeMs}
          heightPx={snapshot.maxAmmo <= 12 ? 18 : 10}
          isPaused={isPaused}
        />
      ) : snapshot.maxAmmo <= 12 ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {Array.from({ length: snapshot.maxAmmo }).map((_, idx) => {
            const filled = idx < snapshot.ammo;
            return (
              <div
                key={idx}
                style={{
                  width: '12px',
                  height: '18px',
                  borderRadius: '3px',
                  background: filled ? skillBadge.accentColor : 'rgba(255, 255, 255, 0.1)',
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
              width: `${(snapshot.ammo / snapshot.maxAmmo) * 100}%`,
              background: `linear-gradient(90deg, #0284c7, ${skillBadge.accentColor})`,
              transition: 'width 0.08s ease-out',
            }}
          />
        </div>
      )}

      {/* 4th row: Active Skill Badge */}
      <div
        style={{
          padding: '6px 10px',
          borderRadius: '8px',
          background: snapshot.isAway
            ? 'rgba(71, 85, 105, 0.2)'
            : skillBadge.isReady
            ? 'rgba(245, 158, 11, 0.15)'
            : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${
            snapshot.isAway
              ? 'rgba(71, 85, 105, 0.4)'
              : skillBadge.isReady
              ? '#f59e0b'
              : 'rgba(255, 255, 255, 0.1)'
          }`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: snapshot.isAway ? '#94a3b8' : skillBadge.isReady ? '#fbbf24' : '#94a3b8',
            letterSpacing: '0.3px',
          }}
        >
          {snapshot.isAway ? '⏸ 정지됨' : skillBadge.skillStatusText}
        </span>
      </div>

      {/* 5th row: Fever Gauge Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 800,
            color: snapshot.isFeverActive
              ? '#ef4444'
              : snapshot.isFeverReady
              ? '#fbbf24'
              : '#38bdf8',
          }}
        >
          <span>
            {formatPanelFeverText(snapshot.isFeverActive, snapshot.isFeverReady, snapshot.feverGauge)}
          </span>
          <span>{snapshot.feverGauge}%</span>
        </div>
        {snapshot.isFeverActive && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#fca5a5', whiteSpace: 'nowrap' }}>
            {formatPanelFeverBonus()}
          </div>
        )}
        <div
          style={{
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${snapshot.feverGauge}%`,
              background: snapshot.isFeverActive
                ? '#ef4444'
                : snapshot.isFeverReady
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #0284c7, #38bdf8)',
              transition: snapshot.isFeverActive ? 'none' : 'width 0.25s',
            }}
          />
        </div>
      </div>

      {/* 6th row: Personal Buffs */}
      {snapshot.personalBuffs.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {snapshot.personalBuffs.map((buff) => {
            const spec = ITEM_BUFF_SPECS[buff.kind];
            const icon = spec?.icon ?? '✨';
            const remainingSec = Math.ceil(buff.remainingMs / 1000);
            return (
              <div
                key={buff.kind}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#f8fafc',
                }}
              >
                <span>{icon}</span>
                <span>{remainingSec}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 7th row: Passive Cards */}
      {snapshot.passiveCards.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {snapshot.passiveCards.map((card) => {
            const spec = REWARD_CARD_SPECS[card.kind];
            return (
              <div
                key={card.kind}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#e2e8f0',
                }}
              >
                <span>{spec?.icon ?? '🃏'}</span>
                <span>{spec?.nameKo ?? card.kind}</span>
                <span style={{ color: '#fbbf24', fontWeight: 900 }}>+{card.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
