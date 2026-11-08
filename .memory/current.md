# Current Context

## Active Plan
[main 병합 (규칙 수치·스킬 중복 방지·피버 표시)](./plans/2026-11-08-merge-main-rules.md)

## Active Phase
[P01 병합과 이식](./phases/2026-11-08-merge-main-rules/P01-merge-and-port/phase.md)

## Active Task
[T02 폰 스킬 디바운스 되돌리기](./phases/2026-11-08-merge-main-rules/P01-merge-and-port/T02-revert-phone-debounce.md)

## Status
- P01 T01 완료: main 병합, 충돌 7개 해결, 타입체크·전체 테스트(684) 통과.
- 계획 수립 완료. 이전 계획(2인팟 QA 수정)은 P03까지 완료, P04(3차 QA)는 리뷰어 진행 중.

## Next Step (IMPORTANT)
T02 청사진을 읽고 폰 스킬 디바운스(`shouldSendSkillSnap`, `snapDebounceMs`)를 제거한다.
