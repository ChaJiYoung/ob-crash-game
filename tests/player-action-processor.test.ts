import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerActionProcessor, ProcessorContext, ShootableButton } from '../src/pc/input/PlayerActionProcessor';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import type { GamePhase } from '../src/shared/types';

describe('PlayerActionProcessor (P01-T05)', () => {
  let engine: BeerCrusherEngine;
  let phase: GamePhase;
  let pauseMenuOpen: boolean;
  let skillGraceUntilMs: number;
  let mockButton: ShootableButton | null;
  let buttonsCalled: ShootableButton[];
  let shotsFired: number;
  let skillsFired: number;
  let feversFired: number;
  let aimHistory: { x: number; y: number }[];

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new BeerCrusherEngine();
    engine.startGame({ withWeaponSelect: false });
    // 빠른 연사 검증을 위해 개틀링(쿨다운 ~58ms) 선택
    engine.getPlayer(0).weaponSystem.selectWeapon('gatling', 1);
    engine.getPlayer(0).weaponSystem.refillSkillInstant();

    phase = 'PLAYING';
    pauseMenuOpen = false;
    skillGraceUntilMs = 0;
    mockButton = null;
    buttonsCalled = [];
    shotsFired = 0;
    skillsFired = 0;
    feversFired = 0;
    aimHistory = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createContext = (overrides?: Partial<ProcessorContext>): ProcessorContext => ({
    engine,
    playerIndex: 0,
    getPhase: () => phase,
    isPauseMenuOpen: () => pauseMenuOpen,
    getSkillGraceUntilMs: () => skillGraceUntilMs,
    hitTestButton: () => mockButton,
    onButton: (b) => buttonsCalled.push(b),
    onShot: (r) => {
      if (r.fired) shotsFired++;
    },
    onSkill: (r) => {
      if (r.activated) skillsFired++;
    },
    onFeverStarted: () => feversFired++,
    onAim: (x, y) => aimHistory.push({ x, y }),
    now: () => Date.now(),
    ...overrides,
  });

  it('fireDown fires press once then rapid hold, fireUp stops hold in PLAYING phase', () => {
    const processor = new PlayerActionProcessor(createContext());
    processor.send({ type: 'aim', aimX: 0, aimY: 0 });

    processor.send({ type: 'fireDown' });
    expect(shotsFired).toBe(1); // press 한 발

    // 개틀링 연사 간격(약 58ms) 이상 경과 -> hold 연사 발생
    vi.advanceTimersByTime(200);
    expect(shotsFired).toBeGreaterThan(1);

    const shotsBeforeUp = shotsFired;
    processor.send({ type: 'fireUp' });

    vi.advanceTimersByTime(200);
    expect(shotsFired).toBe(shotsBeforeUp); // fireUp 후 추가 사격 없음

    processor.stopAll();
  });

  it('handles PAIRING phase: presses start button via hitTestButton or center zone (D33)', () => {
    phase = 'PAIRING';
    const processor = new PlayerActionProcessor(createContext());

    // 1. hitTestButton이 start 버튼을 감지한 경우
    mockButton = 'start';
    processor.send({ type: 'aim', aimX: 0.8, aimY: 0.8 });
    processor.send({ type: 'fireDown' });
    expect(buttonsCalled).toEqual(['start']);
    expect(shotsFired).toBe(0);

    // 2. hitTestButton이 없고 화면 중심(|x|<0.65, |y|<0.65)을 조준한 경우
    mockButton = null;
    buttonsCalled = [];
    processor.send({ type: 'aim', aimX: 0.3, aimY: -0.2 });
    processor.send({ type: 'fireDown' });
    expect(buttonsCalled).toEqual(['start']);
    expect(shotsFired).toBe(0);

    // 3. 화면 바깥(|x| >= 0.65) 조준 시 버튼 미호출
    buttonsCalled = [];
    processor.send({ type: 'aim', aimX: 0.8, aimY: 0 });
    processor.send({ type: 'fireDown' });
    expect(buttonsCalled).toEqual([]);
    expect(shotsFired).toBe(0);

    processor.stopAll();
  });

  it('locks skill for 300ms immediately after picking a reward card (D27)', () => {
    const processor = new PlayerActionProcessor(createContext());
    engine.spawnWaveRewardCards(Date.now() - 1000, false);
    const card = engine.activeTargets.find((t) => !!t.rewardCardKind)!;
    const aim = engine.computeTargetAimCoords(card);

    processor.send({ type: 'aim', aimX: aim.targetNormX, aimY: aim.targetNormY });
    // 카드 선택 사격
    processor.send({ type: 'fireDown' });
    processor.send({ type: 'fireUp' });
    expect(engine.isRewardCardPending).toBe(false);

    // 같은 틱 또는 100ms 뒤 스킬 요청 -> 300ms 잠금으로 무시
    vi.advanceTimersByTime(100);
    processor.send({ type: 'skill' });
    expect(skillsFired).toBe(0);

    // 301ms 뒤 스킬 요청 -> 발동
    vi.advanceTimersByTime(250); // 합계 350ms 경과
    processor.send({ type: 'skill' });
    expect(skillsFired).toBe(1);

    processor.stopAll();
  });

  it('ignores skill when in grace period, select round, or pause menu', () => {
    const processor = new PlayerActionProcessor(createContext());

    // 1. 그레이스 기간(시작 후 1.5초)
    skillGraceUntilMs = Date.now() + 1500;
    processor.send({ type: 'skill' });
    expect(skillsFired).toBe(0);
    skillGraceUntilMs = 0;

    // 2. 선택 라운드 중
    engine.spawnWaveRewardCards(Date.now(), false);
    processor.send({ type: 'skill' });
    expect(skillsFired).toBe(0);
    engine.isRewardCardPending = false;

    // 3. 일시정지 메뉴 열림
    pauseMenuOpen = true;
    processor.send({ type: 'skill' });
    expect(skillsFired).toBe(0);
    pauseMenuOpen = false;

    // 정상 상태에서는 스킬 발동
    processor.send({ type: 'skill' });
    expect(skillsFired).toBe(1);

    processor.stopAll();
  });

  it('runs 16ms fever auto-fire loop during active fever and stops when fever ends', () => {
    const processor = new PlayerActionProcessor(createContext());
    processor.send({ type: 'aim', aimX: 0, aimY: 0 });

    // 피버 준비 후 발동
    engine.getPlayer(0).scoreManager.forceSetFeverGauge(100);
    engine.activateFever(Date.now());

    processor.tick();
    const shotsBefore = shotsFired;

    vi.advanceTimersByTime(100);
    expect(shotsFired).toBeGreaterThan(shotsBefore); // 피버 자동 연사 실행됨

    // 피버 종료
    vi.advanceTimersByTime(10_000);
    engine.getPlayer(0).scoreManager.updateFeverTimer(Date.now());
    expect(engine.getPlayer(0).scoreManager.getState().isFeverActive).toBe(false);

    processor.tick(); // 피버 종료 감지 및 자동 연사 중지
    const shotsAfterEnd = shotsFired;

    vi.advanceTimersByTime(100);
    expect(shotsFired).toBe(shotsAfterEnd); // 더 이상 자동 연사 안 됨

    processor.stopAll();
  });
});
