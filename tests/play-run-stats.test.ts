import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';

const mon = (id: string): ActiveTargetEntity =>
  ({ id, kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 12, thetaRad: 0, initialThetaRad: 0, x: 0, z: -12, speedMps: 0, hitRadiusM: 0.9, killBonusScore: 1, breached: false }) as ActiveTargetEntity;

describe('play run stats', () => {
  let e: BeerCrusherEngine;
  const killOne = (id: string) => {
    const m = mon(id);
    e.activeTargets.push(m);
    (e as any).applySkillDamage(m, 99, 1000);
  };

  beforeEach(() => {
    e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.getPlayer(0).weaponSystem.selectWeapon('revolver', 2);
  });

  it('is null while the game is running', () => {
    expect(e.getPlayRunStats()).toBeNull();
  });

  it('counts kills across waves, wave clears and lives', () => {
    killOne('a');
    (e as any).waveStartMs = 0;
    (e as any).awardWaveTimeBonus(5000);
    e.startWave(2);
    killOne('b');
    e.gamePhase = 'GAMEOVER';
    const s = e.getPlayRunStats()!;
    expect(s.outcome).toBe('GAMEOVER');
    expect(s.kills).toBe(2);
    expect(s.waveReached).toBe(2);
    expect(s.livesLeft).toBe(e.lives);
    expect(s.weaponKind).toBe('revolver');
    expect(s.weaponLevel).toBe(2);
    expect(s.waves).toEqual([expect.objectContaining({ wave: 1, seconds: 5 })]);
    expect(s.totalScore).toBe(s.baseScore + s.timeBonus + s.precisionBonus + s.levelBonus);
  });

  it('play time leaves out pauses', () => {
    e.update(1000, 0.5);
    e.setPaused(true, 1000);
    e.update(2000, 0.5);
    e.setPaused(false, 2000);
    e.gamePhase = 'GAMEOVER';
    expect(e.getPlayRunStats()!.durationSec).toBeCloseTo(0.5, 2);
  });

  it('a new game resets and returned values are copies', () => {
    killOne('a');
    e.gamePhase = 'GAMEOVER';
    const s = e.getPlayRunStats()!;
    s.shots.PERFECT = 999;
    s.cardStacks.damage_up = 9;
    const again = e.getPlayRunStats()!;
    expect(again.shots.PERFECT).not.toBe(999);
    expect(again.cardStacks.damage_up).toBe(0);
    e.startGame({ withWeaponSelect: false });
    e.gamePhase = 'GAMEOVER';
    expect(e.getPlayRunStats()!.kills).toBe(0);
  });

  it.each([[1, 1.2], [2, 1.1], [3, 1.05], [4, 1]] as const)('a win at Lv.%i multiplies only the base score by %f', (level, mult) => {
    e.getPlayer(0).weaponSystem.selectWeapon('revolver', level);
    e.getPlayer(0).scoreManager.addBonusScore(1000);
    e.getPlayer(0).waveTimeBonusTotal = 0;
    (e as any).declareVictory();
    const s = e.getPlayRunStats()!;
    expect(s.baseScore).toBe(1000);
    expect(s.levelBonus).toBe(Math.round(1000 * (mult - 1)));
    expect(s.totalScore).toBe(s.baseScore + s.timeBonus + s.precisionBonus + s.levelBonus);
  });

  it('a defeat gets no level bonus', () => {
    e.getPlayer(0).weaponSystem.selectWeapon('revolver', 1);
    e.getPlayer(0).scoreManager.addBonusScore(1000);
    e.gamePhase = 'GAMEOVER';
    expect(e.getPlayRunStats()!.levelBonus).toBe(0);
  });

  it('counts real damage and healing, and resets', () => {
    e.lives = 5;
    e.activateItemBuff('bar_repair', 1000); // full: nothing healed
    e.activeTargets = [{ id: 'x', kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 0.1, thetaRad: 0, initialThetaRad: 0, x: 0, z: -0.1, speedMps: 1, hitRadiusM: 0.8, killBonusScore: 0, breached: false } as any];
    (e as any).spawnedInWave = 999;
    e.update(100_000, 0.05);
    expect(e.lives).toBe(4);
    e.activateItemBuff('bar_repair', 1000);
    (e as any).applyRewardCard('bar_repair', 1000); // already full again: nothing more
    e.gamePhase = 'GAMEOVER';
    let s = e.getPlayRunStats()!;
    expect(s.damageTaken).toBe(1);
    expect(s.healedLives).toBe(1);
    e.startGame({ withWeaponSelect: false });
    e.gamePhase = 'GAMEOVER';
    s = e.getPlayRunStats()!;
    expect([s.damageTaken, s.healedLives, s.itemsCollected]).toEqual([0, 0, 0]);
  });

  it('records each reward card pick with wave and mid/clear round (playtest-feedback D09)', () => {
    const pickFirstCard = (now: number) => {
      const card = e.activeTargets.find((t) => t.rewardCardKind)!;
      const c = e.computeTargetAimCoords(card);
      e.shootAt(c.targetNormX, c.targetNormY, now, 'press');
    };
    const wave = e.currentWave;
    e.activeTargets = [];
    e.spawnWaveRewardCards(10_000, false);
    pickFirstCard(11_000);
    e.activeTargets = [];
    e.spawnWaveRewardCards(20_000, true);
    pickFirstCard(21_000);
    const picks = e.getPlayer(0).cardPicks;
    expect(picks.map((p) => p.midWave)).toEqual([true, false]);
    // 클리어 카드를 고르면 다음 웨이브로 넘어가므로, 기록된 웨이브는 고른 시점의 값이어야 한다.
    expect(picks.map((p) => p.wave)).toEqual([wave, wave]);
    expect(picks.every((p) => p.auto === false && !!p.kind)).toBe(true);

    e.gamePhase = 'GAMEOVER';
    const stats = e.getPlayRunStats()!;
    expect(stats.cardPicks).toEqual(picks);
    expect(stats.cardPicks).not.toBe(picks);

    e.startGame({ withWeaponSelect: false });
    expect(e.getPlayer(0).cardPicks).toEqual([]);
  });
});
