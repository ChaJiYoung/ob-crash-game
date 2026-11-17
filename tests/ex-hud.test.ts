import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import {
  buildHudSnapshot,
  EX_DANGER_BANNER_MS,
  EX_RUSH_BANNER_MS,
  isHudSnapshotEqual,
} from '../src/pc/hudSnapshot';
import { ArcadeOverlayHUD } from '../src/pc/components/ArcadeOverlayHUD';
import { GAME_TUNING } from '../src/shared/gameTuning';

function enterEx(engine: BeerCrusherEngine, startMs = 1000): number {
  let t = startMs;
  engine.startGame({ withWeaponSelect: false });
  engine.startWave(7);
  (engine as any).spawnedInWave = GAME_TUNING.waves[6].totalSpawns;
  engine.update(t, 0.016);
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

describe('EX HUD snapshot and banners (P02-T01)', () => {
  it('keeps exDanger=0 and empty banner keys outside EX', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const snap = buildHudSnapshot(engine, 1000);
    expect(snap.exDanger).toBe(0);
    expect(snap.exRushBannerKey).toBe('');
    expect(snap.exDangerBannerKey).toBe('');
  });

  it('sets exRushBannerKey and exDangerBannerKey on first rush and expires after duration', () => {
    const engine = new BeerCrusherEngine();
    let t = enterEx(engine);
    t += 50;
    engine.update(t, 0.05);

    const snap = buildHudSnapshot(engine, t);
    expect(snap.exDanger).toBe(1);
    expect(snap.exRushBannerKey).toBe('0|잠수');
    expect(snap.exDangerBannerKey).toBe('1');

    const afterRush = buildHudSnapshot(engine, t + EX_RUSH_BANNER_MS);
    expect(afterRush.exRushBannerKey).toBe('');
    expect(afterRush.exDangerBannerKey).toBe('1');

    const afterDanger = buildHudSnapshot(engine, t + EX_DANGER_BANNER_MS);
    expect(afterDanger.exDangerBannerKey).toBe('');
  });

  it('keeps isHudSnapshotEqual true 100ms later when no value changed', () => {
    const engine = new BeerCrusherEngine();
    let t = enterEx(engine);
    t += 50;
    engine.update(t, 0.05);

    const a = buildHudSnapshot(engine, t);
    const b = buildHudSnapshot(engine, t + 100);
    expect(isHudSnapshotEqual(a, b)).toBe(true);
  });

  it('updates exDanger and exDangerBannerKey to 2 across the 30s boundary', () => {
    const engine = new BeerCrusherEngine();
    let t = enterEx(engine);
    for (let i = 0; i < 30; i += 1) {
      t += 1000;
      engine.update(t, 1.0);
      engine.lives = 5;
      engine.activeTargets = [];
    }
    const snap = buildHudSnapshot(engine, t);
    expect(snap.exDanger).toBe(2);
    expect(snap.exDangerBannerKey).toBe('2');
  });

  it('renders ex-danger-badge without WAVE text when exDanger > 0', () => {
    const engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    const snap = buildHudSnapshot(engine, 1000);
    const html = renderToStaticMarkup(
      React.createElement(ArcadeOverlayHUD, {
        lives: snap.lives,
        maxLives: snap.maxLives,
        wave: snap.wave,
        totalWaves: 7,
        exDanger: 3,
        bosses: snap.bosses,
        activeBuffs: snap.activeBuffs,
        waveProgress: snap.waveProgress,
        players: snap.players,
        presentations: [{ title: 'P1', accent: '#38bdf8' } as any],
        team: { livesTitle: 'BAR DEFENSE' },
      })
    );
    expect(html).toContain('data-testid="ex-danger-badge"');
    expect(html).toContain('DANGER 3');
    expect(html).not.toContain('WAVE');
  });
});
