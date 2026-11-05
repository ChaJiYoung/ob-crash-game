# Current Context

## Active Plan
[Score Differentiation](./plans/2026-11-05-score-differentiation.md)

## Active Phase
[P03 Tune and Verify](./phases/2026-11-05-score-differentiation/P03-tune-and-verify/phase.md)

## Active Task
[T04 Final Verification and Playtest](./phases/2026-11-05-score-differentiation/P03-tune-and-verify/T04-final-verification-and-playtest.md)

## Status
- P01~P02 완료(각 Phase 끝에 Opus 5.5 코드 리뷰 반영), P03-T01~T03 완료
- P03-T04: 자동 검증 통과(npm test 303, tsc, build, 라이브 봇·검증 스크립트, 렌더 프로파일). **사용자 직접 플레이 대기 중**
- 미달 항목: 점수 격차 약 1.2배(목표 1.5배), 개틀링은 보스 러시가 통함, 보스전 시간이 목표보다 짧음

## Paused Plan
이전 계획 `2026-11-04-gameplay-polish-and-perf-optimization`의 P05-T04(사람의 직접 플레이)·T05(스크린샷 재촬영)가 남아 있다. T05는 이 계획의 UI가 확정된 뒤에 한다.

## Next Step (IMPORTANT)
사용자가 `.memory/references/playtest-2026-11-05.md`의 체크리스트를 폰 자이로·마우스로 직접 플레이해 채운다. 에이전트가 대신 통과로 표시하지 않는다.
피드백이 오면 `src/shared/gameTuning.ts`만 조정하고(조정 위치는 체크리스트 하단) `npm test`와 시뮬레이터를 다시 돌린다(T04 I03). 확정되면 결정 문서의 [초안]을 최종값으로 바꾸고 모든 Phase를 `done`으로 표시한다.
