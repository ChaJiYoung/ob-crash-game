import type { PlayerProfile, PlayerSlot } from '../shared/types';
import type { PlayerIndex } from './engine/PlayerCombatState';

export type SlotInput = 'mobile' | 'mouse';

export interface SlotState {
  slot: PlayerSlot;
  /** 로비에서 고른 입력. null이면 빈 슬롯. */
  input: SlotInput | null;
  /** 서버가 확인한 프로필(폰: CONTROLLER_PAIRED, 마우스: LOCAL_PLAYER_REGISTERED). */
  player?: PlayerProfile;
  /** 폰 전용: ZERO_CALIBRATED 받음. */
  isZeroCalibrated: boolean;
  /** 폰 전용: 소켓 연결 상태(CONTROLLER_DISCONNECTED면 false). 마우스는 항상 true. */
  isConnected: boolean;
  /** 판 도중 30초 유예가 지나 이탈 처리됨(D08, D20). */
  isAway: boolean;
}

export type SlotPair = readonly [SlotState, SlotState];

export function createInitialSlots(): SlotPair {
  return [
    { slot: 1, input: null, isZeroCalibrated: false, isConnected: true, isAway: false },
    { slot: 2, input: null, isZeroCalibrated: false, isConnected: true, isAway: false },
  ];
}

/** 입력 선택. 다른 슬롯이 이미 마우스면 마우스 선택을 거절한다. 같은 입력 재선택은 그대로. 입력을 바꾸면 player/isZeroCalibrated 초기화. */
export function chooseSlotInput(
  slots: SlotPair,
  slot: PlayerSlot,
  input: SlotInput | null
): { slots: SlotPair; rejected?: 'MOUSE_TAKEN' } {
  const otherSlot = slots.find((s) => s.slot !== slot);
  if (input === 'mouse' && otherSlot?.input === 'mouse') {
    return { slots, rejected: 'MOUSE_TAKEN' };
  }

  const current = slots.find((s) => s.slot === slot);
  if (!current || current.input === input) {
    return { slots };
  }

  const newSlots: SlotPair = [
    slot === 1
      ? { ...slots[0], input, player: undefined, isZeroCalibrated: false }
      : slots[0],
    slot === 2
      ? { ...slots[1], input, player: undefined, isZeroCalibrated: false }
      : slots[1],
  ];

  return { slots: newSlots };
}

export function updateSlot(
  slots: SlotPair,
  slot: PlayerSlot,
  patch: Partial<Omit<SlotState, 'slot'>>
): SlotPair {
  return [
    slot === 1 ? { ...slots[0], ...patch } : slots[0],
    slot === 2 ? { ...slots[1], ...patch } : slots[1],
  ];
}

export function isSlotJoined(s: SlotState): boolean {
  return s.input !== null && !!s.player;
}

export function isSlotReady(s: SlotState): boolean {
  if (!isSlotJoined(s)) return false;
  if (s.input === 'mouse') return true;
  return s.isZeroCalibrated && s.isConnected;
}

export function getJoinedSlots(slots: SlotPair): SlotState[] {
  return slots.filter(isSlotJoined).sort((a, b) => a.slot - b.slot);
}

export interface StartGate {
  canStart: boolean;
  playerCount: 0 | 1 | 2;
  /** 참여했지만 아직 준비 안 된 슬롯. */
  waitingSlots: PlayerSlot[];
  /** 로비에 띄울 안내. 예: "2P 준비 중", "1P·2P 준비 중", "플레이어를 연결하세요". 시작 가능하면 null. */
  message: string | null;
}

export function getStartGate(slots: SlotPair): StartGate {
  const joined = getJoinedSlots(slots);
  if (joined.length === 0) {
    return {
      canStart: false,
      playerCount: 0,
      waitingSlots: [],
      message: '플레이어를 연결하세요',
    };
  }

  const waitingSlots = joined.filter((s) => !isSlotReady(s)).map((s) => s.slot);
  const canStart = waitingSlots.length === 0;
  const playerCount = joined.length as 1 | 2;

  let message: string | null = null;
  if (!canStart) {
    if (waitingSlots.length === 1) {
      message = `${waitingSlots[0]}P 준비 중`;
    } else {
      message = '1P·2P 준비 중';
    }
  }

  return {
    canStart,
    playerCount,
    waitingSlots,
    message,
  };
}

/** 판 시작 시점에 고정하는 매핑. joined 슬롯 순서대로 0,1. */
export function buildSlotIndexMap(slots: SlotPair): Partial<Record<PlayerSlot, PlayerIndex>> {
  const joined = getJoinedSlots(slots);
  const map: Partial<Record<PlayerSlot, PlayerIndex>> = {};
  joined.forEach((s, idx) => {
    map[s.slot] = idx as PlayerIndex;
  });
  return map;
}

export function indexToSlot(
  map: Partial<Record<PlayerSlot, PlayerIndex>>,
  index: PlayerIndex
): PlayerSlot | undefined {
  for (const [slotStr, idx] of Object.entries(map)) {
    if (idx === index) {
      return Number(slotStr) as PlayerSlot;
    }
  }
  return undefined;
}

/** 마우스 슬롯의 엔진 번호. 마우스 참여자가 없으면 null. */
export function getMouseIndex(
  slots: SlotPair,
  map: Partial<Record<PlayerSlot, PlayerIndex>>
): PlayerIndex | null {
  const mouseSlot = slots.find((s) => s.input === 'mouse' && isSlotJoined(s));
  if (!mouseSlot) return null;
  const idx = map[mouseSlot.slot];
  return idx !== undefined ? idx : null;
}
