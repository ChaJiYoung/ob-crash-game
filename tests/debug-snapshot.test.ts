import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildDebugSnapshot } from '../src/pc/debug/debugSnapshot';

describe('BeerDebugSnapshot (T06)', () => {
  it('1-player game: builds snapshot with 3 weapon select targets owned by player 0', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ playerCount: 1, withWeaponSelect: true });

    const snap = buildDebugSnapshot(engine, 'PLAYING', 1000);

    expect(snap.phase).toBe('PLAYING');
    expect(snap.wave).toBe(1);
    expect(snap.lives).toBe(5);
    expect(snap.isPaused).toBe(false);
    expect(snap.selection.kind).toBe('weapon');
    expect(snap.selection.done).toEqual([false]);
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0].index).toBe(0);

    // 3 weapon targets
    expect(snap.targets).toHaveLength(3);
    for (const t of snap.targets) {
      expect(t.selectKind).toBe('weapon');
      expect(['shotgun', 'revolver', 'gatling']).toContain(t.selectValue);
      expect(t.ownerIndex).toBe(0);

      const origTarget = engine.activeTargets.find((at) => at.id === t.id);
      expect(origTarget).toBeDefined();
      const expectedProj = engine.computeTargetAimCoords(origTarget!, 1.0, 0);
      expect(t.aimX).toBeCloseTo(expectedProj.targetNormX, 5);
      expect(t.aimY).toBeCloseTo(expectedProj.targetNormY, 5);
      expect(t.hitRadius).toBeCloseTo(expectedProj.apparentHitRadius, 5);
    }
  });

  it('2-player game: builds snapshot with 6 weapon select targets split between players 0 and 1', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ playerCount: 2, withWeaponSelect: true });

    const snap = buildDebugSnapshot(engine, 'PLAYING', 2000);

    expect(snap.selection.kind).toBe('weapon');
    expect(snap.selection.done).toEqual([false, false]);
    expect(snap.players).toHaveLength(2);
    expect(snap.players[0].index).toBe(0);
    expect(snap.players[1].index).toBe(1);

    expect(snap.targets).toHaveLength(6);
    const p0Targets = snap.targets.filter((t) => t.ownerIndex === 0);
    const p1Targets = snap.targets.filter((t) => t.ownerIndex === 1);
    expect(p0Targets).toHaveLength(3);
    expect(p1Targets).toHaveLength(3);

    for (const t of snap.targets) {
      expect(t.selectKind).toBe('weapon');
      const origTarget = engine.activeTargets.find((at) => at.id === t.id);
      const expectedProj = engine.computeTargetAimCoords(origTarget!, 1.0, (t.ownerIndex ?? 0) as any);
      expect(t.aimX).toBeCloseTo(expectedProj.targetNormX, 5);
      expect(t.aimY).toBeCloseTo(expectedProj.targetNormY, 5);
    }
  });

  it('is read-only: calling buildDebugSnapshot does not mutate engine state', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ playerCount: 1, withWeaponSelect: true });

    const targetCountBefore = engine.activeTargets.length;
    const hpsBefore = engine.activeTargets.map((t) => t.hp);
    const livesBefore = engine.lives;

    buildDebugSnapshot(engine, 'PLAYING', 1000);
    buildDebugSnapshot(engine, 'PLAYING', 1500);

    expect(engine.activeTargets.length).toBe(targetCountBefore);
    expect(engine.activeTargets.map((t) => t.hp)).toEqual(hpsBefore);
    expect(engine.lives).toBe(livesBefore);
  });

  it('source inspection: PCGamePage registers __BEER_DEBUG__ guarded by import.meta.env.DEV', () => {
    const pageSrc = fs.readFileSync(path.resolve(__dirname, '../src/pc/PCGamePage.tsx'), 'utf-8');
    const match = pageSrc.match(/if \(!import\.meta\.env\.DEV\) return;\s*\(window as any\)\.__BEER_DEBUG__/);
    expect(match).not.toBeNull();
  });
});
