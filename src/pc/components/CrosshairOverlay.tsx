import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

export function aimToViewportPercent(
  aimX: number,
  aimY: number
): { leftPercent: number; topPercent: number } {
  // Clamps within [8%, 92%] horizontally and [10%, 90%] vertically
  const left = 50 + Math.max(-1, Math.min(1, aimX)) * 42;
  const top = 50 - Math.max(-1, Math.min(1, aimY)) * 38;

  return {
    leftPercent: Math.max(8, Math.min(92, left)),
    topPercent: Math.max(10, Math.min(90, top)),
  };
}

export function aimToNdc(aimX: number, aimY: number): { ndcX: number; ndcY: number } {
  const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
  return {
    ndcX: (leftPercent - 50) / 50, // [-0.84, +0.84]
    ndcY: (50 - topPercent) / 50,  // [-0.76, +0.76]
  };
}

export function viewportRatioToAim(normX: number, normY: number): { aimX: number; aimY: number } {
  // normX, normY in [-1, 1] from mouse screen events -> mapped so crosshair sits directly under cursor
  return {
    aimX: Math.max(-1, Math.min(1, normX / 0.84)),
    aimY: Math.max(-1, Math.min(1, normY / 0.76)),
  };
}

export interface CrosshairVisualSpecOptions {
  isFeverActive?: boolean;
  isWideScopeActive?: boolean;
  isPowerShotActive?: boolean;
}

export function getCrosshairVisualSpec(options: CrosshairVisualSpecOptions): {
  sizePx: number;
  ringSizePx: number;
  primaryColor: string;
  glowColor: string;
  badgeText?: string;
} {
  const isWide = Boolean(options.isWideScopeActive);
  const isPower = Boolean(options.isPowerShotActive);
  const isFever = Boolean(options.isFeverActive);

  const sizePx = isWide ? 140 : 88;
  const ringSizePx = isWide ? 112 : 68;

  let primaryColor = '#38bdf8';
  let glowColor = 'rgba(56, 189, 248, 0.45)';
  let badgeText: string | undefined;

  if (isPower) {
    primaryColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.55)';
    badgeText = 'POWER 2X';
  } else if (isFever) {
    primaryColor = '#fbbf24';
    glowColor = 'rgba(251, 191, 36, 0.55)';
    badgeText = 'FEVER UNLIMITED';
  } else if (isWide) {
    badgeText = 'WIDE 1.6X';
  }

  return {
    sizePx,
    ringSizePx,
    primaryColor,
    glowColor,
    badgeText,
  };
}

export interface CrosshairOverlayHandle {
  updatePosition: (aimX: number, aimY: number) => void;
}

export interface CrosshairOverlayProps {
  aimX: number;
  aimY: number;
  isFeverActive?: boolean;
  isWideScopeActive?: boolean;
  isPowerShotActive?: boolean;
  shotTriggerKey?: number;
}

export const CrosshairOverlay = React.memo(
  forwardRef<CrosshairOverlayHandle, CrosshairOverlayProps>(({
    aimX,
    aimY,
    isFeverActive = false,
    isWideScopeActive = false,
    isPowerShotActive = false,
    shotTriggerKey = 0,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
    const spec = getCrosshairVisualSpec({ isFeverActive, isWideScopeActive, isPowerShotActive });

    useImperativeHandle(
      ref,
      () => ({
        updatePosition(nextAimX: number, nextAimY: number) {
          if (containerRef.current) {
            const pos = aimToViewportPercent(nextAimX, nextAimY);
            containerRef.current.style.left = `${pos.leftPercent}%`;
            containerRef.current.style.top = `${pos.topPercent}%`;
          }
        },
      }),
      []
    );

    const [isKicking, setIsKicking] = useState(false);

    useEffect(() => {
      if (shotTriggerKey > 0) {
        setIsKicking(true);
        const timer = setTimeout(() => setIsKicking(false), 120);
        return () => clearTimeout(timer);
      }
    }, [shotTriggerKey]);

    const cornerSize = spec.sizePx * 0.24;

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${spec.sizePx}px`,
          height: `${spec.sizePx}px`,
          transform: `translate(-50%, -50%) scale(${isKicking ? 1.28 : 1.0})`,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          transition: 'transform 0.08s ease-out',
        }}
      >
      {/* 4 Corner Targeting Brackets ┌ ┐ └ ┘ */}
      {/* Top-Left ┌ */}
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
      {/* Top-Right ┐ */}
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
      {/* Bottom-Left └ */}
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
      {/* Bottom-Right ┘ */}
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

      {/* Outer Aiming Ring */}
      <div
        style={{
          width: `${spec.ringSizePx}px`,
          height: `${spec.ringSizePx}px`,
          borderRadius: '50%',
          border: `2px dashed ${spec.primaryColor}`,
          boxShadow: `0 0 14px ${spec.glowColor}`,
          position: 'relative',
          opacity: 0.85,
          animation: isFeverActive ? 'spin 3s linear infinite' : undefined,
        }}
      />

      {/* Center Laser Dot */}
      <div
        style={{
          position: 'absolute',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: spec.primaryColor,
          boxShadow: `0 0 10px ${spec.primaryColor}`,
        }}
      />

      {/* Crosshair Horizontal & Vertical Laser Hairlines */}
      <div
        style={{
          position: 'absolute',
          width: `${spec.sizePx * 0.9}px`,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${spec.primaryColor}, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          height: `${spec.sizePx * 0.9}px`,
          width: '2px',
          background: `linear-gradient(180deg, transparent, ${spec.primaryColor}, transparent)`,
        }}
      />

      {/* Buff Badge Text on top */}
      {spec.badgeText && (
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
          {spec.badgeText}
        </div>
      )}
    </div>
  );
}));

