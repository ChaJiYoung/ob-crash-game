import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { computeReloadRingTiming } from '../src/pc/components/CrosshairOverlay';

const overlaySource = () => fs.readFileSync('src/pc/components/CrosshairOverlay.tsx', 'utf8');

// 별도 장전 링(getReloadRingSpec/ReloadRing)은 없앴다. 장전은 조준경 탄창 호가 차오르는 모양으로 보인다(scope-gauges.test.tsx).
// 아래 타이밍 함수는 그 호와 하단 패널 장전 막대가 이미 지난 만큼을 건너뛰는 데 그대로 쓴다.

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

describe('reload arc wiring', () => {
  it('defines its keyframes once, in the always-mounted style tag, without a per-reload <style>', () => {
    const src = overlaySource();
    expect((src.match(/@keyframes reload-ring-fill/g) || []).length).toBe(1);
    expect((src.match(/@keyframes crosshair-spin/g) || []).length).toBe(1);
    expect(src).toContain('pathLength={1}');
    const arc = src.slice(src.indexOf('const ReloadArcFill'), src.indexOf('export interface CrosshairOverlayHandle'));
    expect(arc).not.toContain('<style>');
  });

  it('removed the separate reload ring', () => {
    const src = overlaySource();
    expect(src).not.toContain('getReloadRingSpec');
    expect(src).not.toContain('<ReloadRing');
    expect(src).not.toContain('getReloadRemainingMs');
  });

  it('dims only the reticle while reloading, never during fever', () => {
    const src = overlaySource();
    expect(src).toContain('const reticleOpacity = isReloading && !isFeverActive ? 0.45 : 1;');
    expect(src).toContain('opacity: reticleOpacity');
  });

  it('no longer uses the undefined "spin" animation', () => {
    expect(overlaySource()).not.toMatch(/'spin \d/);
  });

  it('PCGamePage gives the three in-game crosshairs the HUD snapshot so every one draws the gauge arcs', () => {
    const src = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    // In-game crosshairs are the ones that receive a weapon; the lobby and result ones do not.
    const gameplay = src.match(/<CrosshairOverlay\b[\s\S]*?\/>/g)!.filter((b) => b.includes('weaponKind='));
    expect(gameplay.length).toBe(3);
    gameplay.forEach((block) => {
      expect(block).toContain('isReloading=');
      expect(block).toContain('isPaused=');
      // 튜토리얼·샌드박스도 장전 표시가 있어야 한다(별도 링이 없어졌다).
      expect(block).toContain('gaugeSource=');
      expect(block).not.toContain('reloadDurationMs=');
      expect(block).not.toContain('getReloadRemainingMs=');
    });
    // Only the regular run freezes its clock for cards; tutorial and sandbox pause on the user pause only.
    const freezing = gameplay.filter((b) => b.includes('hudState.isRewardCardPending'));
    expect(freezing.length).toBe(1);
  });
});
