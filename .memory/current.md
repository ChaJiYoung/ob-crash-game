# Current Context

## Active Plan
[후반 속도, 보스 소환 개편, 똥 모양 포탄, 보스 처치 연출](./plans/2026-11-05-boss-summon-shell-and-speed.md)

## Active Phase
[P02 보스 처치 연출](./phases/2026-11-05-boss-summon-shell-and-speed/P02-boss-clear-effect/phase.md)

## Active Task
[T01 엔진 보스 처치 시퀀스](./phases/2026-11-05-boss-summon-shell-and-speed/P02-boss-clear-effect/T01-boss-clear-sequence-engine.md)

## Status
- P01 완료(속도, 방패 제거, 체력 구간 소환)
- 결정: [결정 문서](./decisions/2026-11-05-boss-summon-shell-and-speed.md)

## Paused Plan
- `2026-11-05-weapon-skill-rework` P04-T03(사람 직접 플레이): 이 계획의 P04-T03 플레이에 합쳐 닫는다(앞 계획의 구현·자동 검증은 완료).
- 그 플레이로 `2026-11-05-skill-guard-ammo-tuning` P03-T02와 `2026-11-05-score-differentiation` P03-T04도 함께 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- 랭킹 v5 여부와 전체 난이도 판단은 P04-T03 플레이 뒤 사용자에게 묻는다.

## Next Step (IMPORTANT)
P02-T01 청사진을 읽고 보스 처치 시퀀스를 엔진에 넣는다. 보스를 죽인 직후 VICTORY/카드를 기대하는 기존 테스트는 시퀀스 길이만큼 update를 더 돌리게 고친다. 전체 구현 후 Opus 리뷰.
