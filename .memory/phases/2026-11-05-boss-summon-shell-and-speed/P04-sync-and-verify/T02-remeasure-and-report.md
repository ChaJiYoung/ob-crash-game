# Task: T02 기준 시간 재측정과 난이도 보고

## Status: done

## Goal
속도·보스 개편 후 웨이브 기준 시간을 다시 재고, 합산 난이도 수치를 기록해 사용자에게 보고한다.

## Decision Summary
- 결정 D04 경고, D09. 값을 임의로 되돌리지 않는다. 예상은 임시 패치 시뮬레이션: 4마리 소환 보통 봇 샷건 70%, 리볼버 93%, 개틀링 78%(속도 증가 8% 미포함).

## Implementation

### I01. 측정
- Related Files:
  - `src/shared/gameTuning.ts` :: `waves[i].parTimeSec`, `score.timeBonus` 위 주석; modify
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md`; modify

#### Details
1. `npx tsx .memory/references/scripts/measure-wave-times.ts 30 all` → 무기 합산 정확 봇 평균을 정수 초로 `parTimeSec`에 넣는다. 주석을 `보스·속도 개편 후 30판씩 재측정했다(2026-11-05, <새 값>초). 직전 값은 15/19/21/24/23/24/50초.`로 바꾼다.
2. `npx tsx .memory/references/scripts/simulate-current-decisions.ts 60`(3무기 × 봇 7종)을 돌려 클리어율·승리 체력·한 판 시간·보스전 시간·패배 웨이브 분포를 체크리스트 파일의 자동 검증 표에 기록한다.
3. 예상과 비교해 보고한다. 보통 봇이 어느 무기든 60% 아래이거나 아주 부정확 봇이 샷건 5% 수준이면 **수치를 고치지 않고** 사용자에게 보고한다(마릿수 `summonCount`, 낙하 거리 `minionDrop`, 속도 증가 `speedPerWave`가 후보).
4. 보스 소환 횟수 실측: `.memory/references/scripts`에 소환 횟수를 세는 도구가 없으므로 임시 스크립트(저장소 밖)로 보스전당 소환 3회(보스당)가 나오는지 확인한다.

## Acceptance Criteria
- [ ] `parTimeSec` 7개가 새 측정값이고 근거가 주석에 남는다.
- [ ] 세 무기의 봇 수치가 기록되고 예상과의 차이가 보고된다.
- [ ] `RANKING_RULESET_VERSION`은 4 그대로다.

## Validation
- `npx tsx .memory/references/scripts/measure-wave-times.ts 30 all` — 웨이브별 시간이 출력된다
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
chore(tuning): refresh wave par times after the boss and speed rework

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P04-sync-and-verify
Task: T02-remeasure-and-report

- parTimeSec re-measured with the accurate bot (30 games, all weapons)
- record combined bot results for the playtest
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
