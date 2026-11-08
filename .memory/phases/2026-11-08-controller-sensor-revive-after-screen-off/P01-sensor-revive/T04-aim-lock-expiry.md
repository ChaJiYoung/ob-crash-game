# Task: T04 조준 잠금 자동 만료

## Status: pending

## Goal
스킬 발동 시 걸리는 조준 잠금(`lockAim`)이 해제 타이머(`setTimeout`)가 취소·정지되더라도 `AIM_LOCK_MAX_MS` 뒤에는 저절로 풀리게 한다.

## Decision Summary
- D08. 시간 인자는 선택값이다. 생략하면 만료되지 않아 기존 테스트(`tests/gameplay-polish.test.ts`, `tests/controller-sensors.test.ts`)가 그대로 통과해야 한다.
- 만료 시간 600ms는 정상 동결(350ms, `MobileControllerPage.tsx`의 `snapFreezeTimerRef`)보다 길다. 정상 흐름에서는 타이머가 먼저 풀어서 만료가 개입하지 않는다.
- `getEffectiveAim`의 3번째 인자 `timestampMs`는 안정화 필터(1€ Filter)용이라 만료 판정에 쓰지 않는다(필터 동작이 바뀌는 것을 막기 위해 별도 메서드 `expireAimLock`을 쓴다).

## Implementation

### I01. GunGripTracker 만료 로직

- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker.lockAim`, `unlockAim`, `calibrateZero`, 신규 `expireAimLock`, 상수 `AIM_LOCK_MAX_MS` — 만료 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 조준 잠금이 이 시간(ms)을 넘기면 자동 해제한다. 정상 동결(350ms)보다 길어야 한다. */
  export const AIM_LOCK_MAX_MS = 600;

  private lockedAtMs: number | null = null;

  public lockAim(sample: EulerOrientation, nowMs?: number): AimResult;
  /** 잠금이 AIM_LOCK_MAX_MS를 넘겼으면 해제하고 true를 돌려준다. */
  public expireAimLock(nowMs: number, maxMs: number = AIM_LOCK_MAX_MS): boolean;
  ```
- **Data & Schema Fields**: `lockedAtMs: number | null` — `nowMs`를 넘기지 않으면 `null`(만료 없음).
- **Execution Flow / Logic**:
  1. `lockAim`: 기존처럼 `lockedAim = computeAim(sample)` 후 `lockedAtMs = nowMs ?? null`. 반환값은 그대로.
  2. `unlockAim`: `lockedAim = null; lockedAtMs = null;`.
  3. `calibrateZero`: 기존 `this.lockedAim = null` 옆에서 `lockedAtMs = null`도 함께 초기화한다.
  4. `expireAimLock(nowMs, maxMs)`: `lockedAim === null` 또는 `lockedAtMs === null`이면 `false`. `nowMs - lockedAtMs > maxMs`이면 `unlockAim()` 후 `true`. 아니면 `false`. 시계가 역행해 음수여도 만료하지 않는다.
  5. `isAimLocked()`와 `getEffectiveAim()`은 수정하지 않는다.

### I02. 폰 컨트롤러 호출

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `flushSensorFrame`, 스냅 처리부(`tracker.lockAim(...)` 호출) — 만료 호출과 시각 전달; modify

#### Details
- `tracker.lockAim(latestOrientationRef.current)` → `tracker.lockAim(latestOrientationRef.current, performance.now())`.
- `flushSensorFrame` 안에서 `tracker.getEffectiveAim(...)` 호출 **직전**에 `tracker.expireAimLock(performance.now());`을 호출한다. (프레임 전송이 60Hz로 도므로 만료 확인도 그 주기로 일어난다.)
- 기존 `setTimeout(unlockAim, 350)`은 그대로 둔다(정상 경로).

### I03. 단위 테스트

- Related Files:
  - `tests/controller-sensors.test.ts` :: `describe('GunGripTracker & UnifiedTouchPadController')` 안에 케이스 추가 — 테스트; modify

#### Details
- 기존 테스트가 쓰는 자세 샘플 패턴(예: `zeroPose`, `targetPose`, `violentRecoilPose`)을 재사용한다.
- 케이스 1: `lockAim(pose, 1000)` 후 `expireAimLock(1000 + AIM_LOCK_MAX_MS)` → `false`(경계 포함), `isAimLocked()` true. `expireAimLock(1000 + AIM_LOCK_MAX_MS + 1)` → `true`, `isAimLocked()` false.
- 케이스 2: `lockAim(pose)`(시각 없음) 후 `expireAimLock(999999)` → `false`, 여전히 잠김. (하위 호환)
- 케이스 3: `lockAim(pose, 1000)` 후 `unlockAim()` → `expireAimLock(...)`은 `false`.
- 케이스 4: 만료 후 `getEffectiveAim`이 잠금값이 아니라 현재 자세 기준 조준을 돌려준다.
- 케이스 5: `lockAim(pose, 1000)` 후 `calibrateZero(pose)` → `lockedAtMs`도 초기화되어 이후 `expireAimLock`이 `false`.

## Acceptance Criteria
- [ ] 시각을 넘긴 잠금은 `AIM_LOCK_MAX_MS` 초과 시 `expireAimLock`으로 해제된다.
- [ ] 시각 없이 건 잠금은 만료되지 않는다.
- [ ] 기존 `gameplay-polish`, `controller-sensors` 테스트가 수정 없이 통과한다.
- [ ] 폰 컨트롤러가 스킬 잠금 시 `performance.now()`를 넘기고, 프레임 전송 전에 `expireAimLock`을 호출한다.

## Validation
- `npx vitest run tests/controller-sensors.test.ts tests/gameplay-polish.test.ts tests/mobile-sensor-stabilizer.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
fix(controller): 조준 잠금 자동 만료 추가

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P01-sensor-revive
Task: T04-aim-lock-expiry

- GunGripTracker에 lockedAtMs, expireAimLock, AIM_LOCK_MAX_MS(600ms) 추가
- lockAim의 시각 인자는 선택값이라 기존 호출은 만료 없이 동작
- 폰 컨트롤러가 잠글 때 시각을 넘기고 프레임 전송 전에 만료 확인
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
