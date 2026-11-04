# Current Context

## Active Plan
[Gameplay Polish and Performance Optimization](./plans/2026-11-04-gameplay-polish-and-perf-optimization.md)

## Active Phase
[P05 Docs and Verification](./phases/2026-11-04-gameplay-polish-and-perf-optimization/P05-docs-and-verification/phase.md)

## Active Task
[T04 Final Verification and Playtest](./phases/2026-11-04-gameplay-polish-and-perf-optimization/P05-docs-and-verification/T04-final-verification-and-playtest.md)

## Status
- P01~P04 완료(각 Phase 끝에 Opus 5.5 코드 리뷰 반영), P05-T01~T03 완료, 리뷰 반영 완료
- P05-T04: 자동 검증 통과(npm test 241, build, 밸런스 시뮬레이션, 렌더 프로파일). **사용자 직접 플레이 대기 중**
- P05-T05: T04의 직접 플레이 조정이 끝난 뒤에 진행(스크린샷 재촬영)

## Next Step (IMPORTANT)
사용자가 `.memory/references/playtest-2026-11-04.md`의 체크리스트를 폰 자이로·마우스로 직접 플레이해 채운다.
피드백이 오면 `src/shared/gameTuning.ts`만 조정하고 `npm test`와 시뮬레이터를 다시 돌린다(T04 I03).
수치가 확정되면 결정 문서의 [초안]을 최종값으로 바꾸고, 랭킹 규칙 버전(`RANKING_RULESET_VERSION`) 상향 여부를 정한 뒤 T05로 넘어간다.
미달 항목(보스전 시간, 보통 봇 클리어율 일부, 한 판 길이)은 결정 문서의 '구현 중 조정 기록'에 있다.
