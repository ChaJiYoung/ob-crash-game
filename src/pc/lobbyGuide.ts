import { isSlotReady } from './coopSlots';
import type { SlotPair, SlotState, StartGate } from './coopSlots';

export type LobbyStepId = 'choose' | 'connect' | 'zero' | 'start';
export type LobbyStepState = 'done' | 'active' | 'todo';
export interface LobbyStep {
  id: LobbyStepId;
  label: string;
  state: LobbyStepState;
}
export interface LobbyNextAction {
  /** 단계 줄(좌→우). 폰이 있으면 [QR 스캔, 영점 조정, 쏴서 시작], 마우스만이면 [닉네임 입력, 클릭으로 시작]. 아무도 고르지 않았으면 [입력 방식 선택]만. */
  steps: LobbyStep[];
  /** 큰 글씨 한 문장. */
  headline: string;
  /** 작은 보조 문장(선택). */
  detail?: string;
  /** 시작 가능한가(= StartGate.canStart). */
  ready: boolean;
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

/**
 * 로비에서 "지금 할 일"을 슬롯 상태에서 계산한다(새 서버 데이터 없음).
 * 입력을 고른 슬롯 중 아직 준비되지 않은 가장 앞 슬롯(번호 순)이 기준이다.
 * 폰을 고르고 아직 접속 전인 슬롯은 StartGate.waitingSlots(참여한 슬롯만 본다)에 없으므로 슬롯을 직접 본다.
 */
export function getLobbyNextAction(slots: SlotPair, gate: StartGate): LobbyNextAction {
  const chosen: SlotState[] = slots.filter((s) => s.input !== null);

  if (chosen.length === 0) {
    return {
      steps: [{ id: 'choose', label: '입력 방식 선택', state: 'active' }],
      headline: '1P 입력 방식을 선택하세요',
      detail: '📱 모바일은 QR 스캔, 🖱 마우스는 바로 사용',
      ready: false,
    };
  }

  const hasPhone = chosen.some((s) => s.input === 'mobile');
  const hasMouse = chosen.some((s) => s.input === 'mouse');
  const defs = hasPhone ? PHONE_STEPS : MOUSE_STEPS;
  const labelOf = (s: SlotState) => (chosen.length === 2 ? `${s.slot}P: ` : '');

  const target = chosen.filter((s) => !isSlotReady(s)).sort((a, b) => a.slot - b.slot)[0];

  if (!target) {
    // 입력을 고른 모든 슬롯이 준비 완료
    const ready = gate.canStart;
    return {
      steps: withStates(defs, 'start'),
      headline: hasPhone ? '준비 완료! 화면 가운데를 쏘면 시작합니다' : '준비 완료! ▶ 게임 시작 버튼을 누르세요',
      detail: hasPhone && hasMouse ? '마우스 슬롯은 ▶ 게임 시작 버튼으로도 시작합니다' : undefined,
      ready,
    };
  }

  const prefix = labelOf(target);
  if (target.input === 'mobile') {
    if (!target.player) {
      return {
        steps: withStates(defs, 'connect'),
        headline: `${prefix}폰으로 QR을 스캔하세요`,
        detail: '카메라로 QR을 비추면 컨트롤러가 열립니다',
        ready: false,
      };
    }
    if (!target.isConnected) {
      return {
        steps: withStates(defs, 'zero'),
        headline: `${prefix}폰 연결이 끊겼어요. 다시 연결해 주세요`,
        ready: false,
      };
    }
    return {
      steps: withStates(defs, 'zero'),
      headline: `${prefix}폰을 화면 쪽으로 들고 영점을 맞추세요`,
      detail: '폰 화면의 안내에 따라 모니터 가운데를 겨누세요',
      ready: false,
    };
  }

  // 마우스 슬롯: 닉네임 입력 대기
  return {
    steps: withStates(defs, 'connect'),
    headline: `${prefix}닉네임을 입력하세요`,
    detail: '2~10자, 입력하면 바로 준비 완료',
    ready: false,
  };
}
