# Plan: SQLite DB 전환 (게임-플레이어 중심 스키마)

## Goal
`data/players.json`과 `data/play-records.jsonl` 파일 저장소를 SQLite(`data/game.db`, `better-sqlite3`) 5개 테이블(`players`, `games`, `game_players`, `game_waves`, `game_player_card_picks`)로 바꾼다. 판은 시작 때(`GAME_BEGIN`) 만들어지고 종료 제출 때 채워진다. 랭킹과 프로필은 원본 테이블에서 쿼리로 산출한다.

측정 가능한 결과:
- 서버를 켜면 `data/game.db`가 생기고 5개 테이블이 있다. JSON/JSONL 파일은 더 이상 읽거나 쓰지 않는다.
- 솔로와 협동 한 판을 끝내면 `games` 1행(`finished`), 참가자 수만큼 `game_players`, 웨이브별 `game_waves`(피격 수 포함), 카드 선택 로그가 남는다.
- 일시정지 메뉴의 "로비로"/"다시시작"은 그 판을 `abandoned`로 남기고, 랭킹에는 `finished`만 보인다.
- 마우스 플레이어는 등록된 PC 브라우저라면 닉네임을 다시 입력하지 않는다.

결정 문서: [2026-11-08-sqlite-db-design](../decisions/2026-11-08-sqlite-db-design.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 서버: DB 코어와 스키마, 두 스토어의 DB 전환, 판 생명주기 프로토콜(`GAME_BEGIN`/`WEAPON_CHOSEN`/`GAME_ABANDON`/`gameId` 제출) | [P01](../phases/2026-11-08-sqlite-db-design/P01-server-db-storage/phase.md) |
| P02 | `in_progress` | 클라이언트: 엔진 웨이브별 피격·무기 선택 훅, PC 판 생명주기 연동, 마우스 닉네임 고정(D12) | [P02](../phases/2026-11-08-sqlite-db-design/P02-client-integration/phase.md) |
| P03 | `pending` | 전체 검증(tsc·vitest·build)과 실제 서버로 DB 기록 확인 | [P03](../phases/2026-11-08-sqlite-db-design/P03-verify/phase.md) |
