import React from 'react';

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

export interface CrosshairOverlayProps {
  aimX: number;
  aimY: number;
  isFeverActive?: boolean;
}

export const CrosshairOverlay: React.FC<CrosshairOverlayProps> = ({
  aimX,
  aimY,
  isFeverActive = false,
}) => {
  const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
  const color = isFeverActive ? '#fbbf24' : '#38bdf8';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: '44px',
        height: '44px',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        transition: 'left 0.05s linear, top 0.05s linear',
      }}
    >
      {/* Outer Glow Ring */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: `2px solid ${color}`,
          boxShadow: `0 0 12px ${color}`,
          position: 'relative',
        }}
      />

      {/* Center Dot */}
      <div
        style={{
          position: 'absolute',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />

      {/* Cross lines */}
      <div
        style={{
          position: 'absolute',
          width: '44px',
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          height: '44px',
          width: '2px',
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
        }}
      />
    </div>
  );
};
