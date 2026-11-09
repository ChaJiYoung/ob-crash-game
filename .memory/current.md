# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)

## Active Phase
[P07 문서 캡처 갱신](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P07-docs-captures/phase.md)

## Active Task
[T01 문서 캡처 재촬영과 참조 점검](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P07-docs-captures/T01-recapture-docs-screens.md)

## Status
- P06 완료. P04~P06 Opus 리뷰 진행 중. P07은 agy --model gemini-3.8-flash-high로 위임 예정

## Next Step (IMPORTANT)
Opus 리뷰 반영 후 P07-T01 청사진을 agy(gemini-3.8-flash-high)에 위임

## 실행 메모
- 사용자 지시: P1~P3, P4~P6 끝날 때마다 Opus 5.5 리뷰. P03·P07 같은 단순 작업은 Orca CLI로 Gemini 3.8 Flash(high)에 위임.
- 각 Task 커밋은 `git log --grep "Task: <id>"`로 찾는다.
