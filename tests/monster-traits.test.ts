import { describe, it, expect, beforeEach } from 'vitest';
import { BeerCrusherEngine, ActiveTargetEntity } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS } from '../src/shared/constants';

const mk = (kind: ActiveTargetEntity['kind'], radiusM: number, extra: Partial<ActiveTargetEntity> = {}): ActiveTargetEntity => ({
  id: `${kind}_${Math.random()}`,
  kind,
  hp: TARGET_SPECS[kind].maxHp,
  maxHp: TARGET_SPECS[kind].maxHp,
  radiusM,
  thetaRad: 0,
  initialThetaRad: 0,
  x: 0,
  z: -radiusM,
  speedMps: TARGET_SPECS[kind].speedMps,
  hitRadiusM: TARGET_SPECS[kind].hitRadiusM,
  killBonusScore: 10,
  breached: false,
  ...extra,
});

/** Runs update in small steps without letting new spawns interfere. */
function step(engine: BeerCrusherEngine, from: number, ms: number, dt = 0.05): number {
  let now = from;
  const end = from + ms;
  while (now < end) {
    now += dt * 1000;
    // @ts-expect-error private test setup: no new spawns while measuring traits
    engine.spawnedInWave = 999;
    engine.update(now, dt);
  }
  return now;
}

describe('monster traits (gameplay-polish P04-T02)', () => {
  let engine: BeerCrusherEngine;

  beforeEach(() => {
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    engine.activeTargets = [];
  });

  it('pilgood moves at base speed beyond 12m and double speed inside 12m', () => {
    const far = mk('pilgood', 13);
    engine.activeTargets = [far];
    engine.update(1000, 0.0001); // init timers
    const before = far.radiusM;
    engine.update(1100, 0.1);
    const farStep = before - far.radiusM;
    expect(farStep).toBeCloseTo(far.speedMps * 0.1, 3);

    const near = mk('pilgood', 11);
    engine.activeTargets = [near];
    const nBefore = near.radiusM;
    engine.update(1200, 0.1);
    expect(nBefore - near.radiusM).toBeCloseTo(near.speedMps * 0.1 * GAME_TUNING.monsters.pilgood.chargeSpeedMult, 3);
  });

  it('pilgood does not charge in the sandbox or tutorial', () => {
    for (const mode of ['sandbox', 'tutorial'] as const) {
      const e = new BeerCrusherEngine();
      if (mode === 'sandbox') e.startSandboxMode();
      else e.startTutorialMode();
      const t = mk('pilgood', 11);
      e.activeTargets = [t];
      const before = t.radiusM;
      e.update(1000, 0.1);
      expect(before - t.radiusM).toBeCloseTo(t.speedMps * 0.1, 3);
    }
  });

  it("items and projectiles whose kind is 'pilgood' never charge", () => {
    const proj = mk('pilgood', 10, { isProjectile: true, customNormY: 0.1, speedMps: 3.2 });
    const item = mk('pilgood', 10, { isItem: true, itemKind: 'power_shot', speedMps: 1 });
    engine.activeTargets = [proj, item];
    engine.update(1000, 0.0001);
    const pb = proj.radiusM;
    const ib = item.radiusM;
    engine.update(1100, 0.1);
    expect(pb - proj.radiusM).toBeCloseTo(3.2 * 0.1, 3);
    expect(ib - item.radiusM).toBeCloseTo(1 * 0.1, 3);

    const projectile = engine.spawnMonsterProjectile(2000, 'hanmac');
    expect(projectile.customBaseY).toBe(1.45);
  });

  it('caslight sways widely while pilgood keeps a straight lane', () => {
    const cas = mk('caslight', 14, { speedMps: 0.0001 });
    const pil = mk('pilgood', 20, { speedMps: 0.0001 });
    engine.activeTargets = [cas, pil];
    let maxDev = 0;
    let pilDev = 0;
    for (let i = 1; i <= 200; i++) {
      engine.update(1000 + i * 50, 0.05);
      maxDev = Math.max(maxDev, Math.abs(cas.thetaRad - (cas.initialThetaRad ?? 0)));
      pilDev = Math.max(pilDev, Math.abs(pil.thetaRad - (pil.initialThetaRad ?? 0)));
    }
    expect(maxDev).toBeGreaterThan(0.1);
    expect(maxDev).toBeLessThanOrEqual(GAME_TUNING.monsters.caslight.swayAmplitudeRad + 1e-9);
    expect(pilDev).toBe(0);
  });

  it('hanmac stops at 11m, never reaches the defense line, and fires from its own theta every 3s', () => {
    const h = mk('hanmac', 14, { thetaRad: 0.2, initialThetaRad: 0.2, x: Math.sin(0.2) * 14, z: -Math.cos(0.2) * 14 });
    engine.activeTargets = [h];

    const fired: ActiveTargetEntity[] = [];
    let now = 1000;
    for (let i = 0; i < 400; i++) {
      // 20s in 50ms steps; intercept every projectile so only the hanmac's own behaviour is measured
      now = step(engine, now, 50);
      engine.activeTargets.filter((t) => t.isProjectile).forEach((t) => fired.push(t));
      engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile);
    }
    expect(h.radiusM).toBe(GAME_TUNING.monsters.hanmac.stopRadiusM);
    expect(engine.lives).toBe(5);
    // Arrives after ~1s, first shot 1s later, then every 3s: ~6 shots in 20s
    expect(fired.length).toBeGreaterThanOrEqual(5);
    expect(fired.length).toBeLessThanOrEqual(7);
    fired.forEach((p) => expect(p.initialThetaRad).toBeCloseTo(0.2, 5));
  });

  it('a stunned hanmac does not fire', () => {
    const h = mk('hanmac', 11, { thetaRad: 0, stunUntilMs: 1_000_000 });
    engine.activeTargets = [h];
    step(engine, 1000, 8000);
    expect(engine.activeTargets.some((t) => t.isProjectile)).toBe(false);
  });

  it('a hanmac does not fire immediately after the card selection freeze ends', () => {
    const h = mk('hanmac', 11, { thetaRad: 0 });
    engine.activeTargets = [h];
    let now = step(engine, 1000, 3500); // fires at least once by now
    engine.activeTargets = engine.activeTargets.filter((t) => !t.isProjectile);

    engine.spawnWaveRewardCards(now, false);
    for (let i = 0; i < 100; i++) {
      now += 100;
      engine.update(now, 0.1); // 10s frozen
    }
    const pick = engine.activeTargets.find((t) => t.rewardCardKind)!;
    const p = engine.computeTargetAimCoords(pick);
    engine.shootAt(p.targetNormX, p.targetNormY, now, 'press');
    engine.activeTargets = engine.activeTargets.filter((t) => t.kind === 'hanmac');

    now = step(engine, now, 200);
    expect(engine.activeTargets.some((t) => t.isProjectile)).toBe(false);
  });

  it('hanmac keeps walking in the sandbox and tutorial', () => {
    for (const mode of ['sandbox', 'tutorial'] as const) {
      const e = new BeerCrusherEngine();
      if (mode === 'sandbox') e.startSandboxMode();
      else e.startTutorialMode();
      const h = mk('hanmac', 11.5, { speedMps: 2 });
      e.activeTargets = [h];
      e.update(1000, 0.5);
      expect(h.radiusM).toBeLessThan(GAME_TUNING.monsters.hanmac.stopRadiusM);
    }
  });

  it('removes hanmac enrage entirely', () => {
    const h = mk('hanmac', 14);
    expect((h as unknown as { isEnraged?: boolean }).isEnraged).toBeUndefined();
  });
});
