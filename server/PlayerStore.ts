import { GameDatabase } from './db/GameDatabase';
import { CoopBestEntry, PlayerProfile } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

interface ProfileRow {
  id: string;
  nickname: string;
  last_seen_at: string;
  best_score: number;
  total_games: number;
}

interface CoopRow {
  total_score: number;
  wave_reached: number;
  ended_at: string;
  my_score: number | null;
  partner_id: string;
  partner_nickname: string;
  partner_score: number | null;
}

const BEST_SCORE_SQL = `COALESCE((SELECT MAX(gp.score) FROM game_players gp JOIN games g ON g.id = gp.game_id
              WHERE gp.player_id = p.id AND g.mode = 'solo' AND g.status = 'finished'
                AND g.ruleset_version = @rv AND gp.submitted_at IS NOT NULL), 0)`;
const TOTAL_GAMES_SQL = `(SELECT COUNT(*) FROM game_players gp JOIN games g ON g.id = gp.game_id
      WHERE gp.player_id = p.id AND g.status = 'finished' AND g.ruleset_version = @rv)`;

export class PlayerStore {
  constructor(
    private readonly db: GameDatabase,
    private readonly rulesetVersion: number = RANKING_RULESET_VERSION,
  ) {}

  private toProfile(row: ProfileRow): PlayerProfile {
    return {
      deviceId: row.id,
      nickname: row.nickname,
      bestScore: row.best_score,
      totalGames: row.total_games,
      lastPlayedAt: row.last_seen_at,
    };
  }

  public findByDeviceId(deviceId: string): PlayerProfile | undefined {
    const row = this.db.conn
      .prepare(
        `SELECT p.id, p.nickname, p.last_seen_at,
           ${BEST_SCORE_SQL} AS best_score,
           ${TOTAL_GAMES_SQL} AS total_games
         FROM players p WHERE p.id = @id`,
      )
      .get({ id: deviceId, rv: this.rulesetVersion }) as ProfileRow | undefined;
    if (!row) return undefined;
    const profile = this.toProfile(row);

    const coopRows = this.db.conn
      .prepare(
        `SELECT g.total_score, g.wave_reached, g.ended_at, me.score AS my_score,
                pa.player_id AS partner_id, pp.nickname AS partner_nickname, pa.score AS partner_score
         FROM game_players me
         JOIN games g ON g.id = me.game_id
         JOIN game_players pa ON pa.game_id = g.id AND pa.player_id <> me.player_id
         JOIN players pp ON pp.id = pa.player_id
         WHERE me.player_id = @id AND g.mode = 'coop' AND g.status = 'finished' AND g.ruleset_version = @rv
         ORDER BY g.total_score DESC, g.ended_at ASC`,
      )
      .all({ id: deviceId, rv: this.rulesetVersion }) as CoopRow[];
    if (coopRows.length > 0) {
      const coopBests: Record<string, CoopBestEntry> = {};
      for (const r of coopRows) {
        if (coopBests[r.partner_id]) continue;
        coopBests[r.partner_id] = {
          partnerDeviceId: r.partner_id,
          partnerNickname: r.partner_nickname,
          teamScore: r.total_score,
          myScore: r.my_score ?? 0,
          partnerScore: r.partner_score ?? 0,
          waveReached: r.wave_reached,
          playedAt: r.ended_at,
        };
      }
      profile.coopBests = coopBests;
    }
    return profile;
  }

  public registerOrUpdateNickname(deviceId: string, nickname: string): PlayerProfile {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 10) {
      throw new Error('INVALID_NICKNAME: Nickname must be 2 to 10 characters');
    }
    const now = new Date().toISOString();
    this.db.conn
      .prepare(
        `INSERT INTO players (id, nickname, auth_provider, last_seen_at, created_at, updated_at)
         VALUES (@id, @nickname, 'device', @now, @now, @now)
         ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at`,
      )
      .run({ id: deviceId, nickname: trimmed, now });
    return this.findByDeviceId(deviceId)!;
  }

  public touchLastSeen(deviceId: string): void {
    this.db.conn
      .prepare(`UPDATE players SET last_seen_at = @now WHERE id = @id`)
      .run({ id: deviceId, now: new Date().toISOString() });
  }

  public getTopRankings(limit = 5): PlayerProfile[] {
    const rows = this.db.conn
      .prepare(
        `SELECT * FROM (
           SELECT p.id, p.nickname, p.last_seen_at,
             ${BEST_SCORE_SQL} AS best_score,
             ${TOTAL_GAMES_SQL} AS total_games
           FROM players p)
         WHERE best_score > 0
         ORDER BY best_score DESC, last_seen_at ASC LIMIT @limit`,
      )
      .all({ rv: this.rulesetVersion, limit }) as ProfileRow[];
    return rows.map((r) => this.toProfile(r));
  }
}
