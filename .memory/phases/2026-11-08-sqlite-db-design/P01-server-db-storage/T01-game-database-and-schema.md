# Task: T01 GameDatabase와 스키마

## Status: done

## Goal
서버가 쓸 SQLite 연결 관리자 `GameDatabase`와 5개 테이블 스키마를 만든다. 아직 어떤 스토어도 이것을 쓰지 않지만, 스키마 제약(CHECK·UNIQUE·FK)을 이 Task의 테스트로 단독 검증한다. 다음 Task(T02)가 이 위에 두 스토어를 올린다.

## Decision Summary
- D10: 연결 하나를 `GameDatabase`가 소유하고 PRAGMA(`journal_mode=WAL`, `foreign_keys=ON`), 스키마 생성, 트랜잭션을 담당한다. 테스트는 `new GameDatabase(':memory:')`.
- D11: 시간 값은 `REAL`, `accuracy`는 0~1, 무기 레벨 1~4, 유니크 4종, `team_key`, `players` 삭제는 RESTRICT, `games` 삭제는 CASCADE. 스키마 원문은 결정 문서의 "최종 스키마 DDL"과 **글자 단위로 같아야 한다**(아래에 그대로 옮겨 둠).

## Implementation

### I01. 의존성 설치
- Related Files:
  - `package.json` — `dependencies`에 `better-sqlite3`, `devDependencies`에 `@types/better-sqlite3`; modify
  - `package-lock.json`; modify
#### Details
- 실행: `npm install better-sqlite3@^12` 그리고 `npm install -D @types/better-sqlite3@^7`
- Node는 v24.15.0이다. `better-sqlite3` 12.x는 Node 24 프리빌드 바이너리를 제공한다. 설치 중 네이티브 빌드(node-gyp)가 시작되고 실패하면 출력 전체를 Task 파일 Progress에 남기고 멈춘다(임의로 다른 라이브러리로 바꾸지 않는다).
- `tsconfig.json`에 이미 `esModuleInterop: true`가 있으므로 `import Database from 'better-sqlite3'`가 컴파일된다.

### I02. 스키마 상수
- Related Files:
  - `server/db/schema.ts` :: `SCHEMA_SQL`, `SCHEMA_VERSION` — 테이블과 인덱스 DDL; new
#### Details
- **Signatures & Types**:
  ```typescript
  /** PRAGMA user_version에 기록한다. 이후 스키마를 바꿀 때 이 값으로 분기한다. */
  export const SCHEMA_VERSION = 1;
  export const SCHEMA_SQL: string; // 아래 DDL 원문 그대로 (템플릿 리터럴)
  ```
- `.sql` 파일이 아니라 TS 상수로 둔다. 이유: `tsx`(서버), `vitest`(테스트), 이후 번들 어디서든 파일 경로 계산 없이 import만으로 쓰기 위해서다.
- **Data & Schema Fields** (`SCHEMA_SQL` 원문):
  ```sql
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
  ```
- 함정: `players.id` FK는 `ON DELETE` 절이 없다(기본 NO ACTION = 사실상 RESTRICT). `CASCADE`를 붙이면 한 플레이어 삭제로 협동 판의 절반만 사라진다(D11).

### I03. 연결 관리자
- Related Files:
  - `server/db/GameDatabase.ts` :: `GameDatabase`, `DEFAULT_DB_PATH` — 연결·PRAGMA·스키마·트랜잭션; new
#### Details
- **Signatures & Types**:
  ```typescript
  import fs from 'node:fs';
  import path from 'node:path';
  import Database from 'better-sqlite3';
  import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

  export const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'game.db');

  export class GameDatabase {
    /** 스토어가 prepare()에 쓰는 원시 연결. */
    readonly conn: Database.Database;
    constructor(filePath: string = DEFAULT_DB_PATH);
    /** fn을 하나의 트랜잭션으로 실행한다. fn이 던지면 전부 롤백하고 예외를 다시 던진다. */
    transaction<T>(fn: () => T): T;
    close(): void;
  }
  ```
