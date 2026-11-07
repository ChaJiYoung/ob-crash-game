import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';

const bosses = (e: BeerCrusherEngine) => e.activeTargets.filter((t) => t.kind === 'boss');
const fieldMonsters = (e: BeerCrusherEngine): number => (e as any).countFieldMonsters();
const startThreshold = (wave: number): number =>
  Math.ceil(GAME_TUNING.waves[wave - 1].totalSpawns * GAME_TUNING.boss.encounterStartRatio);

/** Freezes everything except bosses so a long test never loses lives to walking monsters. */
function freezeNonBosses(e: BeerCrusherEngine): void {
  e.activeTargets.forEach((t) => {
    if (t.kind !== 'boss') t.speedMps = 0;
  });
}

function killBoss(engine: BeerCrusherEngine, boss: ActiveTargetEntity, now: number): void {
  boss.hp = 0.1;
  engine.getPlayer(0).weaponSystem.selectWeapon('revolver', 1);
  const p = engine.computeTargetAimCoords(boss);
  const res = engine.shootAt(p.targetNormX, p.targetNormY, now);
  expect(res.killed).toBe(true);
}

describe('boss fights run alongside regular monsters', () => {
  let engine: BeerCrusherEngine;
  let now: number;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.lives = engine.maxLives = 999;
    now = 100_000;
  });

  /** Starts a boss wave with the boss already out (the spawn total reached in one jump). */
  const startWithBoss = (wave: number): void => {
    engine.startWave(wave);
    engine.activeTargets = [];
    (engine as any).spawnedInWave = GAME_TUNING.waves[wave - 1].totalSpawns;
    engine.update(now, 0.016);
    expect(bosses(engine).length).toBeGreaterThan(0);
  };

  const stepMs = (ms: number): void => {
    now += ms;
    engine.update(now, ms / 1000);
    freezeNonBosses(engine);
  };

  it('has the encounter start ratio and the resulting thresholds', () => {
    expect(GAME_TUNING.boss.encounterStartRatio).toBe(0.5);
    expect([3, 5, 7].map(startThreshold)).toEqual([8, 10, 13]);
  });

  it.each([3, 5, 7])('wave %i: the boss appears exactly at the start threshold', (wave) => {
    engine.startWave(wave);
    engine.activeTargets = [];
    (engine as any).lastSpawnTimeMs = now; // no regular spawn in this frame
    (engine as any).spawnedInWave = startThreshold(wave) - 1;
    engine.update(now, 0.016);
    expect(bosses(engine).length).toBe(0);
    expect(engine.isBossEncounterActive).toBe(false);

    (engine as any).spawnedInWave = startThreshold(wave);
    engine.update(now + 16, 0.016);
    expect(engine.isBossEncounterActive).toBe(true);
    expect(bosses(engine).length).toBe(GAME_TUNING.waves[wave - 1].boss!.coolerHp.length + (GAME_TUNING.waves[wave - 1].boss!.kingHp ? 1 : 0));
  });

  it('a wave that jumps to its spawn total still gets its boss in the same frame', () => {
    engine.startWave(3);
    engine.activeTargets = [];
    (engine as any).spawnedInWave = GAME_TUNING.waves[2].totalSpawns;
    engine.update(now, 0.016);
    expect(bosses(engine).length).toBe(1);
  });

  it('keeps refilling regular monsters past the spawn total while a boss is alive', () => {
    startWithBoss(3);
    const total = GAME_TUNING.waves[2].totalSpawns;
    const spawnedBefore = (engine as any).spawnedInWave as number;
    expect(spawnedBefore).toBe(total);
    stepMs(GAME_TUNING.waves[2].spawnIntervalMs + 20);
    expect((engine as any).spawnedInWave).toBeGreaterThan(total);
    expect(fieldMonsters(engine)).toBeGreaterThan(0);
  });

  it('counts only regular monsters toward the field cap, so the boss and its minions do not crowd them out', () => {
    startWithBoss(3);
    const cap = GAME_TUNING.waves[2].maxSimultaneous;
    engine.spawnBossMinionWave(now, 4);
    for (let i = 0; i < 20; i++) {
      stepMs(GAME_TUNING.waves[2].spawnIntervalMs + 20);
      expect(fieldMonsters(engine)).toBeLessThanOrEqual(cap);
    }
    expect(fieldMonsters(engine)).toBe(cap);
    expect(engine.activeTargets.filter((t) => t.isSummonedMinion).length).toBe(4);
  });

  it('a wave without a boss never spawns past its total', () => {
    engine.startWave(4);
    const total = GAME_TUNING.waves[3].totalSpawns;
    (engine as any).spawnedInWave = total;
    engine.activeTargets = [
      {
        id: 'lingering', kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 12, thetaRad: 0, x: 0, z: -12,
        speedMps: 0, hitRadiusM: 1, killBonusScore: 1, breached: false,
      } as ActiveTargetEntity,
    ];
    for (let i = 0; i < 6; i++) stepMs(GAME_TUNING.waves[3].spawnIntervalMs + 20);
    expect((engine as any).spawnedInWave).toBe(total);
  });

  it('the boss keeps firing shells even when the field is crowded', () => {
    startWithBoss(3);
    engine.spawnBossMinionWave(now, 4);
    for (let i = 0; i < 10; i++) stepMs(GAME_TUNING.waves[2].spawnIntervalMs + 20);
    expect(fieldMonsters(engine)).toBe(GAME_TUNING.waves[2].maxSimultaneous);
    engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile);
    (engine as any).lastBossProjectileMs = now - 4000;
    stepMs(50);
    expect(engine.activeTargets.some((t) => t.isProjectile)).toBe(true);
  });

  it('killing the last boss starts the clear sequence, then deals the cards and moves on, even with spawns left over', () => {
    engine.startWave(3);
    engine.activeTargets = [];
    (engine as any).lastSpawnTimeMs = now;
    (engine as any).spawnedInWave = startThreshold(3); // well short of the total
    engine.update(now, 0.016);
    expect(bosses(engine).length).toBe(1);
    stepMs(GAME_TUNING.waves[2].spawnIntervalMs + 20); // a regular monster joins the fight
    expect(fieldMonsters(engine)).toBeGreaterThan(0);

    const spawnedAtKill = (engine as any).spawnedInWave as number;
    killBoss(engine, bosses(engine)[0], now);
    expect(engine.isBossClearSequence()).toBe(true);

    const end = now + GAME_TUNING.boss.clear.durationMs + 300;
    while (now < end) {
      now += 50;
      engine.update(now, 0.05);
    }
    expect(engine.isBossClearSequence()).toBe(false);
    expect((engine as any).spawnedInWave).toBe(spawnedAtKill); // nothing spawned during or after the sequence

    now += 50;
    engine.update(now, 0.05);
    expect(engine.isRewardCardPending).toBe(true);
    expect(engine.gamePhase).toBe('PLAYING');

    now += 1000; // the cards are shot-locked for the first 800ms
    const card = engine.activeTargets.find((t) => t.rewardCardKind)!;
    const p = engine.computeTargetAimCoords(card);
    engine.shootAt(p.targetNormX, p.targetNormY, now);
    expect(engine.currentWave).toBe(4);
  });

  it('wave 7 ends in victory only after the king and both coolers are down', () => {
    startWithBoss(7);
    expect(bosses(engine).length).toBe(3);
    for (const b of [...bosses(engine)]) {
      expect(engine.gamePhase).toBe('PLAYING');
      now += 600; // the revolver's fire interval
      killBoss(engine, b, now);
    }
    expect(engine.isBossClearSequence()).toBe(true);
    const end = now + GAME_TUNING.boss.clear.durationMs + 300;
    while (now < end) {
      now += 50;
      engine.update(now, 0.05);
    }
    expect(engine.gamePhase).toBe('VICTORY');
  });

  describe('cards and boss fights', () => {
    const kill = (n: number): void => {
      // Count n regular kills the way a shot would: through the engine's own kill handler.
      for (let i = 0; i < n; i++) {
        const t = {
          id: `k${i}`, kind: 'pilgood', hp: 1, maxHp: 1, radiusM: 12, thetaRad: 0, x: 0, z: -12,
          speedMps: 0, hitRadiusM: 1, killBonusScore: 1, breached: false,
        } as ActiveTargetEntity;
        (engine as any).handleMonsterKilled(t, now);
      }
    };

    it('never deals a card mid-fight in a boss wave, however many monsters die', () => {
      for (const wave of [3, 5, 7]) {
        startWithBoss(wave);
        kill(200);
        expect(engine.isRewardCardPending).toBe(false);
        expect(engine.activeTargets.some((t) => t.rewardCardKind)).toBe(false);
      }
    });

    it('does not soft-lock when a mid-fight card and the last boss dying land in the same hit', () => {
      // A blade or pierce shot can kill a regular monster that completes the card target and then the boss.
      for (const wave of [3, 7]) {
        const e = new BeerCrusherEngine();
        e.startGame({ withWeaponSelect: false });
        e.lives = e.maxLives = 999;
        let t = 500_000;
        e.startWave(wave);
        e.activeTargets = [];
        (e as any).spawnedInWave = GAME_TUNING.waves[wave - 1].totalSpawns;
        e.update(t, 0.016);
        e.spawnWaveRewardCards(t, false); // the card dealt by the monster killed just before the boss
        expect(e.isRewardCardPending).toBe(true);

        const all = [...bosses(e)];
        e.activeTargets = e.activeTargets.filter((x) => x.kind !== 'boss');
        all.forEach((b) => (e as any).handleMonsterKilled(b, t));
        expect(e.isBossClearSequence()).toBe(true);
        expect(e.isRewardCardPending).toBe(false);

        const end = t + GAME_TUNING.boss.clear.durationMs + 300;
        while (t < end) {
          t += 50;
          e.update(t, 0.05);
        }
        t += 50;
        e.update(t, 0.05);
        if (wave === 7) {
          expect(e.gamePhase).toBe('VICTORY');
        } else {
          expect(e.gamePhase).toBe('PLAYING');
          expect(e.isRewardCardPending).toBe(true); // the after-boss card, not a stale one
          expect(e.pendingWaveAdvance).toBe(true);
        }
      }
    });
  });
});
