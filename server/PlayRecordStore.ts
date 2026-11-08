import { GameDatabase } from './db/GameDatabase';
import { CardPickRecord, InputKind, PlayMode, PlayRunStats, PlayerSlot, RewardCardKind, RunRankingEntry, TeamRankingEntry, TeamRankingMember, WeaponKind } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

export interface BeginGameInput {
  /** 대문자 정규화된 값(RoomSession.roomId) */
  roomId: string;
  mode: PlayMode;
  rulesetVersion: number;
  startedAt: string;
  players: { slot: PlayerSlot; playerId: string; inputKind: InputKind | null }[];
}

export interface SubmitResultInput {
  gameId: number;
  roomId: string;
  playerId: string;
  /** ISO, 서버 시각 */
  submittedAt: string;
  /** isValidPlayRunStats를 통과한 값만 */
  stats: PlayRunStats;
}

export type SubmitFailure =
  | 'GAME_NOT_FOUND' | 'ROOM_MISMATCH' | 'GAME_NOT_PLAYING'
  | 'NOT_IN_GAME' | 'ALREADY_SUBMITTED' | 'MODE_MISMATCH' | 'SLOT_MISMATCH';
export type SubmitResult = { ok: true; finishedGame: boolean } | { ok: false; reason: SubmitFailure };

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const WEAPONS: readonly WeaponKind[] = ['shotgun', 'revolver', 'gatling'];
const INPUTS: readonly InputKind[] = ['mobile', 'mouse'];
const REWARD_CARD_KINDS: readonly RewardCardKind[] = [
  'weapon_level_up', 'rapid_reload', 'bar_repair', 'fever_boost', 'lucky_drop',
  'damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up',
];
const MAX_CARD_PICKS = 60;
const isCardPick = (c: any): c is CardPickRecord =>
  !!c && typeof c === 'object' && isCount(c.wave) && REWARD_CARD_KINDS.includes(c.kind) &&
  typeof c.midWave === 'boolean' && typeof c.auto === 'boolean';
const NUMBER_KEYS = ['waveReached', 'livesLeft', 'durationSec', 'totalScore', 'baseScore', 'timeBonus', 'precisionBonus', 'levelBonus', 'maxCombo', 'kills', 'accuracy', 'weaponLevel'] as const;
const OPTIONAL_KEYS = ['damageTaken', 'healedLives', 'itemsCollected'] as const;
const SHOT_KEYS = ['PERFECT', 'GREAT', 'GOOD', 'MISS'] as const;
const CARD_KEYS = ['damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up'] as const;

/** 브라우저가 보낸 값이므로 믿지 않고 형식을 확인한다. */
export function isValidPlayRunStats(v: unknown): v is PlayRunStats {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, any>;
  if (s.outcome !== 'GAMEOVER' && s.outcome !== 'VICTORY') return false;
  if (!WEAPONS.includes(s.weaponKind)) return false;
  if (!NUMBER_KEYS.every((k) => isCount(s[k]))) return false;
  // DB 제약(CHECK)과 맞춘다: weapon_level 1..4 정수, accuracy 0..1 비율
  if (!Number.isInteger(s.weaponLevel) || s.weaponLevel < 1 || s.weaponLevel > 4) return false;
  if (s.accuracy > 1) return false;
  if (!OPTIONAL_KEYS.every((k) => s[k] === undefined || isCount(s[k]))) return false;
  if (!s.shots || !SHOT_KEYS.every((k) => isCount(s.shots[k]))) return false;
  if (!s.cardStacks || !CARD_KEYS.every((k) => isCount(s.cardStacks[k]))) return false;
  if (!Array.isArray(s.waves) || s.waves.length > 20) return false;
  if (!s.waves.every((w: any) => w && isCount(w.wave) && isCount(w.seconds) && isCount(w.bonus) && (w.damageTaken === undefined || isCount(w.damageTaken)))) return false;
  // game_waves UNIQUE(game_id, wave_num)
  if (new Set(s.waves.map((w: any) => w.wave)).size !== s.waves.length) return false;

  if (s.inputKind !== undefined && !INPUTS.includes(s.inputKind)) return false;
  if (s.cardPicks !== undefined) {
    if (!Array.isArray(s.cardPicks) || s.cardPicks.length > MAX_CARD_PICKS) return false;
    if (!s.cardPicks.every(isCardPick)) return false;
  }

  if (s.mode !== undefined && s.mode !== 'solo' && s.mode !== 'coop') return false;
  if (s.mode === 'coop') {
    if (!s.coop || typeof s.coop !== 'object') return false;
    const c = s.coop;
    if (c.slot !== 1 && c.slot !== 2) return false;
    if (!isCount(c.teamScore) || !isCount(c.partnerScore)) return false;
    if (typeof c.partnerDeviceId !== 'string' || c.partnerDeviceId.length > 64) return false;
    if (typeof c.partnerNickname !== 'string' || c.partnerNickname.length > 64) return false;
    if (typeof c.leftEarly !== 'boolean') return false;
    if (c.partnerWeaponKind !== undefined && !WEAPONS.includes(c.partnerWeaponKind)) return false;
    if (c.partnerInputKind !== undefined && !INPUTS.includes(c.partnerInputKind)) return false;
  } else {
    if (s.coop !== undefined) return false;
  }

  return true;
}

