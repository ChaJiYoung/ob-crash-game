# Task: T01 보스 체력과 작은 병 속도 수치

## Status: done

## Goal
3·5·7웨이브 보스가 100 / 120×2 / 150×2 + 대왕 250 체력으로 등장하고, 분해된 작은 카스 병이 3.0 m/s로 달려온다. 값은 `gameTuning.ts` 한 곳에서만 바뀌고 테스트가 새 값을 고정한다.

## Decision Summary
- 결정 D01, D02. 보스 체력은 `GAME_TUNING.waves[].boss`가 단일 출처다. `constants.ts`의 `TARGET_SPECS.boss.maxHp: 60`은 쓰이지 않는 기본값이라 건드리지 않는다(범위 밖).
- 값만 바꾸는 Task라 코드 로직 변경은 없다. 하지만 하드코딩된 기대값이 있는 테스트와 문서가 같이 깨지므로 한 Task로 묶는다.

## Implementation

### I01. 수치 변경
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves[2|4|6].boss`, `GAME_TUNING.monsters.bottle.childSpeedMps`; modify

#### Details
- **Data & Schema Fields** (타입·키 이름은 그대로, 숫자만 변경):
  - 3웨이브(`waveIndex: 3`): `coolerHp: [75]` → `[100]`, `kingHp: null` 유지
  - 5웨이브(`waveIndex: 5`): `coolerHp: [70, 70]` → `[120, 120]`, `kingHp: null` 유지
  - 7웨이브(`waveIndex: 7`): `coolerHp: [90, 90]` → `[150, 150]`, `kingHp: 200` → `250`
  - `monsters.bottle.childSpeedMps: 2.2` → `3.0`
- 건드리지 않는 것: `TARGET_SPECS.bottle.speedMps`(2.0, 원본 병), `parTimeSec`(P02-T03에서 재측정), `RANKING_RULESET_VERSION`(5 유지).
- 함정 1: 작은 병 실제 속도는 `childSpeedMps * getWaveSpeedMultiplier()`다(`splitBottle`). 웨이브 4에서는 `1 + 0.08 × (wave-1)` 배율이 곱해지므로 테스트는 배율 1일 때만 `toBeCloseTo(3.0)`을 쓴다(기존 테스트가 `cfg.childSpeedMps * 1`을 쓴다).
- 함정 2: 보스 체력을 바꾸면 `docs`·`GuideModal`의 숫자 문구는 P02-T02에서 한꺼번에 맞춘다. 이 Task에서 docs-sync 테스트가 깨지면 그 이유가 체력 문구인지 확인하고, 깨지는 테스트가 있으면 P02-T02로 미루지 말고 이 Task에서 해당 기대값만 고친다.

### I02. 테스트 갱신
- Related Files:
  - `tests/boss-hp-summons.test.ts` :: `has the tuned thresholds and the new boss HP` (35~38행); modify
  - `tests/monster-traits.test.ts` :: `splits into two small bottles...` (266행 부근); modify

#### Details
- `tests/boss-hp-summons.test.ts`: `hp(3).coolerHp` → `[100]`, `hp(5).coolerHp` → `[120, 120]`, `hp(7).coolerHp` → `[150, 150]`, `hp(7).kingHp` → `250`. `RANKING_RULESET_VERSION`이 5인지 확인하는 줄은 그대로 둔다.
- `tests/monster-traits.test.ts`: `GAME_TUNING.monsters.bottle.childSpeedMps`가 `3.0`이고 원본 병 `TARGET_SPECS.bottle.speedMps`(2.0)보다 큼을 `expect`로 추가한다. 기존 `toBeCloseTo(cfg.childSpeedMps * 1, 5)`는 유지한다.
- 다른 테스트(`boss-encounters`, `boss-model-roles`)는 `GAME_TUNING` 값을 참조하므로 그대로 통과해야 한다.

## Acceptance Criteria
- [x] `GAME_TUNING.waves`의 보스 체력이 100 / [120,120] / [150,150]+250이다.
- [x] `childSpeedMps`가 3.0이고 `RANKING_RULESET_VERSION`은 5다.
- [x] 위 두 테스트 파일이 새 값을 기준으로 통과한다.

## Validation
- `npx vitest run tests/boss-hp-summons.test.ts tests/monster-traits.test.ts tests/boss-encounters.test.ts tests/boss-model-roles.test.ts tests/game-tuning.test.ts` — 모두 통과
- `npm test && npx tsc --noEmit` — 전체 통과 (문서 문구 때문에 `docs-sync`가 실패하면 원인을 확인해 이 Task에서 해당 기대값만 고친다)

## Commit Message
```text
tune(boss): raise boss HP and speed up split cass bottles

Plan: 2026-11-06-boss-hp-and-bottle-speed
Phase: P01-tuning-values
Task: T01-hp-and-speed-values

- Boss HP: wave 3 100, wave 5 120x2, wave 7 150x2 + king 250
- Split bottle childSpeedMps 2.2 -> 3.0
- Update tests that pin the old values

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
