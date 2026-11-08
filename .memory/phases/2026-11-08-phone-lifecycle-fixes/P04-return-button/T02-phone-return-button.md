# Task: T02 폰: 자동 복귀 제거와 "게임으로 돌아가기" 버튼

## Status: done

## Goal
같은 페이지에서 화면이 1초 넘게 꺼졌다 돌아오면 패드 위에 "게임으로 돌아가기" 버튼을 덮어 보여 주고, 누르면 센서 권한 재요청 → 센서 재등록 → 첫 센서값에서 영점 → `CALIBRATE_ZERO` 전송으로 PC를 재개시킨다. 화면 복귀 시 자동 센서 재등록, 센서 워치독, 자동 `DEVICE_CHECK` 재전송은 없앤다.

## Decision Summary
- return-button D02·D03·D04·D06(1)(3)·D07. 페이지가 새로 열린 경우는 기존 초록 버튼(권한 허용 + 자동 영점)이 같은 역할이라 손대지 않는다.

## Implementation

### I01. 권한 요청 헬퍼 추출

- Related Files:
  - `src/controller/sensors/SensorPermission.ts` :: `requestSensorPermission` — 권한 요청 공용 함수; new
  - `src/controller/components/LoginAndPermissionGate.tsx` :: `handleRequestPermission` — 헬퍼 사용으로 교체; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** iOS 13+는 DeviceOrientation/Motion 권한을 사용자 터치 안에서 요청해야 한다. 다른 브라우저는 요청 함수가 없어 바로 허용으로 본다. */
  export async function requestSensorPermission(): Promise<'granted' | 'denied'>;
  ```
- **Execution Flow / Logic**: `LoginAndPermissionGate.handleRequestPermission`의 현재 로직을 그대로 옮긴다. orientation `requestPermission`이 함수면 호출하고 `'granted'`가 아니면 `'denied'` 반환. motion `requestPermission`이 함수면 호출하되 실패는 무시(`.catch(() => {})`). 예외가 나면(데스크톱 등) `'granted'`. `LoginAndPermissionGate`는 결과가 `'denied'`면 기존 `alert('모션 센서 권한이 허용되어야 권총 조준이 가능합니다.')` 후 반환, 아니면 `onPermissionGranted()`. `setIsRequestingPermission` 처리 동작은 기존과 같게 유지한다.

### I02. 자동 복귀·워치독 제거

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: 화면 복귀·워치독 effect(`const onVisibility`, `watchdog` 인터벌, deps `[sensorsActive]`), `SensorLiveness` import·`sensorLivenessRef`·`markEvent`/`reset` 호출, `onBackgroundSignals`의 `DEVICE_CHECK` 재전송 블록 — 제거; modify
  - `src/controller/sensors/SensorLiveness.ts`, `tests/sensor-liveness.test.ts` — 삭제; delete

#### Details
1. 화면 복귀·워치독 `useEffect` 전체를 지운다(안의 `TEMP(sensor-debug)` 로그 호출 포함). `sensorEpoch` 상태와 센서 effect의 deps `[sensorsActive, sensorEpoch, tracker, flushSensorFrame]`, cleanup의 `tracker.unlockAim()`은 **남긴다**(버튼이 `sensorEpoch`를 올려 재등록한다).
2. 센서 effect에서 `sensorLivenessRef.current.reset(...)`과 `onOrientation`의 `markEvent(...)` 줄을 지운다. `debugRegisteredAtRef`/`orientation-first`·`orientation-gap` 진단 로그는 P05에서 지우므로 남긴다.
3. `onBackgroundSignals`: `hidden`일 때 `hiddenAtMs = Date.now()`와 `CONTROLLER_BACKGROUND` 전송은 유지. `visible`일 때 `CONTROLLER_FOREGROUND` 전송은 유지하고, `hiddenForMs >= FOREGROUND_RESUME_MIN_MS && stepRef.current === 'PAD'`이면 `DEVICE_CHECK` 재전송 대신 `setNeedsReturn(true); needsReturnRef.current = true;`를 호출한다. 소켓이 닫혀 있어도(`!open`) 이 판정은 해야 하므로 `if (!open) return;`보다 **앞**에서 처리하고, `FOREGROUND` 전송만 `open`일 때 한다. `isReconnectOpenRef.current = true` 줄은 지운다.
4. `CONTROLLER_LIFECYCLE.FOREGROUND_RESUME_MIN_MS`를 1000으로 바꾼다(서버 알림 기준 1초와 같게, D03). 주석도 "이만큼 넘게 꺼졌다 오면 돌아가기 버튼을 보여 준다"로 고친다.

### I03. 돌아가기 버튼

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: 신규 상태 `needsReturn`, `needsReturnRef`, 핸들러 `handleReturnToGame`, `AUTH_RESULT` 처리부, 렌더 — modify
  - `src/controller/components/ReturnToGameOverlay.tsx` :: `ReturnToGameOverlay` — 버튼 오버레이; new

#### Details
- **Signatures & Types**:
  ```typescript
  const [needsReturn, setNeedsReturn] = useState<boolean>(false);
  const needsReturnRef = useRef<boolean>(false);
  const handleReturnToGame = useCallback(async () => { ... }, [runAutoZero]);

  export interface ReturnToGameOverlayProps { onReturn: () => void; busy?: boolean }
  export const ReturnToGameOverlay: React.FC<ReturnToGameOverlayProps>;
  ```
- **Execution Flow / Logic**:
  1. `handleReturnToGame`(버튼 `onClick`에서 바로 호출 — iOS 권한 요청은 사용자 터치 안이어야 함): `await requestSensorPermission()`; `'denied'`면 `alert(...)` 후 반환(버튼 유지). 이어서 `setSensorEpoch((e) => e + 1)`(센서 재등록), `autoZeroPendingRef.current = true`, 기존 자동 영점과 같은 1초 폴백 타이머(`autoZeroTimerRef`, `CONTROLLER_LIFECYCLE.AUTO_ZERO_FALLBACK_MS`)를 건다. 마지막으로 `needsReturnRef.current = false; setNeedsReturn(false);`.
  2. 영점은 기존 `runAutoZero` → `handleCalibrateZero` 경로가 처리한다(첫 `deviceorientation` 뒤 `CALIBRATE_ZERO`, resume 없음). 소켓이 닫혀 있으면 `handleCalibrateZero`가 전송하지 못하므로, 버튼을 누를 때 `wsRef.current?.readyState !== WebSocket.OPEN`이면 아무것도 하지 않고 버튼을 유지한다(재연결 배너가 보이는 동안 누르면 무시).
  3. `AUTH_RESULT` 처리부: 기존 `if (isReconnectOpenRef.current && stepRef.current === 'PAD')` 조건에 `&& !needsReturnRef.current`를 추가한다(D07: 버튼 대기 중에는 자동 `CALIBRATE_ZERO(resume)`을 보내지 않음).
  4. 렌더: `{step === 'PAD' && needsReturn && <ReturnToGameOverlay onReturn={handleReturnToGame} />}`를 `GunGripPad` 뒤에 둔다. 오버레이는 `position: fixed; inset: 0; zIndex`를 재연결 배너보다 낮게(배너가 위에 보이게) 두고, 아래 패드 터치를 막는다.
  5. `ReturnToGameOverlay` 문구: 제목 "게임으로 돌아가기", 안내 "폰 윗부분으로 모니터 중앙을 겨누고 누르세요. 누른 방향이 새 정면이 됩니다." 버튼 하나. 스타일은 `LoginAndPermissionGate`의 초록 버튼과 맞춘다(같은 색·크기 규칙을 읽어 재사용).
- **주의(회귀 방지)**:
  - `handleReturnToGame`에서 `await` 이전에 상태를 바꾸지 않는다. iOS는 `requestPermission`이 사용자 터치와 같은 호출 흐름에서 불려야 한다.
  - `runAutoZero`는 `autoZeroPendingRef`가 `true`일 때만 동작한다. `handlePermissionGranted`와 같은 순서(플래그 → 타이머)를 지킨다.
  - 로비(`PAIRING`)에서도 버튼이 뜬다(D03). PC는 로비에서 `ZERO_CALIBRATED`를 받으면 `isConnected: true`로 돌아오고 `ZEROING` 단계로 넘어간다(기존 동작).

### I04. 테스트

- Related Files:
  - `tests/controller-reconnect.test.ts` — 워치독·`SensorLiveness`·`DEVICE_CHECK` 재전송 관련 단언을 새 규칙으로 교체; modify
  - `tests/sensor-permission.test.ts` :: `requestSensorPermission` — 단위 테스트; new

#### Details
- 소스 가드:
  - `SensorLiveness`, `SENSOR_STALE_MS`, `watchdog`이 `MobileControllerPage.tsx`에 없다. `[sensorsActive, sensorEpoch,` deps와 cleanup의 `tracker.unlockAim()`은 남아 있다.
  - `onBackgroundSignals` 블록에 `DEVICE_CHECK`와 `isReconnectOpenRef.current = true`가 없고 `setNeedsReturn(true)`가 있다. `setTimeout`·`performance.now` 없음, `Date.now()` 사용은 유지.
  - `AUTH_RESULT` 조건에 `!needsReturnRef.current`가 있다.
  - `handleReturnToGame` 블록에 `requestSensorPermission`, `setSensorEpoch`, `autoZeroPendingRef.current = true`가 있고, `requestSensorPermission`이 `setNeedsReturn(false)`보다 먼저 나온다.
- `requestSensorPermission`: `globalThis.DeviceOrientationEvent`/`DeviceMotionEvent`를 테스트에서 덮어써 (a) 요청 함수 없음 → `'granted'` (b) orientation이 `'denied'` → `'denied'` (c) orientation `'granted'` + motion 실패 → `'granted'` (d) orientation이 예외 → `'granted'`를 확인한다. 테스트 후 원래 값으로 복원한다.

## Acceptance Criteria
- [ ] 같은 페이지에서 1초 넘게 꺼졌다 돌아오면 버튼이 뜨고, 누르기 전에는 패드 조작이 막힌다.
- [ ] 버튼을 누르면 권한 재요청 → 센서 재등록 → 영점 → `CALIBRATE_ZERO`(resume 없음)가 간다.
- [ ] 버튼 대기 중 소켓이 다시 붙어도 자동 `CALIBRATE_ZERO(resume)`이 가지 않는다.
- [ ] 화면 복귀 자동 재등록·워치독·`SensorLiveness`·자동 `DEVICE_CHECK` 재전송이 없다.
- [ ] `tsc`, 전체 `vitest`, `build` 통과.

## Validation
- `grep -rn "SensorLiveness\|SENSOR_STALE_MS" src tests` — 출력 없음
- `npx vitest run tests/controller-reconnect.test.ts tests/sensor-permission.test.ts tests/controller-ui-and-routing.test.ts tests/controller-sensors.test.ts` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과
- `npm run build` — 성공

## Commit Message
```text
feat(controller): 화면 복귀 시 "게임으로 돌아가기" 버튼, 자동 복귀 제거

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P04-return-button
Task: T02-phone-return-button

- 센서 권한 요청을 requestSensorPermission으로 추출해 초록 버튼과 공유
- 화면 복귀 자동 센서 재등록·워치독·SensorLiveness·자동 DEVICE_CHECK 재전송 제거
- 1초 넘게 꺼졌다 돌아오면 버튼 표시, 누르면 권한 재요청·센서 재등록·영점·CALIBRATE_ZERO, 버튼 대기 중 자동 resume 차단
- 소스 가드와 권한 헬퍼 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
