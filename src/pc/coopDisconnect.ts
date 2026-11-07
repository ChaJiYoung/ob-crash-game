import type { PlayerSlot } from '../shared/types';
import type { PlayerIndex } from './engine/PlayerCombatState';

export interface GraceState {
  slot: PlayerSlot;
  playerIndex: PlayerIndex;
  deadlineMs: number;
}

export function startGrace(
  slot: PlayerSlot,
  playerIndex: PlayerIndex,
  nowMs: number,
  graceMs: number
): GraceState {
  return {
    slot,
    playerIndex,
    deadlineMs: nowMs + graceMs,
  };
}

/** 남은 초(올림, 0 이상)와 만료 여부. */
export function tickGrace(
  g: GraceState,
  nowMs: number
): { remainingSec: number; expired: boolean } {
  const remainingMs = g.deadlineMs - nowMs;
  if (remainingMs <= 0) {
    return { remainingSec: 0, expired: true };
  }
  const remainingSec = Math.ceil(remainingMs / 1000);
  return { remainingSec, expired: false };
}
