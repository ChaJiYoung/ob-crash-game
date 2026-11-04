# Task: T02 Weapon Specs, Hit Tolerance & Engine Wiring

## Status: done

## Goal
`BeerCrusherEngine.ts`에서 개틀링 사격 적중 시 `scoreMultiplier: 0.5` 및 `feverMultiplier: 0.33`을 `ScoreAndFeverManager`에 전달하도록 연동하고, 개틀링의 에임 관용도(`weaponHitToleranceMult`)를 `1.25배`에서 `1.05배`로 현실화하여 무지성 난사를 억제하며, 기존 회귀 테스트 및 신규 밸런스 비교 테스트를 통과시킵니다.

## Decision Summary
- [D01/D02/D03] 개틀링 장착 시 점수 0.5배, 피버 0.33배 배율 적용. 리볼버 및 샷건은 기존 1.0배 유지.
- [D04] 개틀링 `weaponHitToleranceMult`를 `1.25` -> `1.05`로 축소.
- 회귀 방지: `tests/weapon-crosshair-hit-detection.test.ts`의 개틀링 tolerance 테스트 단언(기존 1.15x offset)을 신규 1.05x tolerance에 맞게 정렬(1.02x offset은 HIT, 1.12x offset은 MISS).

## Implementation

### I01. `BeerCrusherEngine.ts` 사격 처리 로직 수정
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAt` — 개틀링 히트박스 tolerance 및 registerHit 배율 전달 연동; modify

#### Details
- **Tolerance 배율 변경**:
  ```typescript
  // Around line 1238
  const weaponHitToleranceMult =
    weaponKind === 'shotgun' ? 1.55 :
    weaponKind === 'gatling' ? 1.05 : // 1.25 -> 1.05
    0.95; // revolver
  ```
- **HitScoreOptions 전달**:
  ```typescript
  // Around line 1457
  const scoreMultiplier = weaponKind === 'gatling' ? 0.5 : 1.0;
  const feverMultiplier = weaponKind === 'gatling' ? 0.33 : 1.0;

  const hitInfo = this.scoreManager.registerHit(
    result.grade as Exclude<JudgmentGrade, 'MISS'>,
    killed ? target.killBonusScore : 0,
    killed,
    { scoreMultiplier, feverMultiplier }
  );
  ```

### I02. 테스트 업데이트 및 신규 밸런스 비교 테스트
- Related Files:
  - `tests/weapon-crosshair-hit-detection.test.ts` — 개틀링 1.05x 관용도 단언 업데이트; modify
  - `tests/gatling-balance.test.ts` — 개틀링 vs 리볼버 점수 및 피버 충전율 비교 검증; new

#### Details
- `tests/weapon-crosshair-hit-detection.test.ts`:
  - `1.02x` apparentHitRadius 오프셋 사격 -> HIT 통과
  - `1.12x` apparentHitRadius 오프셋 사격 -> MISS 통과 (과거 1.25x 시절에는 맞았으나 이제 1.05x로 엄격해져 빗나감 검증)
- `tests/gatling-balance.test.ts`:
  - 동일한 타겟(HP 1) 4발 사격 시:
    - 리볼버: 1발당 PERFECT 150점 + 피버 8 델타
    - 개틀링: 1발당 PERFECT 75점(0.5배) + 피버 3 델타(0.33배)
  - 개틀링이 18발 전탄을 맞춰도 피버가 비정상적으로 과충전되지 않음을 수학적으로 입증.

## Acceptance Criteria
- [ ] 개틀링 장착 후 사격 시 판정 점수가 일반 무기 대비 50%로 누적됨.
- [ ] 개틀링 적중 시 피버 게이지 상승량이 1/3(0.33배)로 제한됨.
- [ ] 개틀링의 에임 관용도가 1.05배로 정밀화되어 1.10배 이상 벗어난 사격은 MISS 처리됨.
- [ ] 리볼버와 샷건은 기존 1.0배 점수/피버 및 고유 관용도(0.95x, 1.55x)를 온전히 유지함.
- [ ] `npm test` 전체 100% 통과.

## Validation
- `npx vitest run tests/weapon-crosshair-hit-detection.test.ts` — 히트박스 정밀도 검증 통과
- `npx vitest run tests/gatling-balance.test.ts` — 개틀링 밸런스 비교 검증 통과
- `npm test` — 전체 테스트 통과
- `npx tsc --noEmit` — 컴파일 0 오류 통과

## Commit Message
```text
feat(balance): tune gatling hit tolerance to 1.05x and apply score/fever multipliers

Plan: 2026-11-04-gatling-balance
Phase: P01-engine-balance-core
Task: T02-weapon-specs-and-engine-wiring

- tighten gatling weaponHitToleranceMult from 1.25 to 1.05
- pass weapon-specific scoreMultiplier (0.5x) and feverMultiplier (0.33x) to ScoreAndFeverManager
- align crosshair hit detection unit test to new 1.05x boundary
- add comprehensive balance comparison tests between gatling and revolver
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
