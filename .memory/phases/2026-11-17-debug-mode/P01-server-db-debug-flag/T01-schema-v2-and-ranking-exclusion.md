# Task: T01 Schema v2 and Ranking Exclusion

## Status: done

## Goal
디버그 판을 DB에 `is_debug = 1`(+ 시작 조건 JSON)로 저장하고, 모든 랭킹·최고점·협동 최고 기록·판 수 집계에서 제외한다. 운영 DB(이미 `games` 테이블이 있는 v1)도 서버 재시작만으로 컬럼이 추가되어야 한다.

## Decision Summary
- D03/D04: `games.is_debug INTEGER NOT NULL DEFAULT 0`, `games.debug_config TEXT`(nullable, JSON). `SCHEMA_VERSION` 1 → 2, `user_version < 2`일 때만 ALTER.
- 서버는 GAME_BEGIN의 `debug` 값을 그대로 믿는다(랭킹에서 빼는 방향으로만 작용). 형식만 검증한다.

## Implementation

### I01. 공용 타입 `DebugStartConfig`와 GAME_BEGIN 필드

- Related Files:
  - `src/shared/types.ts` :: `DebugStartPoint`, `DebugStartConfig`, `ClientToServerMessage['GAME_BEGIN']` — 새 타입·필드; modify

#### Details
- **Signatures & Types** (`WeaponLevel` 정의(7행) 근처에 추가):
  ```typescript
  export type DebugStartPoint = 'W1' | 'W6' | 'EX';
  /** 디버그 판 시작 조건. EX 시작은 엔진이 EX MAX 강화를 강제하므로 weaponLevel·cards는 기록용이다. */
  export interface DebugStartConfig {
    startAt: DebugStartPoint;
    weaponLevel: WeaponLevel;
    cards: {
      damage_up: number;      // 0..3 (GAME_TUNING.cards.damageUp.maxStacks)
      skill_cooldown: number; // 0..3
      fever_extend: number;   // 0..3
      hit_zone_up: number;    // 0..2 (GAME_TUNING.cards.hitZoneUp.maxStacks)
      rapid_reload: number;   // 0..3 (GAME_TUNING.cards.rapidReloadMaxStacks)
      lucky_drop: number;     // 0..3 (GAME_TUNING.cards.luckyDropMaxStacks)
    };
  }
  ```
- GAME_BEGIN(289행) 변경:
  `| { type: 'GAME_BEGIN'; roomId: string; beginId: string; mode: PlayMode; players: GameBeginPlayer[]; debug?: DebugStartConfig }`
  - 주석: "있으면 디버그 판(랭킹 제외). 없으면 일반 판."

### I02. 스키마 v2와 마이그레이션

- Related Files:
  - `server/db/schema.ts` :: `SCHEMA_VERSION`, `SCHEMA_SQL`, `MIGRATIONS`(new export); modify
  - `server/db/GameDatabase.ts` :: `GameDatabase.constructor`; modify

#### Details
- `SCHEMA_VERSION = 2`.
- `SCHEMA_SQL`의 `games`에 `ended_at TEXT,` 다음 줄로 추가(새 DB용):
  ```sql
  is_debug        INTEGER NOT NULL DEFAULT 0 CHECK(is_debug IN (0, 1)),
  debug_config    TEXT,
  ```
- 새 export:
  ```typescript
  /** user_version이 from보다 작은 기존 DB에 순서대로 적용한다. */
  export const MIGRATIONS: { to: number; sql: string }[] = [
    { to: 2, sql: `ALTER TABLE games ADD COLUMN is_debug INTEGER NOT NULL DEFAULT 0 CHECK(is_debug IN (0, 1));
                   ALTER TABLE games ADD COLUMN debug_config TEXT;` },
  ];
  ```
- `GameDatabase` 생성자 흐름(현재 23~32행 교체):
  1. `const v = user_version`을 **`exec(SCHEMA_SQL)` 전에** 읽는다.
  2. `this.conn.exec(SCHEMA_SQL)`.
  3. `v === 0`: 새 DB(또는 v0 표기)이다. 단, v0인데 `games`가 이미 있고 `is_debug` 컬럼이 없을 수 있으므로(기존 운영 DB는 v1이지만 방어) `PRAGMA table_info(games)`에 `is_debug`가 없으면 마이그레이션 실행. 그 뒤 `user_version = SCHEMA_VERSION`.
  4. `0 < v < SCHEMA_VERSION`: `this.transaction(() => { for (const m of MIGRATIONS) if (m.to > v) this.conn.exec(m.sql); })` 후 `user_version = SCHEMA_VERSION`.
  5. `v > SCHEMA_VERSION`: 기존 경고 유지.
- **함정**: v1 DB에서 `exec(SCHEMA_SQL)`은 `CREATE TABLE IF NOT EXISTS games`를 건너뛰므로 컬럼이 생기지 않는다. 마이그레이션 없이 `CREATE INDEX`에 `is_debug`를 쓰면 시작 시 크래시하므로, **인덱스는 바꾸지 않는다**.

