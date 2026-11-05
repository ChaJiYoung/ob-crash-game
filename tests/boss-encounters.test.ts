import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { STAGE_CONSTANTS } from '../src/shared/constants';
import { buildHudSnapshot } from '../src/pc/hudSnapshot';

/** Runs the engine until the mini-wave is exhausted: pretend all spawns happened and the field is clear. */
function finishMiniWave(engine: BeerCrusherEngine, wave: number, now: number): void {
  engine.startWave(wave);
  engine.activeTargets = [];
  // @ts-expect-error private test setup
  engine.spawnedInWave = GAME_TUNING.waves[wave - 1].totalSpawns;
  engine.update(now, 0.016);
}

const bosses = (e: BeerCrusherEngine) => e.activeTargets.filter((t) => t.kind === 'boss');

function killBoss(engine: BeerCrusherEngine, boss: ActiveTargetEntity, now: number): void {
  boss.hp = 0.1;
  engine.weaponSystem.selectWeapon('revolver', 1);
  const p = engine.computeTargetAimCoords(boss);
  const res = engine.shootAt(p.targetNormX, p.targetNormY, now);
  expect(res.killed).toBe(true);
}

describe('seven waves and boss encounters (gameplay-polish P04-T01)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
  });

  it('has 7 waves driven by GAME_TUNING', () => {
    expect(STAGE_CONSTANTS.TOTAL_WAVES).toBe(7);
    expect(GAME_TUNING.waves.length).toBe(7);
    expect(GAME_TUNING.waves.filter((w) => w.boss).map((w) => w.waveIndex)).toEqual([3, 5, 7]);
  });

  it('spawns one 45hp cooler after the wave-3 mini-wave', () => {
    finishMiniWave(engine, 3, 1000);
    expect(engine.isBossEncounterActive).toBe(true);
    const b = bosses(engine);
    expect(b.length).toBe(1);
    expect(b[0].hp).toBe(45);
    expect(b[0].bossRole).toBe('cooler');
    expect(b[0].thetaRad).toBe(0);
    expect(b[0].radiusM).toBe(GAME_TUNING.boss.startRadiusM);
  });

  it('a mid boss kill is not victory: cards appear, then the next wave starts', () => {
    finishMiniWave(engine, 3, 1000);
    killBoss(engine, bosses(engine)[0], 2000);
    expect(engine.gamePhase).toBe('PLAYING');
    expect(engine.isBossEncounterActive).toBe(false);

    engine.update(2100, 0.016);
    expect(engine.isRewardCardPending).toBe(true);
    const card = engine.activeTargets.find((t) => t.rewardCardKind)!;
    const p = engine.computeTargetAimCoords(card);
    const pick = engine.shootAt(p.targetNormX, p.targetNormY, 4000, 'press');
    expect(pick.selectedCard).toBeDefined();
    expect(engine.currentWave).toBe(4);
  });

  it('wave 5 has two coolers at different angles and killing one does not advance', () => {
    finishMiniWave(engine, 5, 1000);
    const b = bosses(engine);
    expect(b.length).toBe(2);
    expect(b.map((x) => x.hp)).toEqual([40, 40]);
    expect(b[0].thetaRad).not.toBe(b[1].thetaRad);
    expect(Math.abs(b[0].thetaRad)).toBeCloseTo(GAME_TUNING.boss.coolerSpreadRad, 5);

    killBoss(engine, b[0], 2000);
    expect(bosses(engine).length).toBe(1);
    expect(engine.isBossEncounterActive).toBe(true);
    engine.update(2100, 0.016);
    expect(engine.isRewardCardPending).toBe(false);
    expect(engine.currentWave).toBe(5);
  });

  it('wave 7 needs both coolers and the king for victory', () => {
    finishMiniWave(engine, 7, 1000);
    const b = bosses(engine);
    expect(b.length).toBe(3);
    expect(b.filter((x) => x.bossRole === 'cooler').map((x) => x.hp)).toEqual([50, 50]);
    const king = b.find((x) => x.bossRole === 'king')!;
    expect(king.hp).toBe(120);
    expect(king.hitRadiusM).toBeCloseTo(2.1 * GAME_TUNING.boss.kingScale, 5);

    b.forEach((boss, i) => {
      expect(engine.gamePhase).toBe('PLAYING');
      killBoss(engine, boss, 2000 + i * 600);
    });
    expect(engine.gamePhase).toBe('VICTORY');
    expect(engine.activeTargets.length).toBe(0);
  });

  it('bosses are immune to shotgun knockback and the gatling skill knockback', () => {
    finishMiniWave(engine, 3, 1000);
    const boss = bosses(engine)[0];
    boss.radiusM = 12;
    boss.x = 0;
    boss.z = -12;

    engine.weaponSystem.selectWeapon('shotgun', 2);
    const p = engine.computeTargetAimCoords(boss);
    engine.shootAt(p.targetNormX, p.targetNormY, 3000);
    expect(boss.radiusM).toBe(12);

    engine.weaponSystem.selectWeapon('gatling', 4);
    engine.weaponSystem.addSkillStock(2);
    expect(engine.triggerWeaponSkill(4000).activated).toBe(true);
    expect(boss.radiusM).toBe(12);
  });

  it('boss hit zone is 0.6x of an equivalent normal monster zone', () => {
    const mk = (kind: 'boss' | 'bottle'): ActiveTargetEntity => ({
      id: kind, kind, hp: 10, maxHp: 10, radiusM: 10, thetaRad: 0, x: 0, z: -10, speedMps: 0,
      hitRadiusM: 2.0, killBonusScore: 0, breached: false,
    });
    const boss = engine.computeTargetAimCoords(mk('boss')).apparentHitRadius;
    const normal = engine.computeTargetAimCoords(mk('bottle')).apparentHitRadius;
    expect(boss / normal).toBeCloseTo(GAME_TUNING.boss.hitZoneScale, 2);
  });

  it('scales normal monster speed by +4% per wave but not boss speed', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // always the first kind in the wave list: pilgood
    try {
      const speedAt = (wave: number) => {
        const e = new BeerCrusherEngine();
        e.startGame({ withWeaponSelect: false });
        e.startWave(wave);
        e.activeTargets = [];
        e.update(1000, 0.0001);
        const t = e.activeTargets.find((x) => !x.isGoldenCan && !x.isItem && x.kind === 'pilgood')!;
        return t.speedMps;
      };
      const w1 = speedAt(1);
      const w4 = speedAt(4);
      expect(w4 / w1).toBeCloseTo(1.12, 3);
    } finally {
      spy.mockRestore();
    }

    finishMiniWave(engine, 3, 2000);
    expect(bosses(engine)[0].speedMps).toBe(0.85);
  });

  it('boss encounters summon only the kinds listed for that wave', () => {
    const kindsFor = (wave: number) => {
      const e = new BeerCrusherEngine();
      e.startGame({ withWeaponSelect: false });
      e.startWave(wave);
      let s = 3;
      e.dropRng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const kinds = new Set<string>();
      for (let i = 0; i < 40; i++) e.spawnBossMinionWave(1000 + i, 4).forEach((m) => kinds.add(m.kind));
      return kinds;
    };
    expect([...kindsFor(3)].sort()).toEqual(['caslight', 'hanmac', 'obi']);
    expect([...kindsFor(5)].sort()).toEqual(['bottle', 'hanmac', 'obi', 'pilgood']);
    expect([...kindsFor(7)].sort()).toEqual(['bottle', 'caslight', 'hanmac', 'obi', 'pilgood']);
  });

  it('has no mid-wave card in waves 1-3, 5 and 7 and cards at 22 / 26 kills in waves 4 and 6', () => {
    [1, 2, 3, 5, 7].forEach((w) => expect(engine.getCardKillTarget(w)).toBeNull());
    expect(engine.getCardKillTarget(4)).toBe(22);
    expect(engine.getCardKillTarget(6)).toBe(26);

    engine.startWave(1);
    expect(engine.getWaveProgress().cardKillTarget).toBeNull();
  });

  describe('boss patterns (P04-T04)', () => {
    const run = (e: BeerCrusherEngine, fromMs: number, toMs: number, stepMs = 50) => {
      let now = fromMs;
      while (now < toMs) {
        now += stepMs;
        e.update(now, stepMs / 1000);
      }
      return now;
    };

    it('a single cooler sweeps side to side while holding the stop distance', () => {
      finishMiniWave(engine, 3, 1000);
      const b = bosses(engine)[0];
      const xs: number[] = [];
      let now = 1000;
      for (let i = 0; i < 400; i++) {
        now += 50;
        engine.update(now, 0.05);
        xs.push(b.x);
      }
      expect(Math.max(...xs)).toBeGreaterThan(1);
      expect(Math.min(...xs)).toBeLessThan(-1);
      expect(b.radiusM).toBe(GAME_TUNING.boss.stopRadiusM);
    });

    it('two coolers move in opposite directions', () => {
      finishMiniWave(engine, 5, 1000);
      const [a, c] = bosses(engine);
      let now = 1000;
      let opposite = 0;
      for (let i = 0; i < 300; i++) {
        now += 50;
        engine.update(now, 0.05);
        if (Math.abs(a.thetaRad) > 0.05 && a.thetaRad * c.thetaRad < 0) opposite++;
      }
      expect(opposite).toBeGreaterThan(100);
    });

    it('summons 4 minions per summon (first after 2.5s, gaps shrinking from 8s), once per encounter even with two bosses', () => {
      finishMiniWave(engine, 5, 100_000);
      let now = 100_000;
      const summons: { at: number; minions: number }[] = [];
      let prev = (engine as any).lastBossSummonTimeMs; // the encounter's initial timer value is not a summon
      for (let i = 0; i < 1000; i++) {
        now += 50;
        engine.update(now, 0.05);
        const t = (engine as any).lastBossSummonTimeMs;
        if (t !== prev) {
          // Count the minions that appeared in this very frame (two bosses must still summon only 4)
          summons.push({ at: t, minions: engine.activeTargets.filter((x) => x.id.startsWith('boss_minion_')).length });
          prev = t;
        }
        engine.activeTargets = engine.activeTargets.filter((t2) => !t2.id.startsWith('boss_minion_') && !t2.isProjectile);
      }
      expect(summons.length).toBeGreaterThanOrEqual(5);
      summons.forEach((sm) => expect(sm.minions).toBe(GAME_TUNING.boss.summonCount));
      const gaps = summons.slice(1).map((sm, i) => sm.at - summons[i].at);
      gaps.forEach((gap) => {
        expect(gap).toBeGreaterThanOrEqual(GAME_TUNING.boss.summonAccel.minIntervalMs - 60);
        expect(gap).toBeLessThan(GAME_TUNING.boss.summonIntervalMs + 200);
      });
      expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]); // the fight drags on -> summons come faster
      // The very first summon arrives ~2.5s after the encounter spawned (once the bosses are in range)
      expect(summons[0].at - 100_000).toBeGreaterThanOrEqual(GAME_TUNING.boss.firstSummonDelayMs - 100);
    });

    it('does not summon while 7 or more minions are on the field, and general spawns do not restart', () => {
      finishMiniWave(engine, 5, 100_000);
      const b = bosses(engine);
      b.forEach((x) => {
        x.radiusM = 10;
        x.z = -10;
      });
      (engine as any).lastBossSummonTimeMs = 0;
      const fillers = Array.from({ length: 7 }, (_, i) => ({
        id: `f${i}`, kind: 'obi' as const, hp: 2, maxHp: 2, radiusM: 9, thetaRad: 0.01 * i, x: 0, z: -9, speedMps: 0,
        hitRadiusM: 1, killBonusScore: 1, breached: false,
      }));
      engine.activeTargets.push(...fillers);
      engine.update(100_100, 0.05);
      expect(engine.activeTargets.filter((t) => t.id.startsWith('boss_minion_')).length).toBe(0);

      const spawnedBefore = (engine as any).spawnedInWave;
      run(engine, 100_100, 120_000);
      expect((engine as any).spawnedInWave).toBe(spawnedBefore); // no regular spawns during the boss fight
    });

    it('two coolers fire projectiles in turn from their own positions; one left fires only from it', () => {
      finishMiniWave(engine, 5, 100_000);
      const [a, c] = bosses(engine);
      const who: string[] = [];
      let now = 100_000;
      const collect = (into: string[], steps: number) => {
        for (let i = 0; i < steps; i++) {
          now += 50;
          (engine as any).lastBossSummonTimeMs = now; // keep summons out of the way
          engine.update(now, 0.05);
          engine.activeTargets
            .filter((t) => t.isProjectile && !(t as any).seen)
            .forEach((t) => {
              (t as any).seen = true;
              // The projectile starts exactly at one cooler's current position
              const fromA = Math.abs((t.initialThetaRad ?? 99) - a.thetaRad) < 1e-9;
              const fromC = Math.abs((t.initialThetaRad ?? 99) - c.thetaRad) < 1e-9;
              into.push(fromA && fromC ? 'both' : fromA ? 'A' : fromC ? 'C' : 'none');
            });
          engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile);
        }
      };
      collect(who, 1400);
      expect(who.length).toBeGreaterThanOrEqual(4);
      expect(who.every((w) => w === 'A' || w === 'C')).toBe(true);
      for (let i = 1; i < who.length; i++) expect(who[i]).not.toBe(who[i - 1]);

      // Kill cooler A: cooler C fires alone
      engine.activeTargets = engine.activeTargets.filter((t) => t !== a);
      const after: string[] = [];
      collect(after, 500);
      expect(after.length).toBeGreaterThanOrEqual(2);
      expect(after.every((w) => w === 'C')).toBe(true);
    });

    describe('king shield', () => {
      const kingFight = () => {
        finishMiniWave(engine, 7, 100_000);
        const king = bosses(engine).find((x) => x.bossRole === 'king')!;
        const coolers = bosses(engine).filter((x) => x.bossRole === 'cooler');
        king.radiusM = 10;
        king.z = -10;
        return { king, coolers };
      };
      const aimShot = (t: ActiveTargetEntity, now: number, source: 'press' | 'fever' = 'press') => {
        engine.weaponSystem.selectWeapon('revolver', 1);
        const p = engine.computeTargetAimCoords(t);
        return engine.shootAt(p.targetNormX, p.targetNormY, now, source);
      };

      it('starts shielded: shots are blocked with no score, fever or damage', () => {
        const { king } = kingFight();
        expect(king.isShielded).toBe(true);
        king.thetaRad = 0;
        king.x = 0;
        const res = aimShot(king, 101_000);
        expect(res.shieldBlocked).toBe(true);
        expect(res.killed).toBe(false);
        expect(king.hp).toBe(king.maxHp);
        expect(engine.scoreManager.getState().totalScore).toBe(0);
        expect(engine.scoreManager.getState().feverGauge).toBe(0);
      });

      it('fever does not pierce the king shield', () => {
        const { king } = kingFight();
        engine.scoreManager.forceSetFeverGauge(100);
        engine.scoreManager.activateFever(100_900);
        const res = aimShot(king, 101_000, 'fever');
        expect(res.shieldBlocked).toBe(true);
        expect(king.hp).toBe(king.maxHp);
      });

      it('skills do not damage a shielded king', () => {
        const { king } = kingFight();
        engine.weaponSystem.selectWeapon('shotgun', 1);
        expect(engine.triggerWeaponSkill(101_000).activated).toBe(true);
        expect(king.hp).toBe(king.maxHp);
      });

      it('six minion kills release the shield', () => {
        const { king } = kingFight();
        for (let i = 0; i < 5; i++) {
          (engine as any).handleMonsterKilled(
            { id: `m${i}`, kind: 'obi', hp: 0, maxHp: 2, radiusM: 9, thetaRad: 0, x: 0, z: -9, speedMps: 1, hitRadiusM: 1, killBonusScore: 1, breached: false },
            101_000
          );
        }
        expect(king.isShielded).toBe(true);
        (engine as any).handleMonsterKilled(
          { id: 'm6', kind: 'obi', hp: 0, maxHp: 2, radiusM: 9, thetaRad: 0, x: 0, z: -9, speedMps: 1, hitRadiusM: 1, killBonusScore: 1, breached: false },
          101_000
        );
        expect(king.isShielded).toBe(false);
      });

      it('killing a cooler releases the shield; hp thresholds raise it again', () => {
        const { king, coolers } = kingFight();
        killBoss(engine, coolers[0], 101_000);
        expect(king.isShielded).toBe(false);

        king.hp = king.maxHp * (2 / 3) - 1;
        engine.update(101_500, 0.016);
        expect(king.isShielded).toBe(true);

        (engine as any).releaseKingShield();
        king.hp = king.maxHp * (1 / 3) - 1;
        engine.update(102_000, 0.016);
        expect(king.isShielded).toBe(true);
        expect((engine as any).shieldThresholdIndex).toBe(2);
      });

      it('a shielded king can still be dealt with: the encounter never deadlocks', () => {
        const { king, coolers } = kingFight();
        coolers.forEach((c, i) => killBoss(engine, c, 101_000 + i * 700));
        expect(king.isShielded).toBe(false);
        expect(engine.gamePhase).toBe('PLAYING');
        king.hp = 0.1;
        king.thetaRad = 0;
        king.x = 0;
        const res = aimShot(king, 105_000);
        expect(res.killed).toBe(true);
        expect(engine.gamePhase).toBe('VICTORY');
      });
    });

    it('bosses do not move while cards are pending', () => {
      finishMiniWave(engine, 3, 100_000);
      const b = bosses(engine)[0];
      engine.spawnWaveRewardCards(100_500, false);
      const before = b.thetaRad;
      run(engine, 100_500, 105_000, 100);
      expect(b.thetaRad).toBe(before);
    });
  });

  describe('boss rewards, model and HUD (P04-T05)', () => {
    it('boss body hits give no fever; minion kills do', () => {
      finishMiniWave(engine, 3, 100_000);
      const boss = bosses(engine)[0];
      boss.x = 0;
      boss.thetaRad = 0;
      engine.weaponSystem.selectWeapon('revolver', 1);
      const p = engine.computeTargetAimCoords(boss);
      const res = engine.shootAt(p.targetNormX, p.targetNormY, 101_000);
      expect(res.fired).toBe(true);
      expect(res.shieldBlocked).toBeUndefined();
      expect(boss.hp).toBeLessThan(boss.maxHp);
      expect(engine.scoreManager.getState().feverGauge).toBe(0);

      const minion = engine.spawnBossMinionWave(101_100, 1)[0];
      minion.hp = 0.05;
      minion.thetaRad = 0;
      minion.x = 0;
      minion.z = -minion.radiusM;
      const mp = engine.computeTargetAimCoords(minion);
      engine.shootAt(mp.targetNormX, mp.targetNormY, 103_000); // well after the minion has landed
      expect(engine.scoreManager.getState().feverGauge).toBeGreaterThan(0);
    });

    it('summoned minions drop items at 20% while regular monsters stay at 4%', () => {
      const dropsFor = (summoned: boolean) => {
        const e = new BeerCrusherEngine();
        e.startGame({ withWeaponSelect: false });
        e.activeTargets = [];
        e.dropRng = () => 0.1;
        (e as any).handleMonsterKilled(
          {
            id: 'm', kind: 'obi', hp: 0, maxHp: 2, radiusM: 9, thetaRad: 0, x: 0, z: -9, speedMps: 1,
            hitRadiusM: 1, killBonusScore: 1, breached: false, isSummonedMinion: summoned,
          },
          1000
        );
        return e.activeTargets.filter((t) => t.isItem).length;
      };
      expect(dropsFor(true)).toBe(1);
      expect(dropsFor(false)).toBe(0);
      expect(engine.spawnBossMinionWave(1000, 2).every((m) => m.isSummonedMinion)).toBe(true);
    });

    it('the king is flagged to render 1.5x larger and starts with a warning window', () => {
      finishMiniWave(engine, 7, 100_000);
      const king = bosses(engine).find((b) => b.bossRole === 'king')!;
      const cooler = bosses(engine).find((b) => b.bossRole === 'cooler')!;
      expect(king.modelScaleMult).toBe(GAME_TUNING.boss.kingScale);
      expect(cooler.modelScaleMult).toBeUndefined();
      expect(engine.bossWarningUntilMs).toBe(100_000 + 2000);
    });

    it('HUD snapshot lists every boss with role, hp and shield state', () => {
      finishMiniWave(engine, 7, 100_000);
      const snap = buildHudSnapshot(engine, 100_500);
      expect(snap.bosses.length).toBe(3);
      expect(snap.bosses.map((b) => b.role).sort()).toEqual(['cooler', 'cooler', 'king']);
      const king = snap.bosses.find((b) => b.role === 'king')!;
      expect(king.isShielded).toBe(true);
      expect(king.hp).toBe(120);
      expect(snap.isBossWarning).toBe(true);
      expect(buildHudSnapshot(engine, 103_000).isBossWarning).toBe(false);
    });

    it('summoned hanmacs do not starve the bosses of projectile fire', () => {
      finishMiniWave(engine, 5, 100_000);
      let now = 100_000;
      const bossShots: number[] = [];
      // Park two hanmacs next to the bosses; they fire on their own timer
      const hans = [0.3, -0.3].map((th, i) => ({
        id: `han${i}`, kind: 'hanmac' as const, hp: 3, maxHp: 3, radiusM: 11, thetaRad: th, initialThetaRad: th,
        x: Math.sin(th) * 11, z: -Math.cos(th) * 11, speedMps: 0, hitRadiusM: 1, killBonusScore: 1, breached: false,
      }));
      engine.activeTargets.push(...hans);
      for (let i = 0; i < 800; i++) {
        now += 50;
        (engine as any).lastBossSummonTimeMs = now;
        engine.update(now, 0.05);
        engine.activeTargets
          .filter((t) => t.isProjectile && !(t as any).seen)
          .forEach((t) => {
            (t as any).seen = true;
            if (t.id.endsWith('_boss')) bossShots.push(now);
          });
        engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile);
      }
      // 40s of fight at one boss shot per 3.5s
      expect(bossShots.length).toBeGreaterThanOrEqual(8);
    });

    it('does not leak boss state into the sandbox and keeps sandbox bosses harmless', () => {
      finishMiniWave(engine, 7, 100_000);
      expect(engine.isBossEncounterActive).toBe(true);
      engine.startSandboxMode();
      expect(engine.isBossEncounterActive).toBe(false);
      expect(engine.currentWave).toBe(1);
      expect(engine.bossWarningUntilMs).toBe(0);

      const boss = engine.spawnSandboxTarget('boss', { stationary: true, thetaRad: 0.3 });
      engine.update(1000, 0.1);
      expect(boss.thetaRad).toBeCloseTo(0.3, 5); // not swept by the encounter movement
      boss.hp = 0.01;
      engine.weaponSystem.selectWeapon('revolver', 1);
      const p = engine.computeTargetAimCoords(boss);
      engine.shootAt(p.targetNormX, p.targetNormY, 1100);
      expect(engine.gamePhase).toBe('SANDBOX'); // no VICTORY freeze
    });

    it('a long pause does not make hanmacs or summons fire on resume', () => {
      finishMiniWave(engine, 5, 100_000);
      let now = 100_000;
      for (let i = 0; i < 100; i++) {
        now += 50;
        engine.update(now, 0.05);
      }
      const han = { id: 'h', kind: 'hanmac' as const, hp: 3, maxHp: 3, radiusM: 11, thetaRad: 0, initialThetaRad: 0, x: 0, z: -11, speedMps: 0, hitRadiusM: 1, killBonusScore: 1, breached: false } as ActiveTargetEntity;
      engine.activeTargets.push(han);
      let hanShots = 0;
      for (let i = 0; i < 30; i++) {
        now += 50;
        engine.update(now, 0.05);
        hanShots += engine.activeTargets.filter((t) => t.isProjectile).length;
        // Keep the field uncrowded so the hanmac is never blocked by the field-size limit
        engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile && !t.id.startsWith('boss_minion_'));
      }
      expect(hanShots).toBeGreaterThanOrEqual(1); // it was firing before the pause
      engine.setPaused(true, now);
      now += 20_000;
      engine.setPaused(false, now);
      engine.update(now + 16, 0.016);
      expect(engine.activeTargets.some((t) => t.isProjectile)).toBe(false);
      expect(engine.activeTargets.some((t) => t.id.startsWith('boss_minion_'))).toBe(false);
    });

    it('resets the boss warning when a new game or wave starts and caps the kill counter', () => {
      finishMiniWave(engine, 3, 100_000);
      expect(engine.bossWarningUntilMs).toBeGreaterThan(0);
      engine.startGame({ withWeaponSelect: false });
      expect(engine.bossWarningUntilMs).toBe(0);

      engine.startWave(3);
      // @ts-expect-error private test setup
      engine.killedInWave = 45;
      const p = engine.getWaveProgress();
      expect(p.killedInWave).toBe(GAME_TUNING.waves[2].totalSpawns);
      expect(p.remainingInWave).toBe(0);
    });
  });
});