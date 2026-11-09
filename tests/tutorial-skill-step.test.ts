import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import {
  TutorialDirector,
  TUTORIAL_BLAST_ADVANCE_DELAY_MS,
  TUTORIAL_SKILL_ADVANCE_DELAY_MS,
  TUTORIAL_PAUSE_RECHECK_MS,
} from '../src/pc/tutorial/TutorialDirector';
import { TutorialGuideOverlay } from '../src/pc/components/TutorialGuideOverlay';
import { WEAPON_ONE_LINER } from '../src/shared/guideText';
import { WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';

afterEach(() => vi.useRealTimers());

const toSkillStep = () => {
  vi.useFakeTimers();
  const engine = new BeerCrusherEngine();
  engine.startTutorialMode();
  const director = new TutorialDirector(engine);
  director.start(1000);
  director.advanceStep(2);
  director.advanceStep(3);
  return { engine, director };
};
const weapon = (engine: BeerCrusherEngine) => engine.getPlayer(0).weaponSystem.getState();

describe('tutorial skill step (step 3) is three weapon rounds', () => {
  it('round 1 sets up shotgun Lv1, a ready skill and five stationary targets', () => {
    const { engine, director } = toSkillStep();
    expect(director.step).toBe(3);
    expect(director.skillRound).toBe(0);
    expect(director.skillPhase).toBe('ready');
    expect(weapon(engine).weaponKind).toBe('shotgun');
    expect(weapon(engine).weaponLevel).toBe(1);
    expect(weapon(engine).skillStock).toBeGreaterThan(0);
    expect(engine.activeTargets.length).toBe(5);
    expect(engine.activeTargets.every((t) => t.speedMps === 0)).toBe(true);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(0);
  });

  it('shotgun round: skill -> awaiting blast; the round passes 500ms after the blast', () => {
    const { engine, director } = toSkillStep();
    const rounds: string[] = [];
    (director as any).onRoundChange = (s: { round: number; phase: string }) => rounds.push(`${s.round}:${s.phase}`);
    expect(engine.triggerWeaponSkill(1000).activated).toBe(true);
    expect(director.skillPhase).toBe('awaitingBlast');
    expect(engine.activeTargets.filter((t) => t.plungerBlast).length).toBe(4); // Lv1 상한 4, 표적 5마리
    expect(director.step).toBe(3);

    engine.update(1000 + WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].skillStunMs, 0.016); // 폭발
    expect(director.skillPhase).toBe('done');
    vi.advanceTimersByTime(TUTORIAL_BLAST_ADVANCE_DELAY_MS - 1);
    expect(director.skillRound).toBe(0);
    vi.advanceTimersByTime(1);
    expect(director.skillRound).toBe(1);
    expect(weapon(engine).weaponKind).toBe('revolver');
    expect(weapon(engine).weaponLevel).toBe(1);
    expect(weapon(engine).skillStock).toBeGreaterThan(0);
    expect(engine.activeTargets.length).toBe(5);
    expect(rounds).toContain('0:awaitingBlast');
    expect(rounds).toContain('1:ready');
  });

  it('does not deadlock when every stuck monster is shot dead before the blast', () => {
    const { engine, director } = toSkillStep();
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);
    engine.triggerWeaponSkill(1000);
    // 박힌 몬스터를 모두 평타로 처치(폭발 전)
    let now = 1500;
    for (let i = 0; i < 40 && engine.activeTargets.some((t) => t.plungerBlast); i++) {
      const t = engine.activeTargets.find((x) => x.plungerBlast)!;
      t.hp = 0.01;
      const p = engine.computeTargetAimCoords(t, 1.0);
      now += 400;
      engine.shootAt(p.targetNormX, p.targetNormY, now, 'press');
    }
    expect(engine.activeTargets.some((t) => t.plungerBlast)).toBe(false);
    vi.advanceTimersByTime(TUTORIAL_BLAST_ADVANCE_DELAY_MS);
    expect(director.skillRound).toBe(1);
  });

  it('revolver and gatling rounds pass on skill use after a 1200ms presentation delay', () => {
    const { engine, director } = toSkillStep();
    engine.triggerWeaponSkill(1000);
    engine.update(1000 + 2000, 0.016);
    vi.advanceTimersByTime(TUTORIAL_BLAST_ADVANCE_DELAY_MS);
    expect(director.skillRound).toBe(1);

    expect(engine.triggerWeaponSkill(5000).activated).toBe(true);
    expect(director.skillPhase).toBe('done');
    vi.advanceTimersByTime(TUTORIAL_SKILL_ADVANCE_DELAY_MS - 1);
    expect(director.skillRound).toBe(1);
    vi.advanceTimersByTime(1);
    expect(director.skillRound).toBe(2);
    expect(weapon(engine).weaponKind).toBe('gatling');
    expect(engine.activeTargets.length).toBe(5);

    expect(engine.triggerWeaponSkill(9000).activated).toBe(true);
    vi.advanceTimersByTime(TUTORIAL_SKILL_ADVANCE_DELAY_MS);
    expect(director.step).toBe(4);
    expect(weapon(engine).weaponKind).toBe('shotgun');
    expect(weapon(engine).weaponLevel).toBe(1);
    expect(engine.getPlayer(0).scoreManager.getState().feverGauge).toBe(100);
    expect(engine.activeTargets.length).toBe(0);
  });

  it('re-sets the round targets if shots cleared them before the skill, but not while waiting to pass', () => {
    const { engine, director } = toSkillStep();
    engine.getPlayer(0).weaponSystem.setInfiniteAmmo(true);
    const t = engine.activeTargets[0];
    engine.activeTargets = [t];
    t.hp = 0.01;
    const proj = (engine as any).computeTargetAimCoords(t, 1.0);
    engine.shootAt(proj.targetNormX, proj.targetNormY, 5000, 'press');
    expect(director.step).toBe(3);
    expect(director.skillRound).toBe(0);
    expect(engine.activeTargets.length).toBe(5);
  });

  it('does not advance while the game is paused (e.g. the guide is open) and advances after resume', () => {
    const { engine, director } = toSkillStep();
    engine.triggerWeaponSkill(1000);
    engine.update(1000 + 2000, 0.016); // 폭발 -> 500ms 뒤 통과 예약
    engine.setPaused(true, 3000);
    vi.advanceTimersByTime(TUTORIAL_BLAST_ADVANCE_DELAY_MS + 1000);
    expect(director.skillRound).toBe(0); // 일시정지 중에는 넘어가지 않는다
    expect(weapon(engine).weaponKind).toBe('shotgun');
    engine.setPaused(false, 4000);
    vi.advanceTimersByTime(TUTORIAL_PAUSE_RECHECK_MS);
    expect(director.skillRound).toBe(1);
  });

  it('a shotgun skill that sticks nothing keeps the round open and refills the skill', () => {
    const { engine, director } = toSkillStep();
    engine.activeTargets = []; // 박을 몬스터가 없다(착지 전 등)
    expect(engine.triggerWeaponSkill(1000).activated).toBe(true);
    expect(director.skillRound).toBe(0);
    expect(director.skillPhase).toBe('ready');
    expect(weapon(engine).skillStock).toBeGreaterThan(0);
  });

  it('stop() cancels a pending round change', () => {
    const { engine, director } = toSkillStep();
    engine.triggerWeaponSkill(1000);
    engine.update(3000, 0.016);
    director.stop();
    vi.advanceTimersByTime(5000);
    expect(director.skillRound).toBe(0);
  });

  it('a skill used outside the skill step does not change the step or the round', () => {
    vi.useFakeTimers();
    const engine = new BeerCrusherEngine();
    engine.startTutorialMode();
    const director = new TutorialDirector(engine);
    director.start(1000);
    engine.triggerWeaponSkill(1000);
    vi.advanceTimersByTime(5000);
    expect(director.step).toBe(1);
    expect(director.skillRound).toBe(0);
  });
});

