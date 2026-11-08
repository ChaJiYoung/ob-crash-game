/** PRAGMA user_version에 기록한다. 이후 스키마를 바꿀 때 이 값으로 분기한다. */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  nickname      TEXT NOT NULL CHECK(length(nickname) BETWEEN 2 AND 10),
  auth_provider TEXT NOT NULL DEFAULT 'device' CHECK(auth_provider IN ('device', 'entra')),
  email         TEXT,
  last_seen_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id         TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK(mode IN ('solo', 'coop')),
  player_count    INTEGER NOT NULL CHECK(player_count IN (1, 2)),
  team_key        TEXT,
  ruleset_version INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'playing' CHECK(status IN ('playing', 'finished', 'abandoned')),
  outcome         TEXT CHECK(outcome IS NULL OR outcome IN ('VICTORY', 'GAMEOVER')),
  total_score     INTEGER,
  wave_reached    INTEGER,
  lives_left      INTEGER,
  duration_sec    REAL,
  started_at      TEXT NOT NULL,
  ended_at        TEXT,
  CHECK (status <> 'finished' OR (outcome IS NOT NULL AND total_score IS NOT NULL
         AND wave_reached IS NOT NULL AND duration_sec IS NOT NULL AND ended_at IS NOT NULL)),
  CHECK ((mode = 'coop') = (team_key IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS game_players (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id       TEXT NOT NULL REFERENCES players(id),
  slot            INTEGER NOT NULL CHECK(slot IN (1, 2)),
  input_kind      TEXT CHECK(input_kind IS NULL OR input_kind IN ('mobile', 'mouse')),
  weapon_kind     TEXT CHECK(weapon_kind IS NULL OR weapon_kind IN ('shotgun', 'revolver', 'gatling')),
  weapon_level    INTEGER CHECK(weapon_level IS NULL OR weapon_level BETWEEN 1 AND 4),
  submitted_at    TEXT,
  score           INTEGER,
  base_score      INTEGER,
  time_bonus      INTEGER,
  precision_bonus INTEGER,
  level_bonus     INTEGER,
  kills           INTEGER,
  accuracy        REAL CHECK(accuracy IS NULL OR accuracy BETWEEN 0 AND 1),
  max_combo       INTEGER,
  damage_taken    INTEGER,
  healed_lives    INTEGER,
  items_collected INTEGER,
  left_early      INTEGER NOT NULL DEFAULT 0 CHECK(left_early IN (0, 1)),
  shots_perfect   INTEGER,
  shots_great     INTEGER,
  shots_good      INTEGER,
  shots_miss      INTEGER,
  cards_damage_up      INTEGER,
  cards_skill_cooldown INTEGER,
  cards_fever_extend   INTEGER,
  cards_hit_zone_up    INTEGER,
  CHECK (submitted_at IS NULL OR (score IS NOT NULL AND kills IS NOT NULL AND accuracy IS NOT NULL)),
  UNIQUE (game_id, slot),
  UNIQUE (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS game_waves (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id      INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  wave_num     INTEGER NOT NULL,
  seconds      REAL NOT NULL,
  bonus        INTEGER NOT NULL,
  damage_taken INTEGER,
  UNIQUE (game_id, wave_num)
);

CREATE TABLE IF NOT EXISTS game_player_card_picks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  pick_order     INTEGER NOT NULL,
  wave_num       INTEGER NOT NULL,
  card_kind      TEXT NOT NULL CHECK(card_kind IN (
    'weapon_level_up', 'rapid_reload', 'bar_repair', 'fever_boost', 'lucky_drop',
    'damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up')),
  mid_wave       INTEGER NOT NULL CHECK(mid_wave IN (0, 1)),
  auto_picked    INTEGER NOT NULL CHECK(auto_picked IN (0, 1)),
  UNIQUE (game_player_id, pick_order)
);

CREATE INDEX IF NOT EXISTS idx_games_rank ON games(ruleset_version, mode, status, total_score DESC, ended_at);
CREATE INDEX IF NOT EXISTS idx_games_team ON games(ruleset_version, team_key) WHERE mode = 'coop';
CREATE INDEX IF NOT EXISTS idx_games_room_playing ON games(room_id) WHERE status = 'playing';
CREATE INDEX IF NOT EXISTS idx_game_players_player ON game_players(player_id);
`;
