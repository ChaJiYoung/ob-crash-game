import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { computeReloadRingTiming, getReloadRingSpec } from '../src/pc/components/CrosshairOverlay';

const overlaySource = () => fs.readFileSync('src/pc/components/CrosshairOverlay.tsx', 'utf8');

describe('reload progress ring spec', () => {
  it('shows a ring around the crosshair for the reload duration', () => {
    const ring = getReloadRingSpec({ isReloading: true, isFeverActive: false, reloadDurationMs: 1680, sizePx: 120 });
    expect(ring.visible).toBe(true);
    expect(ring.diameterPx).toBe(136);
    expect(ring.radiusPx).toBe(62);
    expect(ring.strokeWidthPx).toBe(8);
    expect(ring.outlineWidthPx).toBe(12);
    expect(ring.reticleOpacity).toBe(0.45);
    expect(ring.durationMs).toBe(1680);
  });

  it('keeps the reticle at full brightness when not reloading and during fever', () => {
    expect(getReloadRingSpec({ isReloading: false, reloadDurationMs: 1680, sizePx: 88 }).reticleOpacity).toBe(1);
    expect(getReloadRingSpec({ isReloading: true, isFeverActive: true, reloadDurationMs: 1680, sizePx: 88 }).reticleOpacity).toBe(1);
  });

  it('hides the ring when not reloading, during fever, or without a duration', () => {
    expect(getReloadRingSpec({ isReloading: false, reloadDurationMs: 1680, sizePx: 88 }).visible).toBe(false);
    expect(getReloadRingSpec({ isReloading: true, isFeverActive: true, reloadDurationMs: 1680, sizePx: 88 }).visible).toBe(false);
    expect(getReloadRingSpec({ isReloading: true, reloadDurationMs: 0, sizePx: 88 }).visible).toBe(false);
    expect(getReloadRingSpec({ isReloading: true, sizePx: 88 }).visible).toBe(false);
  });
});

describe('reload ring timing (the ring mounts up to ~100ms after the reload really started)', () => {
  it('starts from zero when the whole reload is still ahead', () => {
    expect(computeReloadRingTiming(1680, 1680)).toEqual({ durationMs: 1680, delayMs: 0 });
  });

  it('skips the part that already elapsed with a negative delay, so it ends with the real reload', () => {
    const t = computeReloadRingTiming(1680, 1580); // 100ms late
    expect(t.durationMs).toBe(1680);
    expect(t.delayMs).toBe(-100);
    expect(t.durationMs + t.delayMs).toBe(1580); // visible time left == real time left
  });

  it('is already full when nothing remains, and never delays past the start', () => {
    expect(computeReloadRingTiming(1680, 0).delayMs).toBe(-1680);
    expect(computeReloadRingTiming(1680, 9999).delayMs).toBe(0);
    expect(computeReloadRingTiming(1680, -50).delayMs).toBe(-1680);
  });

  it('falls back to a plain run when the remaining time is unknown or invalid', () => {
    expect(computeReloadRingTiming(1680, undefined).delayMs).toBe(0);
    expect(computeReloadRingTiming(1680, NaN).delayMs).toBe(0);
    expect(computeReloadRingTiming(NaN, 500)).toEqual({ durationMs: 0, delayMs: 0 });
  });
});

describe('reload ring wiring', () => {
  it('defines its keyframes once, in the always-mounted style tag, without a per-reload <style>', () => {
    const src = overlaySource();
    expect((src.match(/@keyframes reload-ring-fill/g) || []).length).toBe(1);
    expect((src.match(/@keyframes crosshair-spin/g) || []).length).toBe(1);
    expect(src).toContain('pathLength={1}');
    const ring = src.slice(src.indexOf('const ReloadRing'), src.indexOf('export interface CrosshairOverlayHandle'));
    expect(ring).not.toContain('<style>');
  });

  it('renders the ring after the dimmed reticle wrapper closes, so only the reticle dims', () => {
    const src = overlaySource();
    const lastBadge = src.lastIndexOf("spec.weaponLevel === 4 ? 'MAX'");
    expect(src.indexOf('opacity: ring.reticleOpacity')).toBeLessThan(lastBadge);
    expect(src.indexOf('{ring.visible && <ReloadRing')).toBeGreaterThan(lastBadge);
  });

  it('no longer uses the undefined "spin" animation', () => {
    expect(overlaySource()).not.toMatch(/'spin \d/);
  });

  it('PCGamePage passes the reload props to the three in-game crosshairs and pauses correctly per mode', () => {
    const src = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    // In-game crosshairs are the ones that receive a weapon; the lobby and result ones do not.
    const gameplay = src.match(/<CrosshairOverlay\b[\s\S]*?\/>/g)!.filter((b) => b.includes('weaponKind={hudState.weaponKind}'));
    expect(gameplay.length).toBe(3);
    gameplay.forEach((block) => {
      expect(block).toContain('isReloading={hudState.isReloading}');
      expect(block).toContain('reloadDurationMs={hudState.reloadDurationMs}');
      expect(block).toContain('getReloadRemainingMs={getReloadRemainingMs}');
      expect(block).toContain('isPaused=');
    });
    // Only the regular run freezes its clock for cards; tutorial and sandbox pause on the user pause only.
    const freezing = gameplay.filter((b) => b.includes('hudState.isRewardCardPending'));
    expect(freezing.length).toBe(1);
  });
});