- **Execution Flow / Logic** (`constructor`):
  1. `filePath !== ':memory:'`이면 `fs.mkdirSync(path.dirname(filePath), { recursive: true })`.
  2. `this.conn = new Database(filePath)`.
  3. `filePath !== ':memory:'`일 때만 `this.conn.pragma('journal_mode = WAL')`(메모리 DB는 WAL 불가).
  4. `this.conn.pragma('foreign_keys = ON')`, `this.conn.pragma('busy_timeout = 5000')`.
  5. `this.conn.exec(SCHEMA_SQL)`.
  6. `const v = this.conn.pragma('user_version', { simple: true }) as number`; `v === 0`이면 `this.conn.pragma(\`user_version = ${SCHEMA_VERSION}\`)`. `v > SCHEMA_VERSION`이면 `console.error`로 "더 새로운 서버가 만든 DB"라고 남기되 계속 진행한다(기존 `PlayerStore.migrateRuleset`의 "새 파일은 건드리지 않는다" 관례와 같다).
- `transaction<T>(fn)`: `return this.conn.transaction(fn)();`
- `close()`: `if (this.conn.open) this.conn.close();` (두 번 불려도 안전해야 한다. 서버 `close()`와 테스트 정리가 둘 다 부를 수 있다.)
- 에러 처리: 생성자에서 열기 실패는 그대로 던진다(서버 기동 실패가 맞다. 조용히 빈 저장소로 시작하던 JSON 방식과 다르다).

### I04. 스키마 테스트
- Related Files:
  - `tests/game-database.test.ts` :: `describe('GameDatabase')`; new
#### Details
- 공통 준비: `beforeEach`에서 `db = new GameDatabase(':memory:')`, `afterEach`에서 `db.close()`. 행 삽입 헬퍼:
  ```typescript
  const now = '2026-11-08T00:00:00.000Z';
  const addPlayer = (id: string) => db.conn.prepare(
    `INSERT INTO players (id, nickname, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, `닉${id}`.slice(0, 10), now, now, now);
  const addGame = (over: Record<string, unknown> = {}) => { /* mode 'solo', player_count 1, room_id 'ROOM', ruleset_version 5, started_at now 기본값으로 INSERT 후 lastInsertRowid 반환 */ };
  ```
- 케이스:
  1. 5개 테이블이 `sqlite_master`에 있다. `PRAGMA foreign_keys`가 1, `PRAGMA user_version`이 1이다.
  2. `status='finished'`인데 `outcome`이 NULL이면 INSERT가 던진다(`SqliteError`, `CHECK constraint failed`).
  3. `mode='coop'`인데 `team_key`가 NULL이면 던진다. `mode='solo'`인데 `team_key`가 있으면 던진다.
  4. 같은 `game_id`에 `slot` 1을 두 번 넣으면 UNIQUE로 던진다. 같은 `player_id`를 두 번 넣어도 던진다.
  5. `game_players`가 참조하는 `players` 행을 DELETE하면 FK로 던진다(RESTRICT).
  6. `games` 행을 DELETE하면 `game_players`, `game_waves`, `game_player_card_picks`가 모두 0행이 된다(CASCADE).
  7. `game_players.accuracy = 1.5`, `weapon_level = 0`, `submitted_at`만 있고 `score` NULL은 각각 던진다.
  8. `transaction`: 안에서 INSERT 후 throw하면 행이 남지 않는다.
  9. 파일 경로: `os.tmpdir()` 아래 `nested/game.db`로 열면 폴더가 생기고 `PRAGMA journal_mode`가 `wal`이다. 닫은 뒤 다시 열어도 스키마 생성이 실패하지 않는다(`IF NOT EXISTS`). 정리는 `fs.rmSync(dir, { recursive: true, force: true })`.

## Acceptance Criteria
- [ ] `better-sqlite3`가 설치되고 `npx tsc --noEmit`이 통과한다.
- [ ] `new GameDatabase(':memory:')`로 5개 테이블과 인덱스 4개가 만들어진다.
- [ ] 스키마 제약 위반이 모두 예외로 드러난다(I04의 2~7).
- [ ] 기존 테스트가 하나도 깨지지 않는다(아직 아무도 `GameDatabase`를 쓰지 않음).

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/game-database.test.ts` — 전부 통과
- `npm test` — 전부 통과(기존 테스트 회귀 없음)

## Commit Message
```text
feat(server): SQLite 연결 관리자와 5개 테이블 스키마 추가

Plan: 2026-11-08-sqlite-db-design
Phase: P01-server-db-storage
Task: T01-game-database-and-schema

- better-sqlite3 의존성 추가
- server/db/schema.ts: players·games·game_players·game_waves·game_player_card_picks DDL과 인덱스
- server/db/GameDatabase.ts: WAL·외래키 PRAGMA, 스키마 생성, user_version, 트랜잭션
- tests/game-database.test.ts: CHECK·UNIQUE·FK(RESTRICT/CASCADE)·트랜잭션 롤백 검증
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `c111b53`
