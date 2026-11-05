# Task: T04 Final Verification and Playtest

## Status: done

## Goal
자동 검증을 모두 통과시키고, 사람이 폰 자이로와 마우스로 직접 플레이해 시간 보너스·보스 압박 수치를 확정한다.

## Decision Summary
- 이 Task의 직접 플레이 항목은 **사람이 해야 한다. 실행 주체가 대신 판단하거나 통과로 표시하지 않는다.**
- 확인할 것: 시간 보너스가 체감되는가, 폰 자이로로 보스 부하 낙하에 대응 가능한가, 점수 격차가 실제 실력 차를 반영하는가.

## Implementation

### I01. 자동 검증

- Related Files:
  - 전체 — 검증만; no change

#### Details
- `npm test`, `npx tsc --noEmit`, `npm run build`, 봇 라이브 플레이(`scripts/playtest-bot.mjs`, `scripts/verify-live.mjs`, 개발 서버 필요), 렌더 프로파일(`perf-frame-profile.mjs`), 시뮬레이터 점수 비·클리어율을 실행하고 결과를 `.memory/current.md`에 적는다.

### I02. 직접 플레이 체크리스트

- Related Files:
  - `.memory/references/playtest-2026-11-05.md` :: 체크리스트; new

#### Details
- 항목: 웨이브 클리어 배너와 시간 보너스가 이해되는가, 기준 시간이 너무 빡빡/느슨하지 않은가(모바일/마우스 각각), 부하 낙하가 억울하지 않은가(착지 표식 가시성, 가까운 6m 낙하), 보스전 길이와 소환 가속이 적당한가, 같은 사람이 잘 할 때와 못 할 때 점수 차이가 나는가, 무기별 점수 차이.
- 빈 칸은 사람이 채운다.

### I03. 조정 반영

- Related Files:
  - `src/shared/gameTuning.ts` :: 수치 조정; modify

#### Details
- 피드백이 오면 `GAME_TUNING`만 고치고 `npm test`와 시뮬레이터를 다시 돌린다. 확정되면 결정 문서의 [초안]을 최종값으로 바꾸고 모든 Phase를 `done`으로 표시한다.


## Acceptance Criteria
- [x] 자동 검증이 모두 통과한다. (결과는 `.memory/references/playtest-2026-11-05.md`)
- [x] 사람이 체크리스트를 채웠다(실행 주체가 대신 표시하지 않는다).
- [x] 피드백이 있으면 수치 조정과 재검증이 끝났다.

## Validation
- `npm test`, `npx tsc --noEmit`, `npm run build` — 모두 통과
- `node scripts/playtest-bot.mjs`, `node scripts/verify-live.mjs` — 종료 코드 0 (개발 서버 필요)
- 직접 플레이 체크리스트 — 사람이 확인

## Commit Message
```text
docs(memory): record final verification for score differentiation

Plan: 2026-11-05-score-differentiation
Phase: P03-tune-and-verify
Task: T04-final-verification-and-playtest

- Record automated verification results and the human playtest outcome
- Finalize the tuned values in the decision document
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit:

## 사람 플레이 결과 (2026-11-06)
사용자가 세 무기를 모두 직접 플레이해 "아슬아슬하게 다 깼다"고 알렸고, 이 플레이 확인을 닫으라고 했다. 값 조정 없음.
