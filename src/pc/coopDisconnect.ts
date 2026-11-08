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

export type DisconnectAction = 'start' | 'ignore' | 'second_loss';

/**
 * 같은 슬롯의 CONTROLLER_DISCONNECTED가 거듭 와도(화면 꺼짐 신호 뒤 소켓이 닫히거나, 프레임 끊김 감지와 겹칠 때)
 * 유예 기한을 다시 시작하지 않는다.
 * grace가 없으면 'start', 같은 슬롯이면 'ignore', 다른 슬롯이면(두 번째 사람도 끊김) 'second_loss'.
 */
export function decideDisconnectAction(grace: GraceState | null, droppedSlot: PlayerSlot): DisconnectAction {
  if (grace === null) return 'start';
  return grace.slot === droppedSlot ? 'ignore' : 'second_loss';
}
