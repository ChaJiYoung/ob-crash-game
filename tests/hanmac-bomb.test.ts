import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { createTargetMesh3D } from '../src/pc/three/TargetModels3D';

const mk = (id: string, kind: ActiveTargetEntity['kind'], x: number, extra: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity =>
  ({ id, kind, hp: 3, maxHp: 3, radiusM: 12, thetaRad: 0, initialThetaRad: 0, x, z: -12, speedMps: 0, hitRadiusM: 0.9, killBonusScore: 1, breached: false, ...extra }) as ActiveTargetEntity;

describe('hanmac bomb', () => {
  let e: BeerCrusherEngine;
  const kill = (t: ActiveTargetEntity) => (e as any).applySkillDamage(t, 99, 1000);
  const blastTick = () => e.update(1016, 0.016);
  const R = GAME_TUNING.monsters.hanmac.blastRadiusM;
  const D = GAME_TUNING.monsters.hanmac.blastDamage;

  beforeEach(() => {
    e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.update(1000, 0.0001);
    (e as any).spawnedInWave = 999;
  });

  it('damages monsters in range on the next update, not during the kill', () => {
    const h = mk('h', 'hanmac', 0);
    const near = mk('n', 'obi', R - 0.5, { hp: 5, maxHp: 5, isGuarding: true });
    const far = mk('f', 'obi', R + 1, { hp: 5, maxHp: 5 });
    e.activeTargets = [h, near, far];
    kill(h);
    expect(near.hp).toBe(5);
    blastTick();
    expect(near.hp).toBe(5 - D);
    expect(far.hp).toBe(5);
    expect(e.drainHanmacBlastEvents().length).toBe(1);
    expect(e.drainHanmacBlastEvents()).toEqual([]);
  });

  it('does not touch bosses, shells, items or falling monsters', () => {
    const h = mk('h', 'hanmac', 0);
    const boss = mk('b', 'boss', 1, { hp: 50, maxHp: 50, bossRole: 'cooler' });
    const shell = mk('s', 'pilgood', 1, { isProjectile: true, hp: 1, maxHp: 1 });
    const item = mk('i', 'pilgood', 1, { isItem: true, hp: 1, maxHp: 1 });
    const falling = mk('d', 'obi', 1, { dropLandAtMs: 999_999 });
    e.activeTargets = [h, boss, shell, item, falling];
    kill(h);
    blastTick();
    expect(boss.hp).toBe(50);
    expect(e.activeTargets).toEqual(expect.arrayContaining([shell, item, falling]));
    expect(falling.hp).toBe(3);
  });

  it('chains through hanmacs killed by a blast and terminates', () => {
    const a = mk('a', 'hanmac', 0);
    const b = mk('b', 'hanmac', 2, { hp: 1, maxHp: 3 });
    const c = mk('c', 'hanmac', 4, { hp: 1, maxHp: 3 });
    const keep = mk('k', 'obi', 40, { radiusM: 40 });
    e.activeTargets = [a, b, c, keep];
    kill(a);
    blastTick();
    expect(e.activeTargets.includes(b)).toBe(false);
    expect(e.activeTargets.includes(c)).toBe(false);
    expect(e.drainHanmacBlastEvents().length).toBe(3);
  });

  it('a breach, the sandbox and a new wave make no blast', () => {
    const h = mk('h', 'hanmac', 0, { radiusM: 0.1, z: -0.1, speedMps: 1 });
    e.activeTargets = [h];
    blastTick();
    expect(e.drainHanmacBlastEvents()).toEqual([]);

    const s = new BeerCrusherEngine();
    s.startSandboxMode();
    const t = mk('t', 'hanmac', 0);
    s.activeTargets = [t];
    (s as any).applySkillDamage(t, 99, 1000);
    s.update(1016, 0.016);
    expect(s.drainHanmacBlastEvents()).toEqual([]);

    const h2 = mk('h2', 'hanmac', 0);
    e.activeTargets = [h2];
    kill(h2);
    e.startWave(2);
    e.update(2000, 0.016);
    expect(e.drainHanmacBlastEvents()).toEqual([]);
  });

  it('the model shows it is a bomb', () => {
    expect(createTargetMesh3D('hanmac').getObjectByName('hanmacFuseSpark')).toBeDefined();
    expect(createTargetMesh3D('obi').getObjectByName('hanmacFuseSpark')).toBeUndefined();
  });
});
