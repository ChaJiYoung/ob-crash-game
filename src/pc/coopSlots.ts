import type { InputKind, PlayerProfile, PlayerSlot } from '../shared/types';
import type { PlayerIndex } from './engine/PlayerCombatState';

export type SlotInput = InputKind;

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

/** CONTROLLER_PAIRED 반영: 그 슬롯을 모바일·연결됨으로, 다른 슬롯에 같은 기기가 있으면 비운다. */
export function applyControllerPaired(
  slots: SlotPair,
  slot: PlayerSlot,
  player: PlayerProfile
): SlotPair {
  const other: PlayerSlot = slot === 1 ? 2 : 1;
  let next = slots;
  if (slots[other - 1].player?.deviceId === player.deviceId) {
    next = chooseSlotInput(next, other, null).slots;
  }
  return updateSlot(chooseSlotInput(next, slot, 'mobile').slots, slot, {
    player,
    isConnected: true,
  });
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

/**
 * 1인 모드(튜토리얼/센서랩/진단 등)나 단일 플레이어 관점 도구에서 기준 슬롯(플레이어 0)을 계산.
 * - map의 플레이어 0에 매핑된 슬롯이 있으면 그 슬롯 (예: 슬롯 2만 참여하여 map[2] === 0인 경우 2)
 * - map에 없으면 slots의 첫 번째 joined 슬롯 (예: 슬롯 2만 참여한 상태의 slots면 2)
 * - 둘 다 없으면 기본값 1
 */
export function getSoloSlot(
  map?: Partial<Record<PlayerSlot, PlayerIndex>>,
  slots?: SlotPair
): PlayerSlot {
  if (map) {
    const fromMap = indexToSlot(map, 0);
    if (fromMap !== undefined) return fromMap;
  }
  if (slots) {
    const joined = getJoinedSlots(slots);
    if (joined.length > 0) return joined[0].slot;
  }
  return 1;
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

/**
 * 마우스 어댑터가 어느 플레이어 처리부를 조종할지 결정.
 * - 마우스 슬롯이 있으면 그 플레이어.
 * - 없으면 플레이어가 1명일 때 보조 입력으로 플레이어 0 (기존 1인 폰 판에서 마우스도 쓸 수 있던 동작 유지).
 * - 그 외(폰 2대 등)는 null (게임 중 마우스 사격 비활성, HTML 버튼 클릭은 영향 없음).
 */
export function getMouseBinding(
  slots: SlotPair,
  map: Partial<Record<PlayerSlot, PlayerIndex>>,
  playerCount: number
): PlayerIndex | null {
  const mouseIndex = getMouseIndex(slots, map);
  if (mouseIndex !== null) return mouseIndex;
  if (playerCount === 1) return 0;
  return null;
}

export type LobbyStartDecision =
  | { start: false; notice: string }
  | { start: true; playerCount: 1 | 2; map: Partial<Record<PlayerSlot, PlayerIndex>> };

/** 로비에서 게임 시작 시도 시 게이트 상태를 확인해 시작 가능 여부와 인원수/매핑을 결정. */
export function decideLobbyStart(slots: SlotPair): LobbyStartDecision {
  const gate = getStartGate(slots);
  if (!gate.canStart) {
    return {
      start: false,
      notice: gate.message || '시작할 수 없습니다',
    };
  }
  const playerCount: 1 | 2 = gate.playerCount === 2 ? 2 : 1;
  const map = buildSlotIndexMap(slots);
  return {
    start: true,
    playerCount,
    map,
  };
}
