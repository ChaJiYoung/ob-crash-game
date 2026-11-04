# Task: T02 Remove Intercept Banner

## Status: pending

## Goal
계속 떠 있던 INTERCEPTED 배너를 없애고, 요격한 투사체를 몬스터처럼 터뜨린다.

## Decision Summary
- D01: 배너를 제거하고 파티클 폭발로 피드백을 준다. 요격음과 점수는 유지한다.
- 배너가 남던 원인은 리셋 코드가 없고 `@keyframes fadeUp`도 정의되지 않은 것이다. 배너를 없애므로 둘 다 추가하지 않는다.

## Implementation

### I01. 배너 제거

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `interceptedBannerKey`, `handleShootEvent`, 배너 JSX — 삭제; modify

#### Details
- `const [interceptedBannerKey, setInterceptedBannerKey] = useState<number>(0);`를 지운다.
- `handleShootEvent`에서 `setInterceptedBannerKey(Date.now());`를 지우고 `soundSynth.playInterceptSound();`는 유지한다.
- `{/* Projectile Intercepted Arcade Floating Banner */}` 블록 전체를 지운다.

### I02. 투사체 폭발

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `playShotFx`, `resolveHitFxColor` — 투사체 색상과 효과음; modify
  - `tests/three-stage-and-models.test.ts` — 색상 함수 검증; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function resolveHitFxColor(target: ActiveTargetEntity): string {
    if (target.isProjectile) return '#f87171';
    if (target.isItem && target.itemKind) return ITEM_BUFF_SPECS[target.itemKind].auraColorHex;
    return TARGET_SPECS[target.kind]?.brandColorHex || '#fbbf24';
  }
  ```
- **Execution Flow / Logic**:
  1. `playShotFx`의 `hitColor` 계산을 이 함수로 교체한다.
  2. 처치 분기에서 투사체를 먼저 처리한다.
     ```typescript
     if (result.killed) {
       if (result.target.isProjectile) {
         particlesRef.current.spawnHitEffect(targetPos, hitColor, HIT_PARTICLE_COUNTS.kill);
       } else if (result.target.kind === 'bottle') {
         // 기존 코드
       }
     }
     ```
     투사체의 `kind`가 `'pilgood'`라서, 이 분기가 없으면 캔 찌그러지는 소리가 요격음과 겹친다.
  3. 테스트: 투사체, 아이템, 일반 몬스터 각각의 색상을 확인한다.

### I03. 회귀 방지

- Related Files:
  - `tests/hud-render-cost.test.ts` — 소스 검사 추가; modify

#### Details
- `PCGamePage.tsx`에 `INTERCEPTED`, `interceptedBannerKey`, `fadeUp`이 없는지 확인한다.

## Acceptance Criteria
- [ ] 투사체를 맞히면 배너 없이 터지고 요격음이 들린다.
- [ ] 점수가 그대로 오른다.
- [ ] 화면에 남아 있는 문구가 없다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts tests/hud-render-cost.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
fix(pc): replace intercept banner with a projectile burst

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P02-stage-and-input
Task: T02-remove-intercept-banner

- Remove the INTERCEPTED banner that never disappeared
- Burst intercepted projectiles with particles
- Avoid overlapping can crush and intercept sounds
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
