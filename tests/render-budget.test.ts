import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { computeRenderPixelRatio, MAX_RENDER_PIXELS } from '../src/pc/three/renderBudget';

describe('render budget (gameplay-polish P01-T02)', () => {
  it('caps ultrawide 3440x1440 at roughly 3M pixels', () => {
    const ratio = computeRenderPixelRatio(3440, 1440, 1);
    expect(ratio).toBeCloseTo(0.778, 2);
    expect(3440 * ratio * 1440 * ratio).toBeLessThanOrEqual(MAX_RENDER_PIXELS + 1);
  });

  it('keeps high-DPR laptop screens under the pixel budget', () => {
    expect(computeRenderPixelRatio(1440, 900, 2)).toBeCloseTo(1.521, 2);
  });

  it('does not reduce a 1080p display', () => {
    expect(computeRenderPixelRatio(1920, 1080, 1)).toBe(1);
  });

  it('returns the clamped DPR for zero-size containers', () => {
    expect(computeRenderPixelRatio(0, 0, 1.5)).toBe(1.5);
  });

  it('never exceeds DPR 2', () => {
    expect(computeRenderPixelRatio(800, 600, 3)).toBeLessThanOrEqual(2);
  });

  it('GameCanvas3D renders without post-processing', () => {
    const src = fs.readFileSync('src/pc/components/GameCanvas3D.tsx', 'utf8');
    expect(src).not.toContain('UnrealBloomPass');
    expect(src).not.toContain('EffectComposer');
    expect(src).toContain('computeRenderPixelRatio');
  });
});
