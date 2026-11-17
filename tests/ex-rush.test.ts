import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import {
  buildExRushQueue,
  getExDanger,
  getExFieldCap,
  getExHpMult,
  getExRushIndex,
  getExRushQuota,
  getExSpeedMult,
  pickExTheme,
} from '../src/pc/engine/exRush';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS } from '../src/shared/constants';
import type { TargetKind } from '../src/shared/types';

function makeSeededRng(seed = 1234567): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function clearWave7ToEnterEx(engine: BeerCrusherEngine, startMs = 1000): number {
  let t = startMs;
  engine.startWave(7);
  (engine as any).spawnedInWave = GAME_TUNING.waves[6].totalSpawns;
  engine.update(t, 0.016);
  // W7 보스 등장까지 1틱
  const bosses = engine.activeTargets.filter((x) => x.kind === 'boss');
  engine.activeTargets = engine.activeTargets.filter((x) => x.kind !== 'boss');
  for (const b of bosses) {
    b.hp = 0.01;
    (engine as any).handleMonsterKilled(b, t);
  }
  const end = t + GAME_TUNING.boss.clear.durationMs + 300;
  while (t < end && !engine.isExActive) {
    t += 50;
    engine.update(t, 0.05);
  }
  return t;
}

describe('exRush pure helpers', () => {
  it('computes DANGER and rush index from elapsed ms', () => {
    expect(getExDanger(0)).toBe(1);
    expect(getExDanger(29999)).toBe(1);
    expect(getExDanger(30000)).toBe(2);
    expect(getExDanger(90000)).toBe(4);

    expect(getExRushIndex(0)).toBe(0);
    expect(getExRushIndex(9999)).toBe(0);
    expect(getExRushIndex(10000)).toBe(1);
  });

  it('computes quota and field cap for 1P and 2P', () => {
    expect(getExRushQuota(1, 1)).toBe(20);
    expect(getExRushQuota(3, 1)).toBe(36);
    expect(getExRushQuota(1, 2)).toBe(30);
    expect(getExRushQuota(2, 2)).toBe(42); // ceil(28 * 1.5)

    expect(getExFieldCap(1)).toBe(15);
    expect(getExFieldCap(2)).toBe(23);
  });

  it('computes speed and HP multipliers', () => {
    expect(getExSpeedMult(1)).toBe(1.5);
    expect(getExSpeedMult(2)).toBeCloseTo(1.68, 5);
    expect(getExSpeedMult(50)).toBe(2.3);

    expect(getExHpMult(1)).toBe(1.5);
    expect(getExHpMult(3)).toBe(2.535);
  });

  it('picks dive on rush 0 and never repeats prev theme', () => {
    const rng = makeSeededRng(42);
    expect(pickExTheme(0, null, rng)).toBe('dive');
    let prev = pickExTheme(0, null, rng);
    for (let i = 1; i <= 1000; i += 1) {
      const next = pickExTheme(i, prev, rng);
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it('builds rush queue with theme share, chalang share, and other kinds', () => {
    const rng = makeSeededRng(99);
    const chargeQ = buildExRushQueue('charge', 20, rng);
    expect(chargeQ).toHaveLength(20);
    expect(chargeQ.filter((k) => k === 'pilgood')).toHaveLength(10);
    expect(chargeQ.filter((k) => k === 'chalang')).toHaveLength(2);
    const others = chargeQ.filter((k) => k !== 'pilgood' && k !== 'chalang');
    expect(others).toHaveLength(8);
    expect(others.every((k) => ['caslight', 'obi', 'hanmac', 'bottle'].includes(k))).toBe(true);

    const diveQ = buildExRushQueue('dive', 20, rng);
    expect(diveQ).toHaveLength(20);
    expect(diveQ.filter((k) => k === 'chalang')).toHaveLength(10);
  });
});

describe('BeerCrusherEngine EX rush', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.exRng = makeSeededRng(777);
  });

  it('enters EX after W7 boss clear with MAX upgrades and mainCleared=true', () => {
    engine.startGame({ withWeaponSelect: false });
    clearWave7ToEnterEx(engine);

    expect(engine.mainCleared).toBe(true);
    expect(engine.isExActive).toBe(true);
    expect(engine.gamePhase).toBe('PLAYING');

    const p = engine.getPlayer(0);
    expect(p.weaponSystem.getState().weaponLevel).toBe(4);
    expect(p.cardStacks).toEqual({
      damage_up: 3,
      skill_cooldown: 3,
      fever_extend: 3,
      hit_zone_up: 2,
    });
    expect(p.weaponSystem.getRapidReloadStacks()).toBe(3);
    expect(p.luckyDropStacks).toBe(3);
  });

  it('spawns 20 dive-theme monsters in the first 10s (1P) with EX HP and speed multipliers', () => {
    engine.startGame({ withWeaponSelect: false });
    let t = clearWave7ToEnterEx(engine);

    const spawned: { kind: TargetKind; maxHp: number; speedMps: number }[] = [];
    for (let i = 0; i < 199; i += 1) {
      t += 50;
      engine.update(t, 0.05);
      for (const m of engine.activeTargets) {
        if (!m.isItem && !m.isProjectile && !m.isGoldenCan) {
          spawned.push({ kind: m.kind, maxHp: m.maxHp, speedMps: m.speedMps });
        }
      }
      engine.activeTargets = [];
    }

    expect(engine.exRushTheme).toBe('dive');
    expect(spawned).toHaveLength(20);
    for (const s of spawned) {
      const spec = TARGET_SPECS[s.kind];
      expect(s.maxHp).toBeCloseTo(Number((spec.maxHp * 1.5).toFixed(3)), 3);
      expect(s.speedMps).toBeCloseTo(spec.speedMps * 1.5, 3);
    }
  });

  it('spawns 30 monsters in the first 10s for 2P coop', () => {
    engine.startGame({ withWeaponSelect: false, playerCount: 2 });
    let t = clearWave7ToEnterEx(engine);

    let spawnedCount = 0;
    for (let i = 0; i < 199; i += 1) {
      t += 50;
      engine.update(t, 0.05);
      spawnedCount += engine.activeTargets.filter((m) => !m.isItem && !m.isProjectile && !m.isGoldenCan).length;
      engine.activeTargets = [];
    }

    expect(spawnedCount).toBe(30);
  });

  it('enforces field cap of 15 (1P) and prepends unspawned monsters to next rush queue', () => {
    engine.startGame({ withWeaponSelect: false });
    let t = clearWave7ToEnterEx(engine);

    for (let i = 0; i < 199; i += 1) {
      t += 50;
      engine.update(t, 0.05);
      for (const m of engine.activeTargets) {
        m.radiusM = 20;
      }
      const fieldCount = (engine as any).countFieldMonsters();
      expect(fieldCount).toBeLessThanOrEqual(15);
    }

    const firstQueue: TargetKind[] = [...(engine as any).exRushQueue];
    const firstSpawned: number = (engine as any).exRushSpawned;
    const leftover = firstQueue.slice(firstSpawned);
    expect(leftover.length).toBeGreaterThan(0);

    // 10초 경계 직후 다음 러시 시작
    t += 100;
    engine.update(t, 0.1);
    const secondQueue: TargetKind[] = (engine as any).exRushQueue;
    expect(secondQueue.length).toBe(leftover.length + 20);
    expect(secondQueue.slice(0, leftover.length)).toEqual(leftover);
  });

  it('reports outcome VICTORY and waveReached = 7 + DANGER when dying in EX', () => {
    engine.startGame({ withWeaponSelect: false });
    let t = clearWave7ToEnterEx(engine);
    t += 50;
    engine.update(t, 0.05); // EX DANGER 1 시작

    engine.lives = 1;
    const breacher = engine.activeTargets[0];
    expect(breacher).toBeDefined();
    breacher.radiusM = 0.1;
    t += 50;
    engine.update(t, 0.05);

    expect(engine.gamePhase).toBe('GAMEOVER');
    const stats = engine.getPlayRunStats();
    expect(stats).not.toBeNull();
    expect(stats!.outcome).toBe('VICTORY');
    expect(stats!.waveReached).toBe(8);
  });

  it('freezes exElapsedMs while paused', () => {
    engine.startGame({ withWeaponSelect: false });
    let t = clearWave7ToEnterEx(engine);
    t += 50;
    engine.update(t, 0.05);
    const elapsedBefore = engine.exElapsedMs;
    expect(elapsedBefore).toBeGreaterThan(0);

    engine.setPaused(true);
    for (let i = 0; i < 10; i += 1) {
      t += 100;
      engine.update(t, 0.1);
    }
    expect(engine.exElapsedMs).toBe(elapsedBefore);
  });
});
