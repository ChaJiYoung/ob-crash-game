import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { PlayerCombatState } from '../src/pc/engine/PlayerCombatState';

function makeDummyTarget(id: string, opts: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity {
  const thetaRad = opts.thetaRad ?? 0;
  const radiusM = opts.radiusM ?? 10;
  return {
    id,
    kind: 'pilgood',
    hp: 1,
    maxHp: 1,
    radiusM,
    thetaRad,
    x: Math.sin(thetaRad) * radiusM,
    z: -Math.cos(thetaRad) * radiusM,
    speedMps: 0,
    hitRadiusM: 0.8,
    killBonusScore: 100,
    breached: false,
    ...opts,
  };
}

describe('coop routing (P02-T01)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    engine.players.forEach((p) => p.weaponSystem.selectWeapon('revolver', 1));
  });

  it('credits PERFECT kill to player 2 (P2 score > 0, P1 score == 0, P2 shotStats PERFECT == 1)', () => {
    const t = makeDummyTarget('m1', { x: 0, z: -10, radiusM: 10, thetaRad: 0 });
    engine.activeTargets = [t];

    const aim = engine.computeTargetAimCoords(t, 1.0, 1);
    const res = engine.shootAt(aim.targetNormX, aim.targetNormY, 1000, 'press', 1);

    expect(res.fired).toBe(true);
    expect(res.killed).toBe(true);
    expect(res.playerIndex).toBe(1);

    const p0 = engine.getPlayer(0);
    const p1 = engine.getPlayer(1);

    expect(p1.scoreManager.getState().totalScore).toBeGreaterThan(0);
    expect(p0.scoreManager.getState().totalScore).toBe(0);

    expect(p1.shotStats.PERFECT).toBe(1);
    expect(p0.shotStats.PERFECT).toBe(0);

    expect(p1.totalKills).toBe(1);
    expect(p0.totalKills).toBe(0);
  });

  it('credits revolver pierce kills to the firing player', () => {
    engine.getPlayer(1).weaponSystem.selectWeapon('revolver', 3);
    const front = makeDummyTarget('front', { radiusM: 8, thetaRad: 0, hp: 0.5 });
    const rear = makeDummyTarget('rear', { radiusM: 12, thetaRad: 0, hp: 0.5 });
    engine.activeTargets = [front, rear];

    const aim = engine.computeTargetAimCoords(front, 1.0, 1);
    const res = engine.shootAt(aim.targetNormX, aim.targetNormY, 1000, 'press', 1);

    expect(res.fired).toBe(true);
    expect(res.killed).toBe(true);
    expect(res.hitTargets?.length).toBe(2);

    expect(engine.getPlayer(1).totalKills).toBe(2);
    expect(engine.getPlayer(0).totalKills).toBe(0);
  });

  it('credits blade skill kills to the casting player', () => {
    engine.getPlayer(1).weaponSystem.selectWeapon('revolver', 1);
    engine.getPlayer(1).weaponSystem.addSkillStock(1);

    const t = makeDummyTarget('m_blade', { radiusM: 8, thetaRad: 0, hp: 1 });
    engine.activeTargets = [t];

    const res = engine.triggerWeaponSkill(1000, 1);
    expect(res.activated).toBe(true);
    expect(res.playerIndex).toBe(1);

    // Update passes time so blades fly out and sweep the target
    engine.update(1000 + 400, 0.4);

    expect(engine.getPlayer(1).scoreManager.getState().totalScore).toBeGreaterThan(0);
    expect(engine.getPlayer(0).scoreManager.getState().totalScore).toBe(0);
    expect(engine.getPlayer(1).totalKills).toBe(1);
    expect(engine.getPlayer(0).totalKills).toBe(0);
  });

  it('credits hanmac blast cascade kills to the original killer', () => {
    const hanmac = makeDummyTarget('hanmac1', { kind: 'hanmac', radiusM: 10, thetaRad: 0, x: 0, z: -10, hp: 0.5 });
    const neighbor = makeDummyTarget('neighbor', { kind: 'pilgood', radiusM: 10.5, thetaRad: 0.05, x: 0.5, z: -10.5, hp: 1 });
    const farIdle = makeDummyTarget('farIdle', { kind: 'pilgood', radiusM: 20, thetaRad: 0.5, x: 10, z: -18, hp: 10 });
    engine.activeTargets = [hanmac, neighbor, farIdle];

    const aim = engine.computeTargetAimCoords(hanmac, 1.0, 1);
    engine.shootAt(aim.targetNormX, aim.targetNormY, 1000, 'press', 1);

    // Run hanmac blast
    engine.update(1000 + 20, 0.02);

    expect(engine.activeTargets.some((t) => t.id === 'hanmac1')).toBe(false);
    expect(engine.activeTargets.some((t) => t.id === 'neighbor')).toBe(false);
    expect(engine.getPlayer(1).totalKills).toBe(2);
    expect(engine.getPlayer(0).totalKills).toBe(0);
  });

  it('routes personal item buffs (power_shot) to collector, team buffs (ice_freeze) to everyone', () => {
    const powerItem = makeDummyTarget('item_power', { isItem: true, itemKind: 'power_shot', kind: 'pilgood' });
    engine.activeTargets = [powerItem];

    const aimPower = engine.computeTargetAimCoords(powerItem, 1.0, 1);
    engine.shootAt(aimPower.targetNormX, aimPower.targetNormY, 1000, 'press', 1);

    expect(engine.isBuffActive('power_shot', 1000, 1)).toBe(true);
    expect(engine.isBuffActive('power_shot', 1000, 0)).toBe(false);

    const freezeItem = makeDummyTarget('item_freeze', { isItem: true, itemKind: 'ice_freeze', kind: 'pilgood' });
    engine.activeTargets = [freezeItem];

    const aimFreeze = engine.computeTargetAimCoords(freezeItem, 1.0, 1);
    engine.shootAt(aimFreeze.targetNormX, aimFreeze.targetNormY, 2000, 'press', 1);

    expect(engine.isBuffActive('ice_freeze', 2000, 1)).toBe(true);
    expect(engine.isBuffActive('ice_freeze', 2000, 0)).toBe(true);
    expect(engine.isTeamBuffActive('ice_freeze', 2000)).toBe(true);
  });

  it('scales item drop chances by the killer lucky drop stacks', () => {
    engine.getPlayer(0).luckyDropStacks = 3; // 4x drop rate: 0.04 * 4 = 0.16
    engine.getPlayer(1).luckyDropStacks = 0; // 1x drop rate: 0.04 * 1 = 0.04
    engine.dropRng = () => 0.05; // 0.05 threshold: > 0.04 (no drop for P2), <= 0.16 (drop for P1)

    // P2 kills monster -> dropRng(0.05) >= 0.04 -> no item drop
    const t2 = makeDummyTarget('t2');
    engine.activeTargets = [t2];
    const aim2 = engine.computeTargetAimCoords(t2, 1.0, 1);
    engine.shootAt(aim2.targetNormX, aim2.targetNormY, 1000, 'press', 1);
    expect(engine.activeTargets.some((x) => x.isItem)).toBe(false);

    // P1 kills monster -> dropRng(0.05) < 0.16 -> drops item
    const t1 = makeDummyTarget('t1');
    engine.activeTargets = [t1];
    const aim1 = engine.computeTargetAimCoords(t1, 1.0, 0);
    engine.shootAt(aim1.targetNormX, aim1.targetNormY, 2000, 'press', 0);
    expect(engine.activeTargets.some((x) => x.isItem)).toBe(true);
  });

  it('awards equal wave time bonus to all active players', () => {
    engine.startWave(1);
    engine.update(1000, 0.016);
    (engine as any).spawnedInWave = (engine as any).waveDefinitions[1].totalSpawns;
    engine.activeTargets = [];

    // Clear wave at 5 seconds elapsed
    engine.update(6000, 0.016);

    const p0 = engine.getPlayer(0);
    const p1 = engine.getPlayer(1);

    expect(p0.waveTimeBonusTotal).toBeGreaterThan(0);
    expect(p0.waveTimeBonusTotal).toBe(p1.waveTimeBonusTotal);
    expect(p0.waveClears.length).toBe(1);
    expect(p1.waveClears.length).toBe(1);
  });

  it('activateFever consumes fever gauge only for the calling player', () => {
    engine.getPlayer(0).scoreManager.forceSetFeverGauge(50);
    engine.getPlayer(1).scoreManager.forceSetFeverGauge(100);

    const activated = engine.activateFever(1000, 1);
    expect(activated).toBe(true);

    expect(engine.getPlayer(1).scoreManager.getState().isFeverActive).toBe(true);
    expect(engine.getPlayer(1).scoreManager.getState().isFeverReady).toBe(false);

    expect(engine.getPlayer(0).scoreManager.getState().isFeverActive).toBe(false);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(50);

    // After fever duration, only P2 gauge resets to 0
    engine.update(1000 + 6000, 6.0);
    expect(engine.getPlayer(1).scoreManager.getState().isFeverActive).toBe(false);
    expect(engine.getPlayer(1).scoreManager.getState().feverGauge).toBe(0);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(50);
  });
});
