# Task: T02 웨이브 기준 시간 재측정

## Status: done

## Goal
칼날·거품의 비행 시간과 개틀링의 큰 밀기로 웨이브 클리어 시간이 달라졌다. 시간 보너스 기준인 `parTimeSec`를 다시 재서 반영하고 실제 구현 기준 봇 수치를 기록한다.

## Decision Summary
- 결정 D10. `parTimeSec`는 정확 봇(세 무기 평균)의 웨이브별 클리어 시간이다. 랭킹 규칙 버전은 올리지 않는다.
- 숫자는 사람이 플레이한 뒤 최종 조정하므로, 여기서는 측정 반영과 이상 보고까지만 한다.

## Implementation

### I01. 측정과 반영
- Related Files:
  - `.memory/references/scripts/measure-wave-times.ts` — 측정; read-only
  - `.memory/references/scripts/simulate-current-decisions.ts` — 클리어율 확인; read-only
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves[i].parTimeSec`, `score.timeBonus` 위 주석; modify
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` — 자동 검증 표; modify

#### Details
1. `npx tsx .memory/references/scripts/measure-wave-times.ts 30 all` 실행(사용법: `[games=30] [weapon|all] [skill-name-substring]`). 정확 봇 기준 웨이브별 평균을 정수 초로 반올림해 `parTimeSec`를 갱신한다. 현재 값은 14 / 18 / 20 / 24 / 22 / 23 / 48이다.
2. `gameTuning.ts` 주석의 측정 근거 문장을 `무기 스킬 개편 후 30판씩 재측정했다(2026-11-05, <새 값>초).`로 바꾼다.
3. `tests/wave-time-bonus.test.ts`는 값을 읽어 쓰므로 그대로 통과해야 한다. `grep -rn "parTimeSec\|기준 시간" tests docs README.md`로 값이 적힌 곳이 있으면 맞춘다.
4. `npx tsx .memory/references/scripts/simulate-current-decisions.ts 60`을 돌려 세 무기 값을 체크리스트 파일 자동 검증 표에 적는다.
5. 예측과 비교해 보고한다. 예측은 임시 패치 값으로 아주 부정확 봇 클리어율 샷건 82%, 리볼버 88%, 개틀링 90%, 보통 봇 99~100%였다. 칼날·거품 비행 시간이 실제로 들어갔으므로 차이가 날 수 있다.
   - 어떤 무기든 아주 부정확 봇이 70% 아래로 떨어지거나, 한 판 시간이 예측(약 200~245초)보다 크게 늘면 수치를 임의로 고치지 말고 사용자에게 보고한다.

## Acceptance Criteria
- [ ] `parTimeSec` 7개가 새 측정값으로 바뀌고 근거가 주석에 남는다.
- [ ] 세 무기의 봇 수치가 기록되고 예측과의 차이가 보고된다.
- [ ] `RANKING_RULESET_VERSION`은 4 그대로다.

## Validation
- `npx tsx .memory/references/scripts/measure-wave-times.ts 30 all` — 웨이브별 시간이 출력된다
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
chore(tuning): refresh wave par times after the skill rework

Plan: 2026-11-05-weapon-skill-rework
Phase: P04-sync-and-verify
Task: T02-remeasure-par-times

- parTimeSec re-measured with the accurate bot (30 games, all weapons)
- record bot results for the playtest
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
