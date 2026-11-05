import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';

const atLine = (over: Partial<ActiveTargetEntity>): ActiveTargetEntity =>
  ({
    id: `t_${Math.random()}`,
    kind: 'pilgood',
    hp: 1,
    maxHp: 1,
    radiusM: 0.1,
    thetaRad: 0,
    initialThetaRad: 0,
    x: 0,
    z: -0.1,
    speedMps: 1,
    hitRadiusM: 0.8,
    killBonusScore: 0,
    breached: false,
    ...over,
  }) as ActiveTargetEntity;

function run(target: ActiveTargetEntity, sandbox = false) {
  const engine = new BeerCrusherEngine();
  engine.startGame({ withWeaponSelect: false });
  engine.isSandboxMode = sandbox;
  engine.activeTargets = [target];
  const before = engine.lives;
  const { breaches } = engine.update(100_000, 0.05);
  return { breaches, lost: before - engine.lives };
}

describe('player hit feedback', () => {
  it('monsters and shells crossing the line report a breach and cost health', () => {
    for (const t of [atLine({}), atLine({ isProjectile: true })]) {
      const r = run(t);
      expect(r.breaches.length).toBe(1);
      expect(r.lost).toBe(1);
    }
  });

  it('items and the sandbox report nothing', () => {
    expect(run(atLine({ isItem: true, itemKind: 'power_shot' })).breaches).toEqual([]);
    expect(run(atLine({}), true).breaches).toEqual([]);
  });

  it('the canvas and the page are wired without state', () => {
    expect(fs.readFileSync('src/pc/components/GameCanvas3D.tsx', 'utf8')).toContain('onPlayerHitRef.current?.()');
    const page = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    expect(page).toContain('data-testid="player-hit-flash"');
    expect(page).toContain('onPlayerHit={handlePlayerHit}');
    expect(page).toContain('playPlayerHitSound');
  });
});
