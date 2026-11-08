# Task: T02 스토어 DB 전환과 판 생명주기 서버 프로토콜

## Status: done

## Goal
`PlayerStore`와 `PlayRecordStore`를 JSON/JSONL에서 `GameDatabase`로 바꾸고, 서버가 판 생명주기 메시지(`GAME_BEGIN`, `WEAPON_CHOSEN`, `GAME_ABANDON`, `gameId`가 붙은 `GAME_SCORE_SUBMIT`)를 처리하게 한다. 끝나면 웹소켓 테스트만으로 "판 시작 → 무기 → 제출 → 랭킹/프로필" 전체가 DB 위에서 검증된다.

한 Task로 묶은 이유: 스토어의 쓰기 API(`append`, `recordGameScore`, `recordCoopResult`)가 사라지면 `wsServer`의 제출 처리와 그 테스트가 동시에 바뀌어야 컴파일과 테스트가 성립한다. 스토어만 먼저 바꾸면 중간 상태에서 서버가 빌드되지 않는다.

## Decision Summary
- D01: 레거시 파일을 읽지도 옮기지도 않는다. `data/players.json`, `data/play-records.jsonl` 파일은 지우지 않는다(코드만 제거).
- D02/D05: 판은 `GAME_BEGIN` 때 `games`(`playing`)와 `game_players`를 만들고, 첫 유효 제출이 `finished`로 바꾼다. 각 플레이어 상세는 본인 제출 때 채운다(미제출 = NULL).
- D04(수정본): `abandoned`는 같은 방의 새 `GAME_BEGIN`과 `GAME_ABANDON`으로만. 소켓 끊김·서버 기동 때는 정리하지 않는다.
- D07: `bestScore` = 솔로·finished·현재 규칙 버전 `MAX(score)`, `totalGames` = finished·현재 규칙 버전 `COUNT(*)`.
- D08: 닉네임은 항상 `players.nickname` 조인(판에 저장하지 않음).
- D10: 생성자에 `GameDatabase` 주입. 서버 옵션은 `dbPath` 하나로.
- 마우스 슬롯의 `deviceId` 대조는 P02-T03에서 추가한다. 이 Task는 폰 슬롯만 대조한다.

## Implementation

### I01. 공용 타입과 프로토콜
- Related Files:
  - `src/shared/types.ts` :: `PlayRunStats`, `GameBeginPlayer`(new), `ClientToServerMessage`, `ServerToClientMessage`; modify
#### Details
- **Signatures & Types**:
  ```typescript
  // PlayRunStats.waves: damageTaken 추가 (P02-T01이 채운다. 옛 클라이언트는 안 보냄)
  waves: { wave: number; seconds: number; bonus: number; damageTaken?: number }[];

  export interface GameBeginPlayer {
    slot: PlayerSlot;
    deviceId: string;
    inputKind: InputKind; // 'mobile' | 'mouse'
  }

  // ClientToServerMessage에 추가
  /** 무기 선택 화면이 뜨는 순간(PCGamePage.handleStartGame) PC가 보낸다. beginId는 응답을 짝짓는 PC 쪽 임의 문자열. */
  | { type: 'GAME_BEGIN'; roomId: string; beginId: string; mode: PlayMode; players: GameBeginPlayer[] }
  | { type: 'WEAPON_CHOSEN'; roomId: string; gameId: number; slot: PlayerSlot; weaponKind: WeaponKind }
  /** 일시정지 메뉴의 "로비로"/"다시시작". */
  | { type: 'GAME_ABANDON'; roomId: string; gameId: number }

  // GAME_SCORE_SUBMIT에 gameId 추가. P02-T02 전까지 PC 코드가 컴파일되도록 이 Task에서는 optional로 둔다.
  | { type: 'GAME_SCORE_SUBMIT'; roomId: string; deviceId: string; gameId?: number; score: number; waveReached: number; maxCombo: number; stats?: PlayRunStats; rulesetVersion: number; mode?: PlayMode }

  // ServerToClientMessage: 기존 정의만 있고 쓰이지 않던 GAME_STARTED를 교체
  | { type: 'GAME_STARTED'; roomId: string; beginId: string; gameId: number }
  ```
- `GAME_STARTED`는 현재 `src/`, `server/`, `tests/` 어디에서도 쓰이지 않는다(`grep -rn GAME_STARTED`로 확인 후 교체).
- 새 ERROR 코드(문자열, 타입 변경 없음): `NOT_ROOM_HOST`(기존 재사용), `GAME_BEGIN_REJECTED`, `GAME_NOT_FOUND`, `ROOM_MISMATCH`, `GAME_NOT_PLAYING`, `NOT_IN_GAME`, `ALREADY_SUBMITTED`, `MODE_MISMATCH`, `SLOT_MISMATCH`, `INVALID_STATS`.

