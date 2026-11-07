import { describe, it, expect } from 'vitest';
import {
  formatAmmoStatusText,
  formatFeverStatusBadge,
  formatActiveBuffBadge,
  shouldRenderMonsterHpBar,
  formatWeaponSkillBadge,
  getWaveHudMode,
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
    // The reload text must not carry a hard-coded duration that drifts from the tuning
    expect(formatAmmoStatusText(0, 10, true, false)).not.toMatch(/\d\.\ds/);
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
    const fever = getJudgmentBannerSpec('GREAT', true);
    expect(fever.title).toBe('FEVER!');
    expect(fever.subtitle).toContain('2.0x');
    expect(getJudgmentBannerSpec('MISS', true).title).toBe('MISS...');
    const perfect = getJudgmentBannerSpec('PERFECT');
    expect(perfect.title).toBe('PERFECT!');
    expect(perfect.subtitle).toContain('2.0x 데미지');
    expect(perfect.colorHex).toBe('#fbbf24');
    expect(perfect.scale).toBeGreaterThan(1.2);

    const great = getJudgmentBannerSpec('GREAT');
    expect(great.title).toBe('GREAT!');
    expect(great.subtitle).toContain('1.0x 데미지');
    expect(great.colorHex).toBe('#38bdf8');

    const good = getJudgmentBannerSpec('GOOD');
    expect(good.title).toBe('GOOD!');
    expect(good.subtitle).toContain('0.5x 데미지');
    expect(good.colorHex).toBe('#4ade80');

    const miss = getJudgmentBannerSpec('MISS');
    expect(miss.title).toBe('MISS...');
    expect(miss.subtitle).toBe('빗나감');
    expect(miss.colorHex).toBe('#f87171');
  });

  it('should transform normalized aim coordinates to clamped viewport percentages', () => {
    const center = aimToViewportPercent(0, 0);
    expect(center.leftPercent).toBe(50);
    expect(center.topPercent).toBe(50);

    const upLeft = aimToViewportPercent(-1, 1);
    expect(upLeft.leftPercent).toBe(3);
    expect(upLeft.topPercent).toBe(8);

    const downRight = aimToViewportPercent(1, -1);
    expect(downRight.leftPercent).toBe(97);
    expect(downRight.topPercent).toBe(92);

    // Clamps beyond [-1, 1]
    const extreme = aimToViewportPercent(-5, 5);
    expect(extreme.leftPercent).toBe(3);
    expect(extreme.topPercent).toBe(8);
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

    // Full bounds: NDC within [-0.94, 0.94] and [-0.84, 0.84]
    const rightNdc = aimToNdc(1, 0);
    expect(rightNdc.ndcX).toBeCloseTo(0.94, 2);

    const mouseRightAim = viewportRatioToAim(0.94, 0);
    expect(mouseRightAim.aimX).toBeCloseTo(1.0, 2);
  });

  it('should filter monster HP bar visibility with shouldRenderMonsterHpBar according to D03 & D06 spec', () => {
    // 1HP Air cans (pilgood, caslight) should NOT show HP bar when full health (reduces clutter)
    expect(shouldRenderMonsterHpBar(1)).toBe(false);
    expect(shouldRenderMonsterHpBar(1, false, false, 1.0)).toBe(false);

    // Damaged 1HP air cans (hp < maxHp) MUST show HP bar so player sees remaining health
    expect(shouldRenderMonsterHpBar(1, false, false, 0.2)).toBe(true);

    // Items and Projectiles should NOT show HP bar even if damaged
    expect(shouldRenderMonsterHpBar(1, true, false)).toBe(false);
    expect(shouldRenderMonsterHpBar(4, true, false, 2)).toBe(false);
    expect(shouldRenderMonsterHpBar(1, false, true)).toBe(false);

    // Multi-hit monsters (obi: 2, hanmac: 3, bottle: 4, boss: 60) MUST show HP bar
    expect(shouldRenderMonsterHpBar(2)).toBe(true);
    expect(shouldRenderMonsterHpBar(2, false, false, 2)).toBe(true);
    expect(shouldRenderMonsterHpBar(3)).toBe(true);
    expect(shouldRenderMonsterHpBar(4)).toBe(true);
    expect(shouldRenderMonsterHpBar(60)).toBe(true);
  });

  it('should format weapon and skill badges across Lv.1~MAX and ready/cooldown states', () => {
    // 1. Shotgun Lv.1 Ready
    const sg = formatWeaponSkillBadge('shotgun', 1, 1, 1, 0);
    expect(sg.weaponTitle).toBe('맥주관 뚫어뻥 샷건');
    expect(sg.levelBadge).toBe('Lv.1');
    expect(sg.isReady).toBe(true);
    expect(sg.skillStatusText).toContain('SKILL READY');
    expect(sg.accentColor).toBe('#ef4444');

    // 2. Revolver Lv.4 MAX in Cooldown
    const rev = formatWeaponSkillBadge('revolver', 4, 0, 2, 3500);
    expect(rev.weaponTitle).toBe('황금 병따개 리볼버');
    expect(rev.levelBadge).toBe('Lv.MAX');
    expect(rev.isReady).toBe(false);
    expect(rev.skillStatusText).toContain('3.5s');
    expect(rev.accentColor).toBe('#fbbf24');

    // 3. Gatling Lv.2 with 2 Stocks Ready
    const gat = formatWeaponSkillBadge('gatling', 2, 2, 2, 0);
    expect(gat.weaponTitle).toBe('탄산 탭 개틀링');
    expect(gat.levelBadge).toBe('Lv.2');
    expect(gat.isReady).toBe(true);
    expect(gat.skillStatusText).toContain('★2/2');
    expect(gat.accentColor).toBe('#06b6d4');
  });

  it('should support immediate and lerp interpolation modes for CrosshairOverlay', () => {
    // Coordinate mapping correctness
    const center = aimToViewportPercent(0, 0);
    expect(center.leftPercent).toBe(50);
    expect(center.topPercent).toBe(50);

    const corner = aimToViewportPercent(1, 1);
    expect(corner.leftPercent).toBe(97);
    expect(corner.topPercent).toBe(8);

    const ndc = aimToNdc(0, 0);
    expect(ndc.ndcX).toBe(0);
    expect(ndc.ndcY).toBe(0);

    const backToAim = viewportRatioToAim(0, 0);
    expect(backToAim.aimX).toBe(0);
    expect(backToAim.aimY).toBe(0);
  });

  it('hides the wave progress bar while any boss is on the field', () => {
    expect(getWaveHudMode(0)).toEqual({ showProgressBar: true });
    expect(getWaveHudMode(1)).toEqual({ showProgressBar: false });
    expect(getWaveHudMode(3)).toEqual({ showProgressBar: false });
  });
});
