import type { BeerCrusherEngine } from './engine/BeerCrusherEngine';
import type { PlayerIndex } from './engine/PlayerCombatState';
import { indexToSlot, SlotPair } from './coopSlots';
import { getOrCreateDeviceId } from '../shared/deviceIdentity';
import { RANKING_RULESET_VERSION } from '../shared/gameTuning';
import type { ClientToServerMessage, PlayerSlot, PlayRunStats } from '../shared/types';

export type ScoreSubmitMessage = Extract<ClientToServerMessage, { type: 'GAME_SCORE_SUBMIT' }>;
export type GameBeginMessage = Extract<ClientToServerMessage, { type: 'GAME_BEGIN' }>;

/**
 * 판에 들어가는 슬롯(map에 있는 슬롯)으로 GAME_BEGIN을 만든다.
 * 참가 슬롯 중 하나라도 입력(input)이나 서버 확인 프로필(player.deviceId)이 없으면 null(보내지 않는다).
 */
export function buildGameBegin(
  slots: SlotPair,
  map: Partial<Record<PlayerSlot, PlayerIndex>>,
  roomId: string,
  beginId: string
): GameBeginMessage | null {
  const entries = ([1, 2] as PlayerSlot[]).filter((s) => map[s] !== undefined);
  if (entries.length === 0) return null;
  const players: GameBeginMessage['players'] = [];
  for (const slot of entries) {
    const state = slots.find((s) => s.slot === slot);
    const input = state?.input;
    const deviceId = state?.player?.deviceId;
    if (!input || !deviceId) return null;
    players.push({ slot, deviceId, inputKind: input });
  }
  return { type: 'GAME_BEGIN', roomId, beginId, mode: players.length === 2 ? 'coop' : 'solo', players };
}

/**
 * 게임 종료 시 각 플레이어별 점수 제출 메시지를 순수하게 생성.
 * - 1인 판: 1개 메시지 (`mode: 'solo'`)
 * - 2인 판: 2개 메시지 (`mode: 'coop'`, 파트너 정보 포함)
 */
export function buildScoreSubmissions(
  engine: BeerCrusherEngine,
  slots: SlotPair,
  map: Partial<Record<PlayerSlot, PlayerIndex>>,
  roomId: string,
  gameId: number
): ScoreSubmitMessage[] {
  const submissions: ScoreSubmitMessage[] = [];

  engine.players.forEach((_, i) => {
    const playerIdx = i as PlayerIndex;
    const slot = indexToSlot(map, playerIdx) ?? ((playerIdx + 1) as PlayerSlot);
    const meSlot = slots.find((s) => s.slot === slot);
    const me = meSlot?.player;
    const stats = engine.getPlayRunStats(playerIdx);
    if (!stats) return;

    let finalStats: PlayRunStats = meSlot?.input ? { ...stats, inputKind: meSlot.input } : { ...stats };
    if (stats.coop) {
      const partnerSlot: PlayerSlot = slot === 1 ? 2 : 1;
      const partnerState = slots.find((s) => s.slot === partnerSlot);
      const partner = partnerState?.player;
      const partnerIdx = map[partnerSlot];
      const partnerWeapon = partnerIdx !== undefined ? engine.getPlayRunStats(partnerIdx)?.weaponKind : undefined;
      finalStats = {
        ...finalStats,
        coop: {
          ...stats.coop,
          partnerDeviceId: partner?.deviceId ?? '',
          partnerNickname: partner?.nickname ?? '',
          ...(partnerWeapon ? { partnerWeaponKind: partnerWeapon } : {}),
          ...(partnerState?.input ? { partnerInputKind: partnerState.input } : {}),
        },
      };
    }

    const msg: ScoreSubmitMessage = {
      type: 'GAME_SCORE_SUBMIT',
      roomId,
      gameId,
      deviceId: me?.deviceId ?? getOrCreateDeviceId(),
      score: finalStats.totalScore,
      waveReached: finalStats.waveReached,
      maxCombo: finalStats.maxCombo,
      rulesetVersion: RANKING_RULESET_VERSION,
      mode: finalStats.mode,
      stats: finalStats,
    };

    submissions.push(msg);
  });

  return submissions;
}
