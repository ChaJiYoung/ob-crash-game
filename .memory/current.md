# Current Context

## Active Plan
[스킬·오비 방패·탄창 조정 + 장전 게이지 링](./plans/2026-11-05-skill-guard-ammo-tuning.md)

## Active Phase
[P03 재보정과 검증](./phases/2026-11-05-skill-guard-ammo-tuning/P03-retune-and-verify/phase.md)

## Active Task
[T02 최종 자동 검증과 직접 플레이 (사람)](./phases/2026-11-05-skill-guard-ammo-tuning/P03-retune-and-verify/T02-final-verification-and-playtest.md)

## Status
- P01~P02 완료, P03-T01 완료(기준 시간 재측정, 랭킹 규칙 v4), P04(Opus 코드리뷰 반영) 완료
- P03-T02: 자동 검증 통과(npm test 321, tsc, build, 봇 플레이 VICTORY, 라이브 검증, 장전 링 확인). **사람 직접 플레이 대기 중**
- 보통 봇 클리어율이 모든 무기에서 100%로 올랐다(직전 35~55%). 사람이 보고 너무 쉬우면 조정한다.

- 리뷰 1(난이도·시간 보너스 구조·v5 초기화 여부)은 사용자의 직접 플레이 뒤에 정한다. 이전에는 첫 보스까지 겨우 갔다는 피드백이 있었다.

## Paused Plan
- `2026-11-05-score-differentiation` P03-T04(사람 직접 플레이)는 이 계획의 직접 플레이와 합쳐서 닫는다.
- 더 이전 계획 `2026-11-04-gameplay-polish-and-perf-optimization`의 P05-T04·T05도 남아 있다(T05는 UI 확정 뒤).

## Next Step (IMPORTANT)
사용자가 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 체크리스트를 폰 자이로·마우스로 직접 플레이해 채운다. 에이전트가 대신 통과로 표시하지 않는다.
피드백이 오면 `src/shared/gameTuning.ts`만 조정하고(조정 위치는 체크리스트 하단) `npm test`와 시뮬레이터를 다시 돌린다. 확정되면 결정 문서에 최종값을 적고 P03-T02와 모든 Phase를 `done`으로 표시한다.
