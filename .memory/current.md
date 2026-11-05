# Current Context

## Active Plan
[후반 속도, 보스 소환 개편, 똥 모양 포탄, 보스 처치 연출](./plans/2026-11-05-boss-summon-shell-and-speed.md)

## Active Phase
[P04 문서 동기화와 최종 검증](./phases/2026-11-05-boss-summon-shell-and-speed/P04-sync-and-verify/phase.md)

## Active Task
[T02 기준 시간 재측정과 난이도 보고](./phases/2026-11-05-boss-summon-shell-and-speed/P04-sync-and-verify/T02-remeasure-and-report.md)

## Status
- P01~P03 완료(똥 포탄, 속도, 방패 제거, 체력 구간 소환, 보스 처치 연출)
- 결정: [결정 문서](./decisions/2026-11-05-boss-summon-shell-and-speed.md)

## Paused Plan
- `2026-11-05-weapon-skill-rework` P04-T03(사람 직접 플레이): 이 계획의 P04-T03 플레이에 합쳐 닫는다(앞 계획의 구현·자동 검증은 완료).
- 그 플레이로 `2026-11-05-skill-guard-ammo-tuning` P03-T02와 `2026-11-05-score-differentiation` P03-T04도 함께 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- 랭킹 v5 여부와 전체 난이도 판단은 P04-T03 플레이 뒤 사용자에게 묻는다.

## Next Step (IMPORTANT)
P04-T02: measure-wave-times와 시뮬레이터로 합산 난이도를 재고 기록한다. 난이도는 임의로 고치지 않고 사용자에게 보고한다(샷건 보통 봇이 매우 낮게 나옴).