/** 값이 없는 선택 필드는 키째 뺀다. */
function compactMember(m: TeamRankingMember): TeamRankingMember {
  const out: TeamRankingMember = { deviceId: m.deviceId, nickname: m.nickname };
  if (m.score !== undefined) out.score = m.score;
  if (m.weaponKind !== undefined) out.weaponKind = m.weaponKind;
  if (m.inputKind !== undefined) out.inputKind = m.inputKind;
  return out;
}

interface RunRow {
  player_id: string;
  nickname: string;
  total_score: number;
  wave_reached: number;
  weapon_kind: WeaponKind;
  ended_at: string;
  input_kind: InputKind | null;
}

interface TeamGameRow {
  id: number;
  team_key: string;
  total_score: number;
  wave_reached: number;
  ended_at: string;
}

interface MemberRow {
  slot: number;
  player_id: string;
  nickname: string;
  score: number | null;
  weapon_kind: WeaponKind | null;
  input_kind: InputKind | null;
}

/** 판(games)과 플레이어별 기록(game_players 등)을 SQLite에 저장하고 랭킹을 쿼리로 만든다. */
export class PlayRecordStore {
  constructor(
    private readonly db: GameDatabase,
    private readonly rulesetVersion: number = RANKING_RULESET_VERSION,
  ) {}

  /** 새 판을 만든다. 같은 방의 진행 중인 판은 abandoned로 바꾼다. */
  public beginGame(input: BeginGameInput): number {
    return this.db.transaction(() => {
      const conn = this.db.conn;
      conn
        .prepare(`UPDATE games SET status = 'abandoned', ended_at = @startedAt WHERE room_id = @roomId AND status = 'playing'`)
        .run({ startedAt: input.startedAt, roomId: input.roomId });
      const teamKey = input.mode === 'coop' ? input.players.map((p) => p.playerId).sort().join('|') : null;
      const res = conn
        .prepare(
          `INSERT INTO games (room_id, mode, player_count, team_key, ruleset_version, status, started_at)
           VALUES (@roomId, @mode, @playerCount, @teamKey, @rv, 'playing', @startedAt)`,
        )
        .run({
          roomId: input.roomId,
          mode: input.mode,
          playerCount: input.players.length,
          teamKey,
          rv: input.rulesetVersion,
          startedAt: input.startedAt,
        });
      const gameId = Number(res.lastInsertRowid);
      const insertPlayer = conn.prepare(
        `INSERT INTO game_players (game_id, player_id, slot, input_kind) VALUES (@gameId, @playerId, @slot, @inputKind)`,
      );
      for (const p of input.players) {
        insertPlayer.run({ gameId, playerId: p.playerId, slot: p.slot, inputKind: p.inputKind });
      }
      return gameId;
    });
  }

  public chooseWeapon(gameId: number, roomId: string, slot: PlayerSlot, weaponKind: WeaponKind): boolean {
    const res = this.db.conn
      .prepare(
        `UPDATE game_players SET weapon_kind = @weaponKind, weapon_level = COALESCE(weapon_level, 1)
         WHERE slot = @slot AND game_id = (SELECT id FROM games WHERE id = @gameId AND room_id = @roomId AND status = 'playing')`,
      )
      .run({ weaponKind, slot, gameId, roomId });
    return res.changes === 1;
  }

