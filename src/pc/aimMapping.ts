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
