import { describe, it, expect } from 'vitest';
import {
  formatAmmoStatusText,
  formatFeverStatusBadge,
} from '../src/pc/components/ArcadeOverlayHUD';
import { getJudgmentBannerSpec } from '../src/pc/components/JudgmentBanner';
import { aimToViewportPercent } from '../src/pc/components/CrosshairOverlay';

describe('PC Fullscreen HUD & Judgment Banner', () => {
  it('should format ammo status text correctly', () => {
    expect(formatAmmoStatusText(10, 10, false, false)).toBe('10 / 10');
    expect(formatAmmoStatusText(4, 10, false, false)).toBe('4 / 10');
    expect(formatAmmoStatusText(0, 10, true, false)).toContain('자동 장전 중');
    expect(formatAmmoStatusText(0, 10, false, true)).toContain('FEVER');
  });

  it('should format fever status badge with 100% LOCK indicator', () => {
    const normal = formatFeverStatusBadge(40, false, false);
    expect(normal.isLocked).toBe(false);
    expect(normal.label).toContain('40%');

    // 100% Lock state
    const locked = formatFeverStatusBadge(100, true, false);
    expect(locked.isLocked).toBe(true);
    expect(locked.label).toContain('LOCK 100%');
    expect(locked.accentColor).toBe('#fbbf24');

    // Fever active state
    const active = formatFeverStatusBadge(80, false, true);
    expect(active.isLocked).toBe(false);
    expect(active.label).toContain('ACTIVE');
  });

  it('should return correct specs for all judgment grades', () => {
    const perfect = getJudgmentBannerSpec('PERFECT');
    expect(perfect.title).toBe('PERFECT!');
    expect(perfect.colorHex).toBe('#fbbf24');
    expect(perfect.scale).toBeGreaterThan(1.2);

    const great = getJudgmentBannerSpec('GREAT');
    expect(great.title).toBe('GREAT!');
    expect(great.colorHex).toBe('#38bdf8');

    const good = getJudgmentBannerSpec('GOOD');
    expect(good.title).toBe('GOOD!');
    expect(good.colorHex).toBe('#4ade80');

    const miss = getJudgmentBannerSpec('MISS');
    expect(miss.title).toBe('MISS...');
    expect(miss.colorHex).toBe('#f87171');
  });

  it('should transform normalized aim coordinates to clamped viewport percentages', () => {
    const center = aimToViewportPercent(0, 0);
    expect(center.leftPercent).toBe(50);
    expect(center.topPercent).toBe(50);

    const upLeft = aimToViewportPercent(-1, 1);
    expect(upLeft.leftPercent).toBe(8);
    expect(upLeft.topPercent).toBe(12);

    const downRight = aimToViewportPercent(1, -1);
    expect(downRight.leftPercent).toBe(92);
    expect(downRight.topPercent).toBe(88);

    // Clamps beyond [-1, 1]
    const extreme = aimToViewportPercent(-5, 5);
    expect(extreme.leftPercent).toBe(8);
    expect(extreme.topPercent).toBe(12);
  });
});
