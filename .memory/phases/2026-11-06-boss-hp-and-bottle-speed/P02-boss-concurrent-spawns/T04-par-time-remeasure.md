# Task: T04 보스 웨이브 기준 시간 재측정

## Status: done

## Goal
3·5·7웨이브 `parTimeSec`를 새 보스 체력과 병행 흐름에서 측정한 값으로 갱신하고, 측정 결과를 기록으로 남긴다.

## Decision Summary
- 결정 D05. 보스전 카드(T02)가 들어간 뒤에 측정한다. 봇이 카드를 고르는 시간도 기준에 포함된다. `parTimeSec`는 시간 보너스(`awardWaveTimeBonus`)의 기준이다. 보스가 길어졌는데 기준 시간이 그대로면 보너스가 항상 0에 가깝다.
- 1·2·4·6웨이브는 바뀌지 않으므로 값을 고치지 않는다.

## Implementation

### I01. 측정 스크립트 점검
- Related Files:
  - `.memory/references/scripts/measure-wave-times.ts` :: 측정 스크립트; read-only 후 필요 시 modify
  - `.memory/references/scripts/simulate-balance-bundles.ts` :: 68행의 웨이브 종료 판정; read-only

#### Details
- 스크립트가 "스폰 완료 + 필드 비움"이나 `isBossEncounterActive` 전환으로 보스전을 판단하는지 읽는다. 새 흐름(보스가 중간에 등장하고 일반 몬스터가 계속 나옴)에서는 봇이 보스를 우선 조준하거나 필드 몬스터와 섞어 조준해야 시간이 현실적이다. 봇이 멈추거나 무한 루프를 돌면 스크립트의 종료 판정을 보스 처치 기준으로 고친다.
- 스크립트를 고쳐야 하면 고친 이유를 이 Task의 `Progress`에 한 줄로 남긴다.

### I02. 측정과 반영
- Related Files:
  - `src/shared/gameTuning.ts` :: `waves[2|4|6].parTimeSec`, `score.timeBonus` 주석의 측정 날짜 문구; modify
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 끝; modify (측정 기록 추가)

#### Details
- 실행: `npx tsx .memory/references/scripts/measure-wave-times.ts 30` (30판). 세 무기 평균의 "정확" 봇 합산값을 정수 초로 반올림해 3·5·7웨이브 `parTimeSec`에 넣는다. 1·2·4·6웨이브 값은 건드리지 않는다.
- `gameTuning.ts`의 시간 보너스 주석("현재 값은 보스·속도 개편 후 30판씩 재측정한 결과다(2026-11-05, ...)")을 이번 측정 날짜(2026-11-06)와 새 보스 웨이브 값으로 고친다. 이전 값(`15/19/31/24/37/23/45초`)은 "직전 값"으로 남긴다.
- 함정: `tests/wave-time-bonus.test.ts`와 `tests/docs-sync.test.ts`(139행 `보스 웨이브는 ${fmt(t.maxPerWave * t.bossWaveWeight)}점`)가 `parTimeSec`나 보너스 값을 읽는다. `maxPerWave`·`bossWaveWeight`는 바꾸지 않으므로 문서 문구는 그대로여야 한다.
- 측정 결과가 비정상이면(예: 보스 웨이브 시간이 1·2웨이브보다 짧음) 값을 반영하지 말고 원인을 먼저 찾는다.

## Acceptance Criteria
- [x] 3·5·7웨이브 `parTimeSec`가 30판 측정값으로 갱신되고 주석 날짜가 맞다.
- [x] 측정 기록이 `.memory/references/`에 남는다.
- [x] `RANKING_RULESET_VERSION`은 5 그대로다.

## Validation
- `npx vitest run tests/wave-time-bonus.test.ts tests/game-tuning.test.ts tests/docs-sync.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(boss): re-measure boss wave par times

Plan: 2026-11-06-boss-hp-and-bottle-speed
Phase: P02-boss-concurrent-spawns
Task: T04-par-time-remeasure

- Update wave 3, 5 and 7 parTimeSec from 30-game bot measurements
- Record the measurement and keep the ranking ruleset at v5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 측정 스크립트는 수정 없이 새 보스 흐름에서 동작했다(3판 시험 후 30판 측정). 정확 봇 합산 3웨이브 34초, 5웨이브 38초, 7웨이브 45초.
