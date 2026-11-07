# Task: T01 피버 대미지 배율

## Status: pending

## Goal
피버 중 명중의 `damageMultiplier`가 GREAT 배율(1.0) 대신 `GAME_TUNING.judgment.feverDamage`(2.0)가 되게 한다. 판정 등급(GREAT)·점수·피버 충전(0)은 그대로다.

## Decision Summary
- D02·D03: 모든 무기 공통 단일 값. 파워샷(×2.0)·무기 보너스 등 다른 곱셈은 건드리지 않는다.

## Implementation

### I01. 튜닝 값 추가
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.judgment` — modify
#### Details
- 현재: `judgment: { perfectDamage: 2.0, greatDamage: 1.0, goodDamage: 0.5 },`
- 변경: `judgment: { perfectDamage: 2.0, greatDamage: 1.0, goodDamage: 0.5, feverDamage: 2.0 },`
- 위에 한 줄 주석: 피버 중 모든 명중에 쓰는 판정 배율(PERFECT 대신 GREAT로 고정되던 것을 보상).

### I02. 피버 분기에서 사용
- Related Files:
  - `src/pc/engine/HitJudgment.ts` :: `evaluateHitJudgment` — modify
#### Details
- import 추가: `import { GAME_TUNING } from '../../shared/gameTuning';`
- 피버 분기(`if (isFeverActive) { if (errorRatio <= 1.0) { return {...} } }`)의 `damageMultiplier: JUDGMENT_SPECS.GREAT.damageMultiplier`만 `damageMultiplier: GAME_TUNING.judgment.feverDamage`로 바꾼다. `grade: 'GREAT'`, `baseScore`, `feverDelta: 0`은 유지.
- 함정: MISS 분기(`damageMultiplier: 0`)와 비피버 분기는 건드리지 않는다. 엔진(`BeerCrusherEngine.ts:2113`)은 `result.damageMultiplier`를 그대로 곱하므로 엔진 수정은 필요 없다.

### I03. 테스트 갱신
- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` — modify (피버 케이스, 약 80~84행)
  - `tests/game-tuning.test.ts` — modify
#### Details
- 기존 `expect(feverHit.damageMultiplier).toBe(JUDGMENT_SPECS.GREAT.damageMultiplier);` → `.toBe(GAME_TUNING.judgment.feverDamage)`. 주석의 "at normal damage"도 "at fever damage"로. 파일에 GAME_TUNING import가 없으면 추가.
- `game-tuning.test.ts`에 케이스 추가: `GAME_TUNING.judgment.feverDamage`가 2.0이고, `evaluateHitJudgment(0.05, 1.0, true).damageMultiplier`가 같은 값이며 `.grade`는 `'GREAT'`, `.feverDelta`는 0.

## Acceptance Criteria
- [ ] 피버 중 명중 `damageMultiplier === GAME_TUNING.judgment.feverDamage (2.0)`, 등급은 GREAT
- [ ] 비피버 판정·MISS 결과는 변하지 않음

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts tests/game-tuning.test.ts` — 통과

## Commit Message
```text
tune(fever): fever hits deal PERFECT-level damage

Plan: 2026-11-07-fever-damage-multiplier
Phase: P01-fever-and-boss-scale
Task: T01-fever-damage

- GAME_TUNING.judgment.feverDamage = 2.0; fever hits use it instead of the GREAT multiplier
- Grade, score and fever gain stay GREAT/0; tests updated

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