### I02. PlayerStore DB 전환
- Related Files:
  - `server/PlayerStore.ts` :: `PlayerStore`; modify (파일 내용 전면 교체)
#### Details
- **Signatures & Types**:
  ```typescript
  import { GameDatabase } from './db/GameDatabase';
  import { CoopBestEntry, PlayerProfile } from '../src/shared/types';
  import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

  export class PlayerStore {
    constructor(db: GameDatabase, rulesetVersion: number = RANKING_RULESET_VERSION);
    findByDeviceId(deviceId: string): PlayerProfile | undefined;          // 유지
    registerOrUpdateNickname(deviceId: string, nickname: string): PlayerProfile; // 유지
    getTopRankings(limit?: number): PlayerProfile[];                       // 유지
    touchLastSeen(deviceId: string): void;                                  // new
  }
  ```
- 제거: `PlayerStoreData`, `load`, `save`, `writeFileAtomic`, `backupUnreadableFile`, `migrateRuleset`, `recordGameScore`, `recordCoopResult`, `fs`/`path` import. (점수 기록은 이제 `PlayRecordStore.submitResult`가 하고, 프로필 숫자는 쿼리로 산출하므로 쓰기 메서드가 필요 없다. 규칙 버전 초기화도 쿼리 조건 `ruleset_version = @rv`가 대신한다.)
- 시각: 모든 메서드는 `new Date().toISOString()`을 쓴다(기존 `lastPlayedAt` 정렬 규칙과 같은 ISO 문자열).
- **`registerOrUpdateNickname`**:
  1. `trimmed = nickname.trim()`; 길이 2~10이 아니면 `throw new Error('INVALID_NICKNAME: Nickname must be 2 to 10 characters')`(문구 그대로. `wsServer`가 `err.message`를 클라이언트에 보낸다).
  2. ```sql
     INSERT INTO players (id, nickname, auth_provider, last_seen_at, created_at, updated_at)
     VALUES (@id, @nickname, 'device', @now, @now, @now)
     ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at
     ```
  3. `return this.findByDeviceId(deviceId)!`
- 자동 생성 닉네임(`` `맥주고수_${deviceId.slice(0, 4)}` ``)은 옮기지 않는다(D09). 미등록 기기는 판에 참가할 수 없다.
- **`touchLastSeen`**: `UPDATE players SET last_seen_at = @now WHERE id = @id`.
- **`findByDeviceId`** — 행이 없으면 `undefined`:
  ```sql
  SELECT p.id, p.nickname, p.last_seen_at,
    COALESCE((SELECT MAX(gp.score) FROM game_players gp JOIN games g ON g.id = gp.game_id
              WHERE gp.player_id = p.id AND g.mode = 'solo' AND g.status = 'finished'
                AND g.ruleset_version = @rv AND gp.submitted_at IS NOT NULL), 0) AS best_score,
    (SELECT COUNT(*) FROM game_players gp JOIN games g ON g.id = gp.game_id
      WHERE gp.player_id = p.id AND g.status = 'finished' AND g.ruleset_version = @rv) AS total_games
  FROM players p WHERE p.id = @id
  ```
  결과 → `{ deviceId: id, nickname, bestScore: best_score, totalGames: total_games, lastPlayedAt: last_seen_at }`. 여기에 `coopBests`를 붙인다(아래 쿼리 결과가 1행 이상일 때만 키를 넣는다. 옛 프로필처럼 없으면 키 자체를 생략).
  ```sql
  SELECT g.total_score, g.wave_reached, g.ended_at, me.score AS my_score,
         pa.player_id AS partner_id, pp.nickname AS partner_nickname, pa.score AS partner_score
  FROM game_players me
  JOIN games g ON g.id = me.game_id
  JOIN game_players pa ON pa.game_id = g.id AND pa.player_id <> me.player_id
  JOIN players pp ON pp.id = pa.player_id
  WHERE me.player_id = @id AND g.mode = 'coop' AND g.status = 'finished' AND g.ruleset_version = @rv
  ORDER BY g.total_score DESC, g.ended_at ASC
  ```
  JS에서 `partner_id`별 첫 행만 취해 `coopBests[partner_id] = { partnerDeviceId, partnerNickname, teamScore: total_score, myScore: my_score ?? 0, partnerScore: partner_score ?? 0, waveReached: wave_reached, playedAt: ended_at }`.
  - 함정: PC는 `best.playedAt >= submittedIso`로 "이번 판이 팀 신기록인가"를 판정한다(`PCGamePage.tsx` `RANKING_UPDATED` 처리). `playedAt`은 반드시 `games.ended_at`(서버가 첫 제출 때 넣는 시각)이어야 하고, `started_at`을 쓰면 신기록 표시가 영영 안 뜬다.
