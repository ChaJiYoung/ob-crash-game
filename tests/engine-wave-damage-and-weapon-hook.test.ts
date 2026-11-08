import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';

const breacher = (id: string): ActiveTargetEntity =>
  ({ id, kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 0.1, thetaRad: 0, initialThetaRad: 0, x: 0, z: -0.1, speedMps: 1, hitRadiusM: 0.8, killBonusScore: 0, breached: false }) as ActiveTargetEntity;

/** Runs an empty wave to completion: no spawns left, no monsters. */
function finishEmptyWave(engine: any, startMs: number, endMs: number): void {
  engine.update(startMs, 0.016);
  engine.spawnedInWave = engine.waveDefinitions[engine.currentWave].totalSpawns;
  engine.activeTargets = [];
  engine.bossSpawned = true;
  engine.update(endMs, 0.016);
}

/** One real life lost to a monster crossing the floor line. */
function takeHit(engine: any, nowMs: number): void {
  engine.activeTargets = [breacher(`b${nowMs}`)];
  engine.spawnedInWave = 999;
  engine.update(nowMs, 0.05);
}

describe('wave damage aggregation', () => {
  let e: any;
  beforeEach(() => {
    e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
  });

  it('records per-wave damage and restarts from 0 on the next wave', () => {
    e.lives = 5;
    takeHit(e, 100_000);
    expect(e.lives).toBe(4);
    finishEmptyWave(e, 100_100, 101_000);
    expect(e.getPlayer(0).waveClears[0].damageTaken).toBe(1);

    e.startWave(2);
    finishEmptyWave(e, 200_000, 201_000);
    const clears = e.getPlayer(0).waveClears;
    expect(clears.length).toBeGreaterThanOrEqual(2);
    expect(clears[1].damageTaken).toBe(0);
  });

  it('gives every player the same wave damage in a 2P game', () => {
    e.startGame({ withWeaponSelect: false, playerCount: 2 });
    e.lives = 5;
    takeHit(e, 100_000);
    finishEmptyWave(e, 100_100, 101_000);
    expect(e.getPlayer(0).waveClears[0].damageTaken).toBe(1);
    expect(e.getPlayer(1).waveClears[0].damageTaken).toBe(1);
  });

  it('does not carry damage across startGame', () => {
    e.lives = 5;
    takeHit(e, 100_000);
    e.startGame({ withWeaponSelect: false });
    finishEmptyWave(e, 300_000, 301_000);
    expect(e.getPlayer(0).waveClears[0].damageTaken).toBe(0);
  });

  it('exposes wave damage in getPlayRunStats', () => {
    e.lives = 5;
    takeHit(e, 100_000);
    finishEmptyWave(e, 100_100, 101_000);
    e.gamePhase = 'GAMEOVER';
    const s = e.getPlayRunStats()!;
    expect(s.waves[0].damageTaken).toBe(e.getPlayer(0).waveClears[0].damageTaken);
    expect(s.waves[0].damageTaken).toBe(1);
  });
});

describe('onWeaponChosen hook', () => {
  it('fires once with (0, kind) on a direct pick', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: true });
    const cb = vi.fn();
    e.onWeaponChosen = cb;
    const t = e.activeTargets.find((x) => !!x.weaponSelectKind && x.ownerIndex === 0)!;
    const aim = e.computeTargetAimCoords(t, 1.0, 0);
    const res = e.shootCardSelect(aim.targetNormX, aim.targetNormY, 1000, 0);
    expect(res.fired).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(0, t.weaponSelectKind);
  });

  it('fires for an auto pick', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: true, playerCount: 2 });
    const cb = vi.fn();
    e.onWeaponChosen = cb;
    e.dropRng = () => 0;
    e.autoPickFor(1, 1500);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1, e.getPlayer(1).weaponSystem.getState().weaponKind);
  });

  it('does not fire for card picks', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.startWave(1);
    const cb = vi.fn();
    e.onWeaponChosen = cb;
    e.openSelectRound('card', 5000, true);
    const t = e.activeTargets.find((x) => !!x.rewardCardKind && x.ownerIndex === 0)!;
    const aim = e.computeTargetAimCoords(t, 1.0, 0);
    e.shootCardSelect(aim.targetNormX, aim.targetNormY, 5100, 0);
    expect(cb).not.toHaveBeenCalled();
  });

  it('survives a throwing callback', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: true });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    e.onWeaponChosen = () => {
      throw new Error('boom');
    };
    const t = e.activeTargets.find((x) => !!x.weaponSelectKind && x.ownerIndex === 0)!;
    const aim = e.computeTargetAimCoords(t, 1.0, 0);
    const res = e.shootCardSelect(aim.targetNormX, aim.targetNormY, 1000, 0);
    expect(res.fired).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
