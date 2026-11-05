# Current Context

## Active Plan
[무기 스킬 개편과 효용성 정리](./plans/2026-11-05-weapon-skill-rework.md)

## Active Phase
[P04 문서 동기화와 최종 검증](./phases/2026-11-05-weapon-skill-rework/P04-sync-and-verify/phase.md)

## Active Task
[T03 최종 자동 검증과 직접 플레이 (사람)](./phases/2026-11-05-weapon-skill-rework/P04-sync-and-verify/T03-final-verification-and-playtest.md)

## Status
- P01-T01 완료(밀어내기 공용 함수 `pushTargetBack`), P01-T02 완료(보스 면역), P01-T03 완료(스킬 피해 공용 함수·spreadRad 삭제). P01 Opus 리뷰 반영 완료, P02 전체 완료 + Opus 리뷰 반영(칼날 지난 구간만 판정, 종료 시 칼날 정리). P03 완료 + Opus 리뷰 반영, P04-T01·T02 완료, P04-T03 자동 검증 완료(npm test 376, tsc, build, 봇 VICTORY, 라이브 통과). **P04 재개 리뷰·자동 재검증 완료(376 테스트, tsc, build, 봇 VICTORY, 라이브 오류 0). 사용자가 아직 플레이하지 않았다고 답변하여 사람 직접 플레이 대기 중**
- 결정: [무기 스킬 개편 결정 문서](./decisions/2026-11-05-weapon-skill-rework.md)

## Paused Plan
- `2026-11-05-skill-guard-ammo-tuning` P03-T02(사람 직접 플레이): 이 계획의 P04-T03 플레이에 합쳐 닫는다.
- `2026-11-05-score-differentiation` P03-T04(사람 직접 플레이): 같은 플레이로 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다(T05는 UI 확정 뒤).
- 랭킹 v5 여부와 전체 난이도 판단(이전 리뷰 1)은 P04-T03 플레이 뒤에 사용자에게 묻는다.

## Next Step (IMPORTANT)
사용자가 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 하단 "무기 스킬 개편 추가분"을 플레이해 채팅으로 느낌을 말한다. 에이전트가 대신 통과로 표시하지 않는다. 피드백은 `gameTuning.ts`로 조정하고 `npm test`와 시뮬레이터를 다시 돌린다. 이후 v5 여부를 묻고(되돌릴 수 없음), 이전 두 계획의 직접 플레이 Task(`skill-guard-ammo-tuning` P03-T02, `score-differentiation` P03-T04)를 닫고 모든 Phase를 done으로 표시한다.
