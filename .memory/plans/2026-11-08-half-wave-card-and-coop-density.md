# Plan: 웨이브 절반 카드 · 2P 필드 밀도 · 조준경 게이지 가시성

## Goal
- 4·6웨이브 중간 카드를 "처치 수가 웨이브 절반(`ceil(totalSpawns/2)`)에 닿을 때 1회"로 바꾼다(결정 D01·D02).
- 2P에서 필드 동시 몬스터 수를 1.8배, 스폰 간격을 0.6배로 바꾼다(결정 D03·D04).
- 조준경의 탄창·스킬·피버 호를 굵게 하고, 스킬 가득·피버 준비 때 눈에 띄게 반짝인다(사용자 추가 요청, 2026-11-08).
- 측정: `npm test` 전부 통과, `tsc` 0 오류, 1P/2P 봇 클리어율 기록.

Decisions: [2026-11-08-half-wave-card-and-coop-density](../decisions/2026-11-08-half-wave-card-and-coop-density.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 절반 카드 + 2P 밀도 규칙과 문서·측정 | [P01](../phases/2026-11-08-half-wave-card-and-coop-density/P01-wave-rules/phase.md) |
| P02 | `in_progress` | 조준경 게이지 굵기·반짝임 (decisions: 2026-11-08-scope-gauge-visibility) | [P02](../phases/2026-11-08-half-wave-card-and-coop-density/P02-scope-gauge-visibility/phase.md) |
