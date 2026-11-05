# Task: T01 거리, 탄창, 오비 비중

## Status: done

## Goal
보스는 20m에 나와 14m에 멈추고, 부하는 10~18m에 떨어지며, 개틀링 탄창이 늘고, 오비가 덜 나온다.

## Decision Summary
- 결정 D01, D02, D03, D06. `src/shared/gameTuning.ts` 값만 바꾼다.

## Implementation

### I01. 값
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING`; modify
#### Details
- `boss.startRadiusM` 20, `boss.stopRadiusM` 14, `boss.minionDrop.minRadiusM` 10, `maxRadiusM` 18.
- `maxAmmoByWeapon.gatling` `{1:30, 2:35, 3:40, 4:50}`.
- `kinds`: 2웨이브 `['pilgood','pilgood','caslight','obi']`, 3웨이브 `['obi','caslight','caslight','hanmac']`, 5웨이브 `['obi','hanmac','hanmac','bottle','bottle']`. 보스 `summonKinds`와 6·7웨이브는 그대로.

### I02. 테스트
- Related Files:
  - `tests/boss-distance-and-mix.test.ts`; new
#### Details
- 값 검사와 웨이브별 오비 비중 검사(2: 25%, 3: 25%, 5: 20%). 스폰 `Math.min(14, r)`로 보스 똥이 보스 위치에서 나오는지 확인. 값에 고정된 기존 테스트는 `GAME_TUNING` 참조로 고친다.

## Acceptance Criteria
- [x] 값이 결정과 같고 전체 테스트가 통과한다.

## Validation
- `npm test`, `npx tsc --noEmit` — 통과

## Commit Message
```text
tune(balance): move bosses back, widen minion drops, grow gatling mags, reduce obi

Plan: 2026-11-05-boss-distance-gatling-hanmac
Phase: P01-rule-values
Task: T01-tuning-values

- Bosses stop at 14m and minions land at 10-18m so shells and drops give more time
- Gatling magazines are 30-50 and obi share falls in waves 2, 3 and 5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
