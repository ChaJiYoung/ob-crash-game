# Task 01: 모바일 에임 연속 가변 스무딩 곡선, 스냅 임계값 상향(`4.8 m/s²`) 및 카운트다운/시작 1.5초 스냅 가드 구현

- **Status**: done
- **Phase**: `P01-aim-sync-and-start-flow`
- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`

## Goal
모바일 컨트롤러의 `GunGripTracker`에서 `delta > 0.15`일 때 `smoothingAlpha`를 즉시 `1.0`으로 점프시키던 불연속 분기를 연속 속도 비례 곡선으로 교체하고, 스킬 스냅 가속도 임계값을 `4.8 m/s²`로 상향하며, 카운트다운 중 및 게임 시작/영점 조절 직후 1.5초 동안 스냅 스킬 트리거를 원천 차단한다.

## Decision Summary
- **D01 (`2026-11-04-aim-sync-and-start-flow-fix.md`)**: `GunGripTracker.extractAimSample`의 `delta > 0.15 ? 1.0 : smoothingAlpha` 계단 함수를 제거하고, 이동량(`delta`)에 비례해 `smoothingAlpha`에서 `1.0`으로 매끄럽게 증가하는 연속 가변 알파 곡선(`computeAdaptiveSmoothingAlpha`)을 적용한다.
- **D04 (`2026-11-04-aim-sync-and-start-flow-fix.md`)**: `WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2`를 기존 `2.2`에서 `4.8`로 상향하고, 모바일 컨트롤러(`MobileControllerPage.tsx`)에서 카운트다운 진행 중(`countdownSec !== null`) 및 카운트다운 종료/게임 시작/영점 조절 직후 `1500ms` 유예 시간(`snapGraceUntilMsRef`) 동안 `skillSnapTriggered`가 `false`가 되도록 강제한다.

## Implementation
- [x] **I01**: `src/shared/constants.ts`의 `WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2` 상수를 `4.8`로 변경하고, 유예 시간 상수 `SNAP_GRACE_PERIOD_MS: 1500`을 추가한다.
- [x] **I02**: `src/controller/sensors/GunGripTracker.ts`에 `computeAdaptiveSmoothingAlpha(baseAlpha: number, delta: number, hasSmoothedSample: boolean): number`를 구현하여 미세 떨림 구간(`delta <= 0.03`)은 `baseAlpha`를 유지하고, 중·고속 이동 구간(`0.03 < delta < 0.35`)은 선형/부드러운 비율(`t = (delta - 0.03) / (0.35 - 0.03)`)로 `baseAlpha`에서 `1.0`까지 연속 증가하도록 교체한다.
- [x] **I03**: `src/controller/MobileControllerPage.tsx`에 `snapGraceUntilMsRef`와 `countdownSecRef`를 추가하여 카운트다운 중이거나 카운트다운 종료/게임 시작/영점 조절 후 `1500ms` 이내일 때 `skillSnapTriggered`를 `false`로 차단한다.
- [x] **I04**: `tests/shared-protocol.test.ts` 및 `tests/controller-sensors.test.ts`의 스냅 가속도 임계값 테스트와 연속 가변 알파 곡선 검증 테스트를 업데이트한다.

## Related Files
- `src/shared/constants.ts` (modify)
- `src/controller/sensors/GunGripTracker.ts` (modify)
- `src/controller/MobileControllerPage.tsx` (modify)
- `tests/shared-protocol.test.ts` (modify)
- `tests/controller-sensors.test.ts` (modify)

## Signatures & Types
```typescript
// src/shared/constants.ts
export const WEAPON_CONSTANTS = {
  RELOAD_GESTURE_ACCEL_THRESHOLD: 18,
  RELOAD_COOLDOWN_MS: 850,
  PUMP_THRESHOLD_ACCEL: 15,
  SKILL_SHAKE_THRESHOLD: 22,
  SNAP_ACCEL_THRESHOLD_MPS2: 4.8,
  SNAP_GRACE_PERIOD_MS: 1500,
  SNAP_COOLDOWN_MS: 1200,
} as const;

