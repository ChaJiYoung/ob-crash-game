# Task: T01 전체 검증과 DB 기록 확인

## Status: done

## Goal
코드 변경 없이 계획 전체를 검증한다. 타입 검사·전체 테스트·운영 빌드를 통과시키고, 실제 서버 코드에 웹소켓으로 솔로·협동·중도 종료 판을 흘려 DB에 기대한 행이 남는지 확인한다. 브라우저로만 확인 가능한 항목은 체크리스트로 남긴다. 결과는 이 파일의 "검증 결과" 절에 기록하고 커밋한다.

## Decision Summary
- 실제 `data/game.db`를 테스트 데이터로 더럽히지 않는다. 스모크는 임시 DB 경로로 서버를 띄워 확인하고, `npm run server`는 "파일과 테이블이 생기는지"만 본다.
- 이 Task에서 버그를 발견하면 고치지 말고 결과에 기록한 뒤 멈춘다(사용자가 수정 범위를 정한다).

## Implementation

### I01. 자동 검증
- Related Files: 없음(실행만)
#### Details
1. `npx tsc --noEmit`
2. `npm test`
3. `npm run build`
4. 잔여 참조 점검: `grep -rn "play-records.jsonl\|players.json\|recordGameScore\|recordCoopResult\|beer_crusher_mouse_nickname\|storePath\|recordPath" src server tests` → 0건이어야 한다.

### I02. 실서버 코드 스모크
- Related Files:
  - 임시 스크립트(저장소 밖, 예: `$TMPDIR/db-smoke.ts`); 커밋하지 않음
#### Details
- `npx tsx <스크립트>`로 실행. 스크립트는 `createBeerCrusherServer({ port: 0, dbPath: <임시 폴더>/game.db })`로 서버를 띄우고 `ws` 클라이언트로 다음을 수행한 뒤, `better-sqlite3`로 같은 파일을 열어 조회한다. (메시지 순서와 필드는 P01-T02, P02-T03 청사진을 따른다. 테스트 헬퍼 `tests/helpers/wsHarness.ts`의 `open`, `Inbox`, `beginGame`을 import해도 된다.)
  1. PC `CREATE_ROOM` → 마우스 `REGISTER_LOCAL_PLAYER`(slot 1) → `GAME_BEGIN`(solo) → `WEAPON_CHOSEN` → `GAME_SCORE_SUBMIT`(웨이브 2개, 그중 하나에 `damageTaken: 1`, 카드 선택 3개).
  2. 폰 `DEVICE_CHECK`/`REGISTER_NICKNAME`(slot 2) + 마우스(slot 1) → `GAME_BEGIN`(coop) → 제출 2번(slot 1, slot 2).
  3. `GAME_BEGIN`(solo) → `GAME_ABANDON`.
  4. `GAME_BEGIN`(solo) → PC 소켓 닫기 → 같은 방 코드로 재접속 `CREATE_ROOM` → 마우스 `LOOKUP_LOCAL_PLAYER` → 이전 `gameId`로 제출 성공.
- 기대 조회 결과:
  - `SELECT status, COUNT(*) FROM games GROUP BY status` → `finished` 3, `abandoned` 1.
  - 솔로 판의 `game_waves` 2행, `damage_taken`이 `1`과 `NULL`(또는 `0`, 보낸 값 그대로).
  - 협동 판 `team_key`가 정렬된 두 ID, `game_players` 2행 모두 `submitted_at` 있음, `total_score` = `teamScore`.
  - `game_player_card_picks`의 `pick_order`가 0,1,2.
  - `RANKING_UPDATED.rankings`에 솔로 판들, `teamRankings`에 협동 판 1개.
- 끝나면 임시 폴더를 지운다.

### I03. `npm run server` 기동 확인
#### Details
- `npm run server`를 백그라운드로 띄우고 `curl -s http://localhost:8787/health`가 `ok`를 반환하면, `node -e "const D=require('better-sqlite3');const d=new D('data/game.db',{readonly:true});console.log(d.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all())"`로 5개 테이블(+`sqlite_sequence`)을 확인하고 서버를 끈다.
- 기존 `data/players.json`, `data/play-records.jsonl`이 그대로 남아 있는지(지워지거나 바뀌지 않았는지) `ls -la data/`로 확인한다.

### I04. 브라우저 체크리스트 (사용자 확인용으로 기록)
#### Details
결과 절에 아래 항목을 표로 남기고, 자동으로 확인한 것은 "자동", 못 한 것은 "미확인"으로 표기한다.
- A. 마우스 슬롯 선택 → 처음 브라우저는 입력 폼, 등록 후 로비로 나갔다 다시 마우스 선택 시 폼 없이 "준비 완료".
- B. "닉네임 변경" 버튼 → 현재 닉네임이 채워진 폼 → 변경 후 랭킹에 새 닉네임 표시(과거 판 포함, D08).
- C. 솔로 한 판 끝까지 → 결과 화면 랭킹 갱신, 개인 신기록 표시.
- D. 협동 한 판 → 결과 화면 팀 기록·팀 신기록 표시(`coopBests.playedAt` 비교).
- E. 일시정지 → "로비로" → DB에 그 판이 `abandoned`.
- F. 판 도중 `npm run server` 재시작(tsx watch) → PC 재접속 후 판을 끝내면 정상 기록.
- G. 등록된 폰으로 다시 접속 → 환영 화면 "닉네임 변경" → 새 닉네임 저장 → 폰 화면과 PC 로비 슬롯이 모두 새 닉네임. "취소"를 누르면 환영 화면으로 돌아감.

