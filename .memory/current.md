# Current Context

## Active Plan
[무기 스킬 개편과 효용성 정리](./plans/2026-11-05-weapon-skill-rework.md)

## Active Phase
[P03 개틀링 거품](./phases/2026-11-05-weapon-skill-rework/P03-gatling-foam/phase.md)

## Active Task
[T01 거품 파도 판정과 미끄러짐](./phases/2026-11-05-weapon-skill-rework/P03-gatling-foam/T01-foam-engine.md)

## Status
- P01-T01 완료(밀어내기 공용 함수 `pushTargetBack`), P01-T02 완료(보스 면역), P01-T03 완료(스킬 피해 공용 함수·spreadRad 삭제). P01 Opus 리뷰 반영 완료, P02 전체 완료 + Opus 리뷰 반영(칼날 지난 구간만 판정, 종료 시 칼날 정리)
- 결정: [무기 스킬 개편 결정 문서](./decisions/2026-11-05-weapon-skill-rework.md)

## Paused Plan
- `2026-11-05-skill-guard-ammo-tuning` P03-T02(사람 직접 플레이): 이 계획의 P04-T03 플레이에 합쳐 닫는다.
- `2026-11-05-score-differentiation` P03-T04(사람 직접 플레이): 같은 플레이로 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다(T05는 UI 확정 뒤).
- 랭킹 v5 여부와 전체 난이도 판단(이전 리뷰 1)은 P04-T03 플레이 뒤에 사용자에게 묻는다.

## Next Step (IMPORTANT)
P03-T01 청사진을 읽고 거품 파도 엔진을 구현한다. 칼날처럼 "앞면이 이번 프레임에 훑은 구간만" 판정한다(P02 리뷰 교훈).
