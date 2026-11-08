# Current Context

## Active Plan
[SQLite DB 전환 (게임-플레이어 중심 스키마)](./plans/2026-11-08-sqlite-db-design.md)

## Active Phase
[P02 클라이언트 연동](./phases/2026-11-08-sqlite-db-design/P02-client-integration/phase.md)

## Active Task
[T01 엔진 웨이브별 피격 집계와 무기 선택 훅](./phases/2026-11-08-sqlite-db-design/P02-client-integration/T01-engine-wave-damage-and-weapon-hook.md)

## Status
- 진행 방식: 코디네이터(Opus)가 Phase마다 Orca Sonnet 워커에게 구현을 맡기고, Phase가 끝나면 코드 리뷰 후 다음 Phase로 넘긴다. `.memory` 상태는 코디네이터만 갱신한다.
- P01 완료: T01 `c111b53`, T02 `d48d21e`, 리뷰 반영 `b205943`. tsc 0 오류, vitest 839 통과 + 기존 실패 1건(docs-sync 'monster studio info cards', 커밋 d8e8904의 html 삭제 때문, 범위 밖).
- 주의: 지금은 실제 게임 점수가 기록되지 않는다(PC가 아직 `GAME_BEGIN`을 안 보냄). P02-T02에서 연결된다.
- 결정 문서: [2026-11-08-sqlite-db-design](./decisions/2026-11-08-sqlite-db-design.md)

## Next Step (IMPORTANT)
P02 워커가 T01(`src/pc/engine/BeerCrusherEngine.ts`의 웨이브별 피격 집계·`onWeaponChosen`)부터 T03까지 순서대로 구현
