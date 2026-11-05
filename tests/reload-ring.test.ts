import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { getReloadRingSpec } from '../src/pc/components/CrosshairOverlay';

describe('reload progress ring', () => {
  it('shows a ring around the crosshair for the reload duration', () => {
    const ring = getReloadRingSpec({ isReloading: true, isFeverActive: false, reloadDurationMs: 1680, sizePx: 120 });
    expect(ring.visible).toBe(true);
    expect(ring.diameterPx).toBe(136);
    expect(ring.durationMs).toBe(1680);
    expect(ring.circumferencePx).toBeCloseTo(2 * Math.PI * 65, 5);
  });

  it('hides the ring when not reloading, during fever, or without a duration', () => {
    expect(getReloadRingSpec({ isReloading: false, reloadDurationMs: 1680, sizePx: 88 }).visible).toBe(false);
    expect(getReloadRingSpec({ isReloading: true, isFeverActive: true, reloadDurationMs: 1680, sizePx: 88 }).visible).toBe(false);
    expect(getReloadRingSpec({ isReloading: true, reloadDurationMs: 0, sizePx: 88 }).visible).toBe(false);
    expect(getReloadRingSpec({ isReloading: true, sizePx: 88 }).visible).toBe(false);
  });

  it('defines its own keyframes instead of relying on a global stylesheet', () => {
    const src = fs.readFileSync('src/pc/components/CrosshairOverlay.tsx', 'utf8');
    expect(src).toContain('@keyframes reload-ring-fill');
  });

  it('every in-game CrosshairOverlay in PCGamePage (the ones with a weapon) receives the reload props', () => {
    const src = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    // The lobby and result overlays pass no weapon, so they never reload.
    const gameplay = (src.match(/<CrosshairOverlay\b[^>]*?weaponKind=\{hudState\.weaponKind\}[\s\S]*?\/>/g) || []);
    expect(gameplay.length).toBe(3);
    gameplay.forEach((block) => {
      expect(block).toContain('reloadDurationMs={hudState.reloadDurationMs}');
      expect(block).toContain('isReloading={hudState.isReloading}');
    });
  });
});
