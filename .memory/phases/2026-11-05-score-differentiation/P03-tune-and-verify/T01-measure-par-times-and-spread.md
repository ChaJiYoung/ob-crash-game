# Task: T01 Measure Par Times and Spread

## Status: done

## Goal
봇으로 웨이브별 클리어 시간을 재서 기준 시간을 정하고, 시간 보너스 상한을 조정해 점수 격차 목표(약 1.5배)를 맞춘다.

## Decision Summary
- D05: 상위 실력 대 평범한 실력 약 1.5배, 시간 보너스는 총점의 약 25~30%.
- D03: 기준 시간 산정은 봇 측정으로 시작해 직접 플레이로 보정한다.
- 봇의 실력 편차는 사람보다 좁다. 격차 목표는 봇 기준 초안이고 최종은 직접 플레이로 확인한다.
- 지금 시뮬레이터에는 죽지 않게 하는 모드(`INVINCIBLE`)와 판정 집계가 있다.

## Implementation

### I01. 측정 스크립트

- Related Files:
  - `.memory/references/scripts/measure-wave-times.ts` :: 웨이브별 클리어 시간 분포(무기 x 봇 실력); new
  - `.memory/references/scripts/simulate-current-decisions.ts` :: 점수 내역(기본/시간/정밀도) 출력; modify
  - `.memory/references/scripts/README.md` :: 사용법; modify

#### Details
- `measure-wave-times.ts`: 죽지 않게 한 상태로 정확/보통/부정확(탭) 봇이 웨이브 1~7을 클리어하는 시간을 `engine.lastWaveClear.seconds`로 모아 웨이브별 평균·p25·p75를 무기별로 출력한다.
- 시뮬레이터는 `getScoreBreakdown()`을 사용해 평균 내역과 정확/보통/부정확 점수 비를 출력한다.

### I02. 기준 시간과 상한 설정

- Related Files:
  - `src/shared/gameTuning.ts` :: `waves[i].parTimeSec`, `score.timeBonus.maxPerWave` — 측정값 반영; modify

#### Details
- 기준 시간은 **정확 봇 평균 시간의 약 1.1배**를 시작값으로 한다(최상위 플레이어는 보너스를 거의 다 받고, 평범한 플레이어는 중간 정도 받는 위치). 무기별로 시간이 다르면 세 무기 평균을 쓰되 차이가 크면 결정 문서에 적는다.
- `maxPerWave`: 정확 봇 총점의 25~30%가 시간 보너스가 되도록 맞춘다. 보스 웨이브는 `bossWaveWeight`배.
- 점수 격차 목표: 죽지 않게 한 상태에서 정확 대 부정확 약 1.5배, 정확 대 보통 1.25배 이상. 무기별 순서(개틀링이 가장 낮음)를 확인한다.

### I03. 결정 문서 갱신

- Related Files:
  - `.memory/decisions/2026-11-05-score-differentiation.md` :: '구현 중 조정 기록' 절 추가; modify

#### Details
- 측정한 기준 시간 표, 선택한 `maxPerWave`, 점수 비 결과, 미달 항목을 적는다.


## Acceptance Criteria
- [x] 7개 웨이브 모두 측정 근거가 있는 `parTimeSec`가 들어갔다.
- [x] 죽지 않게 한 상태에서 정확 대 부정확 점수 비가 약 1.5배, 정확 대 보통이 1.25배 이상이다(미달이면 이유를 기록).
- [x] 시간 보너스가 정확 봇 총점의 약 25~30%이다.
- [x] 무기 점수 순서가 유지된다.

## Validation
- `npx tsx .memory/references/scripts/measure-wave-times.ts 30` — 웨이브별 시간 표 출력
- `INVINCIBLE=1 npx tsx .memory/references/scripts/simulate-current-decisions.ts 30 all` — 점수 비 확인
- `npm test` — 전체 통과

## Commit Message
```text
chore(tuning): set wave par times and time bonus from bot measurements

Plan: 2026-11-05-score-differentiation
Phase: P03-tune-and-verify
Task: T01-measure-par-times-and-spread

- Measure per-wave clear times by weapon and skill
- Set par times and the per-wave cap to hit the score spread target
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit:
