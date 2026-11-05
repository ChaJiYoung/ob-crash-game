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
    e.weaponSystem.selectWeapon('revolver', 2);
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
    expect(s.totalScore).toBe(s.baseScore + s.timeBonus + s.precisionBonus);
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
});
