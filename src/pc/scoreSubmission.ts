import type { BeerCrusherEngine } from './engine/BeerCrusherEngine';
import type { PlayerIndex } from './engine/PlayerCombatState';
import { indexToSlot, SlotPair } from './coopSlots';
import { getOrCreateDeviceId } from '../shared/deviceIdentity';
import { RANKING_RULESET_VERSION } from '../shared/gameTuning';
import type { ClientToServerMessage, PlayerSlot, PlayRunStats } from '../shared/types';

export type ScoreSubmitMessage = Extract<ClientToServerMessage, { type: 'GAME_SCORE_SUBMIT' }>;

/**
 * 게임 종료 시 각 플레이어별 점수 제출 메시지를 순수하게 생성.
 * - 1인 판: 1개 메시지 (`mode: 'solo'`)
 * - 2인 판: 2개 메시지 (`mode: 'coop'`, 파트너 정보 포함)
 */
export function buildScoreSubmissions(
  engine: BeerCrusherEngine,
  slots: SlotPair,
  map: Partial<Record<PlayerSlot, PlayerIndex>>,
  roomId: string
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