- **`getTopRankings(limit = 5)`**: 위 `best_score` 서브쿼리를 SELECT로 계산해 `best_score > 0`인 플레이어만, `ORDER BY best_score DESC, last_seen_at ASC LIMIT @limit`. 각 행은 `findByDeviceId`와 같은 모양으로 반환(`coopBests`는 생략해도 된다. 현재 사용처는 랭킹 표시뿐).

### I03. PlayRecordStore DB 전환
- Related Files:
  - `server/PlayRecordStore.ts` :: `PlayRecordStore`, `isValidPlayRunStats`, `BeginGameInput`, `SubmitResultInput`, `SubmitResult`; modify (파일 내용 전면 교체, `isValidPlayRunStats`는 유지·확장)
#### Details
- **Signatures & Types**:
  ```typescript
  import { GameDatabase } from './db/GameDatabase';

  export interface BeginGameInput {
    roomId: string;                // 대문자 정규화된 값(RoomSession.roomId)
    mode: PlayMode;
    rulesetVersion: number;
    startedAt: string;             // ISO
    players: { slot: PlayerSlot; playerId: string; inputKind: InputKind | null }[];
  }
  export interface SubmitResultInput {
    gameId: number;
    roomId: string;
    playerId: string;
    submittedAt: string;           // ISO, 서버 시각
    stats: PlayRunStats;           // isValidPlayRunStats 통과한 값만
  }
  export type SubmitFailure =
    | 'GAME_NOT_FOUND' | 'ROOM_MISMATCH' | 'GAME_NOT_PLAYING'
    | 'NOT_IN_GAME' | 'ALREADY_SUBMITTED' | 'MODE_MISMATCH' | 'SLOT_MISMATCH';
  export type SubmitResult = { ok: true; finishedGame: boolean } | { ok: false; reason: SubmitFailure };

  export class PlayRecordStore {
    constructor(db: GameDatabase, rulesetVersion: number = RANKING_RULESET_VERSION);
    beginGame(input: BeginGameInput): number;                                   // 새 games.id
    chooseWeapon(gameId: number, roomId: string, slot: PlayerSlot, weaponKind: WeaponKind): boolean;
    abandonGame(gameId: number, roomId: string, endedAt: string): boolean;
    submitResult(input: SubmitResultInput): SubmitResult;
    getTopRuns(limit?: number): RunRankingEntry[];                              // 시그니처 유지
    getTopTeams(limit?: number): TeamRankingEntry[];                            // 시그니처 유지
  }
  ```
- 제거: `PlayRecordInput`, `append`, `pickStats`, `loadTopRuns`, `addToTop`, `addToTeamTop`, 메모리 캐시 필드, `fs`/`path` import. `compactMember`는 `getTopTeams`의 선택 필드 생략에 계속 쓴다.
- **`isValidPlayRunStats`** 확장: 기존 검사를 모두 유지하고, waves 검사에 `(w.damageTaken === undefined || isCount(w.damageTaken))`를 추가.
- **`beginGame`** (한 트랜잭션, `db.transaction`):
  1. 같은 방의 진행 중인 판 정리(D04-1): `UPDATE games SET status = 'abandoned', ended_at = @startedAt WHERE room_id = @roomId AND status = 'playing'`.
  2. `team_key` = `mode === 'coop' ? players.map(p => p.playerId).sort().join('|') : null` (기존 `TeamRankingEntry.teamKey` 규칙과 같다: JS 기본 정렬 후 `'|'`).
  3. `INSERT INTO games (room_id, mode, player_count, team_key, ruleset_version, status, started_at) VALUES (..., 'playing', ...)` → `lastInsertRowid`를 `Number()`로.
  4. 각 플레이어 `INSERT INTO game_players (game_id, player_id, slot, input_kind) VALUES (...)`.
  5. 반환 gameId. (`players` 행 존재는 호출자(`wsServer`)가 미리 확인한다. 그래도 FK 위반이 나면 예외가 그대로 올라가 트랜잭션이 롤백된다.)
- **`chooseWeapon`**: 
  ```sql
  UPDATE game_players SET weapon_kind = @weaponKind, weapon_level = COALESCE(weapon_level, 1)
  WHERE slot = @slot AND game_id = (SELECT id FROM games WHERE id = @gameId AND room_id = @roomId AND status = 'playing')
  ```
  `changes === 1`이면 true.
