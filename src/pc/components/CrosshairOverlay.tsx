import React, { useEffect, useLayoutEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { WeaponKind, WeaponLevel } from '../../shared/types';
import { aimToViewportPercent, aimToNdc, viewportRatioToAim } from '../aimMapping';
import { clampToViewport } from '../overlayClamp';
import {
  ScopeGaugeInput,
  computeScopeGauges,
  describeArc,
  filledArcRange,
  polarPoint,
  SCOPE_GAUGE_COLORS,
  ArcSpec,
} from './scopeGauges';

export { aimToViewportPercent, aimToNdc, viewportRatioToAim };

export interface CrosshairVisualSpecOptions {
  isFeverActive?: boolean;
  isWideScopeActive?: boolean;
  isPowerShotActive?: boolean;
  isAimLocked?: boolean;
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
  playerColor?: string;
  nameTag?: string;
}

export function formatCrosshairNameTag(
  kind: WeaponKind,
  level: number,
  slotLabel: string | null
): string {
  const weaponLabel = kind.toUpperCase();
  const levelLabel = level === 4 ? 'Lv.MAX' : `Lv.${level}`;
  if (slotLabel) {
    return `${slotLabel} · ${weaponLabel} ${levelLabel}`;
  }
  return `${weaponLabel} ${levelLabel}`;
}

export function computeCrosshairVisualSpec(options: CrosshairVisualSpecOptions): {
  sizePx: number;
  ringSizePx: number;
  primaryColor: string;
  glowColor: string;
  badgeText?: string;
  isLocked?: boolean;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
} {
  const isWide = Boolean(options.isWideScopeActive);
  const isPower = Boolean(options.isPowerShotActive);
  const isFever = Boolean(options.isFeverActive);
  const isLocked = Boolean(options.isAimLocked);
  const weaponKind = options.weaponKind ?? 'shotgun';
  const weaponLevel = options.weaponLevel ?? 1;

  let sizePx = isWide ? 140 : 88;
  let ringSizePx = isWide ? 112 : 68;
  let primaryColor = '#38bdf8';
  let glowColor = 'rgba(56, 189, 248, 0.45)';

  if (options.weaponKind === 'shotgun') {
    // 🪠 Large pellet spread ring (120px base)
    sizePx = isWide ? 164 : 120;
    ringSizePx = isWide ? 144 : 104;
    primaryColor = '#f59e0b'; // Amber Orange
    glowColor = 'rgba(245, 158, 11, 0.45)';
  } else if (options.weaponKind === 'revolver') {
    // 🍾 Precision sniper crosshair (76px base)
    sizePx = isWide ? 104 : 76;
    ringSizePx = isWide ? 64 : 48;
    primaryColor = '#fbbf24'; // Warm Gold
    glowColor = 'rgba(251, 191, 36, 0.55)';
  } else if (options.weaponKind === 'gatling') {
    // 🍺 High-RPM Rotary turbine reticle (88px base)
    sizePx = isWide ? 120 : 88;
    ringSizePx = isWide ? 88 : 64;
    primaryColor = '#38bdf8'; // Electric Cyan
    glowColor = 'rgba(56, 189, 248, 0.45)';
  }

  let badgeText: string | undefined;

  if (isFever) {
    primaryColor = '#fbbf24';
    glowColor = 'rgba(251, 191, 36, 0.55)';
    badgeText = 'FEVER UNLIMITED';
  } else if (isPower) {
    primaryColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.55)';
    badgeText = 'POWER 2X';
  } else if (isLocked) {
    primaryColor = '#10b981';
    glowColor = 'rgba(16, 185, 129, 0.65)';
    badgeText = 'AIM LOCKED';
  } else if (isWide) {
    badgeText = 'WIDE 1.6X';
  }

  if (options.playerColor) {
    primaryColor = options.playerColor;
    glowColor = options.playerColor.startsWith('#')
      ? `${options.playerColor}99`
      : options.playerColor;
  }

  return {
    sizePx,
    ringSizePx,
    primaryColor,
    glowColor,
    badgeText,
    isLocked,
    weaponKind,
    weaponLevel,
  };
}

export const getCrosshairVisualSpec = computeCrosshairVisualSpec;

