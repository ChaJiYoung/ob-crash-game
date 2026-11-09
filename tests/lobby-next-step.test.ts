import { describe, it, expect } from 'vitest';
import { createInitialSlots, createLobbySlots, chooseSlotInput, updateSlot } from '../src/pc/coopSlots';
import type { SlotPair } from '../src/pc/coopSlots';
import { getLobbyNextAction, isOptionalSlot } from '../src/pc/lobbyGuide';
import type { PlayerProfile } from '../src/shared/types';

const profile = (id: string): PlayerProfile =>
  ({ deviceId: id, nickname: id, bestScore: 0, totalGames: 0 }) as PlayerProfile;

const rowOf = (slots: SlotPair, slot: 1 | 2) => getLobbyNextAction(slots).rows.find((r) => r.slot === slot)!;
const ids = (slots: SlotPair, slot: 1 | 2) => rowOf(slots, slot).steps.map((s) => s.id);
const states = (slots: SlotPair, slot: 1 | 2) => rowOf(slots, slot).steps.map((s) => s.state);
const activeId = (slots: SlotPair, slot: 1 | 2) => rowOf(slots, slot).steps.find((s) => s.state === 'active')?.id;

const readyPhone = (slots: SlotPair, slot: 1 | 2, id: string) =>
  updateSlot(chooseSlotInput(slots, slot, 'mobile').slots, slot, {
    player: profile(id),
    isConnected: true,
    isZeroCalibrated: true,
  });
const readyMouse = (slots: SlotPair, slot: 1 | 2, id: string) =>
  updateSlot(chooseSlotInput(slots, slot, 'mouse').slots, slot, { player: profile(id) });

describe('getLobbyNextAction (per-player rows)', () => {
  it('both slots empty: one 1P row with the choose step', () => {
    const a = getLobbyNextAction(createInitialSlots());
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].slot).toBe(1);
    expect(a.rows[0].steps.map((s) => s.id)).toEqual(['choose']);
  });

  it('only 1P chosen: one row, QR scan step active, plain label', () => {
    const slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    expect(getLobbyNextAction(slots).rows).toHaveLength(1);
    expect(activeId(slots, 1)).toBe('connect');
    expect(rowOf(slots, 1).label).toBe('1P');
    expect(ids(slots, 1)).toEqual(['connect', 'zero', 'start']);
  });

  it('the default lobby shows both players on the QR step, neither optional', () => {
    const slots = createLobbySlots('mobile');
    expect(getLobbyNextAction(slots).rows.map((r) => r.slot)).toEqual([1, 2]);
    expect(activeId(slots, 1)).toBe('connect');
    expect(activeId(slots, 2)).toBe('connect');
    expect(rowOf(slots, 2).optional).toBe(false);
    expect(rowOf(slots, 2).label).toBe('2P');
  });

  it('phone paired but not zeroed: connect done, zero active', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
    slots = updateSlot(slots, 1, { player: profile('p1'), isConnected: true });
    expect(states(slots, 1)).toEqual(['done', 'active', 'todo']);
  });

  it('phone zeroed: start step active', () => {
    const slots = readyPhone(createInitialSlots(), 1, 'p1');
    expect(states(slots, 1)).toEqual(['done', 'done', 'active']);
  });

  it('a dropped phone connection keeps the zero step active', () => {
    let slots = readyPhone(createInitialSlots(), 1, 'p1');
    slots = updateSlot(slots, 1, { isConnected: false });
    expect(activeId(slots, 1)).toBe('zero');
  });

  it('mouse waiting for a nickname: two steps; after the nickname the start step is active', () => {
    let slots = chooseSlotInput(createInitialSlots(), 1, 'mouse').slots;
    expect(ids(slots, 1)).toEqual(['connect', 'start']);
    expect(states(slots, 1)).toEqual(['active', 'todo']);
    slots = updateSlot(slots, 1, { player: profile('m1') });
    expect(states(slots, 1)).toEqual(['done', 'active']);
  });

  it('1P ready + 2P phone not scanned: 2P row is optional and labelled (선택)', () => {
    const slots = chooseSlotInput(readyPhone(createInitialSlots(), 1, 'p1'), 2, 'mobile').slots;
    expect(rowOf(slots, 2).optional).toBe(true);
    expect(rowOf(slots, 2).label).toBe('2P (선택)');
    expect(rowOf(slots, 1).label).toBe('1P');
    expect(isOptionalSlot(slots, 2)).toBe(true);
  });

  it('1P ready + 2P phone paired but not zeroed: zero step active, no longer optional', () => {
    let slots = chooseSlotInput(readyMouse(createInitialSlots(), 1, 'm1'), 2, 'mobile').slots;
    slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true });
    expect(activeId(slots, 2)).toBe('zero');
    expect(rowOf(slots, 2).optional).toBe(false);
    expect(rowOf(slots, 2).label).toBe('2P');
  });

  it('1P not ready: 2P is not optional, and the 1P slot is never optional', () => {
    const slots = createLobbySlots('mobile');
    expect(isOptionalSlot(slots, 2)).toBe(false);
    expect(isOptionalSlot(readyPhone(createInitialSlots(), 1, 'p1'), 1)).toBe(false);
  });

  it('mixed mouse (1P) + phone (2P): each row follows its own input', () => {
    const slots = chooseSlotInput(readyMouse(createInitialSlots(), 1, 'm1'), 2, 'mobile').slots;
    expect(ids(slots, 1)).toEqual(['connect', 'start']);
    expect(ids(slots, 2)).toEqual(['connect', 'zero', 'start']);
  });

  it('1P phone ready + 2P mouse waiting for a nickname', () => {
    const slots = chooseSlotInput(readyPhone(createInitialSlots(), 1, 'p1'), 2, 'mouse').slots;
    expect(ids(slots, 2)).toEqual(['connect', 'start']);
    expect(activeId(slots, 2)).toBe('connect');
    expect(rowOf(slots, 2).optional).toBe(false);
  });
});
