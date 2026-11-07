import { describe, it, expect } from 'vitest';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { TutorialDirector } from '../src/pc/tutorial/TutorialDirector';

const toSkillStep = () => {
  const engine = new BeerCrusherEngine();
  engine.startTutorialMode();
  const director = new TutorialDirector(engine);
  director.start(1000);
  director.advanceStep(2);
  director.advanceStep(3);
  return { engine, director };
};

describe('tutorial skill step (step 3)', () => {
  it('sets up five stationary targets and a ready skill', () => {
    const { engine, director } = toSkillStep();
    expect(director.step).toBe(3);
    expect(engine.activeTargets.length).toBe(5);
    expect(engine.activeTargets.every((t) => t.speedMps === 0)).toBe(true);
    expect(engine.getPlayer(0).weaponSystem.getState().skillStock).toBeGreaterThan(0);
  });

  it('does not charge fever yet', () => {
    expect(toSkillStep().engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(0);
  });

  it('moves to the fever step once the skill is used', () => {
    const { engine, director } = toSkillStep();
    const res = engine.triggerWeaponSkill(1000);
    expect(res.activated).toBe(true);
    expect(director.step).toBe(4);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(100);
    expect(engine.activeTargets.length).toBe(0);
  });

  it('stays on step 3 and re-sets the targets if shots cleared them without the skill', () => {
    const { engine, director } = toSkillStep();
    const lastId = engine.activeTargets[0].id;
    engine.activeTargets = [engine.activeTargets[0]];
    const t = engine.activeTargets[0];
    engine.activeTargets[0].hp = 0.01;
    // aim straight at it: use its projected coords through a normal shot at the target centre
    const proj = (engine as any).computeTargetAimCoords(t, 1.0);
    engine.shootAt(proj.targetNormX, proj.targetNormY, 5000, 'press');
    expect(director.step).toBe(3);
    expect(engine.activeTargets.length).toBe(5);
    expect(lastId).toBeTruthy();
  });

  it('a skill used outside the skill step does not change the step', () => {
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);
    engine.triggerWeaponSkill(1000);
    expect(director.step).toBe(1);
  });
});

describe('tutorial fever step (step 4)', () => {
  it('finishes the tutorial when the fever targets are cleared', () => {
    const { engine, director } = toSkillStep();
    director.advanceStep(4);
    engine.activateFever(2000);
    expect(engine.activeTargets.length).toBe(6);
    engine.activeTargets = [];
    director.advanceStep('COMPLETED');
    expect(director.completed).toBe(true);
  });
});

import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TutorialGuideOverlay } from '../src/pc/components/TutorialGuideOverlay';

describe('tutorial guide overlay for the skill and fever steps', () => {
  const render = (step: 1 | 2 | 3 | 4 | 'COMPLETED') =>
    renderToStaticMarkup(
      React.createElement(TutorialGuideOverlay, {
        step,
        targetsRemaining: 3,
        isFeverActive: false,
        ammo: 5,
        maxAmmo: 5,
        isReloading: false,
        onExitToLobby: () => {},
        onStartRealGame: () => {},
      } as any)
    );

  it('step 3 explains the skill and step 4 explains the fever', () => {
    const skill = render(3);
    expect(skill).toContain('STEP 3');
    expect(skill).toContain('우클릭');
    const fever = render(4);
    expect(fever).toContain('STEP 4');
    expect(fever).toContain('더블클릭');
  });

  // T05: 폰 스냅 스킬 및 튜토리얼 스킬 허용 처리는 PhoneAdapter와 PlayerActionProcessor가 담당
  it('the phone snap skill is also handled during the tutorial in PlayerActionProcessor', () => {
    const adapter = fs.readFileSync('src/pc/input/PhoneAdapter.ts', 'utf8');
    const processor = fs.readFileSync('src/pc/input/PlayerActionProcessor.ts', 'utf8');
    expect(adapter).toContain("p.skillSnapTriggered");
    expect(processor).toContain("phase !== 'TUTORIAL'");
  });
});