export interface ReloadRingSpec {
  visible: boolean;
  diameterPx: number;
  radiusPx: number;
  durationMs: number;
  color: string;
  strokeWidthPx: number;
  outlineWidthPx: number;
  /** 링 바깥 조준점의 투명도. 링이 보일 때 0.45, 아니면 1. */
  reticleOpacity: number;
}

/** 장전 게이지 링을 그릴지와 크기를 정한다. 피버(무한 탄약) 중에는 장전이 없으므로 그리지 않는다. */
export function getReloadRingSpec(options: {
  isReloading?: boolean;
  isFeverActive?: boolean;
  reloadDurationMs?: number;
  sizePx: number;
}): ReloadRingSpec {
  const durationMs = options.reloadDurationMs ?? 0;
  const diameterPx = options.sizePx + 16;
  const outlineWidthPx = 12;
  // 외곽선 절반만큼 안쪽에 그려야 SVG 밖으로 잘리지 않는다.
  const radiusPx = diameterPx / 2 - outlineWidthPx / 2;
  const visible = Boolean(options.isReloading) && !options.isFeverActive && durationMs > 0;
  return {
    visible,
    diameterPx,
    radiusPx,
    durationMs,
    color: '#f87171',
    strokeWidthPx: 8,
    outlineWidthPx,
    reticleOpacity: visible ? 0.45 : 1,
  };
}

/**
 * 링 애니메이션 길이와 시작 지연. HUD는 100ms 주기로 갱신되므로 링은 장전이 시작된 뒤에야 마운트될 수 있다.
 * 이미 지난 만큼은 음수 지연으로 건너뛰어 실제 장전 종료 시각에 맞춰 가득 찬다.
 */
export function computeReloadRingTiming(
  startDurationMs: number,
  remainingMs: number | undefined
): { durationMs: number; delayMs: number } {
  const duration = Number.isFinite(startDurationMs) ? Math.max(0, startDurationMs) : 0;
  if (remainingMs === undefined || !Number.isFinite(remainingMs)) return { durationMs: duration, delayMs: 0 };
  const remaining = Math.min(duration, Math.max(0, remainingMs));
  return { durationMs: duration, delayMs: remaining - duration };
}

/**
 * 장전 게이지 링. 장전 중에만 마운트되므로 마운트 시점의 길이·남은 시간을 한 번 고정한다.
 * (장전 도중 rapid_reload 카드를 받아도 진행 중인 장전은 처음 길이로 끝나므로 링도 그대로 둔다.)
 */
