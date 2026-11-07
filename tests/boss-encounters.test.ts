import fs from 'node:fs';
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

const finishBossSequence = (e: BeerCrusherEngine, from: number): number => {
  let t = from;
  const end = from + GAME_TUNING.boss.clear.durationMs + 300;
  while (t < end) {
    t += 50;
    e.update(t, 0.05);
  }
  return t;
};

function killBoss(engine: BeerCrusherEngine, boss: ActiveTargetEntity, now: number): void {
  boss.hp = 0.1;
  engine.weaponSystem.selectWeapon('revolver', 1);
  engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
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

  it('spawns one cooler after the wave-3 mini-wave', () => {
    finishMiniWave(engine, 3, 1000);
    expect(engine.isBossEncounterActive).toBe(true);
    const b = bosses(engine);
    expect(b.length).toBe(1);
    expect(b[0].hp).toBe(GAME_TUNING.waves[2].boss!.coolerHp[0]);
    expect(b[0].bossRole).toBe('cooler');
    expect(b[0].thetaRad).toBe(0);
    expect(b[0].radiusM).toBe(GAME_TUNING.boss.startRadiusM);
  });

  it('a mid boss kill is not victory: cards appear, then the next wave starts', () => {
    finishMiniWave(engine, 3, 1000);
    killBoss(engine, bosses(engine)[0], 2000);
    expect(engine.gamePhase).toBe('PLAYING');
    expect(engine.isBossEncounterActive).toBe(false);
    expect(engine.isBossClearSequence()).toBe(true);
    expect(engine.isRewardCardPending).toBe(false); // the cards wait for the clear sequence

    const after = finishBossSequence(engine, 2000);
    engine.update(after + 50, 0.016);
    expect(engine.isRewardCardPending).toBe(true);
    const card = engine.activeTargets.find((t) => t.rewardCardKind)!;
    const p = engine.computeTargetAimCoords(card);
    const pick = engine.shootAt(p.targetNormX, p.targetNormY, after + 2000, 'press');
    expect(pick.selectedCard).toBeDefined();
    expect(engine.currentWave).toBe(4);
  });

  it('wave 5 has two coolers at different angles and killing one does not advance', () => {
    finishMiniWave(engine, 5, 1000);
    const b = bosses(engine);
    expect(b.length).toBe(2);
    expect(b.map((x) => x.hp)).toEqual([...GAME_TUNING.waves[4].boss!.coolerHp]);
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
    expect(b.filter((x) => x.bossRole === 'cooler').map((x) => x.hp)).toEqual([...GAME_TUNING.waves[6].boss!.coolerHp]);
    const king = b.find((x) => x.bossRole === 'king')!;
    expect(king.hp).toBe(GAME_TUNING.waves[6].boss!.kingHp);
    expect(king.hitRadiusM).toBeCloseTo(2.1 * GAME_TUNING.boss.kingScale, 5);

    b.forEach((boss, i) => {
      expect(engine.gamePhase).toBe('PLAYING');
      killBoss(engine, boss, 2000 + i * 600);
    });
    expect(engine.gamePhase).toBe('PLAYING'); // the clear sequence runs first
    finishBossSequence(engine, 2000 + 2 * 600);
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
    engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    const p = engine.computeTargetAimCoords(boss);
    engine.shootAt(p.targetNormX, p.targetNormY, 3000);
    expect(boss.radiusM).toBe(12);

    engine.weaponSystem.selectWeapon('gatling', 4);
    engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    engine.weaponSystem.addSkillStock(2);
    expect(engine.triggerWeaponSkill(4000).activated).toBe(true);
    expect(boss.radiusM).toBe(12);
  });

  it('bosses are immune to stun and slow from skills and the Lv.4 shotgun shot, but still take damage', () => {
    finishMiniWave(engine, 3, 1000);
    const boss = bosses(engine)[0];
    boss.radiusM = 12; boss.x = 0; boss.z = -12;
    const hp0 = boss.hp;

    engine.weaponSystem.selectWeapon('shotgun', 1);
    engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    expect(engine.triggerWeaponSkill(3000).activated).toBe(true);
    expect(boss.hp).toBeLessThan(hp0);
    expect(boss.stunUntilMs).toBeUndefined();
    expect(boss.stuckPlungerCount).toBeFalsy();

    engine.weaponSystem.selectWeapon('revolver', 1);
    engine.weaponSystem.refillSkillInstant();
    engine.triggerWeaponSkill(3100);
    expect(boss.slowUntilMs).toBeUndefined();

    engine.weaponSystem.selectWeapon('gatling', 1);
    engine.weaponSystem.refillSkillInstant();
    engine.triggerWeaponSkill(3200);
    expect(boss.slowUntilMs).toBeUndefined();

    engine.weaponSystem.selectWeapon('shotgun', 4);
    engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    const p = engine.computeTargetAimCoords(boss);
    engine.shootAt(p.targetNormX, p.targetNormY, 3300, 'press');
    expect(boss.slowUntilMs).toBeUndefined();
  });

  it('a Lv.4 shotgun hit still slows a normal monster', () => {
    const m: ActiveTargetEntity = {
      id: 'm', kind: 'hanmac', hp: 99, maxHp: 99, radiusM: 10, thetaRad: 0, x: 0, z: -10, speedMps: 0,
      hitRadiusM: 0.95, killBonusScore: 0, breached: false,
    };
    engine.activeTargets = [m];
    engine.weaponSystem.selectWeapon('shotgun', 4);
    engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    const p = engine.computeTargetAimCoords(m);
    engine.shootAt(p.targetNormX, p.targetNormY, 3000, 'press');
    expect(m.slowUntilMs).toBe(4000);
  });

  it('normal monsters are still stunned by the shotgun skill', () => {
    const m: ActiveTargetEntity = {
      id: 'm', kind: 'hanmac', hp: 3, maxHp: 3, radiusM: 10, thetaRad: 0, x: 0, z: -10, speedMps: 0,
      hitRadiusM: 0.95, killBonusScore: 0, breached: false,
    };
    engine.activeTargets = [m];
    engine.weaponSystem.selectWeapon('shotgun', 1);
    engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
    engine.triggerWeaponSkill(1000);
    expect(m.stunUntilMs).toBe(2000);
    expect(m.stuckPlungerCount).toBe(2);
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

  it('scales normal monster speed by the per-wave rate but not boss speed', () => {
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
      expect(w4 / w1).toBeCloseTo((1 + GAME_TUNING.speedPerWave * 3) / 1, 3);
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

  it('has mid-wave cards only in waves 4 and 6 (22 / 26 kills) and none in the boss waves', () => {
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

    it('two coolers fire projectiles in turn from their own positions; one left fires only from it', () => {
      finishMiniWave(engine, 5, 100_000);
      const [a, c] = bosses(engine);
      const who: string[] = [];
      let now = 100_000;
      const collect = (into: string[], steps: number) => {
        for (let i = 0; i < steps; i++) {
          now += 50;
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
          // Keep only the coolers: refilled regular monsters would walk into the line and end the game over 70s
          engine.activeTargets = engine.activeTargets.filter((t) => t.kind === 'boss');
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

    it('the king has no shield: it takes damage from any weapon at any HP', () => {
      finishMiniWave(engine, 7, 100_000);
      const king = bosses(engine).find((x) => x.bossRole === 'king')!;
      king.radiusM = 10; king.z = -10; king.thetaRad = 0; king.x = 0;
      expect((king as any).isShielded).toBeUndefined();
      let t = 101_000;
      for (const ratio of [1, 0.6, 0.3]) {
        t += 1000;
        king.hp = king.maxHp * ratio;
        engine.weaponSystem.selectWeapon('revolver', 1);
        engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
        const p = engine.computeTargetAimCoords(king);
        const before = king.hp;
        engine.shootAt(p.targetNormX, p.targetNormY, t, 'press');
        expect(king.hp).toBeLessThan(before);
      }
    });
  });

  describe('boss rewards, model and HUD (P04-T05)', () => {
    it('boss body hits give no fever; minion kills do', () => {
      finishMiniWave(engine, 3, 100_000);
      const boss = bosses(engine)[0];
      boss.x = 0;
      boss.thetaRad = 0;
      engine.weaponSystem.selectWeapon('revolver', 1);
      engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
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
      engine.shootAt(mp.targetNormX, mp.targetNormY, minion.dropLandAtMs! + 1); // right after the minion has landed
      expect(engine.scoreManager.getState().feverGauge).toBeGreaterThan(0);
    });

    it('summoned minions drop items at 10% while regular monsters stay at 4%', () => {
      const dropsFor = (summoned: boolean) => {
        const e = new BeerCrusherEngine();
        e.startGame({ withWeaponSelect: false });
        e.activeTargets = [];
        e.dropRng = () => 0.09;
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
      expect(engine.bossWarningUntilMs).toBe(100_000 + GAME_TUNING.boss.warningMs);
      const page = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');
      expect(page).toContain('boss-warning-sweep');
      expect(page).toContain('WARNING');
      expect(page).toContain('playBossWarningSound');
      expect(page).not.toContain('⚠️ 보스 등장!');
    });

    it('HUD snapshot lists every boss with role and hp', () => {
      finishMiniWave(engine, 7, 100_000);
      const snap = buildHudSnapshot(engine, 100_500);
      expect(snap.bosses.length).toBe(3);
      expect(snap.bosses.map((b) => b.role).sort()).toEqual(['cooler', 'cooler', 'king']);
      const king = snap.bosses.find((b) => b.role === 'king')!;
      expect(king.hp).toBe(GAME_TUNING.waves[6].boss!.kingHp);
      expect(snap.isBossWarning).toBe(true);
      expect(buildHudSnapshot(engine, 103_000).isBossWarning).toBe(false);
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
      engine.weaponSystem.refillSkillInstant(); // selectWeapon starts with 0 charges
      const p = engine.computeTargetAimCoords(boss);
      engine.shootAt(p.targetNormX, p.targetNormY, 1100);
      expect(engine.gamePhase).toBe('SANDBOX'); // no VICTORY freeze
    });

    it('a long pause does not make bosses or summons fire on resume', () => {
      finishMiniWave(engine, 5, 100_000);
      let now = 100_000;
      for (let i = 0; i < 100; i++) {
        now += 50;
        engine.update(now, 0.05);
      }
      engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile && !t.id.startsWith('boss_minion_'));
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