### I03. 저장과 조회 제외

- Related Files:
  - `server/PlayRecordStore.ts` :: `BeginGameInput`, `beginGame`, `getTopRuns`, `getTopTeams`; modify
  - `server/PlayerStore.ts` :: `BEST_SCORE_SQL`, `TOTAL_GAMES_SQL`, `findByDeviceId`(coopRows 쿼리); modify
  - `server/PlayRecordStore.ts` :: `isValidDebugStartConfig`(new export); modify
  - `server/wsServer.ts` :: `case 'GAME_BEGIN'`(599~642행); modify

#### Details
- `BeginGameInput`에 `debug?: DebugStartConfig` 추가.
- `beginGame` INSERT: 컬럼 `is_debug, debug_config` 추가, 값 `@isDebug`(= `input.debug ? 1 : 0`), `@debugConfig`(= `input.debug ? JSON.stringify(input.debug) : null`).
- `isValidDebugStartConfig(v: unknown): v is DebugStartConfig`: `startAt ∈ {'W1','W6','EX'}`, `weaponLevel` 정수 1..4, `cards`의 6개 키가 모두 0 이상 정수이고 위 상한 이하(`GAME_TUNING.cards` 상수 사용). 그 밖의 키는 무시.
- 쿼리 제외(`AND g.is_debug = 0`) 적용 위치:
  - `getTopRuns` WHERE(308행)
  - `getTopTeams` WHERE(342행)
  - `PlayerStore.BEST_SCORE_SQL`, `TOTAL_GAMES_SQL`, `findByDeviceId` coopRows WHERE(64행)
- `wsServer.ts` GAME_BEGIN: 플레이어 검증 뒤, `beginGame` 전에
  ```typescript
  if (msg.debug !== undefined && !isValidDebugStartConfig(msg.debug)) return reject('Invalid debug config');
  ```
  그리고 `beginGame({ ..., debug: msg.debug })`.

### I04. 테스트

- Related Files:
  - `tests/game-database.test.ts` — v1 → v2 마이그레이션 케이스; modify
  - `tests/debug-records.test.ts` — 랭킹 제외 케이스; new

#### Details
- 마이그레이션: 임시 파일 DB(`os.tmpdir()`)에 v1 스키마(현재 `games` 정의에서 두 컬럼 뺀 CREATE + `PRAGMA user_version = 1`)를 만들고 기존 행 1개 삽입 → `new GameDatabase(path)` → `PRAGMA table_info(games)`에 `is_debug`, `debug_config` 존재, 기존 행 `is_debug = 0`, `user_version = 2`. 두 번째로 열어도 에러 없음(멱등).
- 새 메모리 DB: `user_version = 2`, 컬럼 존재.
- 랭킹 제외(`tests/helpers/dbFixtures.ts`의 `makeEnv`, `register`, `stats` 사용): d1 일반 판 10000점, d2 디버그 판(`debug: {...}`) 99999점 제출 → `getTopRuns()`에 d2 없음, `getTopRunsByWeapon()`에도 없음, `players.findByDeviceId('d2').bestScore === 0`, `totalGames === 0`. 협동 디버그 판 → `getTopTeams()`에 없음, coopBests에도 없음. `games.debug_config`가 JSON으로 저장됨.
- `isValidDebugStartConfig`: 정상값 true, `startAt: 'W3'`·`weaponLevel: 5`·`hit_zone_up: 3`·음수 → false.

## Acceptance Criteria
- [x] v1 운영 DB를 열면 `is_debug`·`debug_config`가 추가되고 기존 판은 `is_debug = 0`이다.
- [x] `debug`가 있는 GAME_BEGIN으로 만든 판은 `is_debug = 1`이며 솔로·무기별·팀 랭킹, 최고점, 협동 최고, 판 수에서 빠진다.
- [x] 잘못된 `debug`는 `GAME_BEGIN_REJECTED`로 거절된다.

## Validation
- `npx vitest run tests/game-database.test.ts tests/debug-records.test.ts tests/play-records.test.ts tests/team-rankings.test.ts tests/game-lifecycle-server.test.ts` — 모두 통과
- `npx tsc --noEmit` — 에러 0

## Commit Message
```text
feat(server): add debug game flag with schema v2 and exclude debug runs from rankings

Plan: 2026-11-17-debug-mode
Phase: P01-server-db-debug-flag
Task: T01-schema-v2-and-ranking-exclusion

- I01: add DebugStartConfig type and optional debug field on GAME_BEGIN
- I02: bump SCHEMA_VERSION to 2 with is_debug/debug_config migration
- I03: store debug flag on beginGame and filter is_debug from ranking/profile queries
- I04: cover migration, validation and ranking exclusion with tests
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
