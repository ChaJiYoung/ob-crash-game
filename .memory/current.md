# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)

## Active Phase
[P02 샷건 스킬 재설계](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P02-shotgun-skill/phase.md)

## Active Task
[T02 샷건 스킬 연출 (박힌 몬스터만, 폭발, 폭발 직전 진동)](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P02-shotgun-skill/T02-plunger-visuals.md)

## Status
- P02-T01 완료(박힘·기절·폭발 엔진). P02-T02 시작 준비 완료

## Next Step (IMPORTANT)
T02 청사진을 읽고 `triggerSkillEffect`가 affectedTargets만 쓰게 하고 `spawnPlungerBlast`·`playPlungerBlastSound` 추가

## 실행 메모
- 사용자 지시: P1~P3, P4~P6 끝날 때마다 Opus 5.5 리뷰. P03·P07 같은 단순 작업은 Orca CLI로 Gemini 3.8 Flash(high)에 위임.
- 각 Task 커밋은 `git log --grep "Task: <id>"`로 찾는다.
