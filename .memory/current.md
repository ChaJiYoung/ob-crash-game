# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)

## Active Phase
[P03 균형 측정·튜닝](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P03-balance-measure/phase.md)

## Active Task
[T01 샷건 균형 봇 측정·튜닝](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P03-balance-measure/T01-bot-measure-and-tune.md)

## Status
- P02 완료. P03-T01은 단순 측정 작업이라 Orca CLI로 Gemini Flash에 위임 예정

## Next Step (IMPORTANT)
T01 청사진의 I01 기준선 측정(세 무기 80판)부터. Orca CLI worker에 위임

## 실행 메모
- 사용자 지시: P1~P3, P4~P6 끝날 때마다 Opus 5.5 리뷰. P03·P07 같은 단순 작업은 Orca CLI로 Gemini 3.8 Flash(high)에 위임.
- 각 Task 커밋은 `git log --grep "Task: <id>"`로 찾는다.
