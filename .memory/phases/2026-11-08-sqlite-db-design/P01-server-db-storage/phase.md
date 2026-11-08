# Phase: P01 서버 DB 저장소 전환

## Goal
서버만으로 완결되는 저장소 전환. 이 Phase가 끝나면 서버 테스트(웹소켓 하네스 포함)로 판 시작 → 무기 → 제출 → 랭킹 흐름을 DB 위에서 검증할 수 있다. PC 클라이언트는 P02 전까지 `GAME_BEGIN`을 보내지 않으므로, **P01 완료 시점에 실제 게임의 점수는 기록되지 않는다**(제출이 `GAME_NOT_FOUND`로 거절됨). P02-T02에서 다시 연결된다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | `better-sqlite3` 설치, `GameDatabase`(PRAGMA·스키마·트랜잭션), 스키마 제약 테스트 | [T01](./T01-game-database-and-schema.md) |
| T02 | `done` | `PlayerStore`·`PlayRecordStore` DB 전환, 판 생명주기 프로토콜과 서버 핸들러, 테스트·문서 이관 | [T02](./T02-stores-and-game-lifecycle-server.md) |

## Progress
- done: 2/2 (Phase 완료, 코디네이터 리뷰 통과)
- 참고: `npm test`의 `docs-sync` 'monster studio info cards' 1건은 커밋 d8e8904(html 삭제)로 생긴 기존 실패. 이 계획 범위 밖.
- 참고: 기존 테스트 정리 코드 버그로 T01 실행 중 `data/play-records.jsonl`이 삭제됨(T02에서 해당 코드 제거, 복구 불가, 마이그레이션 안 하므로 영향 작음).
