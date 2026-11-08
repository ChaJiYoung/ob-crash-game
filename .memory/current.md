# Current Context

## Active Plan
[SQLite DB 전환 (게임-플레이어 중심 스키마)](./plans/2026-11-08-sqlite-db-design.md)

## Active Phase
[P01 서버 DB 저장소 전환](./phases/2026-11-08-sqlite-db-design/P01-server-db-storage/phase.md)

## Active Task
[T01 GameDatabase와 스키마](./phases/2026-11-08-sqlite-db-design/P01-server-db-storage/T01-game-database-and-schema.md)

## Status
- T01 구현 시작 준비 완료
- 결정 문서: [2026-11-08-sqlite-db-design](./decisions/2026-11-08-sqlite-db-design.md) (D04는 계획 단계에서 "명시적 신호로만 abandoned"로 수정됨)
- 주의: P01 완료 ~ P02-T02 완료 사이에는 실제 게임 점수가 기록되지 않는다(PC가 아직 `GAME_BEGIN`을 안 보냄). 의도된 중간 상태다.
- 이전 계획 [미지원 폰 차단](./plans/2026-11-08-unsupported-phone-block.md)은 구현 완료, 실기기 확인(P04-T01 체크리스트 A·B·C·I·K·P)만 남아 있다.

## Next Step (IMPORTANT)
T01 청사진을 읽고 `npm install better-sqlite3@^12`로 의존성을 설치한 뒤 `server/db/schema.ts`부터 구현 시작
