# Task: T01 웨이브 기준 시간 재측정과 클리어율 확인

## Status: done

## Goal
방패 내림 시간·탄수·장전·쿨타임이 바뀌어 웨이브 클리어 시간이 달라졌다. 시간 보너스의 기준인 `parTimeSec`를 다시 재서 반영하고, 클리어율이 크게 무너지지 않았는지 확인한다.

## Decision Summary
- 점수 차별화 계획의 방식을 그대로 따른다: `parTimeSec` = 정확 봇(세 무기 평균)의 웨이브별 클리어 시간(`measure-wave-times.ts`).
- 숫자는 사용자 체감으로 최종 조정하므로 여기서는 "측정값 반영 + 이상 징후 보고"까지만 한다.

## Implementation

### I01. 측정과 반영
- Related Files:
  - `.memory/references/scripts/measure-wave-times.ts` — 측정 스크립트; read-only
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves[i].parTimeSec` — 반영; modify
  - `.memory/references/scripts/simulate-current-decisions.ts` — 클리어율 확인; read-only

#### Details
1. `npx tsx .memory/references/scripts/measure-wave-times.ts 30 all` 실행(사용법: `[games=30] [weapon|all] [skill-name-substring]`). 정확 봇 기준 웨이브별 평균을 받아 `parTimeSec`(정수 초, 반올림)로 갱신한다. 현재 값: 17, 24, 32, 29, 37, 27, 61.
2. `docs`·`README`·테스트에 par 시간이 적혀 있으면 함께 바꾼다(`grep -rn "parTimeSec\|기준 시간" tests docs README.md`). `tests/wave-time-bonus.test.ts`가 현재 par 값을 가정하면 새 값으로 고친다.
3. `npx tsx .memory/references/scripts/simulate-current-decisions.ts`(인자는 스크립트 머리 주석 참고)로 봇 클리어율을 본다. 직전 값(샷건 42%, 리볼버 38%, 개틀링 53%)보다 너무 올라가면(예: 모두 80% 이상) 사용자에게 "쉬워졌다"고 보고하고 값을 임의로 되돌리지 않는다.
4. **랭킹 규칙 버전 상승 (D06-2)**: `src/shared/gameTuning.ts`의 `RANKING_RULESET_VERSION`을 3 → **4**로 올리고 머리 주석의 설명 옆에 "(v4: 스킬·방패·탄창 완화)"를 덧붙인다. 올리면 서버가 처음 실행될 때 `data/players.json`을 `data/players.json.ruleset-3.bak`로 백업하고 점수를 초기화한다(닉네임 유지; `server/PlayerStore.ts`).
   - **되돌릴 수 없는 동작이므로**, 이 단계를 실행하기 전에 사용자에게 "서버를 다시 켜면 기존 랭킹이 초기화됩니다"라고 한 번 알린다(사용자는 포함을 승인했지만 실행 시점은 사용자가 정한다).
   - `tests/server-session.test.ts`는 상수를 import하므로 값이 바뀌어도 통과하는지만 확인한다. 문서·README에 "규칙 v3"가 적혀 있으면(`grep -rn "ruleset\|규칙 버전" README.md docs`) 4로 바꾼다.

## Acceptance Criteria
- [ ] `parTimeSec` 7개가 새 측정값으로 바뀌고 근거(측정 날짜·게임 수)가 `gameTuning.ts` 주석에 남는다.
- [ ] 봇 클리어율 세 무기 값이 보고된다. 큰 변화는 사용자에게 알린다.
- [ ] `RANKING_RULESET_VERSION`이 4이고 관련 문서가 맞다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx tsx .memory/references/scripts/measure-wave-times.ts 30 all` — 웨이브별 시간이 출력된다
- `npm test` — 전체 통과

## Commit Message
```text
chore(tuning): refresh wave par times after the skill/guard/ammo retune

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P03-retune-and-verify
Task: T01-remeasure-par-times

- parTimeSec re-measured with the accurate bot (30 games, all weapons)
- docs and tests follow the new par times
- RANKING_RULESET_VERSION 3 -> 4 (scores are not comparable after the easier tuning)
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