- **`abandonGame`**: `UPDATE games SET status = 'abandoned', ended_at = @endedAt WHERE id = @gameId AND room_id = @roomId AND status = 'playing'` → `changes === 1`.
- **`submitResult`** (한 트랜잭션):
  1. `SELECT id, room_id, mode, status FROM games WHERE id = @gameId`. 없으면 `GAME_NOT_FOUND`. `room_id !== roomId`면 `ROOM_MISMATCH`. `status === 'abandoned'`면 `GAME_NOT_PLAYING`.
     - **함정**: `status === 'finished'`는 거절하면 안 된다. 협동은 PC가 두 제출을 연달아 보내고, 첫 제출이 판을 `finished`로 바꾼 뒤 두 번째가 도착한다.
  2. `SELECT id, slot, submitted_at FROM game_players WHERE game_id = @gameId AND player_id = @playerId`. 없으면 `NOT_IN_GAME`, `submitted_at`이 있으면 `ALREADY_SUBMITTED`.
  3. `(stats.mode ?? 'solo') !== games.mode`면 `MODE_MISMATCH`. coop이면 `stats.coop!.slot !== row.slot`일 때 `SLOT_MISMATCH`.
  4. 본인 행 UPDATE:
     ```sql
     UPDATE game_players SET
       submitted_at = @submittedAt, score = @totalScore, base_score = @baseScore, time_bonus = @timeBonus,
       precision_bonus = @precisionBonus, level_bonus = @levelBonus, kills = @kills, accuracy = @accuracy,
       max_combo = @maxCombo, damage_taken = @damageTaken, healed_lives = @healedLives, items_collected = @itemsCollected,
       left_early = @leftEarly, weapon_kind = @weaponKind, weapon_level = @weaponLevel,
       input_kind = COALESCE(input_kind, @inputKind),
       shots_perfect = @PERFECT, shots_great = @GREAT, shots_good = @GOOD, shots_miss = @MISS,
       cards_damage_up = @damage_up, cards_skill_cooldown = @skill_cooldown,
       cards_fever_extend = @fever_extend, cards_hit_zone_up = @hit_zone_up
     WHERE id = @rowId
     ```
     값 매핑: `damageTaken ?? 0`, `healedLives ?? 0`, `itemsCollected ?? 0`(옛 클라이언트 호환, 기존 `pickStats`와 같다), `leftEarly = stats.coop?.leftEarly ? 1 : 0`, `inputKind = stats.inputKind ?? null`. 최종 무기·레벨은 제출 값으로 덮는다(D03).
  5. `stats.cardPicks ?? []`를 인덱스 순서로 `INSERT INTO game_player_card_picks (game_player_id, pick_order, wave_num, card_kind, mid_wave, auto_picked)`; boolean은 `? 1 : 0`.
  6. `games.status === 'playing'`이면(이 제출이 판을 끝냄):
     - `UPDATE games SET status = 'finished', outcome = @outcome, total_score = @total, wave_reached = @waveReached, lives_left = @livesLeft, duration_sec = @durationSec, ended_at = @submittedAt WHERE id = @gameId`. `@total = mode === 'coop' ? stats.coop!.teamScore : stats.totalScore`.
     - `stats.waves`를 `INSERT INTO game_waves (game_id, wave_num, seconds, bonus, damage_taken)`, `damage_taken = w.damageTaken ?? null`.
     - `finishedGame = true`. 이미 `finished`였으면 games·waves는 건드리지 않는다(웨이브 기록은 판 단위라 두 플레이어 값이 같다).
  7. `{ ok: true, finishedGame }`.
- **`getTopRuns(limit = 5)`**:
  ```sql
  SELECT gp.player_id, p.nickname, g.total_score, g.wave_reached, gp.weapon_kind, g.ended_at, gp.input_kind
  FROM games g JOIN game_players gp ON gp.game_id = g.id JOIN players p ON p.id = gp.player_id
  WHERE g.mode = 'solo' AND g.status = 'finished' AND g.ruleset_version = @rv AND gp.submitted_at IS NOT NULL
  ORDER BY g.total_score DESC, g.ended_at ASC LIMIT @limit
  ```
  → `RunRankingEntry { deviceId, nickname, score, waveReached, weaponKind, playedAt: ended_at, ...(input_kind ? { inputKind } : {}) }`. `input_kind`가 NULL이면 키를 넣지 않는다(기존 테스트 `'inputKind' in entry === false`).
