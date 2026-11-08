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
  reloadDurationMs: 1680,
  reloadEndTimeMs: 0,
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

  it('warns under 20% ammo', () => {
    expect(computeScopeGauges(input({ ammo: 5 })).ammo.warn).toBe(true);
    expect(computeScopeGauges(input({ ammo: 6 })).ammo.warn).toBe(false);
  });

  it('keeps drawing the ammo arc while reloading: empty fill, filled by the reload animation', () => {
    const g = computeScopeGauges(input({ isReloading: true, ammo: 0 }));
    expect(g.ammo.reloading).toBe(true);
    expect(g.ammo.fill).toBe(0);
    expect(g.ammo.warn).toBe(false);
    expect(computeScopeGauges(input()).ammo.reloading).toBeUndefined();
  });

  it('shows the real ammo during fever (fever does not refill) and does not warn (shots are free)', () => {
    const g = computeScopeGauges(input({ ammo: 18, isFeverActive: true, feverGauge: 70 }));
    expect(g.ammo.fill).toBeCloseTo(0.6);
    expect(g.ammo.warn).toBe(false);
    expect(computeScopeGauges(input({ ammo: 3, isFeverActive: true })).ammo.warn).toBe(false);
  });

  it('keeps reloading visible during fever as well', () => {
    const g = computeScopeGauges(input({ ammo: 0, isReloading: true, isFeverActive: true, feverGauge: 40 }));
    expect(g.ammo.reloading).toBe(true);
    expect(g.fever.active).toBe(true);
  });

  it('shrinks the fever arc with the remaining time while fever runs (no flash, active colour)', () => {
    const g = computeScopeGauges(input({ isFeverActive: true, feverGauge: 40 }));
    expect(g.fever.fill).toBeCloseTo(0.4);
    expect(g.fever.active).toBe(true);
    expect(g.fever.flash).toBe(false);
    expect(computeScopeGauges(input({ isFeverActive: true, feverGauge: 100 })).fever.fill).toBe(1);
    expect(computeScopeGauges(input({ isFeverActive: true, feverGauge: 0 })).fever.fill).toBe(0);
  });

  it('charges the fever arc with the charging colour before fever (not active)', () => {
    const g = computeScopeGauges(input({ feverGauge: 55 }));
    expect(g.fever.fill).toBeCloseTo(0.55);
    expect(g.fever.active).toBeUndefined();
    expect(g.fever.flash).toBe(false);
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

describe('scope gauge rendering of reload and fever (fever-ammo-and-aim-source D03/D04)', () => {
  it('draws a reload fill in the reload colour only while reloading', () => {
    const reloading = renderToStaticMarkup(
      <CrosshairOverlay aimX={0} aimY={0} gaugeSource={input({ isReloading: true, ammo: 0, reloadEndTimeMs: performance.now() + 1000 })} />
    );
    expect(reloading).toContain('data-testid="scope-reload-fill"');
    expect(reloading).toContain('#4cc9f0');
    expect(reloading).toContain('reload-ring-fill 1680ms');
    const idle = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input()} />);
    expect(idle).not.toContain('scope-reload-fill');
  });

  it('draws the fever arc red while fever runs and orange while charging', () => {
    const active = renderToStaticMarkup(
      <CrosshairOverlay aimX={0} aimY={0} gaugeSource={input({ isFeverActive: true, feverGauge: 50 })} />
    );
    expect(active).toContain('#ef4444');
    const charging = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input({ feverGauge: 50 })} />);
    expect(charging).toContain('#ff7a3d');
    expect(charging).not.toContain('#ef4444');
  });

  it('has no separate reload ring any more (the old ring was a rotated -90deg svg)', () => {
    const html = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} isReloading gaugeSource={input({ isReloading: true })} />);
    expect(html).not.toContain('rotate(-90deg)');
  });

  it('dims the reticle while reloading but not during fever', () => {
    const dimmed = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} isReloading />);
    expect(dimmed).toContain('opacity:0.45');
    const fever = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} isReloading isFeverActive />);
    expect(fever).not.toContain('opacity:0.45');
  });
});

describe('scope gauge visibility (2026-11-08-scope-gauge-visibility)', () => {
  const count = (html: string, cls: string) => (html.match(new RegExp(`class="${cls}"`, 'g')) || []).length;

  it('draws the arcs 6px thick and the skill dots at radius 4.5', () => {
    const html = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input()} />);
    expect(html).toContain('stroke-width="6"');
    expect(html).not.toContain('stroke-width="3"');
    expect(html).toContain('r="4.5"');
  });

  it('pulses with a glow when the skill stock is full and fever is ready', () => {
    const html = renderToStaticMarkup(
      <CrosshairOverlay aimX={0} aimY={0} gaugeSource={input({ skillStock: 2, isFeverReady: true, feverGauge: 100 })} />
    );
    expect(count(html, 'scope-gauge-ready')).toBe(2);
    expect(count(html, 'scope-gauge-halo')).toBe(2);
    expect(html).toContain('stroke-width="16"');
    expect(html).toContain('@keyframes scope-gauge-ready');
  });

  it('does not pulse while charging, and low ammo keeps its own warning blink', () => {
    const charging = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input()} />);
    expect(count(charging, 'scope-gauge-ready')).toBe(0);
    expect(count(charging, 'scope-gauge-halo')).toBe(0);
    const low = renderToStaticMarkup(<CrosshairOverlay aimX={0} aimY={0} gaugeSource={input({ ammo: 3 })} />);
    expect(count(low, 'scope-gauge-warn')).toBe(1);
    expect(count(low, 'scope-gauge-ready')).toBe(0);
  });
});