describe('TutorialGuideOverlay step 3 text', () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(TutorialGuideOverlay, {
        step: 3,
        targetsRemaining: 5,
        isFeverReady: false,
        isFeverActive: false,
        onStartRealGame: () => {},
        onExitToLobby: () => {},
        ...props,
      } as any)
    );

  it('shows the round, the weapon name and its one-liner', () => {
    const html = render({ weaponKind: 'revolver', skillRound: 1 });
    expect(html).toContain('STEP 3-2/3');
    expect(html).toContain(WEAPON_ARCHETYPE_SPECS.revolver.nameKo);
    expect(html).toContain(WEAPON_ONE_LINER.revolver);
    expect(html).toContain('먼저');
  });

  it('shows the blast-waiting message and no longer claims the skill stuns every monster', () => {
    const html = render({ weaponKind: 'shotgun', skillRound: 0, skillPhase: 'awaitingBlast' });
    expect(html).toContain('곧 터집니다');
    expect(html).not.toContain('화면의 모든 몬스터를 기절시키고');
  });

  it('the last round says the fever step is next', () => {
    const html = render({ weaponKind: 'gatling', skillRound: 2, skillPhase: 'done' });
    expect(html).toContain('STEP 3-3/3');
    expect(html).toContain('피버로 넘어갑니다');
  });
});