- **`getTopTeams(limit = 5)`**:
  ```sql
  WITH ranked AS (
    SELECT g.id, g.team_key, g.total_score, g.wave_reached, g.ended_at,
           ROW_NUMBER() OVER (PARTITION BY g.team_key ORDER BY g.total_score DESC, g.ended_at ASC) AS rn
    FROM games g WHERE g.mode = 'coop' AND g.status = 'finished' AND g.ruleset_version = @rv)
  SELECT id, team_key, total_score, wave_reached, ended_at FROM ranked WHERE rn = 1
  ORDER BY total_score DESC, ended_at ASC LIMIT @limit
  ```
  각 판의 멤버: `SELECT gp.slot, gp.player_id, p.nickname, gp.score, gp.weapon_kind, gp.input_kind FROM game_players gp JOIN players p ON p.id = gp.player_id WHERE gp.game_id = ? ORDER BY gp.slot`. 멤버는 `compactMember({ deviceId, nickname, score: score ?? undefined, weaponKind: weapon_kind ?? undefined, inputKind: input_kind ?? undefined })`. 멤버가 2명이 아니면 그 판은 건너뛴다. 반환 `{ teamKey, members: [slot1, slot2], teamScore, waveReached, playedAt: ended_at }`.
  - 동점 처리: 기존은 "더 큰 점수일 때만 교체"라서 같은 점수면 먼저 세운 판이 남았다. `ORDER BY total_score DESC, ended_at ASC`의 `rn = 1`이 같은 결과다.

### I04. 서버 연결과 핸들러
- Related Files:
  - `server/wsServer.ts` :: `createBeerCrusherServer`, `BeerCrusherServerInstance`, 메시지 switch; modify
#### Details
- **옵션 교체**: `storePath?`, `recordPath?` 제거 → `dbPath?: string`(기본 `DEFAULT_DB_PATH`). 본문:
  ```typescript
  const db = new GameDatabase(options?.dbPath);
  const playerStore = new PlayerStore(db);
  const playRecordStore = new PlayRecordStore(db);
  ```
  `recordPath` 계산 블록과 `path` import(다른 사용처 없으면) 제거.
- `BeerCrusherServerInstance`에 `db: GameDatabase`, `playRecordStore: PlayRecordStore` 추가. `close()`는 `wss.close → server.close` 다음에 `db.close()`.
- 공통 헬퍼(파일 상단 또는 핸들러 근처):
  ```typescript
  /** 방의 PC 소켓이 보낸 메시지인지 확인한다. 아니면 NOT_ROOM_HOST를 보내고 undefined. */
  const requireHost = (ws: WebSocket, roomId: unknown): RoomSession | undefined => { ... };
  ```
  `typeof roomId !== 'string'` 또는 방 없음 또는 `session.pcSocket !== ws` → `sendJson(ws, { type: 'ERROR', code: 'NOT_ROOM_HOST', message: 'Only the room host can do this' })`.
- **`case 'GAME_BEGIN'`**:
  1. `session = requireHost(ws, msg.roomId)`; 없으면 return.
  2. 형식 검사(실패 시 `GAME_BEGIN_REJECTED`): `typeof msg.beginId === 'string' && msg.beginId.length <= 64`, `msg.mode`는 `'solo' | 'coop'`, `Array.isArray(msg.players)`, 길이는 solo 1·coop 2, 각 항목 `slot ∈ {1,2}` 중복 없음, `deviceId`는 1~64자 문자열 중복 없음, `inputKind ∈ {'mobile','mouse'}`, 마우스는 최대 1명.
  3. 신원 대조: `inputKind === 'mobile'`인 항목은 `session.controllers[slot]?.deviceId === deviceId`여야 한다(좌석은 소켓이 끊겨도 `deviceId`를 유지하므로 이탈 중인 폰도 통과한다. `RoomManager.removeSocket` 참고). 아니면 `GAME_BEGIN_REJECTED`. 마우스 대조는 P02-T03.
  4. 등록 확인: 각 `deviceId`에 대해 `playerStore.findByDeviceId(deviceId)`가 `undefined`면 `GAME_BEGIN_REJECTED`(미등록 기기, D09). 모두 있으면 각각 `touchLastSeen`.
  5. `gameId = playRecordStore.beginGame({ roomId: session.roomId, mode, rulesetVersion: RANKING_RULESET_VERSION, startedAt: new Date().toISOString(), players: players.map(p => ({ slot: p.slot, playerId: p.deviceId, inputKind: p.inputKind })) })`.
  6. `sendJson(ws, { type: 'GAME_STARTED', roomId: session.roomId, beginId: msg.beginId, gameId })`.