// src/controller/sensors/GunGripTracker.ts
export function computeAdaptiveSmoothingAlpha(
  baseAlpha: number,
  delta: number,
  hasSmoothedSample: boolean
): number;
```

## Data & Schema Fields
- `WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2`: `4.8` (number) - 중력 제거 선형 가속도 스냅 임계값 (`m/s²`)
- `WEAPON_CONSTANTS.SNAP_GRACE_PERIOD_MS`: `1500` (number) - 시작/카운트다운/영점 조절 직후 스냅 스킬 잠금 유예 시간 (`ms`)

## Execution Flow / Logic
1. `computeAdaptiveSmoothingAlpha(baseAlpha, delta, hasSmoothedSample)`:
   - `!hasSmoothedSample` 또는 `baseAlpha >= 1.0`이면 `1.0` 반환.
   - `const clampedBase = Math.max(0.05, Math.min(1.0, baseAlpha));`
   - `const lowerKnee = 0.03;` (미세 손떨림 상한)
   - `const upperKnee = 0.35;` (고속 플릭 포화점)
   - `delta <= lowerKnee`이면 `clampedBase` 반환.
   - `delta >= upperKnee`이면 `1.0` 반환.
   - 그 사이 구간에서는 `const ratio = (delta - lowerKnee) / (upperKnee - lowerKnee);`를 계산하여 `clampedBase + (1.0 - clampedBase) * ratio`를 반환한다.
   - 이를 통해 `delta = 0.02`, `baseAlpha = 0.5`일 때 기존처럼 `0.01` 변화량(`< 0.025`)으로 미세 떨림을 억제하고, `delta = 0.14`~`0.16` 경계에서도 계단 점프 없이 연속적으로 반응성이 높아지며, `delta = 0.6` 플릭에서는 즉시 따라붙는다.
2. `MobileControllerPage.tsx`:
   - `countdownSecRef.current = countdownSec;` 동기화.
   - `START_COUNTDOWN` 수신 시 및 `countdownSec`가 `0` 이하로 내려가 카운트다운이 끝나는 시점, `GAME_START_CMD` 송신 시점, `handleZeroCalibration()` 실행 시점에 `snapGraceUntilMsRef.current = performance.now() + WEAPON_CONSTANTS.SNAP_GRACE_PERIOD_MS;`를 설정하고 `trackerRef.current.resetSnapBaseline()`을 호출한다.
   - 60Hz `SENSOR_RELAY` 전송 루프에서 `const isSnapAllowed = countdownSecRef.current === null && now >= snapGraceUntilMsRef.current;`를 평가하여 `skillSnapTriggered: isSnapAllowed ? sample.skillSnapTriggered : false`로 전송한다.

## Acceptance Criteria
- `WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2`가 `4.8`로 설정되어 일반적인 폰 파지 고쳐잡기(`2.2 ~ 3.5 m/s²`)에서 `skillSnapTriggered`가 발생하지 않는다.
- `computeAdaptiveSmoothingAlpha`가 `delta = 0.14`와 `delta = 0.16` 사이에서 불연속 점프 없이 연속적인 값을 반환한다.
- `tests/shared-protocol.test.ts` 및 `tests/controller-sensors.test.ts`가 모두 통과한다.

## Validation
```bash
npx vitest run tests/shared-protocol.test.ts tests/controller-sensors.test.ts
```

## Commit Message
```text
fix(controller): apply continuous adaptive aim smoothing and guard skill snap

Plan: 2026-11-04-aim-sync-and-render-optimization
Phase: P01
Task: T01
```

## Progress
- 2026-11-04: I01~I04 구현 완료. `SNAP_ACCEL_THRESHOLD_MPS2` 4.8 m/s² 상향, `SNAP_GRACE_PERIOD_MS` 1500ms 도입, `computeAdaptiveSmoothingAlpha` 연속 곡선 구현, 모바일 카운트다운/시작 직후 스냅 잠금 가드 적용 및 vitest 17개 테스트 통과.
