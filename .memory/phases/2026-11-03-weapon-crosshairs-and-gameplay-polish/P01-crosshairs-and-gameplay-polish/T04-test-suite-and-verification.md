# Task: T04 Test Suite & Regression Verification

## Status: done

## Goal
신규 구현된 무기별 히트 판정 범위(조준경 1:1 동기화), 보상 카드 0.8초 면역 딜레이, 피버 즉시 탄창 완충 로직에 대한 단위/통합 테스트를 작성하고 전체 테스트 스위트의 무오류(100% PASS)를 검증한다.

## Decision Summary
- `src/tests/WeaponCrosshairHitDetection.test.ts` 및 `src/tests/GameplayPolish.test.ts`를 신규 작성하여 무기별 판정 허용 배율, 카드 사격 무시 시간, 피버 탄창 완충 동작을 정밀 검증한다.

## Implementation

### I01. Weapon Hit Detection Unit Tests
- Related Files:
  - `src/tests/WeaponCrosshairHitDetection.test.ts` :: `WeaponHitDetectionSuite` — 무기별 판정 배율 테스트; new

#### Details
- **Test Cases**:
  1. **샷건 탄착군 명중 검증**: 타겟과의 거리가 기본 `apparentHitRadius`의 1.35배일 때, 샷건(`weaponKind = 'shotgun'`)으로 사격 시 유효타(GREAT/GOOD)로 적중하고 `MISS`가 발생하지 않음을 검증.
  2. **리볼버 정밀도 검증**: 동일한 1.35배 거리에서 리볼버(`weaponKind = 'revolver'`)로 사격 시 정밀 조준 미달로 `MISS`가 뜸을 검증.
  3. **리볼버 수직 관통 축 검증**: 수직 방향 오차(`dy`)가 있을 때 수직 보정 계수(`0.70`)로 인해 세로 방향 관통 샷이 적중함을 검증.
  4. **개틀링 연사 스프레드 검증**: 1.15배 거리에서 개틀링(`weaponKind = 'gatling'`) 사격 시 적중함을 검증.

### I02. Gameplay Polish Unit Tests
- Related Files:
  - `src/tests/GameplayPolish.test.ts` :: `GameplayPolishSuite` — 카드 딜레이 및 피버 리필 테스트; new

#### Details
- **Test Cases**:
  1. **보상 카드 면역 딜레이**: 카드 스폰 후 300ms 시점에 사격 시 `grade: 'MISS'`로 처리되고 카드가 사라지지 않으며, 900ms 시점에 사격 시 카드가 정상 선택됨을 검증.
  2. **피버 즉시 탄창 리필**: 탄창이 0발이고 `isReloading = true`인 상태에서 피버가 발동되면, `weaponSystem.refillAmmoOnFever()`에 의해 즉시 잔탄이 `maxAmmo`로 채워지고 `isReloading = false`가 됨을 검증.

## Acceptance Criteria
- [ ] 신규 작성된 모든 단위 테스트가 통과한다.
- [ ] 기존 67개 Vitest 단위 테스트가 1개도 깨지지 않고 100% 통과한다.
- [ ] `npx tsc --noEmit` 검사 시 타입 오류가 0개다.

## Validation
- `npx tsc --noEmit`
- `npx vitest run src/tests/WeaponCrosshairHitDetection.test.ts`
- `npx vitest run src/tests/GameplayPolish.test.ts`
- `npx vitest run`

## Commit Message
```text
test(polish): add unit tests for weapon crosshair hit detection, reward card grace period and fever refill

Plan: 2026-11-03-weapon-crosshairs-and-gameplay-polish
Phase: P01-crosshairs-and-gameplay-polish
Task: T04-test-suite-and-verification

- Verify shotgun 1.55x and gatling 1.25x hit tolerance vs revolver 0.95x precision
- Verify reward card 800ms shoot immunity
- Verify instant ammo refill and reload cancel on fever
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