- **`case 'WEAPON_CHOSEN'`**: `requireHost` → `typeof msg.gameId === 'number'`, 슬롯·무기 값 검사 → `chooseWeapon(...)`. false면 `console.warn`만(응답 없음. 판이 이미 끝났거나 버려진 경우라 PC가 할 일이 없다).
- **`case 'GAME_ABANDON'`**: `requireHost` → `abandonGame(msg.gameId, session.roomId, new Date().toISOString())`. 응답 없음.
- **`case 'GAME_SCORE_SUBMIT'`** (기존 블록 교체):
  1. 기존 필드 검사와 `RULESET_MISMATCH` 검사 유지.
  2. `session = requireHost(ws, roomId)`. **변경점**: 기존에는 아무 소켓의 제출이나 받았다. 실제 제출은 PC(`buildScoreSubmissions`)만 하므로 PC 소켓으로 제한한다.
  3. `typeof msg.gameId !== 'number'` → `ERROR GAME_NOT_FOUND`.
  4. `!isValidPlayRunStats(msg.stats) || msg.stats.totalScore !== score` → `ERROR INVALID_STATS`. (**행동 변경**: 기존에는 통계가 깨져도 `bestScore`/`totalGames`는 반영했다. 이제 점수의 원본이 `game_players`라서 유효한 통계 없이는 기록하지 않는다.)
  5. `result = playRecordStore.submitResult({ gameId, roomId: session.roomId, playerId: deviceId, submittedAt: new Date().toISOString(), stats })`. 실패면 `sendJson(ws, { type: 'ERROR', code: result.reason, message: ... })` 후 return.
  6. `playerStore.touchLastSeen(deviceId)`; `profile = playerStore.findByDeviceId(deviceId)!`.
  7. 이후 `RANKING_UPDATED` 생성·PC와 컨트롤러 브로드캐스트는 기존 코드 그대로(`rankings: getTopRuns(5)`, `teamRankings: getTopTeams(5)`, `updatedPlayer: profile`). 기존 `isCoop` 분기, `recordGameScore`, `recordCoopResult`, `append` 호출은 모두 제거.
- 기존 `DEVICE_CHECK`, `REGISTER_NICKNAME`, `REGISTER_LOCAL_PLAYER`의 `playerStore` 호출은 시그니처가 같으므로 그대로 둔다.
- close 핸들러는 건드리지 않는다(D04 수정본: 소켓 끊김 때 판을 정리하지 않는다).

### I05. 테스트 이관
- Related Files:
  - `tests/helpers/wsHarness.ts` :: `startHarness`; modify
  - `tests/server-session.test.ts`; modify
  - `tests/play-records.test.ts`; modify (전면 재작성)
  - `tests/coop-records.test.ts`; modify
  - `tests/team-rankings.test.ts`; modify
  - `tests/server-local-player.test.ts`, `tests/server-coop-slots.test.ts`, `tests/room-persistence.test.ts`, `tests/pc-reconnect.test.ts`; modify
  - `tests/game-lifecycle-server.test.ts`; new
#### Details
- **서버를 띄우는 모든 테스트**: `storePath`/`recordPath` 옵션을 `dbPath: ':memory:'`로 바꾸고, `players.json`/`play-records.jsonl` 파일 정리 코드를 지운다.
  - 함정: `server-local-player.test.ts`와 `server-coop-slots.test.ts`의 `afterEach`는 지금 `path.join(path.dirname(testStorePath), 'play-records.jsonl')`, 즉 **실제 `data/play-records.jsonl`을 지운다**. 이 정리 코드를 반드시 제거한다(옮기지 말 것).
  - `pc-reconnect.test.ts`는 같은 포트로 서버를 재시작한다. 방은 메모리에 있으므로 `dbPath: ':memory:'`여도 테스트 의도(같은 방 코드 복구)는 유지된다.
  - `wsHarness.startHarness`: `createBeerCrusherServer({ port: 0, dbPath: ':memory:', ...options })`, `cleanup`의 `unlinkSync` 제거. `phone()`의 `server.playerStore.registerOrUpdateNickname`은 그대로 동작한다.
- **판 흐름 헬퍼**(테스트 파일 공용으로 `tests/helpers/wsHarness.ts`에 추가):
  ```typescript
  /** PC 소켓으로 GAME_BEGIN을 보내고 gameId를 받는다. */
  export async function beginGame(pc: Inbox, roomId: string, mode: PlayMode, players: GameBeginPlayer[]): Promise<number>;
  ```
  `beginId`는 `` `t-${Date.now()}-${Math.random()}` ``, 응답은 `pc.waitFor(() => pc.of('GAME_STARTED', m => m.beginId === beginId).length > 0)`.
