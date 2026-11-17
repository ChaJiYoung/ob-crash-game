# Task: T02 EX Danger Waves and Debug Records WS

## Status: pending

## Goal
EX DANGER별 피격 수를 `game_waves`에 저장하고(일반 판 포함), PC 로비가 최근 디버그 판 10개를 WS로 받아 볼 수 있게 한다.

## Decision Summary
- D07: [최근 기록] 탭과 결과 화면에서 DANGER별 피격을 본다. 저장은 새 테이블 없이 `game_waves`에 `wave_num = 7 + danger`로 넣는다(EX D03의 `wave_reached = 7+n` 규칙과 같은 번호 체계).
- 기존 `submitResult`는 `isExUpdate`일 때 `game_waves`를 다시 넣지 않으므로, EX 행은 **upsert**로 첫 제출·EX 갱신 모두에서 쓴다.

## Implementation

### I01. `PlayRunStats.exDangers`와 저장

- Related Files:
  - `src/shared/types.ts` :: `PlayRunStats`(155행); modify
  - `server/PlayRecordStore.ts` :: `isValidPlayRunStats`, `submitResult`; modify

#### Details
- `PlayRunStats`에 추가:
  ```typescript
  /** EX DANGER별 피격 수. EX에 들어간 판에만 있다. */
  exDangers?: { danger: number; damageTaken: number }[];
  ```
- 검증(`isValidPlayRunStats`, waves 검증 뒤): `exDangers === undefined` 또는 길이 ≤ 50인 배열, 각 원소 `isCount(danger) && danger >= 1 && isCount(damageTaken)`, danger 중복 없음.
- `submitResult`: `games` UPDATE 블록(`if (game.status === 'playing' || isExUpdate)`) 안, `if (!isExUpdate)` 블록 **밖**에서 실행:
  ```sql
  INSERT INTO game_waves (game_id, wave_num, seconds, bonus, damage_taken)
  VALUES (@gameId, @wave, 0, 0, @damageTaken)
  ON CONFLICT(game_id, wave_num) DO UPDATE SET damage_taken = excluded.damage_taken
  ```
  `wave = STAGE_CONSTANTS.TOTAL_WAVES + danger`(= 7 + danger; `src/shared/constants.ts`의 상수 import).
- **함정**: 본편 `waves` INSERT는 그대로 `!isExUpdate`에서만 한다. EX 체크포인트(첫 제출)에 `waves`가 7개 들어가므로 같은 번호 충돌은 없다(EX는 8 이상).

### I02. 최근 디버그 기록 조회

- Related Files:
  - `src/shared/types.ts` :: `DebugRunEntry`(new), `ClientToServerMessage`, `ServerToClientMessage`; modify
  - `server/PlayRecordStore.ts` :: `getRecentDebugRuns`(new); modify
  - `server/wsServer.ts` :: `case 'DEBUG_RECORDS_REQUEST'`(new); modify

#### Details
- 타입:
  ```typescript
  export interface DebugRunEntry {
    gameId: number;
    mode: PlayMode;
    endedAt: string;
    outcome: RunOutcome;
    totalScore: number;
    waveReached: number;        // 8 이상이면 EX DANGER (waveReached - 7)
    damageTaken: number;        // game_players.damage_taken의 MAX(협동은 공유 목숨이라 같은 값)
    config: DebugStartConfig | null; // debug_config JSON 파싱 실패 시 null
    waves: { wave: number; damageTaken: number | null }[]; // wave_num 오름차순
    members: { slot: PlayerSlot; nickname: string; weaponKind: WeaponKind | null; score: number | null }[];
  }
  ```
  - C→S: `| { type: 'DEBUG_RECORDS_REQUEST'; roomId: string }`
  - S→C: `| { type: 'DEBUG_RECORDS'; roomId: string; runs: DebugRunEntry[] }`
- `getRecentDebugRuns(limit = 10): DebugRunEntry[]`:
  - `SELECT id, mode, ended_at, outcome, total_score, wave_reached, debug_config FROM games WHERE is_debug = 1 AND status = 'finished' ORDER BY ended_at DESC, id DESC LIMIT @limit` — `ruleset_version` 조건 없음(버전이 바뀌어도 비교용으로 본다).
  - 판마다 members(`game_players` JOIN `players`, slot 순), `MAX(damage_taken)`, `game_waves`(wave_num, damage_taken) 조회.
  - `JSON.parse`는 try/catch, 실패 시 `config: null`.
- wsServer: `requireHost(ws, msg.roomId)` 통과 시 `sendJson(ws, { type: 'DEBUG_RECORDS', roomId: session.roomId, runs: playRecordStore.getRecentDebugRuns(10) })`. 디버그 여부와 무관하게 호스트면 응답(읽기 전용, 닉네임·점수만 노출 — 기존 랭킹 공개 범위와 같음).

### I03. 테스트

- Related Files:
  - `tests/debug-records.test.ts` — 케이스 추가; modify
  - `tests/play-run-stats.test.ts` 또는 `tests/play-records.test.ts` — exDangers 검증; modify

#### Details
- EX 판: 체크포인트 제출(`waveReached: 8`, `exDangers: [{danger:1, damageTaken:2}]`) → `game_waves`에 wave 8 damage 2. 이어서 `isExUpdate` 제출(`waveReached: 10`, `exDangers: [{1,2},{2,1},{3,4}]`) → wave 8·9·10이 각각 2·1·4, wave 1~7 행은 그대로.
- `exDangers` 형식 오류(중복 danger, danger 0, 51개) → `isValidPlayRunStats` false.
- `getRecentDebugRuns`: 디버그 판 12개 + 일반 판 1개 → 10개, 최신 순, 일반 판 없음, config 파싱, members·waves 포함. 깨진 debug_config → `config: null`.

## Acceptance Criteria
- [ ] EX 체크포인트와 EX 최종 갱신 모두에서 DANGER별 피격이 `game_waves`(8 이상)에 반영된다.
- [ ] 호스트가 `DEBUG_RECORDS_REQUEST`를 보내면 최근 디버그 판 10개가 `DEBUG_RECORDS`로 온다.

## Validation
- `npx vitest run tests/debug-records.test.ts tests/play-records.test.ts tests/play-run-stats.test.ts tests/shared-protocol.test.ts` — 모두 통과
- `npx tsc --noEmit` — 에러 0

## Commit Message
```text
feat(server): persist EX danger damage and serve recent debug runs

Plan: 2026-11-17-debug-mode
Phase: P01-server-db-debug-flag
Task: T02-ex-danger-waves-and-debug-records-ws

- I01: add PlayRunStats.exDangers and upsert them into game_waves as wave 7+n
- I02: add getRecentDebugRuns and DEBUG_RECORDS_REQUEST/DEBUG_RECORDS messages
- I03: test EX danger upsert, validation and recent debug run query
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
