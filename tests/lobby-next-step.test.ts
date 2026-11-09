import { describe, it, expect } from 'vitest';
import { createInitialSlots, chooseSlotInput, updateSlot, getStartGate } from '../src/pc/coopSlots';
import type { SlotPair } from '../src/pc/coopSlots';
import { getLobbyNextAction } from '../src/pc/lobbyGuide';
import type { PlayerProfile } from '../src/shared/types';

const profile = (id: string): PlayerProfile =>
  ({ deviceId: id, nickname: id, bestScore: 0, totalGames: 0 }) as PlayerProfile;

const act = (slots: SlotPair) => getLobbyNextAction(slots, getStartGate(slots));
const activeId = (slots: SlotPair) => act(slots).steps.find((s) => s.state === 'active')?.id;

describe('getLobbyNextAction', () => {
  it('both slots empty: choose an input', () => {
    const a = act(createInitialSlots());
    expect(a.steps.map((s) => s.id)).toEqual(['choose']);
    expect(a.headline).toBe('1P 입력 방식을 선택하세요');
    expect(a.ready).toBe(false);
  });

  it('1P mobile before the scan is NOT treated as ready (no profile yet)', () => {
    const slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    const a = act(slots);
    expect(activeId(slots)).toBe('connect');
    expect(a.headline).toBe('폰으로 QR을 스캔하세요'); // 1인이면 번호 접두어 없음
    expect(a.ready).toBe(false);
    expect(a.steps.map((s) => s.id)).toEqual(['connect', 'zero', 'start']);
  });

  it('1P mobile paired but not zeroed: zero step active, connect done', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    slots = updateSlot(slots, 1, { player: profile('p1'), isConnected: true });
    const a = act(slots);
    expect(a.steps.map((s) => s.state)).toEqual(['done', 'active', 'todo']);
    expect(a.headline).toContain('영점을 맞추세요');
  });

  it('1P mobile zeroed: ready, start step active', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    slots = updateSlot(slots, 1, { player: profile('p1'), isConnected: true, isZeroCalibrated: true });
    const a = act(slots);
    expect(a.ready).toBe(true);
    expect(a.steps.map((s) => s.state)).toEqual(['done', 'done', 'active']);
    expect(a.headline).toContain('화면 가운데를 쏘면 시작');
  });

  it('1P mouse waiting for a nickname: two steps, nickname headline', () => {
    const slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    const a = act(slots);
    expect(a.steps.map((s) => s.id)).toEqual(['connect', 'start']);
    expect(a.headline).toBe('닉네임을 입력하세요');
  });

  it('1P mouse ready: press the start button', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    slots = updateSlot(slots, 1, { player: profile('m1') });
    const a = act(slots);
    expect(a.ready).toBe(true);
    expect(a.headline).toContain('▶ 게임 시작');
  });

  it('1P ready + 2P phone not scanned yet: prefixed with 2P and not ready', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    slots = updateSlot(slots, 1, { player: profile('m1') });
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    const a = act(slots);
    expect(a.headline).toBe('2P: 폰으로 QR을 스캔하세요');
    expect(a.ready).toBe(false);
    expect(a.steps.map((s) => s.id)).toEqual(['connect', 'zero', 'start']); // 폰이 있으면 폰 단계
  });

  it('1P mouse ready + 2P phone paired but not zeroed: zero step for 2P', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    slots = updateSlot(slots, 1, { player: profile('m1') });
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true });
    const a = act(slots);
    expect(activeId(slots)).toBe('zero');
    expect(a.headline).toContain('2P: 폰을 화면 쪽으로');
  });

  it('both ready with a phone and a mouse: shoot to start, mention the start button', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    slots = updateSlot(slots, 1, { player: profile('m1') });
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true, isZeroCalibrated: true });
    const a = act(slots);
    expect(a.ready).toBe(true);
    expect(a.headline).toContain('화면 가운데를 쏘면 시작');
    expect(a.detail).toContain('▶ 게임 시작');
  });

  it('a dropped phone connection is called out', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    slots = updateSlot(slots, 1, { player: profile('p1'), isZeroCalibrated: true, isConnected: false });
    const a = act(slots);
    expect(a.headline).toContain('연결이 끊겼어요');
    expect(a.ready).toBe(false);
  });

  it('the earlier slot (1P) is shown first when both are unfinished', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true });
    expect(act(slots).headline).toBe('1P: 폰으로 QR을 스캔하세요');
  });
});
