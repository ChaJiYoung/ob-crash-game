import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

const toSkillStep = () => {
  const engine = new BeerCrusherEngine();
  engine.startTutorialMode();
  engine.advanceTutorialStep(2);
  engine.advanceTutorialStep(3);
  return engine;
};

describe('tutorial skill step (step 3)', () => {
  it('sets up five stationary targets and a ready skill', () => {
    const engine = toSkillStep();
    expect(engine.tutorialStep).toBe(3);
    expect(engine.activeTargets.length).toBe(5);
    expect(engine.activeTargets.every((t) => t.speedMps === 0)).toBe(true);
    expect(engine.weaponSystem.getState().skillStock).toBeGreaterThan(0);
  });

  it('does not charge fever yet', () => {
    expect(toSkillStep().scoreManager.getState().feverGauge).toBe(0);
  });

  it('moves to the fever step once the skill is used', () => {
    const engine = toSkillStep();
    const res = engine.triggerWeaponSkill(1000);
    expect(res.activated).toBe(true);
    expect(engine.tutorialStep).toBe(4);
    expect(engine.scoreManager.getState().feverGauge).toBe(100);
    expect(engine.activeTargets.length).toBe(0);
  });

  it('stays on step 3 and re-sets the targets if shots cleared them without the skill', () => {
    const engine = toSkillStep();
    const lastId = engine.activeTargets[0].id;
    engine.activeTargets = [engine.activeTargets[0]];
    const t = engine.activeTargets[0];
    engine.activeTargets[0].hp = 0.01;
    // aim straight at it: use its projected coords through a normal shot at the target centre
    const proj = (engine as any).computeTargetAimCoords(t, 1.0);
    engine.shootAt(proj.targetNormX, proj.targetNormY, 5000, 'press');
    expect(engine.tutorialStep).toBe(3);
    expect(engine.activeTargets.length).toBe(5);
    expect(lastId).toBeTruthy();
  });

  it('a skill used outside the skill step does not change the step', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    engine.triggerWeaponSkill(1000);
    expect(engine.tutorialStep).toBe(1);
  });
});

describe('tutorial fever step (step 4)', () => {
  it('finishes the tutorial when the fever targets are cleared', () => {
    const engine = toSkillStep();
    engine.advanceTutorialStep(4);
    engine.spawnTutorialFeverEnemies();
    expect(engine.activeTargets.length).toBe(6);
    engine.activeTargets = [];
    engine.advanceTutorialStep('COMPLETED');
    expect(engine.tutorialCompleted).toBe(true);
  });
});