  public abandonGame(gameId: number, roomId: string, endedAt: string): boolean {
    const res = this.db.conn
      .prepare(`UPDATE games SET status = 'abandoned', ended_at = @endedAt WHERE id = @gameId AND room_id = @roomId AND status = 'playing'`)
      .run({ endedAt, gameId, roomId });
    return res.changes === 1;
  }

  public submitResult(input: SubmitResultInput): SubmitResult {
    return this.db.transaction((): SubmitResult => {
      const conn = this.db.conn;
      const { gameId, roomId, playerId, submittedAt, stats } = input;
      const game = conn
        .prepare(`SELECT id, room_id, mode, status FROM games WHERE id = ?`)
        .get(gameId) as { id: number; room_id: string; mode: PlayMode; status: string } | undefined;
      if (!game) return { ok: false, reason: 'GAME_NOT_FOUND' };
      if (game.room_id !== roomId) return { ok: false, reason: 'ROOM_MISMATCH' };
      // finished는 거절하지 않는다: 협동은 첫 제출이 판을 끝낸 뒤 두 번째 제출이 온다.
      if (game.status === 'abandoned') return { ok: false, reason: 'GAME_NOT_PLAYING' };

      const row = conn
        .prepare(`SELECT id, slot, submitted_at FROM game_players WHERE game_id = ? AND player_id = ?`)
        .get(gameId, playerId) as { id: number; slot: number; submitted_at: string | null } | undefined;
      if (!row) return { ok: false, reason: 'NOT_IN_GAME' };
      if (row.submitted_at) return { ok: false, reason: 'ALREADY_SUBMITTED' };

      if ((stats.mode ?? 'solo') !== game.mode) return { ok: false, reason: 'MODE_MISMATCH' };
      if (game.mode === 'coop' && stats.coop!.slot !== row.slot) return { ok: false, reason: 'SLOT_MISMATCH' };

      conn
        .prepare(
          `UPDATE game_players SET
             submitted_at = @submittedAt, score = @totalScore, base_score = @baseScore, time_bonus = @timeBonus,
             precision_bonus = @precisionBonus, level_bonus = @levelBonus, kills = @kills, accuracy = @accuracy,
             max_combo = @maxCombo, damage_taken = @damageTaken, healed_lives = @healedLives, items_collected = @itemsCollected,
             left_early = @leftEarly, weapon_kind = @weaponKind, weapon_level = @weaponLevel,
             input_kind = COALESCE(input_kind, @inputKind),
             shots_perfect = @PERFECT, shots_great = @GREAT, shots_good = @GOOD, shots_miss = @MISS,
             cards_damage_up = @damage_up, cards_skill_cooldown = @skill_cooldown,
             cards_fever_extend = @fever_extend, cards_hit_zone_up = @hit_zone_up
           WHERE id = @rowId`,
        )
        .run({
          submittedAt,
          totalScore: stats.totalScore,
          baseScore: stats.baseScore,
          timeBonus: stats.timeBonus,
          precisionBonus: stats.precisionBonus,
          levelBonus: stats.levelBonus,
          kills: stats.kills,
          accuracy: stats.accuracy,
          maxCombo: stats.maxCombo,
          damageTaken: stats.damageTaken ?? 0,
          healedLives: stats.healedLives ?? 0,
          itemsCollected: stats.itemsCollected ?? 0,
          leftEarly: stats.coop?.leftEarly ? 1 : 0,
          weaponKind: stats.weaponKind,
          weaponLevel: stats.weaponLevel,
          inputKind: stats.inputKind ?? null,
          PERFECT: stats.shots.PERFECT,
          GREAT: stats.shots.GREAT,
          GOOD: stats.shots.GOOD,
          MISS: stats.shots.MISS,
          damage_up: stats.cardStacks.damage_up,
          skill_cooldown: stats.cardStacks.skill_cooldown,
          fever_extend: stats.cardStacks.fever_extend,
          hit_zone_up: stats.cardStacks.hit_zone_up,
          rowId: row.id,
        });

      const insertPick = conn.prepare(
        `INSERT INTO game_player_card_picks (game_player_id, pick_order, wave_num, card_kind, mid_wave, auto_picked)
         VALUES (@gpId, @order, @wave, @kind, @mid, @auto)`,
      );
      (stats.cardPicks ?? []).forEach((c, i) => {
        insertPick.run({ gpId: row.id, order: i, wave: c.wave, kind: c.kind, mid: c.midWave ? 1 : 0, auto: c.auto ? 1 : 0 });
      });

      let finishedGame = false;
      if (game.status === 'playing') {
        conn
          .prepare(
            `UPDATE games SET status = 'finished', outcome = @outcome, total_score = @total, wave_reached = @waveReached,
               lives_left = @livesLeft, duration_sec = @durationSec, ended_at = @submittedAt WHERE id = @gameId`,
          )
          .run({
            outcome: stats.outcome,
            total: game.mode === 'coop' ? stats.coop!.teamScore : stats.totalScore,
            waveReached: stats.waveReached,
            livesLeft: stats.livesLeft,
            durationSec: stats.durationSec,
            submittedAt,
            gameId,
          });
        const insertWave = conn.prepare(
          `INSERT INTO game_waves (game_id, wave_num, seconds, bonus, damage_taken) VALUES (@gameId, @wave, @seconds, @bonus, @damageTaken)`,
        );
        for (const w of stats.waves) {
          insertWave.run({ gameId, wave: w.wave, seconds: w.seconds, bonus: w.bonus, damageTaken: w.damageTaken ?? null });
        }
        finishedGame = true;
      }
      return { ok: true, finishedGame };
    });
  }

