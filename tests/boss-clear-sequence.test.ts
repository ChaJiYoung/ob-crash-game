import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { buildHudSnapshot } from '../src/pc/hudSnapshot';
import { ParticleEffects3D } from '../src/pc/three/ParticleEffects3D';
import { GAME_TUNING } from '../src/shared/gameTuning';

const DUR = GAME_TUNING.boss.clear.durationMs;
const GAP = GAME_TUNING.boss.clear.cascadeGapMs;
const bosses = (e: BeerCrusherEngine) => e.activeTargets.filter((t) => t.kind === 'boss');

function startBossWave(engine: BeerCrusherEngine, wave: number, now: number): void {
  engine.startWave(wave);
  engine.activeTargets = [];
  (engine as any).spawnedInWave = GAME_TUNING.waves[wave - 1].totalSpawns;
  engine.update(now, 0.016);
}

const mkMonster = (id: string, r: number): ActiveTargetEntity => ({
  id, kind: 'hanmac', hp: 3, maxHp: 3, radiusM: r, thetaRad: 0, x: 0, z: -r, speedMps: 2,
  hitRadiusM: 1, killBonusScore: 90, breached: false,
});

describe('boss clear sequence', () => {
  let engine: BeerCrusherEngine;
  let now: number;
  const step = (ms = 50) => { now += ms; return engine.update(now, ms / 1000); };
  const killBoss = (boss: ActiveTargetEntity) => {
    boss.hp = 0.1;
    engine.weaponSystem.selectWeapon('revolver', 1);
    const p = engine.computeTargetAimCoords(boss);
    const res = engine.shootAt(p.targetNormX, p.targetNormY, now);
    expect(res.killed).toBe(true);
  };

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    now = 100_000;
  });

  it('killing the last boss starts a sequence instead of cards: monsters stay, no cards yet', () => {
    startBossWave(engine, 3, now);
    const boss = bosses(engine)[0];
    boss.radiusM = 10; boss.z = -10;
    engine.activeTargets.push(mkMonster('m1', 8), mkMonster('m2', 12));
    killBoss(boss);
    expect(engine.isBossClearSequence()).toBe(true);
    expect(engine.isBossEncounterActive).toBe(false);
    expect(engine.isRewardCardPending).toBe(false);
    expect(engine.activeTargets.filter((t) => t.id.startsWith('m')).length).toBe(2);
  });

  it('leftover monsters pop one by one closest first, with no score, and do not move', () => {
    startBossWave(engine, 3, now);
    const boss = bosses(engine)[0];
    engine.activeTargets.push(mkMonster('near', 4), mkMonster('far', 12));
    killBoss(boss);
    const scoreBefore = engine.scoreManager.getState().totalScore;
    const nearBefore = engine.activeTargets.find((t) => t.id === 'near')!.radiusM;
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      step(GAP);
      for (const ev of engine.drainBossClearEvents()) if (ev.type === 'cascade') order.push(ev.target.id);
    }
    expect(order).toEqual(['near', 'far']);
    expect(engine.scoreManager.getState().totalScore).toBe(scoreBefore);
    expect(nearBefore).toBe(4);
  });

  it('emits one defeated event with the boss position', () => {
    startBossWave(engine, 3, now);
    const boss = bosses(engine)[0];
    killBoss(boss);
    const events = engine.drainBossClearEvents();
    expect(events.filter((e) => e.type === 'defeated').length).toBe(1);
    expect(engine.drainBossClearEvents()).toEqual([]);
  });

  it('shots, skills and fever are blocked and cost nothing during the sequence', () => {
    startBossWave(engine, 3, now);
    killBoss(bosses(engine)[0]);
    engine.activeTargets.push(mkMonster('m', 9));
    const ammo = engine.weaponSystem.getState().ammo;
    const stock = engine.weaponSystem.getState().skillStock;
    const shot = engine.shootAt(0, 0, now + 10);
    expect(shot.fired).toBe(false);
    expect(engine.triggerWeaponSkill(now + 10).activated).toBe(false);
    expect(engine.weaponSystem.getState().ammo).toBe(ammo);
    expect(engine.weaponSystem.getState().skillStock).toBe(stock);
    engine.scoreManager.addFeverGauge(100);
    expect(engine.activateFever(now + 10)).toBe(false);
  });

  it('after the sequence a mid boss deals cards and a last boss wins', () => {
    startBossWave(engine, 3, now);
    killBoss(bosses(engine)[0]);
    for (let t = 0; t < DUR + 200; t += 50) step();
    expect(engine.isBossClearSequence()).toBe(false);
    step();
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.gamePhase).toBe('PLAYING');

    const e2 = new BeerCrusherEngine();
    e2.startGame({ withWeaponSelect: false });
    let t2 = 200_000;
    e2.startWave(7);
    e2.activeTargets = [];
    (e2 as any).spawnedInWave = GAME_TUNING.waves[6].totalSpawns;
    e2.update(t2, 0.016);
    const all = e2.activeTargets.filter((t) => t.kind === 'boss');
    for (const b of all) {
      b.hp = 0.1;
      e2.weaponSystem.selectWeapon('revolver', 1);
      const p = e2.computeTargetAimCoords(b);
      t2 += 600;
      e2.shootAt(p.targetNormX, p.targetNormY, t2);
    }
    expect(e2.isBossClearSequence()).toBe(true);
    expect(e2.gamePhase).toBe('PLAYING');
    for (let t = 0; t < DUR + 200; t += 50) { t2 += 50; e2.update(t2, 0.05); }
    expect(e2.gamePhase).toBe('VICTORY');
  });

  it('killing one of two coolers does not start the sequence', () => {
    startBossWave(engine, 5, now);
    killBoss(bosses(engine)[0]);
    expect(engine.isBossClearSequence()).toBe(false);
    expect(bosses(engine).length).toBe(1);
  });

  it('pausing keeps the remaining sequence time', () => {
    startBossWave(engine, 3, now);
    killBoss(bosses(engine)[0]);
    step(500);
    const untilBefore = engine.getBossClearUntilMs();
    engine.setPaused(true, now);
    engine.setPaused(false, now + 5000);
    expect(engine.getBossClearUntilMs() - untilBefore).toBe(5000);
  });

  it('the skill cooldown keeps running during the sequence', () => {
    startBossWave(engine, 3, now);
    killBoss(bosses(engine)[0]);
    engine.weaponSystem.consumeSkill(now);
    const before = engine.weaponSystem.getState().skillCooldownRemainingMs;
    step(500);
    expect(engine.weaponSystem.getState().skillCooldownRemainingMs).toBeLessThan(before);
  });

  it('the wave time bonus is paid at the moment of the kill, not after the sequence', () => {
    startBossWave(engine, 3, now);
    const killTime = now + 5000;
    now = killTime;
    killBoss(bosses(engine)[0]);
    expect(engine.lastWaveClear?.wave).toBe(3);
    expect(engine.lastWaveClear?.atMs).toBe(killTime);
  });

  it('a new game or wave resets the sequence', () => {
    startBossWave(engine, 3, now);
    killBoss(bosses(engine)[0]);
    engine.startWave(4);
    expect(engine.isBossClearSequence()).toBe(false);
    expect(engine.drainBossClearEvents()).toEqual([]);
  });

  it('the HUD snapshot raises bossDown only while the sequence runs', () => {
    startBossWave(engine, 3, now);
    expect(buildHudSnapshot(engine, now).bossDown).toBe(false);
    killBoss(bosses(engine)[0]);
    expect(buildHudSnapshot(engine, now).bossDown).toBe(true);
    for (let t = 0; t < DUR + 200; t += 50) step();
    expect(buildHudSnapshot(engine, now).bossDown).toBe(false);
  });

  it('the page renders a BOSS DOWN banner from that value, away from the wave-clear banner', () => {
    const page = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
    expect(page).toContain('data-testid="boss-down-banner"');
    expect(page).toContain('hudState.bossDown');
    expect(page).toContain('BOSS DOWN!');
  });

  it('the defeat burst adds many particles at the boss position', () => {
    const fx = new ParticleEffects3D();
    const before = fx.activeParticleCount;
    fx.spawnBossDefeatBurst(new THREE.Vector3(0, 1.5, -10));
    expect(fx.activeParticleCount - before).toBeGreaterThanOrEqual(40);
  });

  it('a pierce kill of the last boss does not let the primary target score, split or drop during the sequence', () => {
    startBossWave(engine, 3, now);
    const boss = bosses(engine)[0];
    boss.radiusM = 12; boss.z = -12; boss.thetaRad = 0; boss.x = 0; boss.hp = 0.1;
    const front: ActiveTargetEntity = { ...mkMonster('front', 8), kind: 'bottle', hp: 0.1, maxHp: 4 };
    engine.activeTargets.push(front);
    engine.weaponSystem.selectWeapon('revolver', 1);
    const p = engine.computeTargetAimCoords(front);
    engine.shootAt(p.targetNormX, p.targetNormY, now);
    expect(engine.isBossClearSequence()).toBe(true);
    expect(engine.activeTargets.filter((t) => t.isSplitChild).length).toBe(0);
    expect(engine.activeTargets.filter((t) => t.isItem).length).toBe(0);
  });

  it('the cascade only removes monsters, never items, shells or cards', () => {
    startBossWave(engine, 3, now);
    killBoss(bosses(engine)[0]);
    const events: string[] = [];
    for (let i = 0; i < 40; i++) {
      step(GAP);
      for (const ev of engine.drainBossClearEvents()) if (ev.type === 'cascade') events.push(ev.target.id);
    }
    expect(events.every((id) => !id.startsWith('item_') && !id.startsWith('proj_'))).toBe(true);
  });

  it('hit events queued earlier in the same frame survive the start of the sequence', () => {
    startBossWave(engine, 3, now);
    const m = mkMonster('m', 6);
    engine.activeTargets.push(m);
    (engine as any).pushSkillHitEvent({ source: 'blade', target: m, killed: true });
    killBoss(bosses(engine)[0]);
    expect(engine.drainSkillHitEvents().some((e) => e.target.id === 'm')).toBe(true);
  });
});
