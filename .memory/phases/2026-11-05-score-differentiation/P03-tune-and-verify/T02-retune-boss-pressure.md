# Task: T02 Retune Boss Pressure

## Status: done

## Goal
소환 가속과 6~14m 낙하 소환으로 보스전이 어려워진 만큼 보통 봇 클리어율을 직전 수준으로 되돌린다.

## Decision Summary
- 직전 상태 보통 봇 클리어율: 샷건 35%, 리볼버 38%, 개틀링 55%. 이보다 크게 나빠지면 안 된다.
- 조정 순서(위에서부터): 낙하 반경 하한(6m), 소환 가속 최소 간격(4초)과 시간(40초), 한 번에 소환하는 수(4), 동시 최대 수(7).
- 보스 러시: 샷건·리볼버 클리어율이 여전히 낮고, 개틀링도 일반 플레이보다 불리해야 한다.

## Implementation

### I01. 보스 압박 측정

- Related Files:
  - `.memory/references/scripts/boss-strategy-compare.ts` :: 부하 먼저 / 보스 러시 / 보스 스톨 봇 비교; new

#### Details
- 세 전략 봇(부하 우선, 보스 러시, 보스를 살려 두고 부하만 잡는 스톨)을 무기별로 돌려 클리어율, 보스전 체력 손실, 보스전 시간, 점수를 출력한다. 스톨 봇은 보스를 마지막에 처치하거나 시간 제한을 두고 비교한다.

### I02. 수치 조정

- Related Files:
  - `src/shared/gameTuning.ts` :: `boss.minionDrop`, `boss.summonAccel`, `boss.summonCount`, `boss.summonMaxActive` — 조정; modify

#### Details
- 보통 봇 클리어율, 보스전 시간(목표 15~25 / 20~30 / 40~60초에 가깝게), 세 전략 점수 순서(부하 우선 > 스톨, 러시)를 본다.
- 보스 웨이브 `parTimeSec`가 바뀌면 P03-T01의 측정을 다시 한다.

### I03. 결정 문서 갱신

- Related Files:
  - `.memory/decisions/2026-11-05-score-differentiation.md` :: 조정 기록; modify


## Acceptance Criteria
- [x] 보통 봇 클리어율이 직전 수준(샷건 35%, 리볼버 38%, 개틀링 55%) 근처로 유지된다.
- [x] 보스 러시의 샷건·리볼버 클리어율이 낮고 스톨은 점수에서 이득이 없다.
- [x] 조정한 수치가 결정 문서에 기록된다.

## Validation
- `npx tsx .memory/references/scripts/boss-strategy-compare.ts 30` — 세 전략 비교
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 60 all 보통` — 클리어율 확인
- `npm test` — 전체 통과

## Commit Message
```text
chore(tuning): rebalance boss pressure after drop spawns and acceleration

Plan: 2026-11-05-score-differentiation
Phase: P03-tune-and-verify
Task: T02-retune-boss-pressure

- Compare minion-first, boss-rush, and stalling strategies
- Tune drop radius and summon acceleration to keep clear rates
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit:
