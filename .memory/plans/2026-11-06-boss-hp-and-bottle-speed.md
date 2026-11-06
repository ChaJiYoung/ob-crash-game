# Plan: 보스 체력 상향 · 병 조각 속도 · 보스전 일반 몬스터 병행

## Goal
플레이 피드백("빨리 끝나고 체력이 닳지 않아도 깰 수 있다")에 대응한다.
- 보스 체력을 100 / 120×2 / 150×2 + 대왕 250으로 올린다.
- 분해된 작은 카스 병의 속도를 2.2 → 3.0으로 올린다.
- 보스가 일반 몬스터와 함께 싸우도록 바꿔, 보스 체력이 늘어도 보스 단독 구간이 생기지 않게 한다.
- 측정 가능한 결과: `npm test`, `npx tsc --noEmit`, `npm run build` 통과. 보스 웨이브 `parTimeSec` 재측정. `RANKING_RULESET_VERSION`은 5 유지.

근거 문서: [결정 문서](../decisions/2026-11-06-boss-hp-and-bottle-speed.md)

## 범위 메모
- 이전 계획(`2026-11-06-boss-drop-and-passive-cards`)은 구현·검증이 끝났고 사람 플레이만 남았다. 이 계획은 그 계획과 파일이 겹치지 않는다.
- 랭킹 규칙 버전 상향은 이번 계획에 넣지 않는다. 플레이해 본 뒤 결정한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 보스 체력·작은 병 속도 수치 변경과 테스트 | [P01](../phases/2026-11-06-boss-hp-and-bottle-speed/P01-tuning-values/phase.md) |
| P02 | `done` | 보스전 일반 몬스터 병행, 보스전 카드·HUD, 문서 동기화, 기준 시간 재측정 | [P02](../phases/2026-11-06-boss-hp-and-bottle-speed/P02-boss-concurrent-spawns/phase.md) |