- **`tests/play-records.test.ts`** (스토어 단위, `new GameDatabase(':memory:')` + `PlayerStore.registerOrUpdateNickname`으로 FK 준비):
  1. `beginGame`이 `games`(`playing`, `team_key` NULL)와 `game_players`(상세 NULL)를 만든다.
  2. 솔로 `submitResult` → `games`가 `finished`, `total_score = stats.totalScore`, `game_waves` 행 수 = `stats.waves.length`, `damage_taken`은 값이 있으면 그 값·없으면 NULL. 카드 선택이 `pick_order` 0..n-1로 저장된다.
  3. 같은 플레이어 재제출 → `ALREADY_SUBMITTED`. 다른 방 → `ROOM_MISMATCH`. 없는 판 → `GAME_NOT_FOUND`. 참가하지 않은 플레이어 → `NOT_IN_GAME`.
  4. 같은 방 `beginGame` 두 번 → 첫 판이 `abandoned`이고 `ended_at`이 채워진다. 버려진 판 제출 → `GAME_NOT_PLAYING`.
  5. `chooseWeapon`: playing일 때 true, `abandonGame` 후 false.
  6. `getTopRuns`: 점수 내림차순, 동점이면 먼저 끝난 판. 다른 `ruleset_version`의 판, `abandoned`, `playing` 판은 제외. `inputKind`가 없으면 키가 없다.
  7. `isValidPlayRunStats`: 기존 검증 케이스 유지 + `waves[0].damageTaken = -1`이면 false, `damageTaken` 없음은 true.
  - 삭제: "JSONL 한 줄", "unknown keys 미저장", "쓰기 실패 false", "재시작 복원" 등 파일 동작 테스트(DB는 컬럼이 고정이라 알 수 없는 키가 들어갈 자리가 없다).
- **`tests/coop-records.test.ts`**, **`tests/team-rankings.test.ts`**:
  - 스토어 부분: 협동 판 `beginGame`(2명) → slot1 제출(`finishedGame: true`) → slot2 제출(`finishedGame: false`, `ok: true`). `getTopTeams`: 같은 `team_key`의 더 높은 판 하나만, 동점이면 먼저 끝난 판, 멤버는 slot 순서, 미제출 멤버는 `score`/`weaponKind` 키 없음.
  - `PlayerStore` 부분(기존 `recordCoopResult` 테스트 대체): 위 판 뒤 `findByDeviceId(a).coopBests[b]`가 `{ teamScore, myScore, partnerScore, waveReached, playedAt: ended_at }`. 협동 점수는 `bestScore`에 반영되지 않고 `totalGames`는 1 증가한다(D07).
  - 서버 부분: PC 소켓에서 `beginGame` 헬퍼 → `GAME_SCORE_SUBMIT`(gameId 포함)을 **PC 소켓으로** 2번 → `RANKING_UPDATED.teamRankings` 확인. 기존에 폰 소켓으로 제출하던 케이스는 PC 소켓으로 바꾼다.
- **`tests/server-session.test.ts`**:
  - `PlayerStore` 단위: 닉네임 등록·검증(2~10자, 기존 에러 문구), 재등록 시 닉네임만 바뀜, `findByDeviceId` 없음 → undefined.
  - 프로필 산출: 솔로 finished 판 2개(점수 100, 300) → `bestScore 300`, `totalGames 2`. 이전 `ruleset_version` 판은 세지 않는다(기존 "규칙 버전이 바뀌면 점수 초기화" 테스트의 대체). `abandoned` 판은 세지 않는다.
  - `getTopRankings`: `bestScore 0`인 플레이어 제외, 동점이면 `last_seen_at` 이른 순.
  - 삭제: `players.json` 백업·`ruleset-N.bak`·깨진 파일 복구·원자적 저장 테스트(파일 저장소가 없어짐).
  - 서버 제출 케이스(기존 `GAME_SCORE_SUBMIT` 3곳): PC 소켓으로 `beginGame` 후 `gameId`를 붙여 제출. 폰 소켓(`mobileWs`)으로 보내던 케이스는 `NOT_ROOM_HOST` 응답을 확인하는 테스트로 바꾸고, 같은 내용의 PC 제출 케이스를 둔다.
- **`tests/game-lifecycle-server.test.ts`** (new, `startHarness` 사용):
  1. 폰 소켓이 `GAME_BEGIN` → `NOT_ROOM_HOST`.
  2. 폰 슬롯 `deviceId`가 좌석과 다름 → `GAME_BEGIN_REJECTED`. `players`에 없는 `deviceId`(좌석에는 앉혔지만 `registerOrUpdateNickname`을 안 한 경우) → `GAME_BEGIN_REJECTED`이고 `players`·`games` 행이 생기지 않는다. 형식 오류(coop인데 1명, 슬롯 중복, 마우스 2명) → `GAME_BEGIN_REJECTED`.
  3. 정상 `GAME_BEGIN` → `GAME_STARTED { beginId 동일, gameId 숫자 }`. 같은 방에서 한 번 더 → 첫 판이 `abandoned`(`server.db.conn`으로 조회).
  4. `WEAPON_CHOSEN` → `game_players.weapon_kind` 갱신.
  5. `GAME_ABANDON` → `abandoned`; 그 판으로 제출 → `ERROR GAME_NOT_PLAYING`.
  6. `gameId` 없는 제출 → `ERROR GAME_NOT_FOUND`. 깨진 stats → `ERROR INVALID_STATS`.
  7. PC 소켓을 닫았다가 같은 방 코드로 `CREATE_ROOM` 재접속 → 이전 `gameId`로 제출이 성공한다(D04 수정본 회귀 방지: 끊김으로 판이 정리되지 않는다).

