# Task: T02 보스 무기별 배율 1.0

## Status: pending

## Goal
보스에게 주는 일반 공격 대미지의 무기별 배율을 전 무기 1.0으로 만든다. 필드와 `bossScale` 코드 경로는 남겨 나중에 다시 조정할 수 있게 한다.

## Decision Summary
- D05: 값만 변경. 보스 체력·스킬 보스 대미지(`skillBossDamage`)는 건드리지 않는다. 랭킹 규칙 버전(5)은 올리지 않는다(current.md 지침).

## Implementation

### I01. 값 변경
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss.damageScaleByWeapon` — modify
#### Details
- 현재: `damageScaleByWeapon: { shotgun: 0.7, revolver: 0.8, gatling: 2.2 },`
- 변경: `damageScaleByWeapon: { shotgun: 1, revolver: 1, gatling: 1 },`
- 주석 갱신: "무기별 보스 피해 배율. 지금은 모두 1(조정 필요 시 무기별로 다시 나눈다)."
- 함정: `BeerCrusherEngine.ts`의 `bossScale` 계산(`target.kind === 'boss' ? ... : 1.0`)은 그대로 둔다.

### I02. 테스트와 영향 확인
- Related Files:
  - `tests/game-tuning.test.ts` — modify
  - `tests/boss-encounters.test.ts`, `tests/gatling-balance.test.ts` — read-only 확인, 깨지면 modify
#### Details
- `game-tuning.test.ts`에 케이스 추가: 세 무기 모두 `GAME_TUNING.boss.damageScaleByWeapon[kind]`가 1.
- 보스 대미지 수치를 직접 가정한 기존 테스트가 있으면, 기대값을 새 배율(1.0)에 맞게 고친다(고친 내용을 커밋 본문에 적는다).
- 전체 `npx vitest run`과 `npx tsc --noEmit`으로 회귀가 없는지 본다.

## Acceptance Criteria
- [ ] 세 무기의 보스 배율이 모두 1
- [ ] 전체 테스트와 타입 검사 통과

## Validation
- `npx vitest run` — 전부 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
tune(boss): set per-weapon boss damage scale to 1.0

Plan: 2026-11-07-fever-damage-multiplier
Phase: P01-fever-and-boss-scale
Task: T02-boss-scale

- boss.damageScaleByWeapon: shotgun 0.7 -> 1, revolver 0.8 -> 1, gatling 2.2 -> 1
- Test pins the values; boss HP and skill boss damage unchanged

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
