import { describe, it, expect } from 'vitest';
import {
  computeShotgunPelletTargets,
  SHOTGUN_PELLET_SPREAD_STEP,
  SHOTGUN_PELLET_JITTER_Y,
} from '../src/pc/three/shotgunPellets';

const mid = () => 0.5; // 세로 흔들림 0
const P = { x: 0, y: 1, z: -8 };

describe('computeShotgunPelletTargets', () => {
  it('without extras every pellet spreads symmetrically around the primary', () => {
    const t = computeShotgunPelletTargets(P, [], 4, mid);
    expect(t).toHaveLength(4);
    t.forEach((p, i) => {
      expect(p.x).toBeCloseTo((i - 1.5) * SHOTGUN_PELLET_SPREAD_STEP, 5);
      expect(p.y).toBeCloseTo(1, 5);
      expect(p.z).toBe(-8);
    });
    expect(t[0].x + t[3].x).toBeCloseTo(0, 5);
  });

  it('the spread step is twice the old 0.28 and the jitter is twice the old 0.25', () => {
    expect(SHOTGUN_PELLET_SPREAD_STEP).toBe(0.56);
    expect(SHOTGUN_PELLET_JITTER_Y).toBe(0.5);
  });

  it('with two extras and 4 pellets, pellets are shared round-robin: primary, extra0, extra1, primary', () => {
    const e0 = { x: 3, y: 1, z: -8 };
    const e1 = { x: -3, y: 1, z: -8 };
    const t = computeShotgunPelletTargets(P, [e0, e1], 4, mid);
    expect(t).toHaveLength(4);
    expect(Math.abs(t[0].x - P.x)).toBeLessThan(1.2); // primary 근처
    expect(Math.abs(t[3].x - P.x)).toBeLessThan(1.2);
    expect(Math.abs(t[1].x - e0.x)).toBeLessThan(1); // extra0 근처
    expect(Math.abs(t[2].x - e1.x)).toBeLessThan(1); // extra1 근처
  });

  it('returns exactly pelletCount targets even when there are more extras than pellets', () => {
    const extras = [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }];
    expect(computeShotgunPelletTargets(P, extras, 3, mid)).toHaveLength(3);
  });

  it('zero pellets gives an empty list and the jitter stays inside its range', () => {
    expect(computeShotgunPelletTargets(P, [], 0, mid)).toEqual([]);
    const lo = computeShotgunPelletTargets(P, [], 1, () => 0)[0];
    const hi = computeShotgunPelletTargets(P, [], 1, () => 0.999999)[0];
    expect(lo.y).toBeCloseTo(1 - SHOTGUN_PELLET_JITTER_Y / 2, 3);
    expect(hi.y).toBeCloseTo(1 + SHOTGUN_PELLET_JITTER_Y / 2, 3);
  });
});
