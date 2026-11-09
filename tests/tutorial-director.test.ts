import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { TutorialDirector } from '../src/pc/tutorial/TutorialDirector';

afterEach(() => vi.useRealTimers());

describe('TutorialDirector', () => {
  it('drives 1 -> 2 -> 3 -> 4 -> COMPLETED sequentially through events', () => {
    vi.useFakeTimers();
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);

    const director = new TutorialDirector(engine);
    let now = 1000;
    director.start(now);

    // Step 1: 3 cans
    expect(director.step).toBe(1);
    expect(engine.activeTargets.length).toBe(3);

    // Kill all Step 1 targets
    const step1Ids = new Set(engine.activeTargets.map((t) => t.id));
    while (engine.activeTargets.some((t) => step1Ids.has(t.id)) && now < 20000) {
      now += 500;
      const t = engine.activeTargets.find((x) => step1Ids.has(x.id))!;
      const proj = (engine as any).computeTargetAimCoords(t, 1.0);
      engine.shootAt(proj.targetNormX, proj.targetNormY, now, 'press');
    }

    // Should automatically advance to Step 2: 1 bottle
    expect(director.step).toBe(2);
    expect(engine.activeTargets.length).toBe(1);
    expect(engine.activeTargets[0].kind).toBe('bottle');

    // Kill the Step 2 bottle
    const step2Ids = new Set(engine.activeTargets.map((t) => t.id));
    while (engine.activeTargets.some((t) => step2Ids.has(t.id)) && now < 40000) {
      now += 500;
      const t = engine.activeTargets.find((x) => step2Ids.has(x.id))!;
      const proj = (engine as any).computeTargetAimCoords(t, 1.0);
      engine.shootAt(proj.targetNormX, proj.targetNormY, now, 'press');
    }

    // Should advance to Step 3: skill targets (5)
    expect(director.step).toBe(3);
    expect(engine.activeTargets.length).toBe(5);
    expect(engine.getPlayer(0).weaponSystem.getState().skillStock).toBeGreaterThan(0);

    // Step 3 has three rounds (shotgun -> revolver -> gatling): use each weapon's skill once
    now += 600;
    expect(engine.getPlayer(0).weaponSystem.getState().weaponKind).toBe('shotgun');
    expect(engine.triggerWeaponSkill(now).activated).toBe(true);
    expect(director.step).toBe(3); // 샷건은 박힌 몬스터가 터질 때까지 기다린다
    now += 2500; // Lv1 기절(2.0초)이 끝나면 터진다
    engine.update(now, 0.016);
    vi.advanceTimersByTime(500);
    expect(director.skillRound).toBe(1);
    expect(engine.getPlayer(0).weaponSystem.getState().weaponKind).toBe('revolver');

    now += 600;
    expect(engine.triggerWeaponSkill(now).activated).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(director.skillRound).toBe(2);
    expect(engine.getPlayer(0).weaponSystem.getState().weaponKind).toBe('gatling');

    now += 600;
    expect(engine.triggerWeaponSkill(now).activated).toBe(true);
    vi.advanceTimersByTime(1200);

    // Should advance to Step 4: fever ready (gauge 100), targets cleared
    expect(director.step).toBe(4);
    expect(engine.getPlayer(0).weaponSystem.getState().weaponKind).toBe('shotgun');
    expect(engine.getPlayer(0).scoreManager.getState().isFeverReady).toBe(true);
    expect(engine.activeTargets.length).toBe(0);

    // Activate fever -> spawns 6 fever targets
    now += 500;
    const feverActivated = engine.activateFever(now);
    expect(feverActivated).toBe(true);
    expect(engine.activeTargets.length).toBe(6);

    // Clear fever targets
    const step4Ids = new Set(engine.activeTargets.map((t) => t.id));
    while (engine.activeTargets.some((t) => step4Ids.has(t.id)) && now < 60000) {
      now += 500;
      const t = engine.activeTargets.find((x) => step4Ids.has(x.id))!;
      const proj = (engine as any).computeTargetAimCoords(t, 1.0);
      engine.shootAt(proj.targetNormX, proj.targetNormY, now, 'press');
    }

    // All targets cleared in step 4 -> completed
    expect(director.step).toBe('COMPLETED');
    expect(director.completed).toBe(true);

    director.stop();
  });

  it('resets bottle to radius 14 when breached in Step 2', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();

    const director = new TutorialDirector(engine);
    director.start(1000);
    director.advanceStep(2);

    expect(director.step).toBe(2);
    expect(engine.activeTargets.length).toBe(1);

    // Move bottle past defense line
    engine.activeTargets[0].radiusM = 0.5;
    engine.activeTargets[0].breached = true;

    engine.update(2000, 0.05);

    // Target should have been reset to radius 14
    expect(director.step).toBe(2);
    expect(engine.activeTargets.length).toBe(1);
    expect(engine.activeTargets[0].radiusM).toBe(14.0);
    expect(engine.lives).toBe(5); // No life lost

    director.stop();
  });

  it('re-spawns targets and stays on step 3 if cleared by regular shots', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);

    const director = new TutorialDirector(engine);
    let now = 1000;
    director.start(now);
    director.advanceStep(3);

    expect(director.step).toBe(3);
    expect(engine.activeTargets.length).toBe(5);

    // Shoot down the initial 5 targets
    const initialStep3Ids = new Set(engine.activeTargets.map((t) => t.id));
    while (engine.activeTargets.some((t) => initialStep3Ids.has(t.id)) && now < 20000) {
      now += 500;
      const t = engine.activeTargets.find((x) => initialStep3Ids.has(x.id))!;
      const proj = (engine as any).computeTargetAimCoords(t, 1.0);
      engine.shootAt(proj.targetNormX, proj.targetNormY, now, 'press');
    }

    // Step should still be 3 and targets respawned (5 new targets)
    expect(director.step).toBe(3);
    expect(engine.activeTargets.length).toBe(5);
    expect(engine.activeTargets.every((t) => !initialStep3Ids.has(t.id))).toBe(true);

    director.stop();
  });
});
