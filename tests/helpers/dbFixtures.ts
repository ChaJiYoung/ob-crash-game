import { GameDatabase } from '../../server/db/GameDatabase';
import { PlayerStore } from '../../server/PlayerStore';
import { PlayRecordStore } from '../../server/PlayRecordStore';
import type { PlayRunStats, PlayerSlot } from '../../src/shared/types';
import { RANKING_RULESET_VERSION } from '../../src/shared/gameTuning';

export interface Env {
  db: GameDatabase;
  players: PlayerStore;
  records: PlayRecordStore;
}

/** 메모리 DB 위의 두 스토어. */
export function makeEnv(rulesetVersion: number = RANKING_RULESET_VERSION): Env {
  const db = new GameDatabase(':memory:');
  return { db, players: new PlayerStore(db, rulesetVersion), records: new PlayRecordStore(db, rulesetVersion) };
}

export const stats = (over: Partial<PlayRunStats> = {}): PlayRunStats => ({
  outcome: 'VICTORY', waveReached: 7, livesLeft: 3, durationSec: 200, totalScore: 20000, baseScore: 12000,
  timeBonus: 5000, precisionBonus: 3000, levelBonus: 0, maxCombo: 90, kills: 180,
  waves: [{ wave: 1, seconds: 14, bonus: 500 }],
  shots: { PERFECT: 30, GREAT: 40, GOOD: 10, MISS: 20 }, accuracy: 0.7,
  weaponKind: 'gatling', weaponLevel: 4,
  cardStacks: { damage_up: 1, skill_cooldown: 0, fever_extend: 2, hit_zone_up: 0 },
  ...over,
});

/** 협동 판에서 slot 플레이어가 내는 통계. */
export function coopStats(
  slot: PlayerSlot,
  teamScore: number,
  myScore: number,
  partner: { id: string; nickname: string },
  over: Partial<PlayRunStats> = {},
): PlayRunStats {
  return stats({
    mode: 'coop',
    totalScore: myScore,
    coop: {
      slot,
      teamScore,
      partnerScore: teamScore - myScore,
      partnerDeviceId: partner.id,
      partnerNickname: partner.nickname,
      leftEarly: false,
    },
    ...over,
  });
}

export function register(env: Env, ...ids: string[]): void {
  for (const id of ids) env.players.registerOrUpdateNickname(id, `닉_${id}`.slice(0, 10));
}

let seq = 0;
const iso = (n: number) => new Date(Date.UTC(2026, 10, 8, 0, 0, n)).toISOString();

/** 솔로 판을 만들고 제출까지 끝낸다. at(초)이 ended_at이 된다. */
export function playSolo(
  env: Env,
  o: { playerId: string; score: number; at?: number; roomId?: string; rv?: number; over?: Partial<PlayRunStats>; submit?: boolean },
): number {
  const at = o.at ?? ++seq;
  const gameId = env.records.beginGame({
    roomId: o.roomId ?? `R${++seq}`,
    mode: 'solo',
    rulesetVersion: o.rv ?? RANKING_RULESET_VERSION,
    startedAt: iso(at),
    players: [{ slot: 1, playerId: o.playerId, inputKind: null }],
  });
  if (o.submit !== false) {
    const res = env.records.submitResult({
      gameId, roomId: env.db.conn.prepare('SELECT room_id FROM games WHERE id = ?').pluck().get(gameId) as string,
      playerId: o.playerId, submittedAt: iso(at), stats: stats({ totalScore: o.score, ...o.over }),
    });
    if (!res.ok) throw new Error(`playSolo submit failed: ${res.reason}`);
  }
  return gameId;
}

/** 협동 판(slot1=a, slot2=b)을 만들고 둘 다 제출한다. teamScore는 두 점수의 합이 아니어도 된다. */
export function playCoop(
  env: Env,
  o: { a: string; b: string; teamScore: number; scoreA?: number; scoreB?: number; at?: number; roomId?: string; rv?: number; submitB?: boolean; outcome?: PlayRunStats['outcome'] },
): number {
  const at = o.at ?? ++seq;
  const roomId = o.roomId ?? `R${++seq}`;
  const scoreA = o.scoreA ?? Math.floor(o.teamScore / 2);
  const scoreB = o.scoreB ?? o.teamScore - scoreA;
  const gameId = env.records.beginGame({
    roomId,
    mode: 'coop',
    rulesetVersion: o.rv ?? RANKING_RULESET_VERSION,
    startedAt: iso(at),
    players: [
      { slot: 1, playerId: o.a, inputKind: null },
      { slot: 2, playerId: o.b, inputKind: null },
    ],
  });
  const nick = (id: string) => `닉_${id}`.slice(0, 10);
  const r1 = env.records.submitResult({
    gameId, roomId, playerId: o.a, submittedAt: iso(at),
    stats: coopStats(1, o.teamScore, scoreA, { id: o.b, nickname: nick(o.b) }, o.outcome ? { outcome: o.outcome } : {}),
  });
  if (!r1.ok) throw new Error(`playCoop submit A failed: ${r1.reason}`);
  if (o.submitB !== false) {
    const r2 = env.records.submitResult({
      gameId, roomId, playerId: o.b, submittedAt: iso(at + 0.001),
      stats: coopStats(2, o.teamScore, scoreB, { id: o.a, nickname: nick(o.a) }, o.outcome ? { outcome: o.outcome } : {}),
    });
    if (!r2.ok) throw new Error(`playCoop submit B failed: ${r2.reason}`);
  }
  return gameId;
}
