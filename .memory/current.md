# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)

## Active Phase
[P04 로비](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P04-lobby/phase.md)

## Active Task
[T01 로비 1P 입력 방식 기억·기본값](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P04-lobby/T01-default-input-memory.md)

## Status
- P01~P03 완료. Opus 5.5 리뷰(P1~P3) 진행 후 P04 시작. P07은 agy --model gemini-3.8-flash-high로 위임

## Next Step (IMPORTANT)
Opus 리뷰 결과 반영 후 P04-T01 청사진을 읽고 lobbyInputMemory.ts·createLobbySlots·PCGamePage 연결 구현

## 실행 메모
- 사용자 지시: P1~P3, P4~P6 끝날 때마다 Opus 5.5 리뷰. P03·P07 같은 단순 작업은 Orca CLI로 Gemini 3.8 Flash(high)에 위임.
- 각 Task 커밋은 `git log --grep "Task: <id>"`로 찾는다.