## Acceptance Criteria
- [ ] tsc·test·build 통과, 잔여 참조 0건.
- [ ] I02 스모크의 기대 조회 결과가 모두 일치.
- [ ] `npm run server`가 `data/game.db`를 만들고 기존 JSON 파일은 그대로.
- [ ] 결과 절에 체크리스트 상태가 기록됨.

## Validation
- `npx tsc --noEmit && npm test && npm run build` — 모두 성공

## 검증 결과
실행: 2026-11-08, Orca Sonnet 워커(검증만) + 코디네이터 재확인.

### I01 자동 검증
- `npx tsc --noEmit`: 오류 0건
- `npm test`: 107 파일 / 868 테스트 전부 통과, 실패 0건 (코디네이터 재확인, HEAD 이후 `docs-sync` 'monster studio info cards' 케이스는 사용자 요청으로 `5c02ffa`에서 제거)
- `npm run build`: 성공 (청크 500kB 경고만)
- 잔여 참조 grep: 처음 1건(`src/shared/gameTuning.ts:7` 낡은 주석의 `players.json`) → 코디네이터가 주석 갱신 커밋 후 0건

### I02 실서버 코드 스모크 (임시 DB, 끝난 뒤 삭제)
| 시나리오 | 결과 |
|---|---|
| 1. 솔로: 마우스 등록 → GAME_BEGIN → WEAPON_CHOSEN → 제출(웨이브 2, 카드 3) | 통과 (gameId 1) |
| 2. 협동: 폰 slot2 + 마우스 slot1, 제출 2번 | 통과 (gameId 2, 두 번째 응답에 teamRankings 1) |
| 3. 솔로 → GAME_ABANDON | 통과 (gameId 3) |
| 4. 솔로 → PC 소켓 종료 → 같은 방 코드 재접속 → LOOKUP_LOCAL_PLAYER → 이전 gameId 제출 | 통과 (gameId 4) |

기대 조회 결과 모두 일치:
- `games` 상태: finished 3, abandoned 1
- 솔로 판 `game_waves` 2행, `damage_taken` = 1, NULL
- 협동 판 `team_key` 정렬된 두 ID, `game_players` 2행 모두 제출됨(800/700), `total_score` 1500 = teamScore
- `game_player_card_picks.pick_order` 0, 1, 2
- `rankings`에 솔로 판, `teamRankings`에 협동 판 1개
- 참고: 스모크가 WEAPON_CHOSEN(revolver) 뒤 제출 통계에 shotgun을 넣자 최종 무기가 shotgun으로 기록됨. D03(최종 무기·레벨은 제출 값으로 덮음)대로의 동작이며 정상 게임에서는 두 값이 같다.

### I03 서버 기동
- 사용자가 띄운 `npm run server`(tsx watch, 8787)가 이미 실행 중이어서 그 서버로 확인(새로 띄우거나 끄지 않음)
- `/health`: `{"status":"ok"}`
- `data/game.db` 테이블: players, games, game_players, game_waves, game_player_card_picks (+sqlite_sequence)
- `data/players.json` 수정 시각 그대로(옛 파일 읽기·쓰기 없음). `play-records.jsonl`은 P01 중 기존 테스트 버그로 이미 삭제됨(복구 안 함, 새로 시작)

### I04 브라우저 체크리스트
서버 쪽 응답은 I02로 자동 확인됐고, 화면 동작은 모두 실기기·브라우저 확인이 필요하다.
| 항목 | 상태 | 근거 |
|---|---|---|
| A. 마우스 슬롯 재선택 시 폼 없이 준비 완료 | 미확인 | 서버 LOOKUP→LOCAL_PLAYER_REGISTERED는 I02-4에서 확인 |
| B. 마우스 닉네임 변경, 랭킹에 새 닉네임 | 미확인 | 브라우저 필요 |
| C. 솔로 결과 화면 랭킹·개인 신기록 | 미확인 | 서버 RANKING_UPDATED·bestScore는 I02-1에서 확인 |
| D. 협동 결과 화면 팀 기록·팀 신기록 | 미확인 | 서버 teamRankings·coopBests(playedAt)는 I02-2에서 확인 |
| E. 일시정지 "로비로" → abandoned | 미확인 | 서버 GAME_ABANDON 처리는 I02-3에서 확인 |
| F. 판 도중 서버 재시작 후 정상 기록 | 미확인 | PC 재접속 후 이전 gameId 제출은 I02-4에서 확인(서버 프로세스 재시작 자체는 아님) |
| G. 폰 닉네임 변경·취소, PC 로비 반영 | 미확인 | 실제 폰 필요 |

## Commit Message
```text
test(verify): SQLite 전환 전체 검증과 DB 기록 스모크 결과 기록

Plan: 2026-11-08-sqlite-db-design
Phase: P03-verify
Task: T01-verify-db-recording

- tsc·vitest·build 결과와 잔여 참조 점검
- 임시 DB로 솔로·협동·중도 종료·재접속 판 기록 스모크 결과
- 브라우저 확인 체크리스트(A~F) 상태
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 주석 갱신 `cf4be4e`, 결과 기록은 docs(memory) 커밋
