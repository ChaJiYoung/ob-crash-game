import { describe, it, expect } from 'vitest';
import {
  formatAmmoStatusText,
  formatFeverStatusBadge,
  formatActiveBuffBadge,
} from '../src/pc/components/ArcadeOverlayHUD';
import { getJudgmentBannerSpec } from '../src/pc/components/JudgmentBanner';
import {
  aimToViewportPercent,
  aimToNdc,
  viewportRatioToAim,
  getCrosshairVisualSpec,
} from '../src/pc/components/CrosshairOverlay';

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

  it('should compute crosshair 88px base size and 140px wide-scope expansion', () => {
    const normal = getCrosshairVisualSpec({});
    expect(normal.sizePx).toBe(88);
    expect(normal.ringSizePx).toBe(68);
    expect(normal.primaryColor).toBe('#38bdf8');

    const wide = getCrosshairVisualSpec({ isWideScopeActive: true });
    expect(wide.sizePx).toBe(140);
    expect(wide.ringSizePx).toBe(112);
    expect(wide.badgeText).toBe('WIDE 1.6X');

    const power = getCrosshairVisualSpec({ isPowerShotActive: true });
    expect(power.primaryColor).toBe('#ef4444');
    expect(power.badgeText).toBe('POWER 2X');

    const fever = getCrosshairVisualSpec({ isFeverActive: true });
    expect(fever.primaryColor).toBe('#fbbf24');

    // Aim Locked visual spec test (D04)
    const locked = getCrosshairVisualSpec({ isAimLocked: true });
    expect(locked.primaryColor).toBe('#10b981');
    expect(locked.glowColor).toContain('16, 185, 129');
    expect(locked.badgeText).toBe('AIM LOCKED');
    expect(locked.isLocked).toBe(true);

    // Fever priority over Aim Lock
    const feverLocked = getCrosshairVisualSpec({ isFeverActive: true, isAimLocked: true });
    expect(feverLocked.primaryColor).toBe('#fbbf24');
    expect(feverLocked.badgeText).toBe('FEVER UNLIMITED');
  });

  it('should format active buff badge with remaining seconds and progress percent', () => {
    const buff = {
      kind: 'power_shot' as const,
      remainingMs: 4000,
      totalDurationMs: 8000,
    };
    const badge = formatActiveBuffBadge(buff);
    expect(badge.label).toBe('POWER 2X');
    expect(badge.timeSecText).toBe('4.0s');
    expect(badge.percent).toBe(50);
    expect(badge.colorHex).toBe('#ef4444');
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

  it('should map between viewport percentages, NDC, and mouse aim consistently', () => {
    // Center: aim (0, 0) -> NDC (0, 0)
    const centerNdc = aimToNdc(0, 0);
    expect(centerNdc.ndcX).toBe(0);
    expect(centerNdc.ndcY).toBe(0);

    // Mouse aiming at center (0, 0) maps to aim (0, 0)
    const centerAim = viewportRatioToAim(0, 0);
    expect(centerAim.aimX).toBe(0);
    expect(centerAim.aimY).toBe(0);

    // Full bounds: NDC within [-0.84, 0.84] and [-0.76, 0.76]
    const rightNdc = aimToNdc(1, 0);
    expect(rightNdc.ndcX).toBeCloseTo(0.84, 2);

    const mouseRightAim = viewportRatioToAim(0.84, 0);
    expect(mouseRightAim.aimX).toBeCloseTo(1.0, 2);
  });
});
