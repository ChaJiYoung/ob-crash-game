import type { PlayerIndex } from './engine/PlayerCombatState';
import type { PlayerSlot } from '../shared/types';
import type { SlotPair } from './coopSlots';

export const SOLO_PLAYER_COLOR = '#f59e0b';
export const PLAYER_COLORS: Record<PlayerSlot, string> = {
  1: '#38bdf8',
  2: '#ff6b3d',
};

export type PanelInputKind = 'mobile' | 'mouse';

export interface PlayerPresentation {
  index: PlayerIndex;
  slot: PlayerSlot;
  /** 2인 이상이면 '1P'/'2P', 1인이면 null(배지·접두어 숨김, D09). */
  slotLabel: '1P' | '2P' | null;
  /** 패널 테두리·이름표·카드 바깥 테두리 등 플레이어 구분 색. 1인은 SOLO_PLAYER_COLOR. */
  color: string;
  /** 'state': 십자선 링이 피버·파워 등 상태 색(1인, 지금 동작). 'player': 링은 플레이어 색, 상태는 배지·glow로(2인). */
  ringColorMode: 'state' | 'player';
  /** 카드 바깥 주인 테두리 색(D23). 1인은 null. */
  ownerOutlineColor: string | null;
  panelSide: 'left' | 'right';
  /** 판정 팝업 위치. 1인 'center'(지금), 2인은 패널 쪽. */
  popupSide: 'left' | 'right' | 'center';
  inputKind: PanelInputKind;
  nickname?: string;
}

export function getPlayerPresentation(input: {
  playerCount: number;
  slotIndexMap: Partial<Record<PlayerSlot, PlayerIndex>>;
  slots: SlotPair;
}): PlayerPresentation[] {
  const multi = input.playerCount > 1;
  const presentations: PlayerPresentation[] = [];

  for (let i = 0; i < input.playerCount; i++) {
    const playerIdx = i as PlayerIndex;
    let foundSlot: PlayerSlot | undefined;
    for (const [sStr, pIdx] of Object.entries(input.slotIndexMap)) {
      if (pIdx === playerIdx) {
        foundSlot = Number(sStr) as PlayerSlot;
        break;
      }
    }
    const slot: PlayerSlot = foundSlot ?? ((playerIdx + 1) as PlayerSlot);
    const slotState = input.slots.find((s) => s.slot === slot);
    const slotLabel: '1P' | '2P' | null = multi ? (`${slot}P` as '1P' | '2P') : null;
    const color = multi ? PLAYER_COLORS[slot] : SOLO_PLAYER_COLOR;
    const ringColorMode: 'state' | 'player' = multi ? 'player' : 'state';
    const ownerOutlineColor: string | null = multi ? PLAYER_COLORS[slot] : null;
    const panelSide: 'left' | 'right' = playerIdx === 0 ? 'left' : 'right';
    const popupSide: 'left' | 'right' | 'center' = multi ? panelSide : 'center';
    const inputKind: PanelInputKind = slotState?.input === 'mouse' ? 'mouse' : 'mobile';
    const nickname = slotState?.player?.nickname;

    presentations.push({
      index: playerIdx,
      slot,
      slotLabel,
      color,
      ringColorMode,
      ownerOutlineColor,
      panelSide,
      popupSide,
      inputKind,
      nickname,
    });
  }

  return presentations;
}

export function getTeamPresentation(playerCount: number): { livesTitle: string } {
  return {
    livesTitle: playerCount > 1 ? 'TEAM · BAR DEFENSE' : 'BAR DEFENSE',
  };
}