  public getTopRuns(limit = 5): RunRankingEntry[] {
    const rows = this.db.conn
      .prepare(
        `SELECT gp.player_id, p.nickname, g.total_score, g.wave_reached, gp.weapon_kind, g.ended_at, gp.input_kind
         FROM games g JOIN game_players gp ON gp.game_id = g.id JOIN players p ON p.id = gp.player_id
         WHERE g.mode = 'solo' AND g.status = 'finished' AND g.ruleset_version = @rv AND gp.submitted_at IS NOT NULL
         ORDER BY g.total_score DESC, g.ended_at ASC LIMIT @limit`,
      )
      .all({ rv: this.rulesetVersion, limit }) as RunRow[];
    return rows.map((r) => ({
      deviceId: r.player_id,
      nickname: r.nickname,
      score: r.total_score,
      waveReached: r.wave_reached,
      weaponKind: r.weapon_kind,
      playedAt: r.ended_at,
      ...(r.input_kind ? { inputKind: r.input_kind } : {}),
    }));
  }

  public getTopTeams(limit = 5): TeamRankingEntry[] {
    const games = this.db.conn
      .prepare(
        `WITH ranked AS (
           SELECT g.id, g.team_key, g.total_score, g.wave_reached, g.ended_at,
                  ROW_NUMBER() OVER (PARTITION BY g.team_key ORDER BY g.total_score DESC, g.ended_at ASC) AS rn
           FROM games g WHERE g.mode = 'coop' AND g.status = 'finished' AND g.ruleset_version = @rv)
         SELECT id, team_key, total_score, wave_reached, ended_at FROM ranked WHERE rn = 1
         ORDER BY total_score DESC, ended_at ASC LIMIT @limit`,
      )
      .all({ rv: this.rulesetVersion, limit }) as TeamGameRow[];
    const memberStmt = this.db.conn.prepare(
      `SELECT gp.slot, gp.player_id, p.nickname, gp.score, gp.weapon_kind, gp.input_kind
       FROM game_players gp JOIN players p ON p.id = gp.player_id WHERE gp.game_id = ? ORDER BY gp.slot`,
    );
    const out: TeamRankingEntry[] = [];
    for (const g of games) {
      const members = (memberStmt.all(g.id) as MemberRow[]).map((m) =>
        compactMember({
          deviceId: m.player_id,
          nickname: m.nickname,
          score: m.score ?? undefined,
          weaponKind: m.weapon_kind ?? undefined,
          inputKind: m.input_kind ?? undefined,
        }),
      );
      if (members.length !== 2) continue;
      out.push({
        teamKey: g.team_key,
        members: [members[0], members[1]],
        teamScore: g.total_score,
        waveReached: g.wave_reached,
        playedAt: g.ended_at,
      });
    }
    return out;
  }
}
