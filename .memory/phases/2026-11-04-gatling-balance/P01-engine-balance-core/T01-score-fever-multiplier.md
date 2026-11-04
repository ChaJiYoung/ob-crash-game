# Task: T01 Score & Fever Multiplier in ScoreAndFeverManager

## Status: done

## Goal
개틀링과 같이 다단 히트/초고속 연사를 수행하는 무기가 점수와 피버 게이지를 과도하게 독점하는 현상을 방지할 수 있도록, `ScoreAndFeverManager.registerHit`에 `scoreMultiplier` 및 `feverMultiplier` 옵션을 전달받아 정규화된 점수와 게이지를 누적하도록 확장합니다.

## Decision Summary
- [D02/D03] 판정 기본 점수(Base Score)에 `scoreMultiplier`를 적용하고, 킬 보너스 점수(killBonusScore)는 배율 영향 없이 100% 온전히 보존.
- [D02] 타수 피버 델타와 킬 피버 델타에 `feverMultiplier`를 적용하여 반올림 처리 누적. 기존 호출부와 100% 하위 호환 유지(기본값 1.0).

## Implementation

### I01. `ScoreAndFeverManager` 인터페이스 및 계산 로직 확장
- Related Files:
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `HitScoreOptions`, `registerHit` — 옵션 인터페이스 추가 및 배율 계산 적용; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface HitScoreOptions {
    scoreMultiplier?: number;
    feverMultiplier?: number;
  }

  public registerHit(
    grade: Exclude<JudgmentGrade, 'MISS'>,
    killBonusScore = 0,
    killed = false,
    options?: HitScoreOptions
  ): {
    earnedScore: number;
    totalScore: number;
    combo: number;
    maxCombo: number;
    feverGauge: number;
    isFeverReady: boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. `const scoreMult = options?.scoreMultiplier ?? 1.0;`
  2. `const feverMult = options?.feverMultiplier ?? 1.0;`
  3. `const earnedScore = Math.round(spec.baseScore * mult * feverBonusMult * scoreMult) + killBonusScore;`
  4. 피버 계산:
     ```typescript
     if (!this.isFeverActive) {
       const baseFeverDelta = Math.round(spec.feverDelta * feverMult);
       const killFeverDelta = killed ? Math.round(FEVER_CONSTANTS.KILL_FEVER_DELTA * feverMult) : 0;
       const delta = baseFeverDelta + killFeverDelta;
       this.feverGauge = Math.min(FEVER_CONSTANTS.MAX_GAUGE, this.feverGauge + delta);
       if (this.feverGauge >= FEVER_CONSTANTS.MAX_GAUGE) {
         this.feverGauge = FEVER_CONSTANTS.MAX_GAUGE;
         this.isFeverReady = true;
       }
     }
     ```

### I02. 단위 테스트 검증
- Related Files:
  - `tests/score-fever-multiplier.test.ts` :: `describe('ScoreAndFeverManager Multipliers')` — 신규 단위 테스트; new

#### Details
- 테스트 시나리오:
  1. `options` 미전달 시 기존과 동일하게 기본 점수(150 for PERFECT) 및 피버(8 delta) 누적 확인 (하위 호환성 검증).
  2. `scoreMultiplier: 0.5` 전달 시 PERFECT 기본 점수 150 -> 75점 획득 확인.
  3. `feverMultiplier: 0.33` 전달 시 PERFECT 기본 피버 8 -> `Math.round(8 * 0.33) = 3` 누적 확인.
  4. 킬 동반 시 킬 보너스 점수(예: 100점)는 배율 영향 없이 `75 + 100 = 175점` 정상 합산 확인.

## Acceptance Criteria
- [ ] `registerHit`에 `options` 미전달 시 기존 모든 테스트와 동작이 100% 동일함.
- [ ] `scoreMultiplier: 0.5` 적용 시 판정 기본 점수만 50%로 계산됨.
- [ ] `feverMultiplier: 0.33` 적용 시 피버 델타가 1/3로 계산됨.
- [ ] `npx vitest run tests/score-fever-multiplier.test.ts` 성공.

## Validation
- `npx vitest run tests/score-fever-multiplier.test.ts` — 신규 배율 기능 테스트 통과
- `npm test` — 기존 13개 전체 테스트 회귀 없음 확인

## Commit Message
```text
feat(score): add score and fever multiplier options to ScoreAndFeverManager

Plan: 2026-11-04-gatling-balance
Phase: P01-engine-balance-core
Task: T01-score-fever-multiplier

- add HitScoreOptions interface with scoreMultiplier and feverMultiplier
- apply multipliers to base score calculation and fever delta accumulation
- preserve killBonusScore without scoreMultiplier penalty
- add comprehensive unit tests for multiplier behavior
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
