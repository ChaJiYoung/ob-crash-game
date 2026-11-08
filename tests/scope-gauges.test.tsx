import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  computeScopeGauges,
  describeArc,
  filledArcRange,
  ScopeGaugeInput,
} from '../src/pc/components/scopeGauges';
import { CrosshairOverlay } from '../src/pc/components/CrosshairOverlay';

const input = (over: Partial<ScopeGaugeInput> = {}): ScopeGaugeInput => ({
  ammo: 18,
  maxAmmo: 30,
  isReloading: false,
  skillStock: 1,
  maxSkillStock: 2,
  skillCooldownRemainingMs: 8000,
  skillCooldownTotalMs: 20000,
  feverGauge: 55,
  isFeverReady: false,
  isFeverActive: false,
  ...over,
});

describe('computeScopeGauges (playtest-feedback D08)', () => {
  it('fills ammo, skill progress and fever from the snapshot', () => {
    const g = computeScopeGauges(input());
    expect(g.ammo?.fill).toBeCloseTo(0.6);
    expect(g.ammo?.warn).toBe(false);
    expect(g.skill.fill).toBeCloseTo(0.6);
    expect(g.skill.flash).toBe(false);
    expect(g.skillDots).toEqual({ filled: 1, total: 2 });
    expect(g.fever.fill).toBeCloseTo(0.55);
    expect(g.fever.flash).toBe(false);
  });

  it('warns under 20% ammo and hides the ammo arc while reloading', () => {
    expect(computeScopeGauges(input({ ammo: 5 })).ammo?.warn).toBe(true);
    expect(computeScopeGauges(input({ ammo: 6 })).ammo?.warn).toBe(false);
    expect(computeScopeGauges(input({ isReloading: true })).ammo).toBeNull();
  });

  it('shows a full, non-warning ammo arc during fever (ammo does not drop)', () => {
    const g = computeScopeGauges(input({ ammo: 1, isFeverActive: true }));
    expect(g.ammo?.fill).toBe(1);
    expect(g.ammo?.warn).toBe(false);
    expect(g.fever.flash).toBe(true);
  });

  it('flashes a full skill stock and a ready fever', () => {
    const g = computeScopeGauges(input({ skillStock: 2, skillCooldownRemainingMs: 0, isFeverReady: true, feverGauge: 100 }));
    expect(g.skill.fill).toBe(1);
    expect(g.skill.flash).toBe(true);
    expect(g.fever.fill).toBe(1);
    expect(g.fever.flash).toBe(true);
  });

  it('guards a zero cooldown total and clamps odd values', () => {
    const g = computeScopeGauges(input({ skillCooldownTotalMs: 0, skillCooldownRemainingMs: 500, maxAmmo: 0, feverGauge: 150 }));
    expect(Number.isFinite(g.skill.fill)).toBe(true);
    expect(g.skill.fill).toBeGreaterThanOrEqual(0);
    expect(g.ammo?.fill).toBeLessThanOrEqual(1);
    expect(g.fever.fill).toBe(1);
  });
});

describe('arc helpers', () => {
  it('returns an empty path for an arc under 0.5 degrees', () => {
    expect(describeArc(50, 50, 40, 10, 10.2)).toBe('');
    expect(describeArc(50, 50, 40, -60, 60)).toMatch(/^M .* A 40 40 0 0 1 /);
  });
  it('fills from the start, or backwards from the end for the skill arc', () => {
    const arc = { startDeg: 190, endDeg: 290, fill: 0.5, flash: false, warn: false };
    expect(filledArcRange(arc)).toEqual([190, 240]);
    expect(filledArcRange(arc, true)).toEqual([240, 290]);
  });
});

describe('CrosshairOverlay gauges', () => {
  it('draws the gauges on the play crosshair only', () => {
    const play = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input()} />);
    expect(play).toContain('scope-gauges');
    expect((play.match(/scope-skill-dot-on/g) || []).length).toBe(1);
    expect((play.match(/scope-skill-dot-off/g) || []).length).toBe(1);

    const menu = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input()} variant="menu" />);
    expect(menu).not.toContain('data-testid="scope-gauges"');
    const none = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} />);
    expect(none).not.toContain('data-testid="scope-gauges"');
  });
});
