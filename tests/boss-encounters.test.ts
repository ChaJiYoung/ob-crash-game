import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { STAGE_CONSTANTS } from '../src/shared/constants';

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

  it('spawns one 40hp cooler after the wave-3 mini-wave', () => {
    finishMiniWave(engine, 3, 1000);
    expect(engine.isBossEncounterActive).toBe(true);
    const b = bosses(engine);
    expect(b.length).toBe(1);
    expect(b[0].hp).toBe(40);
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
    expect(b.map((x) => x.hp)).toEqual([35, 35]);
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
    expect(b.filter((x) => x.bossRole === 'cooler').map((x) => x.hp)).toEqual([45, 45]);
    const king = b.find((x) => x.bossRole === 'king')!;
    expect(king.hp).toBe(110);
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
});
