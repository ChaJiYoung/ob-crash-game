# Task: T02 아케이드 자석 피격 판정(Hitbox 1.5배 확대) 및 PERFECT/GREAT 등급 오차율 완화

## Status: pending

## Goal
3D 화면상에 투영되는 몬스터 피격 판정(Hitbox)의 투영 배수를 기존 2.8에서 4.2로 1.5배 확장하고, 최소 유효 반경 바닥값을 0.09에서 0.14로 상향하여 24m 원거리 몬스터라도 조준경 링 안에 대략 걸치면 억울하게 빗나가지 않고 자석처럼 시원하게 명중하도록 개선한다. 또한 판정 등급 중 `PERFECT` 오차 범위를 0.15에서 0.25로, `GREAT` 오차 범위를 0.45에서 0.55로 완화하여 호쾌한 아케이드 건슈팅 타격감과 연속 콤보 손맛을 선사한다.

## Decision Summary
- [D03](../../decisions/2026-11-02-rebalance-monster-speed-snap-sensitivity-hitbox.md): 아케이드 자석 피격 판정(Hitbox) 1.5배 확대 및 PERFECT/GREAT 판정 범위 완화

## Implementation

### I01. BeerCrusherEngine 피격 반경 투영 배수 및 최소 바닥값 확장

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine.computeTargetAimCoords` — 투영 배수 2.8 ➔ 4.2배 확대 및 바닥값 0.09 ➔ 0.14 상향; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine` — 확장된 apparentHitRadius 및 유효 피격 판정 테스트; modify

#### Details
- **Execution Flow / Logic (`src/pc/engine/BeerCrusherEngine.ts`)**:
  ```typescript
  public computeTargetAimCoords(
    target: ActiveTargetEntity,
    wideScopeMult = 1.0
  ): TargetAimProjection {
    ...
    // 기존: Math.max(0.09, (target.hitRadiusM * 2.8 * wideScopeMult) / target.radiusM)
    // 개선 (D03): 1.5배 넉넉한 4.2배 투영 배수 및 0.14 최소 바닥값
    const apparentHitRadius = Math.max(0.14, (target.hitRadiusM * 4.2 * wideScopeMult) / target.radiusM);

    return { targetNormX, targetNormY, apparentHitRadius };
  }
  ```

### I02. JUDGMENT_SPECS 판정 등급 오차율 상한 완화

- Related Files:
  - `src/shared/constants.ts` :: `JUDGMENT_SPECS` — `PERFECT` maxErrorRatio 0.15 ➔ 0.25, `GREAT` maxErrorRatio 0.45 ➔ 0.55; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine` — 완화된 오차율에서의 PERFECT/GREAT 판정 유닛 테스트; modify

#### Details
- **Constants (`src/shared/constants.ts`)**:
  ```typescript
  export const JUDGMENT_SPECS: Record<Exclude<JudgmentGrade, 'MISS'>, JudgmentSpec> = {
    PERFECT: {
      maxErrorRatio: 0.25, // 기존 0.15 -> 0.25 (중심 25% 이내면 PERFECT)
      baseScore: 150,
      feverDelta: 30,
      colorHex: '#fbbf24',
    },
    GREAT: {
      maxErrorRatio: 0.55, // 기존 0.45 -> 0.55 (중심 55% 이내면 GREAT)
      baseScore: 100,
      feverDelta: 20,
      colorHex: '#38bdf8',
    },
    GOOD: {
      maxErrorRatio: 1.00, // 유효 반경 전체
      baseScore: 50,
      feverDelta: 10,
      colorHex: '#4ade80',
    },
  };
  ```

## Acceptance Criteria
- [ ] 24m 원거리에 위치한 몬스터라도 조준경 링 근처에 걸친 상태에서 사격하면 `MISS`로 새지 않고 시원하게 명중한다.
- [ ] 조준 오차가 20% 수준이어도 이전과 달리 `PERFECT!` 골드 판정과 사운드가 경쾌하게 출력된다.
- [ ] `tests/engine-judgment-and-spawn.test.ts` 및 전체 테스트 통과.
- [ ] `npm run build` 성공.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 확장된 Hitbox 및 완화된 판정 등급 테스트 통과
- `npx vitest run` — 전체 테스트 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(judgment): expand hitbox projection by 1.5x to 4.2 and relax PERFECT error ratio to 0.25

Plan: 2026-11-02-rebalance-monster-speed-snap-sensitivity-hitbox
Phase: P01-rebalance-speed-sensitivity-and-hitbox
Task: T02-expand-hitbox-projection-and-relax-judgment-tolerance

- Increase apparentHitRadius multiplier from 2.8 to 4.2 with 0.14 floor
- Relax PERFECT maxErrorRatio from 0.15 to 0.25 and GREAT from 0.45 to 0.55
- Ensure arcade-style magnetic bullet feel on distant targets
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
