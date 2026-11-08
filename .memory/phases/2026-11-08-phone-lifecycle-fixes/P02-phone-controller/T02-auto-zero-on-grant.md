# Task: T02 센서 권한 허용 직후 자동 영점

## Status: pending

## Goal
로비에서 폰의 초록 버튼(센서 권한 허용)을 누르면, 첫 센서 이벤트가 온 직후(최대 1초 대기) 폰이 `CALIBRATE_ZERO`를 PC에 보내서 PC 로비의 조준경이 뜨고 시작 준비 상태가 된다. 영점 버튼을 한 번 더 누를 필요가 없다.

## Decision Summary
- auto-zero-on-permission-grant D02, D03, D04. PC 코드는 건드리지 않는다. PC는 `ZERO_CALIBRATED`를 받으면 `isZeroCalibrated`를 켜고 조준경을 띄운다(`PCGamePage.tsx`의 `case 'ZERO_CALIBRATED'`, 로비 조준경 조건 `slots.some(mobile && isZeroCalibrated)`).
- 허용 직후에는 센서 이벤트가 아직 없어 `latestOrientationRef`가 (0,0,0)이다. 첫 `deviceorientation`을 받은 뒤 영점을 잡는다. 1초 안에 이벤트가 없으면(센서 없는 환경) 그대로 진행한다.

## Implementation

### I01. 자동 영점 보류 플래그와 실행 함수

- Related Files:
  - `src/shared/controllerLifecycle.ts` :: `CONTROLLER_LIFECYCLE` — `AUTO_ZERO_FALLBACK_MS` 추가; modify
  - `src/controller/MobileControllerPage.tsx` :: `handlePermissionGranted`, 센서 effect의 `onOrientation`, `handleCalibrateZero`(영점 처리) — 자동 영점 연결; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // CONTROLLER_LIFECYCLE에 추가
  /** 센서 권한 허용 뒤 첫 센서 이벤트를 기다리는 최대 시간(ms). 지나면 그대로 영점을 보낸다. */
  AUTO_ZERO_FALLBACK_MS: 1000,

  const autoZeroPendingRef = useRef<boolean>(false);
  const autoZeroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibrateZeroRef = useRef<() => void>(() => {});
  const runAutoZero = useCallback(() => {
    if (!autoZeroPendingRef.current) return;
    autoZeroPendingRef.current = false;
    if (autoZeroTimerRef.current) {
      clearTimeout(autoZeroTimerRef.current);
      autoZeroTimerRef.current = null;
    }
    calibrateZeroRef.current();
  }, []);
  ```
- **Execution Flow / Logic**:
  1. `calibrateZeroRef`는 `handleCalibrateZero`(`useCallback`, 현재 `handlePermissionGranted` 아래에 정의됨)보다 위에서 선언하고, `handleCalibrateZero` 정의 직후 `calibrateZeroRef.current = handleCalibrateZero;`로 갱신한다(선언 순서 때문에 직접 참조하면 아직 정의되지 않은 값을 참조한다).
  2. `handlePermissionGranted`: 기존 `setSensorsActive(true); setStep('PAD');` 뒤에 `autoZeroPendingRef.current = true; autoZeroTimerRef.current = setTimeout(runAutoZero, CONTROLLER_LIFECYCLE.AUTO_ZERO_FALLBACK_MS);`를 추가한다. 이미 보류 중이면 타이머를 중복으로 만들지 않도록 기존 타이머를 `clearTimeout`한 뒤 설정한다.
  3. 센서 effect의 `onOrientation`: `latestOrientationRef.current = {...}` 대입 **다음 줄**에 `if (autoZeroPendingRef.current) runAutoZero();`를 추가한다. 순서가 중요하다(영점은 이 이벤트의 자세를 써야 한다). `P02` 이전에 추가된 `markEvent`·`TEMP(sensor-debug)` 블록은 그대로 둔다.
  4. 컴포넌트 언마운트 시 `autoZeroTimerRef`를 `clearTimeout`하는 cleanup effect(`useEffect(() => () => {...}, [])`)를 추가한다.
  5. `handleCalibrateZero`(기존)는 `tracker.unlockAim()`, 코킹 상태 초기화, 스냅 유예 설정, `tracker.calibrateZero(latestOrientationRef.current)`, `CALIBRATE_ZERO` 전송(소켓이 열려 있고 `roomId`가 있을 때), `setStep('PAD')`를 한다. 수정하지 않는다.
- **주의(회귀 방지)**:
  - 허용 버튼(`LoginAndPermissionGate`의 `onPermissionGranted`)은 로그인 게이트에서만 나온다. 이미 영점을 잡은 뒤 재연결하는 경로(`AUTH_RESULT`의 `resume: true`)는 `handlePermissionGranted`를 거치지 않으므로 영향이 없다.
  - 허용 순간 소켓이 닫혀 있으면 `handleCalibrateZero`가 `CALIBRATE_ZERO`를 못 보낸다. 이후 소켓이 다시 붙으면 기존 재연결 경로(`isReconnectOpenRef` + `PAD`)가 `CALIBRATE_ZERO` `resume: true`를 보내 PC가 영점 상태를 알게 된다. 별도 처리를 추가하지 않는다.
  - `CALIBRATE_ZERO`(`resume` 없음)를 받으면 PC가 `phoneAdaptersRef[slot].resetZero()`를 호출한다(첫 영점이라 정상).
  - `SENSOR_STALE_MS` 워치독(센서 복구 effect)과 독립이다. 서로 건드리지 않는다.

### I02. 소스 가드 테스트

- Related Files:
  - `tests/controller-reconnect.test.ts` :: `describe('MobileControllerPage reconnect wiring (source guard)')` — 케이스 추가; modify

#### Details
- `handlePermissionGranted` 블록(`const handlePermissionGranted`부터 다음 `};`까지)에 `autoZeroPendingRef.current = true`와 `AUTO_ZERO_FALLBACK_MS`가 있다.
- `onOrientation` 블록(`const onOrientation`부터 `const onMotion`까지)에서 `latestOrientationRef.current =`가 `autoZeroPendingRef`보다 먼저 나온다(순서 가드: `indexOf` 비교).
- `calibrateZeroRef.current = handleCalibrateZero` 대입이 있다.
- 소스에 `autoZeroTimerRef`를 `clearTimeout`하는 cleanup이 있다.

## Acceptance Criteria
- [ ] 허용 버튼을 누르면 첫 센서 이벤트(또는 1초 뒤) 폰이 `CALIBRATE_ZERO`를 보낸다.
- [ ] 자동 영점이 그 첫 이벤트의 자세를 기준으로 잡힌다(이벤트 처리 순서 가드).
- [ ] 재연결 경로(`resume`)에는 영향이 없다.
- [ ] 기존 컨트롤러 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/controller-reconnect.test.ts tests/controller-sensors.test.ts tests/controller-ui-and-routing.test.ts tests/pc-modals-and-pairing.test.ts tests/lobby-slot-cards.test.tsx` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
fix(controller): 센서 권한 허용 직후 자동 영점

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P02-phone-controller
Task: T02-auto-zero-on-grant

- 허용 버튼 직후 첫 deviceorientation(최대 1초 대기)에서 CALIBRATE_ZERO를 자동 전송
- 조준경과 시작 준비가 영점 버튼 없이 PC 로비에 반영됨
- 소스 가드 테스트 추가
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