### I06. 문서 동기화
- Related Files:
  - `README.md` — 151행 "끝난 모든 판은 서버의 `data/play-records.jsonl`에…" 문단; modify
  - `docs/비어 크러셔 상세설계서.md` — 67행(`players.json` 트리), 122행(서버 플레이어 레코드 절), 578~579행(`PlayRecordStore` 설명); modify
#### Details
- README 문단을 다음 요지로 교체: 판은 서버의 SQLite DB `data/game.db`에 저장된다(`games`: 판 결과, `game_players`: 플레이어별 상세, `game_waves`: 웨이브별 시간·보너스·피격 수, `game_player_card_picks`: 카드 선택). 판 시작 때 기록이 생기고 끝날 때 채워지며, 중간에 나간 판은 `abandoned`로 남는다. 랭킹과 개인 기록은 현재 규칙 버전의 끝난 판으로 계산하므로 규칙 버전이 바뀌어도 기록은 지워지지 않는다. 기기 ID와 닉네임이 들어 있으니 외부 공유 시 주의. 예전 `players.json`/`play-records.jsonl`은 더 이상 쓰지 않는다(옮기지 않음).
- 상세설계서: 같은 사실로 해당 행을 갱신하고, 122행 절은 5개 테이블 요약표로 바꾼다. 스키마 원문은 결정 문서 링크로 대신한다.
- `tests/docs-sync.test.ts`의 금지 문구와 겹치지 않는지 확인(`npx vitest run tests/docs-sync.test.ts`).

## Acceptance Criteria
- [ ] `server/`와 `tests/`에 `players.json`, `play-records.jsonl`, `recordGameScore`, `recordCoopResult`, `append(`(PlayRecordStore), `storePath`, `recordPath` 참조가 남지 않는다(`grep -rn` 0건, `.memory/`·`docs/` 과거 문서 제외).
- [ ] 판 시작 → 무기 → 제출(솔로/협동) → 랭킹·프로필이 웹소켓 테스트로 통과한다.
- [ ] PC 재접속 뒤 이전 `gameId` 제출이 성공한다.
- [ ] 테스트가 실제 `data/` 폴더에 파일을 만들거나 지우지 않는다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/play-records.test.ts tests/coop-records.test.ts tests/team-rankings.test.ts tests/server-session.test.ts tests/game-lifecycle-server.test.ts tests/server-local-player.test.ts tests/server-coop-slots.test.ts tests/room-persistence.test.ts tests/pc-reconnect.test.ts tests/docs-sync.test.ts` — 전부 통과
- `npm test` — 전부 통과
- `git status --short data/` — 변화 없음(테스트가 실제 data를 건드리지 않음. `data/`는 .gitignore 대상이라 `ls -la data/`로 테스트 전후 파일 목록이 같은지 확인)

## Commit Message
```text
feat(server): 플레이어·판 기록을 SQLite로 전환하고 판 생명주기 프로토콜 추가

Plan: 2026-11-08-sqlite-db-design
Phase: P01-server-db-storage
Task: T02-stores-and-game-lifecycle-server

- types: GAME_BEGIN·WEAPON_CHOSEN·GAME_ABANDON·GAME_STARTED(gameId), 제출에 gameId, waves[].damageTaken
- PlayerStore: DB 기반, bestScore·totalGames·coopBests를 쿼리로 산출, touchLastSeen, 자동 생성 닉네임 제거
- PlayRecordStore: beginGame·chooseWeapon·abandonGame·submitResult, 랭킹을 DB 쿼리로
- wsServer: dbPath 옵션, 판 생명주기 핸들러, 제출을 PC 소켓·gameId 기준으로 검증
- 테스트를 메모리 DB로 이관하고 실제 data 파일을 지우던 정리 코드 제거
- README·상세설계서의 저장소 설명 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `d48d21e`, 리뷰 반영 `b205943` (통계 검증을 DB 제약과 맞춤, 문서 주석 위치)
