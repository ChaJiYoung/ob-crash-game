import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const drop = GAME_TUNING.boss.minionDrop;

const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe('boss minion drop (score-differentiation P02-T02)', () => {
  let engine: any;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.startWave(3);
    engine.activeTargets = [];
  });

  it('lands minions anywhere in the configured radius and angle range', () => {
    for (let seed = 1; seed <= 30; seed++) {
      engine.dropRng = seeded(seed * 7919);
      engine.activeTargets = [];
      const minions = engine.spawnBossMinionWave(1000, 4);
      expect(minions).toHaveLength(4);
      for (const m of minions) {
        expect(m.radiusM).toBeGreaterThanOrEqual(drop.minRadiusM);
        expect(m.radiusM).toBeLessThanOrEqual(drop.maxRadiusM);
        expect(Math.abs(m.thetaRad)).toBeLessThanOrEqual(drop.thetaRangeRad);
        expect(Math.hypot(m.x, m.z)).toBeCloseTo(m.radiusM, 6);
      }
    }
  });

  it('spreads across the whole range, not just behind the boss', () => {
    const radii: number[] = [];
    engine.dropRng = seeded(12345);
    for (let i = 0; i < 40; i++) {
      engine.activeTargets = [];
      radii.push(...engine.spawnBossMinionWave(1000, 4).map((m: any) => m.radiusM));
    }
    expect(Math.min(...radii)).toBeLessThan(drop.minRadiusM + 1.5);
    expect(Math.max(...radii)).toBeGreaterThan(drop.maxRadiusM - 1.5);
  });

  it('keeps siblings apart when there is room', () => {
    for (let seed = 1; seed <= 20; seed++) {
      engine.dropRng = seeded(seed * 104729);
      engine.activeTargets = [];
      const ms = engine.spawnBossMinionWave(1000, 4);
      let tooClose = 0;
      for (let i = 0; i < ms.length; i++)
        for (let j = i + 1; j < ms.length; j++)
          if (Math.hypot(ms[i].x - ms[j].x, ms[i].z - ms[j].z) < drop.minSeparationM) tooClose++;
      expect(tooClose).toBeLessThanOrEqual(1); // re-rolls are bounded, so a rare overlap is allowed
    }
  });

  describe('while falling', () => {
    let m: any;

    beforeEach(() => {
      engine.dropRng = () => 0.5; // theta 0, mid radius
      m = engine.spawnBossMinionWave(1000, 1)[0];
      m.kind = 'pilgood';
      m.speedMps = 3;
    });

    it('is not landed until dropMs have passed', () => {
      expect(engine.isTargetLanded(m, 1000)).toBe(false);
      expect(engine.isTargetLanded(m, 1000 + drop.dropMs - 1)).toBe(false);
      expect(engine.isTargetLanded(m, 1000 + drop.dropMs)).toBe(true);
      expect(m.dropLandAtMs).toBe(1000 + drop.dropMs);
    });

    it('does not move until it lands, then walks', () => {
      engine.update(1000, 0.0001);
      const r0 = m.radiusM;
      engine.spawnedInWave = 999;
      engine.update(1100, 0.1);
      expect(m.radiusM).toBe(r0);
      engine.update(1000 + drop.dropMs + 100, 0.1);
      engine.update(1000 + drop.dropMs + 200, 0.1);
      expect(m.radiusM).toBeLessThan(r0);
    });

    it('cannot be hit by a shot, but can once landed', () => {
      engine.activeTargets = [m];
      const p = engine.computeTargetAimCoords(m);
      const early = engine.shootAt(p.targetNormX, p.targetNormY, 1000 + 100, 'press');
      expect(early.target).toBeUndefined();
      expect(m.hp).toBe(m.maxHp);

      const late = engine.shootAt(p.targetNormX, p.targetNormY, 1000 + drop.dropMs + 300, 'press');
      expect(late.target).toBe(m);
    });

    it('takes no damage from a weapon skill until it lands', () => {
      engine.activeTargets = [m, { ...m, id: 'second', dropLandAtMs: undefined, hp: 5, maxHp: 5 }];
      engine.weaponSystem.refillSkillInstant();
      const res = engine.triggerWeaponSkill(1000 + 100);
      expect(res.activated).toBe(true);
      expect(m.hp).toBe(m.maxHp);
      expect(engine.activeTargets.find((t: any) => t.id === 'second').hp).toBeLessThan(5);
    });

    it('counts toward the active minion cap', () => {
      const cap = GAME_TUNING.boss.summonMaxActive;
      engine.isBossEncounterActive = true;
      engine.bossEncounterStartMs = 1000;
      engine.lastBossSummonTimeMs = -1e9;
      const boss = {
        id: 'b', kind: 'boss', bossRole: 'cooler', hp: 50, maxHp: 50, radiusM: 10, thetaRad: 0, x: 0, z: -10,
        speedMps: 0, hitRadiusM: 1, killBonusScore: 0, breached: false,
      };
      engine.activeTargets = [boss];
      engine.dropRng = seeded(99);
      engine.spawnBossMinionWave(1000, cap); // all still falling
      expect(engine.activeTargets.filter((t: any) => t.isSummonedMinion)).toHaveLength(cap);
      engine.lastBossSummonTimeMs = -1e9;
      engine.update(1100, 0.05);
      expect(engine.activeTargets.filter((t: any) => t.isSummonedMinion)).toHaveLength(cap);
    });

    it('shifts its landing time when the game clock is frozen', () => {
      engine.freezeTimers(5000);
      expect(m.dropLandAtMs).toBe(1000 + drop.dropMs + 5000);
    });
  });

  it('a hanmac that lands inside its stop radius fires from where it landed', () => {
    engine.dropRng = () => 0;
    const [h] = engine.spawnBossMinionWave(1000, 1);
    h.kind = 'hanmac';
    h.radiusM = drop.minRadiusM; // 6m: inside the 11m stop radius
    h.thetaRad = 0;
    h.x = 0;
    h.z = -h.radiusM;
    h.speedMps = 2;
    engine.activeTargets = [h];
    engine.spawnedInWave = 999;
    engine.update(1000, 0.0001);
    engine.update(1000 + drop.dropMs + 100, 0.1);
    engine.update(1000 + drop.dropMs + 200, 0.1);
    expect(h.radiusM).toBeCloseTo(drop.minRadiusM, 5); // not pushed out to the 11m stop line
    expect(h.hanmacArrivedAtMs).toBeDefined();
  });

  it('a caslight keeps swaying while it falls so it does not jump on landing', () => {
    engine.dropRng = () => 0.5;
    const [c] = engine.spawnBossMinionWave(1000, 1);
    c.kind = 'caslight';
    engine.activeTargets = [c];
    engine.spawnedInWave = 999;
    const landAt = 1000 + drop.dropMs;
    for (let t = 1000; t < landAt - 20; t += 20) engine.update(t, 0.02);
    const beforeX = c.x;
    expect(engine.isTargetLanded(c, landAt - 20)).toBe(false);
    engine.update(landAt + 20, 0.02);
    expect(engine.isTargetLanded(c, landAt + 20)).toBe(true);
    // A frozen caslight would resume from its spawn angle (up to ~2.5m away); a swaying one barely moves in 40ms
    expect(Math.abs(c.x - beforeX)).toBeLessThan(1.0);
  });

  describe('review follow-ups (P02)', () => {
    const mkTarget = (id: string, kind: any, radius: number, extra: any = {}) => ({
      id, kind, hp: 4, maxHp: 4, radiusM: radius, thetaRad: 0, x: 0, z: -radius, speedMps: 0,
      hitRadiusM: 1, killBonusScore: 1, breached: false, ...extra,
    });

    it('revolver pierce passes through a landed target but skips one that is still falling', () => {
      const runPierce = (rearFalling: boolean) => {
        const e: any = new BeerCrusherEngine();
        e.startGame({ withWeaponSelect: false });
        e.weaponSystem.selectWeapon('revolver', 3);
        const front = mkTarget('front', 'bottle', 8);
        const rear = mkTarget('rear', 'bottle', 11, rearFalling ? { dropLandAtMs: 5000 + 700 } : {});
        e.activeTargets = [front, rear];
        const p = e.computeTargetAimCoords(front);
        e.shootAt(p.targetNormX, p.targetNormY, 5000, 'press');
        return { front, rear };
      };
      const landed = runPierce(false);
      expect(landed.front.hp).toBeLessThan(4);
      expect(landed.rear.hp).toBeLessThan(4); // control: the pierce really reaches a landed rear target
      const falling = runPierce(true);
      expect(falling.front.hp).toBeLessThan(4);
      expect(falling.rear.hp).toBe(4);
    });

    it('a falling hanmac does not fire or start its timers until it lands', () => {
      engine.dropRng = () => 0.5;
      const [h] = engine.spawnBossMinionWave(1000, 1);
      h.kind = 'hanmac';
      engine.activeTargets = [h];
      engine.spawnedInWave = 999;
      for (let t = 1000; t < 1000 + drop.dropMs; t += 50) engine.update(t, 0.05);
      expect(h.hanmacArrivedAtMs).toBeUndefined();
      expect(engine.activeTargets.some((t: any) => t.isProjectile)).toBe(false);
      for (let t = 1000 + drop.dropMs; t < 1000 + drop.dropMs + 400; t += 50) engine.update(t, 0.05);
      expect(h.hanmacArrivedAtMs).toBeDefined();
    });

    it('a pause does not let a minion land: the drawn clock holds and the landing time shifts on resume', () => {
      engine.dropRng = () => 0.5;
      const [m] = engine.spawnBossMinionWave(1000, 1);
      engine.setPaused(true, 1300);
      expect(engine.getEffectiveNowMs(9999)).toBe(1300); // what the canvas draws with while paused
      engine.setPaused(false, 21_300); // 20s pause
      expect(m.dropLandAtMs).toBe(1000 + drop.dropMs + 20_000);
      expect(engine.getEffectiveNowMs(21_400)).toBe(21_400);
      expect(engine.isTargetLanded(m, 21_300)).toBe(false);
    });

    it('an obi lands with its shield down so the player gets the full window', () => {
      engine.dropRng = () => 0.5;
      const kinds = engine.waveDefinitions[3].boss.summonKinds;
      engine.waveDefinitions[3].boss.summonKinds = ['obi'];
      const [o] = engine.spawnBossMinionWave(1000, 1);
      engine.waveDefinitions[3].boss.summonKinds = kinds;
      expect(o.kind).toBe('obi');
      const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;
      const cycle = guardUpMs + guardDownMs;
      const landAt = o.dropLandAtMs;
      engine.activeTargets = [o];
      engine.updateGuards(landAt + 1);
      expect(o.isGuarding).toBe(false);
      engine.updateGuards(landAt + guardDownMs - 1);
      expect(o.isGuarding).toBe(false);
      engine.updateGuards(landAt + guardDownMs + 1);
      expect(o.isGuarding).toBe(true);
      expect(cycle).toBeGreaterThan(0);
    });

    it('keeps drops inside the visible fan on narrow windows', () => {
      engine.aspect = 1; // square window
      engine.dropRng = () => 1 - 1e-9; // widest possible angle
      const [m] = engine.spawnBossMinionWave(1000, 1);
      const fan = Math.atan(Math.tan((52 * Math.PI) / 360) * 1) * 0.8;
      expect(Math.abs(m.thetaRad)).toBeLessThanOrEqual(fan + 1e-6);
      expect(fan).toBeLessThan(drop.thetaRangeRad);
    });
  });
});