const ReloadRing: React.FC<{
  spec: ReloadRingSpec;
  getRemainingMs?: () => number;
  isPaused: boolean;
}> = ({ spec, getRemainingMs, isPaused }) => {
  const [timing] = useState(() => computeReloadRingTiming(spec.durationMs, getRemainingMs?.()));
  const center = spec.diameterPx / 2;
  return (
    <svg
      width={spec.diameterPx}
      height={spec.diameterPx}
      style={{ position: 'absolute', transform: 'rotate(-90deg)', pointerEvents: 'none' }}
      aria-hidden
    >
      <circle cx={center} cy={center} r={spec.radiusPx} fill="none" stroke="rgba(0,0,0,0.85)" strokeWidth={spec.outlineWidthPx} />
      <circle cx={center} cy={center} r={spec.radiusPx} fill="none" stroke="rgba(248,113,113,0.35)" strokeWidth={spec.strokeWidthPx} />
      <circle
        cx={center}
        cy={center}
        r={spec.radiusPx}
        fill="none"
        stroke={spec.color}
        strokeWidth={spec.strokeWidthPx}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        style={{
          animation: `reload-ring-fill ${timing.durationMs}ms linear ${timing.delayMs}ms forwards`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      />
    </svg>
  );
};

/** 장전 링(반지름 약 sizePx/2+2, 두께 12) 바깥에 그린다. */
export function getScopeGaugeRadius(sizePx: number): number {
  return sizePx / 2 + 14;
}

const GaugeArc: React.FC<{ c: number; r: number; arc: ArcSpec; color: string; fromEnd?: boolean }> = ({ c, r, arc, color, fromEnd }) => {
  const [a0, a1] = filledArcRange(arc, fromEnd);
  const filled = describeArc(c, c, r, a0, a1);
  return (
    <>
      <path d={describeArc(c, c, r, arc.startDeg, arc.endDeg)} stroke={SCOPE_GAUGE_COLORS.track} strokeWidth={3} fill="none" strokeLinecap="round" />
      {filled && (
        <path
          d={filled}
          stroke={color}
          strokeWidth={arc.flash ? 4 : 3}
          fill="none"
          strokeLinecap="round"
          className={arc.flash || arc.warn ? 'scope-gauge-flash' : undefined}
        />
      )}
    </>
  );
};

/** 조준경 링 게이지(playtest-feedback D08). */
const ScopeGauges: React.FC<{ input: ScopeGaugeInput; sizePx: number }> = ({ input, sizePx }) => {
  const g = computeScopeGauges(input);
  const r = getScopeGaugeRadius(sizePx);
  const size = r * 2 + 24;
  const c = size / 2;
  return (
    <svg width={size} height={size} data-testid="scope-gauges" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden>
      {g.ammo && (
        <GaugeArc c={c} r={r} arc={g.ammo} color={g.ammo.warn ? SCOPE_GAUGE_COLORS.warn : SCOPE_GAUGE_COLORS.ammo} />
      )}
      <GaugeArc c={c} r={r} arc={g.skill} color={SCOPE_GAUGE_COLORS.skill} fromEnd />
      <GaugeArc c={c} r={r} arc={g.fever} color={SCOPE_GAUGE_COLORS.fever} />
      {Array.from({ length: g.skillDots.total }, (_, i) => {
        const [x, y] = polarPoint(c, c, r + 9, 215 + i * 22);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill={i < g.skillDots.filled ? SCOPE_GAUGE_COLORS.skill : SCOPE_GAUGE_COLORS.track}
            data-testid={i < g.skillDots.filled ? 'scope-skill-dot-on' : 'scope-skill-dot-off'}
          />
        );
      })}
    </svg>
  );
};

export interface CrosshairOverlayHandle {
  updatePosition: (aimX: number, aimY: number, immediate?: boolean) => void;
  /** 발사 반동 연출(120ms). 부모 리렌더 없이 직접 호출한다. */
  kick: () => void;
}

export interface CrosshairOverlayProps {
  aimX: number;
  aimY: number;
  isFeverActive?: boolean;
  isWideScopeActive?: boolean;
  isPowerShotActive?: boolean;
  isAimLocked?: boolean;
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
  /** 장전 중이면 true. 피버 중에는 링을 그리지 않는다. */
  isReloading?: boolean;
  /** 링이 차오르는 시간(ms). HudSnapshot.reloadDurationMs. */
  reloadDurationMs?: number;
  /** 일시정지·카드 선택 중이면 true: 링 애니메이션을 멈춘다. */
  isPaused?: boolean;
  /** 장전 종료까지 남은 시간(ms). 링이 마운트될 때 한 번만 읽는다(스냅샷에 매 프레임 값을 넣지 않기 위해). */
  getReloadRemainingMs?: () => number;
  playerColor?: string;
  nameTag?: string;
  hidden?: boolean;
  /**
   * 조준경 링 게이지 값(탄창·스킬·피버). 실전 십자선에만 넘긴다.
   * HUD 스냅샷의 플레이어 객체를 그대로 넘기면 값이 같을 때 참조도 같아 memo가 유지된다.
   */
  gaugeSource?: ScopeGaugeInput;
  /** 'menu': 로비·결과 화면용. 이름표 없이 작고 반투명하게 그려 화면 글자를 가리지 않는다. */
  variant?: 'play' | 'menu';
}

export const CrosshairOverlay = React.memo(
  forwardRef<CrosshairOverlayHandle, CrosshairOverlayProps>(({
    aimX,
    aimY,
    isFeverActive = false,
    isWideScopeActive = false,
    isPowerShotActive = false,
    isAimLocked = false,
    weaponKind = 'shotgun',
    weaponLevel = 1,
    isReloading = false,
    reloadDurationMs = 0,
    isPaused = false,
    getReloadRemainingMs,
    playerColor,
    nameTag,
    hidden = false,
    variant = 'play',
    gaugeSource,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetPosRef = useRef({ x: aimX, y: aimY });
    const currentPosRef = useRef({ x: aimX, y: aimY });
    const hasInitialPosRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
    const spec = computeCrosshairVisualSpec({
      isFeverActive,
      isWideScopeActive,
      isPowerShotActive,
      isAimLocked,
      weaponKind,
      weaponLevel,
      playerColor,
      nameTag,
    });

    // Kick feedback is written straight to the DOM: a React state flip per shot would commit twice per shot.
    const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const kickScaleRef = useRef(1.0);

    const nameTagRef = useRef<HTMLElement>(null);

    // 십자선이 화면 가장자리에 있으면 이름표만 안쪽으로 민다(링은 그대로).
    const clampNameTag = useCallback((leftPercent: number) => {
      const tag = nameTagRef.current;
      const parent = containerRef.current?.offsetParent as HTMLElement | null;
      if (!tag || !parent) return;
      const viewportW = parent.clientWidth;
      if (viewportW <= 0) return;
      const centerX = (leftPercent / 100) * viewportW;
      const tagW = tag.offsetWidth;
      const shift = clampToViewport(centerX, tagW, viewportW) - (centerX - tagW / 2);
      tag.style.transform = `translateX(calc(-50% + ${shift}px))`;
    }, []);

    const applyDomPosition = useCallback((curX: number, curY: number) => {
      if (containerRef.current) {
        const pos = aimToViewportPercent(curX, curY);
        containerRef.current.style.left = `${pos.leftPercent}%`;
        containerRef.current.style.top = `${pos.topPercent}%`;
        clampNameTag(pos.leftPercent);
      }
    }, [clampNameTag]);

    useLayoutEffect(() => {
      clampNameTag(leftPercent);
    });

    useImperativeHandle(
      ref,
      () => ({
        kick() {
          const el = containerRef.current;
          if (!el) return;
          el.style.transform = `translate(-50%, -50%) scale(${kickScaleRef.current})`;
          if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
          kickTimerRef.current = setTimeout(() => {
            kickTimerRef.current = null;
            if (containerRef.current) containerRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
          }, 120);
        },
        updatePosition(nextAimX: number, nextAimY: number, immediate = true) {
          targetPosRef.current = { x: nextAimX, y: nextAimY };

          if (
            immediate ||
            !hasInitialPosRef.current ||
            typeof window === 'undefined' ||
            typeof window.requestAnimationFrame !== 'function'
          ) {
            currentPosRef.current = { x: nextAimX, y: nextAimY };
            hasInitialPosRef.current = true;
            if (rafIdRef.current !== null && typeof window !== 'undefined') {
              window.cancelAnimationFrame(rafIdRef.current);
              rafIdRef.current = null;
            }
            applyDomPosition(nextAimX, nextAimY);
            return;
          }

          if (rafIdRef.current === null) {
            lastTimeRef.current = performance.now();
            const tick = (now: number) => {
              const dtSec = Math.min(0.1, Math.max(0.001, (now - lastTimeRef.current) / 1000));
              lastTimeRef.current = now;
              const lerpFactor = Math.min(1, dtSec * 28);

              const cur = currentPosRef.current;
              const tgt = targetPosRef.current;
              const dx = tgt.x - cur.x;
              const dy = tgt.y - cur.y;
              const dist = Math.hypot(dx, dy);

              if (dist < 0.0005) {
                cur.x = tgt.x;
                cur.y = tgt.y;
                applyDomPosition(cur.x, cur.y);
                rafIdRef.current = null;
                return;
              }

              cur.x += dx * lerpFactor;
              cur.y += dy * lerpFactor;
              applyDomPosition(cur.x, cur.y);
              rafIdRef.current = window.requestAnimationFrame(tick);
            };
            rafIdRef.current = window.requestAnimationFrame(tick);
          }
        },
      }),
      [applyDomPosition]
    );

    useEffect(() => {
      return () => {
        if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
        if (rafIdRef.current !== null && typeof window !== 'undefined') {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }, []);

    kickScaleRef.current = spec.weaponKind === 'shotgun' ? 1.32 : spec.weaponKind === 'revolver' ? 0.90 : 1.20;

    const isMenu = variant === 'menu';
    const menuScale = isMenu ? 0.6 : 1;
    const cornerSize = spec.sizePx * 0.22;
    const ring = getReloadRingSpec({ isReloading, isFeverActive, reloadDurationMs, sizePx: spec.sizePx });

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${spec.sizePx}px`,
          height: `${spec.sizePx}px`,
          transform: 'translate(-50%, -50%) scale(1)',
          pointerEvents: 'none',
          opacity: isMenu ? 0.55 : undefined,
          display: hidden ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          transition: 'transform 0.08s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        }}
      >
        <div data-crosshair-variant={variant} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${menuScale})` }}>
        {/* Fixed keyframes (always mounted): crosshair-spin rotates the reticle rings (rotation only, no translate), reload-ring-fill uses pathLength=1. */}
        <style>{`@keyframes crosshair-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes reload-ring-fill { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } } @keyframes scope-gauge-flash { from { opacity: 0.45; } to { opacity: 1; } } .scope-gauge-flash { animation: scope-gauge-flash 0.7s ease-in-out infinite alternate; } @media (prefers-reduced-motion: reduce) { .scope-gauge-flash { animation: none; } }`}</style>

        {/* Reticle: dimmed while reloading. The ring stays outside so it keeps full brightness. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ring.reticleOpacity,
            transition: 'opacity 0.12s linear',
          }}
        >
        {/* 1. 🪠 SHOTGUN SPECIFIC HUD: Large Pellet Circle + 8-radial dots + Octagon Brackets */}
        {spec.weaponKind === 'shotgun' && (
          <>
            {/* Pellet Spread Outer Ring */}
            <div
              style={{
                position: 'absolute',
                width: `${spec.ringSizePx}px`,
                height: `${spec.ringSizePx}px`,
                borderRadius: '50%',
                border: `2px dashed ${spec.primaryColor}`,
                animation: isFeverActive ? 'crosshair-spin 2s linear infinite' : undefined,
              }}
            />

            {/* 8-Direction Pellet Spread Dots */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angleDeg) => {
              const rad = (angleDeg * Math.PI) / 180;
              const radius = spec.ringSizePx * 0.44;
              const dx = Math.cos(rad) * radius;
              const dy = Math.sin(rad) * radius;
              return (
                <div
                  key={angleDeg}
                  style={{
                    position: 'absolute',
                    transform: `translate(${dx}px, ${dy}px)`,
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: spec.primaryColor,
                  }}
                />
              );
            })}

            {/* Center Burst Pinpoint */}
            <div
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: spec.primaryColor,
              }}
            />
          </>
        )}

        {/* 2. 🍾 REVOLVER SPECIFIC HUD: Precision Crosshair + Center Dot + Vertical Pierce Line */}
        {spec.weaponKind === 'revolver' && (
          <>
            {/* Center Precision Circle */}
            <div
              style={{
                position: 'absolute',
                width: `${spec.ringSizePx}px`,
                height: `${spec.ringSizePx}px`,
                borderRadius: '50%',
                border: `1.5px solid ${spec.primaryColor}`,
              }}
            />

            {/* Vertical Pierce Ray Guide (Top/Bottom Extensions) */}
            <div
              style={{
                position: 'absolute',
                height: `${spec.sizePx * 1.5}px`,
                width: '2px',
                background: `linear-gradient(180deg, transparent, ${spec.primaryColor}, transparent)`,
              }}
            />
            {/* Horizontal Hairline */}
            <div
              style={{
                position: 'absolute',
                width: `${spec.sizePx * 0.9}px`,
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${spec.primaryColor}, transparent)`,
              }}
            />

            {/* Center 3px Pinpoint Laser Dot */}
            <div
              style={{
                position: 'absolute',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#ffffff',
              }}
            />
          </>
        )}

        {/* 3. 🍺 GATLING SPECIFIC HUD: Rotary Turbine Reticle + Spread Circle + Tri-Pin */}
        {spec.weaponKind === 'gatling' && (
          <>
            {/* Rotary Turbine Reticle Ring */}
            <div
              style={{
                position: 'absolute',
                width: `${spec.ringSizePx}px`,
                height: `${spec.ringSizePx}px`,
                borderRadius: '50%',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderLeftColor: spec.primaryColor,
                borderRightColor: spec.primaryColor,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                animation: isFeverActive ? 'crosshair-spin 0.6s linear infinite' : 'crosshair-spin 4s linear infinite',
              }}
            />

            {/* Central Spread Circle */}
            <div
              style={{
                position: 'absolute',
                width: `${spec.ringSizePx * 0.55}px`,
                height: `${spec.ringSizePx * 0.55}px`,
                borderRadius: '50%',
                border: `1.5px dashed ${spec.primaryColor}`,
                opacity: 0.8,
              }}
            />

            {/* 3-Point Turbine Pins (120° apart) */}
            {[0, 120, 240].map((angleDeg) => (
              <div
                key={angleDeg}
                style={{
                  position: 'absolute',
                  width: '2px',
                  height: `${spec.sizePx * 0.45}px`,
                  background: `linear-gradient(180deg, ${spec.primaryColor}, transparent)`,
                  transform: `rotate(${angleDeg}deg)`,
                  transformOrigin: '50% 50%',
                }}
              />
            ))}

            {/* Center Laser Dot */}
            <div
              style={{
                position: 'absolute',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: spec.primaryColor,
              }}
            />
          </>
        )}

        {/* 4 Corner Targeting Brackets ┌ ┐ └ ┘ */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${cornerSize}px`,
            height: `${cornerSize}px`,
            borderTop: `3px solid ${spec.primaryColor}`,
            borderLeft: `3px solid ${spec.primaryColor}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: `${cornerSize}px`,
            height: `${cornerSize}px`,
            borderTop: `3px solid ${spec.primaryColor}`,
            borderRight: `3px solid ${spec.primaryColor}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: `${cornerSize}px`,
            height: `${cornerSize}px`,
            borderBottom: `3px solid ${spec.primaryColor}`,
            borderLeft: `3px solid ${spec.primaryColor}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: `${cornerSize}px`,
            height: `${cornerSize}px`,
            borderBottom: `3px solid ${spec.primaryColor}`,
            borderRight: `3px solid ${spec.primaryColor}`,
          }}
        />

        {/* Name Tag (.xh em: 1P · SHOTGUN Lv.1 / SHOTGUN Lv.1) */}
        {nameTag && !isMenu && (
          <em
            ref={nameTagRef}
            data-testid="crosshair-nametag"
            style={{
              position: 'absolute',
              left: '50%',
              top: '-34px',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontStyle: 'normal',
              fontSize: '12px',
              fontWeight: 800,
              color: '#111',
              background: spec.primaryColor,
              padding: '2px 8px',
              borderRadius: '6px',
              zIndex: 2,
            }}
          >
            {nameTag}
          </em>
        )}

        {/* Buff or Weapon Level Badge on Top */}
        {!isMenu && (!nameTag || spec.badgeText) && (
          <div
            style={{
              position: 'absolute',
              top: nameTag ? '-58px' : '-24px',
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '1px',
              color: spec.primaryColor,
              background: 'rgba(0, 0, 0, 0.75)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${spec.primaryColor}`,
              whiteSpace: 'nowrap',
            }}
          >
            {spec.badgeText
              ? spec.badgeText
              : `${
                  spec.weaponKind === 'shotgun'
                    ? '🪠 SHOTGUN'
                    : spec.weaponKind === 'revolver'
                    ? '🍾 REVOLVER'
                    : '🍺 GATLING'
                } Lv.${spec.weaponLevel === 4 ? 'MAX' : spec.weaponLevel}`}
          </div>
        )}
        </div>

        {/* Reload progress ring: mounted only while reloading so the fill restarts from zero each time */}
        {ring.visible && <ReloadRing spec={ring} getRemainingMs={getReloadRemainingMs} isPaused={isPaused} />}
        {!isMenu && gaugeSource && <ScopeGauges input={gaugeSource} sizePx={spec.sizePx} />}
        </div>
      </div>
    );
  })
);
