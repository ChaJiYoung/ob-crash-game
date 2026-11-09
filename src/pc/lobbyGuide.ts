import type { PlayerSlot } from '../shared/types';
import { getJoinedSlots, isSlotReady } from './coopSlots';
import type { SlotPair, SlotState, StartGate } from './coopSlots';

export type LobbyStepId = 'choose' | 'connect' | 'zero' | 'start';
export type LobbyStepState = 'done' | 'active' | 'todo';
export interface LobbyStep {
  id: LobbyStepId;
  label: string;
  state: LobbyStepState;
}
/** 배너의 한 줄: 플레이어(슬롯) 하나의 단계 뱃지. */
export interface LobbySlotRow {
  slot: PlayerSlot;
  /** "1P" / "2P" / "2P (선택)" */
  label: string;
  /** 1P 준비 완료 + 2P 폰 미연결이면 true(2P 없이도 시작할 수 있다). */
  optional: boolean;
  /** 폰이면 [QR 스캔, 영점 조정, 쏴서 시작], 마우스면 [닉네임 입력, 클릭으로 시작]. */
  steps: LobbyStep[];
}
export interface LobbyNextAction {
  /** 입력을 고른 슬롯마다 한 줄(번호 순). 아무도 안 골랐으면 1P 줄 하나(입력 방식 선택 단계). */
  rows: LobbySlotRow[];
}

const PHONE_STEPS: { id: LobbyStepId; label: string }[] = [
  { id: 'connect', label: 'QR 스캔' },
  { id: 'zero', label: '영점 조정' },
  { id: 'start', label: '쏴서 시작' },
];
const MOUSE_STEPS: { id: LobbyStepId; label: string }[] = [
  { id: 'connect', label: '닉네임 입력' },
  { id: 'start', label: '클릭으로 시작' },
];

function withStates(defs: { id: LobbyStepId; label: string }[], active: LobbyStepId): LobbyStep[] {
  const activeIdx = defs.findIndex((d) => d.id === active);
  return defs.map((d, i) => ({
    ...d,
    state: i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo',
  }));
}

/** 그 슬롯이 지금 어느 단계를 하고 있는가. 폰 연결이 끊긴 슬롯은 영점 단계에 머문다. */
function activeStepOf(s: SlotState): LobbyStepId {
  if (s.input === 'mobile') {
    if (!s.player) return 'connect';
    if (!s.isConnected || !s.isZeroCalibrated) return 'zero';
    return 'start';
  }
  return s.player ? 'start' : 'connect';
}

/**
 * 2P가 폰 연결 전이고 1P가 이미 준비 완료면 2P는 "선택 사항"이다(2P 없이 1인 시작 가능).
 * 1P 슬롯은 항상 false. 배너 라벨과 2P 카드 상태 글자가 같은 조건을 쓴다.
 */
export function isOptionalSlot(slots: SlotPair, slot: PlayerSlot): boolean {
  return slot === 2 && slots[1].input === 'mobile' && !slots[1].player && isSlotReady(slots[0]);
}

/** 로비 배너: 입력을 고른 플레이어마다 3단계(마우스는 2단계) 뱃지 줄을 계산한다(새 서버 데이터 없음). */
export function getLobbyNextAction(slots: SlotPair): LobbyNextAction {
  const chosen: SlotState[] = slots.filter((s) => s.input !== null).sort((a, b) => a.slot - b.slot);

  if (chosen.length === 0) {
    return {
      rows: [
        {
          slot: 1,
          label: '1P',
          optional: false,
          steps: [{ id: 'choose', label: '입력 방식 선택', state: 'active' }],
        },
      ],
    };
  }

  return {
    rows: chosen.map((s) => {
      const optional = isOptionalSlot(slots, s.slot);
      return {
        slot: s.slot,
        label: `${s.slot}P${optional ? ' (선택)' : ''}`,
        optional,
        steps: withStates(s.input === 'mobile' ? PHONE_STEPS : MOUSE_STEPS, activeStepOf(s)),
      };
    }),
  };
}

export interface StartButtonView {
  enabled: boolean;
  icon: '▶' | '⏳';
  /** 괄호 포함 전체 문구. 예: "게임 시작 (2P 준비 중…)" */
  label: string;
}

/**
 * 로비 시작 버튼의 활성 여부와 글자. 전체 상태(누가 준비 중인지, 2P 없이 시작인지)를 괄호 안에 담는다.
 * 시작 판정은 StartGate가 이미 하므로 여기서는 문구만 고른다.
 */
export function getStartButtonView(slots: SlotPair, gate: StartGate): StartButtonView {
  if (!gate.canStart) {
    const detail = gate.playerCount === 0 ? '플레이어를 연결하세요' : `${gate.message}…`;
    return { enabled: false, icon: '⏳', label: `게임 시작 (${detail})` };
  }
  // 폰을 고르고 아직 QR을 안 찍은 슬롯은 게이트가 무시한다 -> 그 슬롯 없이 혼자 시작한다.
  const pending = slots.find((s) => s.input === 'mobile' && !s.player);
  if (gate.playerCount === 1 && pending) {
    return { enabled: true, icon: '▶', label: `게임 시작 (${pending.slot}P 없이 1인 시작)` };
  }
  const hasPhone = getJoinedSlots(slots).some((s) => s.input === 'mobile');
  return { enabled: true, icon: '▶', label: hasPhone ? '게임 시작 (화면 가운데를 쏘세요)' : '게임 시작 (클릭으로 시작)' };
}
