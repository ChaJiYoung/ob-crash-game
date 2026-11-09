import { describe, it, expect } from 'vitest';
import { createInitialSlots, createLobbySlots, chooseSlotInput, updateSlot, getStartGate } from '../src/pc/coopSlots';
import type { SlotPair } from '../src/pc/coopSlots';
import { getStartButtonView } from '../src/pc/lobbyGuide';
import type { PlayerProfile } from '../src/shared/types';

const profile = (id: string): PlayerProfile =>
  ({ deviceId: id, nickname: id, bestScore: 0, totalGames: 0 }) as PlayerProfile;
const view = (slots: SlotPair) => getStartButtonView(slots, getStartGate(slots));

const readyPhone = (slots: SlotPair, slot: 1 | 2, id: string) =>
  updateSlot(chooseSlotInput(slots, slot, 'mobile').slots, slot, {
    player: profile(id),
    isConnected: true,
    isZeroCalibrated: true,
  });
const readyMouse = (slots: SlotPair, slot: 1 | 2, id: string) =>
  updateSlot(chooseSlotInput(slots, slot, 'mouse').slots, slot, { player: profile(id) });

describe('getStartButtonView', () => {
  it('nobody joined (empty or only unscanned phone slots): disabled, connect a player', () => {
    for (const slots of [createInitialSlots(), createLobbySlots('mobile')]) {
      expect(view(slots)).toEqual({ enabled: false, icon: '⏳', label: '게임 시작 (플레이어를 연결하세요)' });
    }
  });

  it('2P phone paired but not zeroed: disabled, 2P preparing', () => {
    let slots = chooseSlotInput(readyMouse(createInitialSlots(), 1, 'm1'), 2, 'mobile').slots;
    slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true });
    expect(view(slots)).toEqual({ enabled: false, icon: '⏳', label: '게임 시작 (2P 준비 중…)' });
  });

  it('both joined but neither ready: disabled, 1P·2P preparing', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 1, { player: profile('p1'), isConnected: true });
    slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true });
    expect(view(slots).label).toBe('게임 시작 (1P·2P 준비 중…)');
    expect(view(slots).enabled).toBe(false);
  });

  it('1P ready + 2P phone unscanned: enabled, starts without 2P (mouse or phone 1P)', () => {
    const withMouse = chooseSlotInput(readyMouse(createInitialSlots(), 1, 'm1'), 2, 'mobile').slots;
    expect(view(withMouse)).toEqual({ enabled: true, icon: '▶', label: '게임 시작 (2P 없이 1인 시작)' });
    const withPhone = chooseSlotInput(readyPhone(createInitialSlots(), 1, 'p1'), 2, 'mobile').slots;
    expect(view(withPhone).label).toBe('게임 시작 (2P 없이 1인 시작)');
  });

  it('only 2P ready while 1P phone is unscanned: names the missing 1P', () => {
    const slots = readyPhone(createLobbySlots('mobile'), 2, 'p2');
    expect(view(slots)).toEqual({ enabled: true, icon: '▶', label: '게임 시작 (1P 없이 1인 시작)' });
  });

  it('solo with the other slot empty: click for mouse, shoot the center for a phone', () => {
    expect(view(readyMouse(createInitialSlots(), 1, 'm1')).label).toBe('게임 시작 (클릭으로 시작)');
    expect(view(readyPhone(createInitialSlots(), 1, 'p1')).label).toBe('게임 시작 (화면 가운데를 쏘세요)');
  });

  it('two ready players with a phone: shoot the center', () => {
    const slots = readyPhone(readyMouse(createInitialSlots(), 1, 'm1'), 2, 'p2');
    expect(view(slots)).toEqual({ enabled: true, icon: '▶', label: '게임 시작 (화면 가운데를 쏘세요)' });
  });
});
