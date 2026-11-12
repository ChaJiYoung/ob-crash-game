# Current Context

## Active Plan
[찰랑 몬스터 (Chalang Submerge Monster)](./plans/2026-11-12-chalang-monster.md)

## Active Phase
[P02 잠수·순간이동 엔진](./phases/2026-11-12-chalang-monster/P02-submerge-engine/phase.md)

## Active Task
[T03 급발진과 체력 규칙](./phases/2026-11-12-chalang-monster/P02-submerge-engine/T03-rush-and-hp.md)

## Status
- T01 완료 (전체 테스트 통과). T02 완료: 잠수 상태 기계, 순간이동, isTargetable 명중 필터 전환(테스트 8개 통과, 전체 1062개 통과).

## Next Step (IMPORTANT)
T03 청사진을 읽고 `updateChalangSubmerge`에 3번째 등장 급발진(`isRushing`)을 추가하고, 이동 루프 속도 배율 블록에 `rushSpeedMult`를 곱함