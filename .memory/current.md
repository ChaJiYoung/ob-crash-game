# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)

## Active Phase
[P02 샷건 스킬 재설계](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P02-shotgun-skill/phase.md)

## Active Task
[T01 샷건 스킬 엔진 재설계 (박힘 → 기절 → 폭발)](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P02-shotgun-skill/T01-plunger-engine.md)

## Status
- P01 완료(T01 추가 명중, T02 퍼짐 연출). P02-T01 시작 준비 완료

## Next Step (IMPORTANT)
T01 청사진을 읽고 `GAME_TUNING.skills.plunger`와 엔진 `runWeaponSkill` 샷건 분기, `advancePlungerBlasts` 구현

## 실행 메모
- 사용자 지시: P1~P3, P4~P6 끝날 때마다 Opus 5.5 리뷰. P03·P07 같은 단순 작업은 Orca CLI로 Gemini 3.8 Flash(high)에 위임.
- 각 Task 커밋은 `git log --grep "Task: <id>"`로 찾는다.
