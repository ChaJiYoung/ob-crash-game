import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { WeaponKind, WeaponLevel } from '../../shared/types';

export function aimToViewportPercent(
  aimX: number,
  aimY: number
): { leftPercent: number; topPercent: number } {
  // Clamps within [3%, 97%] horizontally and [8%, 92%] vertically
  const left = 50 + Math.max(-1, Math.min(1, aimX)) * 47;
  const top = 50 - Math.max(-1, Math.min(1, aimY)) * 42;

  return {
    leftPercent: Math.max(3, Math.min(97, left)),
    topPercent: Math.max(8, Math.min(92, top)),
  };
}

export function aimToNdc(aimX: number, aimY: number): { ndcX: number; ndcY: number } {
  const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
  return {
    ndcX: (leftPercent - 50) / 50, // [-0.94, +0.94]
    ndcY: (50 - topPercent) / 50,  // [-0.84, +0.84]
  };
}

export function viewportRatioToAim(normX: number, normY: number): { aimX: number; aimY: number } {
  // normX, normY in [-1, 1] from mouse screen events -> mapped so crosshair sits directly under cursor
  return {
    aimX: Math.max(-1, Math.min(1, normX / 0.94)),
    aimY: Math.max(-1, Math.min(1, normY / 0.84)),
  };
}

export interface CrosshairVisualSpecOptions {
  isFeverActive?: boolean;
  isWideScopeActive?: boolean;
  isPowerShotActive?: boolean;
  isAimLocked?: boolean;
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
}

export function getCrosshairVisualSpec(options: CrosshairVisualSpecOptions): {
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

export interface CrosshairOverlayHandle {
  updatePosition: (aimX: number, aimY: number, immediate?: boolean) => void;
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
  shotTriggerKey?: number;
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
    shotTriggerKey = 0,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetPosRef = useRef({ x: aimX, y: aimY });
    const currentPosRef = useRef({ x: aimX, y: aimY });
    const hasInitialPosRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
    const spec = getCrosshairVisualSpec({
      isFeverActive,
      isWideScopeActive,
      isPowerShotActive,
      isAimLocked,
      weaponKind,
      weaponLevel,
    });

    const applyDomPosition = useCallback((curX: number, curY: number) => {
      if (containerRef.current) {
        const pos = aimToViewportPercent(curX, curY);
        containerRef.current.style.left = `${pos.leftPercent}%`;
        containerRef.current.style.top = `${pos.topPercent}%`;
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
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
        if (rafIdRef.current !== null && typeof window !== 'undefined') {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }, []);

    const [isKicking, setIsKicking] = useState(false);

    useEffect(() => {
      if (shotTriggerKey > 0) {
        setIsKicking(true);
        const timer = setTimeout(() => setIsKicking(false), 120);
        return () => clearTimeout(timer);
      }
    }, [shotTriggerKey]);

    const cornerSize = spec.sizePx * 0.22;

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${spec.sizePx}px`,
          height: `${spec.sizePx}px`,
          transform: `translate(-50%, -50%) scale(${
            isKicking
              ? spec.weaponKind === 'shotgun'
                ? 1.32
                : spec.weaponKind === 'revolver'
                ? 0.90
                : 1.20
              : 1.0
          })`,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          transition: 'transform 0.08s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
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
                boxShadow: `0 0 16px ${spec.glowColor}, inset 0 0 10px ${spec.glowColor}`,
                animation: isFeverActive ? 'spin 2s linear infinite' : undefined,
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
                    boxShadow: `0 0 8px ${spec.primaryColor}`,
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
                boxShadow: `0 0 12px ${spec.primaryColor}`,
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
                boxShadow: `0 0 12px ${spec.glowColor}`,
              }}
            />

            {/* Vertical Pierce Ray Guide (Top/Bottom Extensions) */}
            <div
              style={{
                position: 'absolute',
                height: `${spec.sizePx * 1.5}px`,
                width: '2px',
                background: `linear-gradient(180deg, transparent, ${spec.primaryColor}, transparent)`,
                boxShadow: `0 0 8px ${spec.glowColor}`,
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
                boxShadow: `0 0 8px ${spec.primaryColor}`,
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
                border: `2px solid ${spec.primaryColor}`,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                boxShadow: `0 0 14px ${spec.glowColor}`,
                animation: isKicking
                  ? 'spin 0.25s linear infinite'
                  : isFeverActive
                  ? 'spin 0.6s linear infinite'
                  : 'spin 4s linear infinite',
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
                boxShadow: `0 0 10px ${spec.primaryColor}`,
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
            boxShadow: `0 0 8px ${spec.glowColor}`,
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
            boxShadow: `0 0 8px ${spec.glowColor}`,
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
            boxShadow: `0 0 8px ${spec.glowColor}`,
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
            boxShadow: `0 0 8px ${spec.glowColor}`,
          }}
        />

        {/* Buff or Weapon Level Badge on Top */}
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            fontSize: '11px',
            fontWeight: '900',
            letterSpacing: '1px',
            color: spec.primaryColor,
            textShadow: `0 0 8px ${spec.primaryColor}`,
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
      </div>
    );
  })
);
