import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

/**
 * 카드 빈도 시뮬레이션(playtest-feedback D07-1).
 * 몬스터를 모두 처치하는 봇으로 4·6웨이브를 돌려, 2인 판의 중간 카드 횟수가 1인 판과 비슷한지 확인한다.
 * 2026-11-08 기준 값: 4웨이브 1인 56킬·2.0회 / 2인 114킬·2.0회, 6웨이브 57킬·1.8회 / 109킬·1.8회.
 */
type SimResult = { kills: number; midCards: number };

function simulate(playerCount: 1 | 2, wave: 4 | 6, seed: number): SimResult {
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const realRandom = Math.random;
  Math.random = rng;
  try {
    const e: any = new BeerCrusherEngine();
    e.dropRng = rng;
    e.startGame({ withWeaponSelect: false, playerCount });
    e.players.forEach((p: any) => {
      p.weaponSystem.infiniteAmmo = true;
    });
    e.startWave(wave);

    let kills = 0;
    let midCards = 0;
    let cleared = false;
    const isPlainMonster = (t: any) =>
      !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind;
    const origKill = e.handleMonsterKilled.bind(e);
    e.handleMonsterKilled = (t: any, n: number, k: any) => {
      if (isPlainMonster(t)) kills++;
      return origKill(t, n, k);
    };
    const origSpawn = e.spawnWaveRewardCards.bind(e);
    e.spawnWaveRewardCards = (n: number, isWaveClear = true) => {
      if (isWaveClear) cleared = true;
      else midCards++;
      return origSpawn(n, isWaveClear);
    };

    let now = 1000;
    let tick = 0; // 시간 나머지(now % N)로 쏘면 16ms 간격과 안 맞아 봇이 한 번도 쏘지 않을 수 있다.
    let cardOpenedAt = -1;
    while (!cleared && now < 300_000 && e.currentWave === wave && e.gamePhase === 'PLAYING') {
      now += 16;
      e.update(now, 0.016);
      if (e.isRewardCardPending) {
        if (cardOpenedAt < 0) cardOpenedAt = now;
        if (now - cardOpenedAt > 900) {
          for (let pi = 0; pi < playerCount && e.isRewardCardPending; pi++) {
            const card =
              e.activeTargets.find((t: any) => t.rewardCardKind && t.ownerIndex === pi) ??
              e.activeTargets.find((t: any) => t.rewardCardKind);
            if (!card) continue;
            const c = e.computeTargetAimCoords(card);
            e.shootAt(c.targetNormX, c.targetNormY, now, 'press', pi);
          }
        }
        continue;
      }
      cardOpenedAt = -1;
      if (++tick % 10 !== 0) continue;
      const mons = e.activeTargets.filter((t: any) => isPlainMonster(t) && !t.breached);
      for (let pi = 0; pi < playerCount && pi < mons.length; pi++) {
        const t = mons[pi];
        t.hp = Math.min(t.hp, 0.01);
        const c = e.computeTargetAimCoords(t);
        e.shootAt(c.targetNormX, c.targetNormY, now, 'press', pi);
      }
    }
    return { kills, midCards };
  } finally {
    Math.random = realRandom;
  }
}

const SEEDS = [1, 2, 3, 4, 5];
const average = (playerCount: 1 | 2, wave: 4 | 6) => {
  const runs = SEEDS.map((seed) => simulate(playerCount, wave, seed));
  return {
    kills: runs.reduce((a, r) => a + r.kills, 0) / runs.length,
    midCards: runs.reduce((a, r) => a + r.midCards, 0) / runs.length,
  };
};

describe('card rate simulation (playtest-feedback P02-T02)', () => {
  it('2-player mid-wave card count stays within 0.5 of solo on waves 4 and 6', () => {
    const rows: Record<string, unknown>[] = [];
    for (const wave of [4, 6] as const) {
      const solo = average(1, wave);
      const coop = average(2, wave);
      rows.push({ wave, players: 1, ...solo }, { wave, players: 2, ...coop });

      expect(solo.midCards).toBeGreaterThan(0);
      expect(Math.abs(coop.midCards - solo.midCards)).toBeLessThanOrEqual(0.5);
      const ratio = coop.kills / solo.kills;
      expect(ratio).toBeGreaterThanOrEqual(1.6);
      expect(ratio).toBeLessThanOrEqual(2.4);
    }
    console.table(rows);
  }, 120_000);
});
