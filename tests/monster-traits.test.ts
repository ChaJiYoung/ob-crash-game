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

  it('a hit hanmac is not enraged or sped up anymore', () => {
    const h = mk('hanmac', 14, { speedMps: 2 });
    engine.activeTargets = [h];
    engine.update(1000, 0.0001);
    engine.weaponSystem.selectWeapon('revolver', 1);
    const p = engine.computeTargetAimCoords(h);
    engine.shootAt(p.targetNormX, p.targetNormY, 1100);
    expect(h.hp).toBeLessThan(3);
    expect((h as unknown as { isEnraged?: boolean }).isEnraged).toBeUndefined();
    const before = h.radiusM;
    engine.update(1300, 0.1);
    expect(before - h.radiusM).toBeCloseTo(2 * 0.1, 3);
  });

  describe('obi shield', () => {
    const guarded = (guardPhaseMs: number): ActiveTargetEntity =>
      mk('obi', 9, { guardPhaseMs, hp: 2, maxHp: 2 });

    // With guardPhase 0 the shield is up for t in [0,2000) and down for [2000,3000) of each 3s cycle
    const UP = 3000 * 5 + 500; // 15500: shield up
    const DOWN = 3000 * 5 + 2500; // 17500: shield down

    const shoot = (e: BeerCrusherEngine, t: ActiveTargetEntity, now: number, source: 'press' | 'fever' = 'press') => {
      e.activeTargets = [t];
      (e as any).updateGuards(now);
      const p = e.computeTargetAimCoords(t);
      return e.shootAt(p.targetNormX, p.targetNormY, now, source);
    };

    it('blocks damage while raised: hp unchanged, no score or fever, ammo is spent', () => {
      const e = engine;
      const t = guarded(0);
      const ammo = e.weaponSystem.getState().ammo;
      const res = shoot(e, t, UP);
      expect(res.shieldBlocked).toBe(true);
      expect(res.killed).toBe(false);
      expect(t.hp).toBe(2);
      expect(e.scoreManager.getState().totalScore).toBe(0);
      expect(e.scoreManager.getState().feverGauge).toBe(0);
      expect(e.weaponSystem.getState().ammo).toBe(ammo - 1);
    });

    it('takes damage while lowered', () => {
      const t = guarded(0);
      const res = shoot(engine, t, DOWN);
      expect(res.shieldBlocked).toBeUndefined();
      expect(t.hp).toBeLessThan(2);
    });

    it('fever shots and skills pierce the shield', () => {
      engine.scoreManager.forceSetFeverGauge(100);
      engine.scoreManager.activateFever(UP - 100);
      const t = guarded(0);
      const res = shoot(engine, t, UP, 'fever');
      expect(res.shieldBlocked).toBeUndefined();
      expect(t.hp).toBeLessThan(2);

      const e2 = new BeerCrusherEngine();
      e2.startGame({ withWeaponSelect: false });
      e2.weaponSystem.selectWeapon('shotgun', 1);
      const t2 = guarded(0);
      e2.activeTargets = [t2];
      (e2 as any).updateGuards(UP);
      expect(t2.isGuarding).toBe(true);
      expect(e2.triggerWeaponSkill(UP).activated).toBe(true);
      expect(t2.hp).toBeLessThan(2);
    });

    it('a stunned obi lowers its shield', () => {
      const t = guarded(0);
      t.stunUntilMs = UP + 5000;
      engine.activeTargets = [t];
      (engine as any).updateGuards(UP);
      expect(t.isGuarding).toBe(false);
    });

    it('spawned obis get different guard phases; cards and hand-made obis have none', () => {
      const seq = [0.0, 0.34, 0.9];
      let n = 0;
      engine.dropRng = () => seq[n++ % seq.length];
      const obis = [mk('obi', 9), mk('obi', 9), mk('obi', 9)];
      obis.forEach((o) => (engine as any).applyMonsterTraits(o));
      const cycle = GAME_TUNING.monsters.obi.guardUpMs + GAME_TUNING.monsters.obi.guardDownMs;
      expect(obis.map((o) => o.guardPhaseMs)).toEqual(seq.map((v) => v * cycle));
      expect(new Set(obis.map((o) => o.guardPhaseMs)).size).toBe(3);

      // Hand-made obis and reward cards (kind 'obi') have no phase, so they are never shielded
      expect(mk('obi', 9).guardPhaseMs).toBeUndefined();
      engine.spawnWaveRewardCards(2000, false);
      (engine as any).updateGuards(3000);
      engine.activeTargets
        .filter((t) => t.rewardCardKind)
        .forEach((c) => {
          expect(c.guardPhaseMs).toBeUndefined();
          expect(c.isGuarding).toBeFalsy();
        });
    });

    it('revolver pierce skips a guarding obi behind the target', () => {
      engine.weaponSystem.selectWeapon('revolver', 3);
      const front = mk('bottle', 6, { hp: 10, maxHp: 10 });
      const rear = guarded(0);
      rear.radiusM = 9;
      rear.z = -9;
      engine.activeTargets = [front, rear];
      (engine as any).updateGuards(UP);
      expect(rear.isGuarding).toBe(true);
      const p = engine.computeTargetAimCoords(front);
      engine.shootAt(p.targetNormX, p.targetNormY, UP);
      expect(rear.hp).toBe(2);
    });
  });

  describe('bottle split', () => {
    const bigBottle = () => mk('bottle', 10, { thetaRad: 0.1, initialThetaRad: 0.1, x: Math.sin(0.1) * 10, z: -Math.cos(0.1) * 10, hp: 0.1, maxHp: 4 });

    const shootKill = (e: BeerCrusherEngine, t: ActiveTargetEntity, now: number) => {
      e.weaponSystem.selectWeapon('revolver', 1);
      const p = e.computeTargetAimCoords(t);
      return e.shootAt(p.targetNormX, p.targetNormY, now);
    };

    it('splits into two small bottles on both sides with the configured stats', () => {
      const b = bigBottle();
      engine.activeTargets = [b];
      const res = shootKill(engine, b, 1000);
      expect(res.killed).toBe(true);
      const kids = engine.activeTargets.filter((t) => t.isSplitChild);
      expect(kids.length).toBe(2);
      const cfg = GAME_TUNING.monsters.bottle;
      expect(kids.map((k) => k.thetaRad).sort()).toEqual([0.1 - cfg.splitOffsetRad, 0.1 + cfg.splitOffsetRad].sort());
      kids.forEach((k) => {
        expect(k.hp).toBe(cfg.childHp);
        expect(k.speedMps).toBeCloseTo(cfg.childSpeedMps * 1, 5);
        expect(k.modelScaleMult).toBe(cfg.childScale);
        expect(k.customBaseY).toBe(cfg.childBaseY);
        expect(k.radiusM).toBe(10);
      });
    });

    it('children do not split again, but killing them counts toward kills', () => {
      const b = bigBottle();
      engine.activeTargets = [b];
      shootKill(engine, b, 1000);
      const kid = engine.activeTargets.find((t) => t.isSplitChild)!;
      kid.hp = 0.1;
      shootKill(engine, kid, 2000);
      expect(engine.activeTargets.filter((t) => t.isSplitChild).length).toBe(1);
    });

    it('a skill kill also splits a big bottle', () => {
      const b = bigBottle();
      b.thetaRad = 0;
      engine.activeTargets = [b];
      engine.weaponSystem.selectWeapon('shotgun', 4);
      expect(engine.triggerWeaponSkill(1000).activated).toBe(true);
      expect(engine.activeTargets.filter((t) => t.isSplitChild).length).toBe(2);
    });

    it('the wave only ends after the children are cleared', () => {
      engine.startWave(4);
      // @ts-expect-error private test setup
      engine.spawnedInWave = GAME_TUNING.waves[3].totalSpawns;
      const b = bigBottle();
      engine.activeTargets = [b];
      shootKill(engine, b, 1000);
      engine.update(1100, 0.016);
      expect(engine.isRewardCardPending).toBe(false);
      engine.activeTargets = engine.activeTargets.filter((t) => !t.isSplitChild);
      engine.update(1200, 0.016);
      expect(engine.isRewardCardPending).toBe(true);
    });

    it('does not split in the sandbox or tutorial', () => {
      for (const mode of ['sandbox', 'tutorial'] as const) {
        const e = new BeerCrusherEngine();
        if (mode === 'sandbox') e.startSandboxMode();
        else e.startTutorialMode();
        const b = bigBottle();
        e.activeTargets = [b];
        shootKill(e, b, 1000);
        expect(e.activeTargets.filter((t) => t.isSplitChild).length).toBe(0);
      }
    });

    it('wave progress never goes negative or above 100% when children are killed', () => {
      engine.startWave(4);
      // @ts-expect-error private test setup
      engine.killedInWave = GAME_TUNING.waves[3].totalSpawns + 3;
      const p = engine.getWaveProgress();
      expect(p.remainingInWave).toBe(0);
      expect(p.progressPercent).toBe(100);
    });

    it('big bottles get the 1.2x model scale hook at spawn', () => {
      const big = mk('bottle', 10);
      (engine as any).applyMonsterTraits(big);
      expect(big.modelScaleMult).toBe(GAME_TUNING.monsters.bottle.bigScale);
    });
  });
});
