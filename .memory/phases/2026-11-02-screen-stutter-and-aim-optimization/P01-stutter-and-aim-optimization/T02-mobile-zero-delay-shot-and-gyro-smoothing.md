# Task: T02 모바일 터치 즉시 단발 사격, 패킷 즉시 플러시, 자이로 스무딩, 피버 상태 양방향 동기화 및 GunGripPad 생명주기 안정화

## Status: done

## Goal
스마트폰 컨트롤러에서 터치패드를 가볍게 탭하는 즉시 단발 사격이 발동되도록 개선하고, 사격·피버·연사 이벤트 발생 시 16ms 주기를 기다리지 않고 즉시 WebSocket으로 전송하며, 자이로 손떨림 보정(Low-Pass Filter), `GunGripPad`의 콜백 Ref 격리, 그리고 PC-모바일 간 `isFeverReady` 실시간 상태 동기화 및 햅틱 진동 알림을 통해 모바일 조작 반응성과 직관성을 극대화한다.

## Decision Summary
- **D05**: `UnifiedTouchPadController`의 `handlePointerDown` 진입 시 단발 사격 콜백(`onTapFire`)을 즉시 호출하고, `MobileControllerPage`에서 사격·피버·연사 이벤트 발생 즉시 WebSocket 패킷을 전송(Zero-Delay Shot Flush)한다.
- **D06**: `GunGripTracker`에 지수 이동 평균(EMA) 기반 적응형 손떨림 스무딩 필터를 도입하여 미세한 손떨림 노이즈를 억제한다.
- **D07**: `GunGripPad`의 `useEffect` 의존성에서 인라인 콜백(`onRapidFireChange`, `onFeverTrigger`, `onTapFire`)을 `useRef`로 분리하여 리렌더링 시 홀드 연사가 초기화되는 버그를 차단한다.
- **D08**: `FEVER_STATUS_SYNC` / `FEVER_STATUS_RELAY` WebSocket 프로토콜을 추가하여 PC의 피버 게이지가 100% 도달하거나 해제될 때 모바일 컨트롤러의 황금빛 피버 배너(`isFeverReady`)와 햅틱 진동을 실시간으로 작동시킨다.

## Implementation

### I01. 터치 즉시 단발 사격을 지원하는 통합 터치패드 (`UnifiedTouchPad.ts`)

- Related Files:
  - `src/controller/sensors/UnifiedTouchPad.ts` :: `TouchPadCallbacks`, `UnifiedTouchPadController` — 첫 탭 시 즉시 단발 사격(`onTapFire`) 호출 및 홀드 연사·더블탭 피버 공존; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface TouchPadCallbacks {
    onRapidFireChange: (active: boolean) => void;
    onFeverTrigger: () => void;
    onTapFire?: () => void;
  }
  ```
- **Execution Flow / Logic**:
  1. `handlePointerDown(nowMs?: number)` 호출 시:
     - `const now = nowMs ?? performance.now();`
     - `if (this.lastTapMs > 0 && now - this.lastTapMs <= doubleTapWindow)` (300ms 이내 더블탭):
       - 기존 `holdTimer`가 있으면 취소하고 `this.lastTapMs = 0` 초기화 후 `this.callbacks.onFeverTrigger()` 호출 후 반환.
     - 첫 번째 탭인 경우:
       - `this.lastTapMs = now;`
       - **즉시 단발 사격**: `this.callbacks.onTapFire?.();` 호출하여 사용자가 패드를 터치하는 즉시 1발 발사!
       - 동시에 250ms(`holdThreshold`) 타이머를 시작하여 계속 누르고 있으면 `this.isRapidFiring = true; this.callbacks.onRapidFireChange(true);`로 전환.

### I02. 자이로 손떨림 보정 필터 (`GunGripTracker.ts`)

- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker` — 자이로 노이즈 억제를 위한 적응형 EMA 스무딩 적용; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export class GunGripTracker {
    private invZeroQuaternion: THREE.Quaternion;
    private isCalibrated: boolean;
    private lastSnapTimeMs: number;
    private smoothedAimX: number;
    private smoothedAimY: number;
    private hasSmoothedSample: boolean;

    public calibrateZero(sample: EulerOrientation): void;
    public computeAim(sample: EulerOrientation, smoothingAlpha?: number): AimResult;
    public detectSnapFire(sample: LinearAccelerationSample): boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. `calibrateZero(sample)` 호출 시 `this.smoothedAimX = 0`, `this.smoothedAimY = 0`, `this.hasSmoothedSample = false`로 리셋한다.
  2. `computeAim(sample, smoothingAlpha = 0.72)`에서 쿼터니언으로 계산한 원시 목표값 `rawAimX`, `rawAimY`를 구한다.
  3. `!this.hasSmoothedSample`이거나 급격한 큰 이동(`Math.hypot(rawAimX - this.smoothedAimX, rawAimY - this.smoothedAimY) > 0.15`)일 때는 반응성을 위해 즉시 스냅(`alpha = 1.0`)하고, 미세한 움직임 구간에서는 `alpha = smoothingAlpha`를 적용해 손떨림만 부드럽게 걸러낸다:
     ```typescript
     const delta = Math.hypot(rawAimX - this.smoothedAimX, rawAimY - this.smoothedAimY);
     const effectiveAlpha = !this.hasSmoothedSample || delta > 0.15 ? 1.0 : smoothingAlpha;
     this.smoothedAimX += (rawAimX - this.smoothedAimX) * effectiveAlpha;
     this.smoothedAimY += (rawAimY - this.smoothedAimY) * effectiveAlpha;
     this.hasSmoothedSample = true;
     ```

### I03. GunGripPad 생명주기 안정화 및 터치 햅틱 연결 (`GunGripPad.tsx`)

- Related Files:
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad`, `GunGripPadProps` — 콜백 `useRef` 격리로 연사 끊김 방지 및 `onTapFire` 연결; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface GunGripPadProps {
    onRecalibrateZero: () => void;
    onRapidFireChange: (active: boolean) => void;
    onFeverTrigger: () => void;
    onTapFire?: () => void;
    isFeverReady?: boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. `onRapidFireChangeRef = useRef(onRapidFireChange)`, `onFeverTriggerRef = useRef(onFeverTrigger)`, `onTapFireRef = useRef(onTapFire)`를 선언하고 매 렌더링마다 `.current`를 갱신한다.
  2. `useEffect`의 의존성 배열을 `[]`로 고정하여 마운트 시 단 1회만 `UnifiedTouchPadController`를 생성하고, 언마운트 시에만 `pad.dispose()`가 호출되게 한다.
  3. `onTapFire` 콜백에서 `triggerHaptic(18)`로 경쾌한 단발 타격 진동을 주고 `onTapFireRef.current?.()`를 호출한다.

### I04. 피버 준비 상태 양방향 WebSocket 동기화 (`types.ts`, `wsServer.ts`, `PCGamePage.tsx`, `MobileControllerPage.tsx`)

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`, `ServerToClientMessage` — `FEVER_STATUS_SYNC` 및 `FEVER_STATUS_RELAY` 메시지 타입 추가; modify
  - `server/wsServer.ts` :: `createBeerCrusherServer` — PC로부터 `FEVER_STATUS_SYNC` 수신 시 해당 방의 `controllerSocket`으로 `FEVER_STATUS_RELAY` 중계; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `feverState.isFeverReady` 변경 감지 시 WebSocket으로 `FEVER_STATUS_SYNC` 전송; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 즉시 패킷 플러시(`flushSensorFrame`) 및 `FEVER_STATUS_RELAY` 수신 시 `setIsFeverReady(msg.isFeverReady)` + 햅틱 진동(`triggerHaptic([60, 40, 80])`) 실행; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/types.ts
  export type ClientToServerMessage =
    | ...
    | { type: 'FEVER_STATUS_SYNC'; roomId: string; isFeverReady: boolean };

  export type ServerToClientMessage =
    | ...
    | { type: 'FEVER_STATUS_RELAY'; roomId: string; isFeverReady: boolean };
  ```
- **Execution Flow / Logic**:
  1. `server/wsServer.ts`: `case 'FEVER_STATUS_SYNC':` 핸들러를 추가하여 `const session = roomManager.getRoom(msg.roomId); if (session && session.controllerSocket) { sendJson(session.controllerSocket, { type: 'FEVER_STATUS_RELAY', roomId: msg.roomId, isFeverReady: Boolean(msg.isFeverReady) }); }`를 실행한다.
  2. `src/pc/PCGamePage.tsx`: `lastSentFeverReadyRef = useRef<boolean>(false)`를 두고, 50ms HUD 틱 안에서 `if (roomId && lastSentFeverReadyRef.current !== feverState.isFeverReady)`일 때 `lastSentFeverReadyRef.current = feverState.isFeverReady`로 갱신 후 오픈된 WebSocket으로 `{ type: 'FEVER_STATUS_SYNC', roomId, isFeverReady: feverState.isFeverReady }`를 전송한다.
  3. `src/controller/MobileControllerPage.tsx`:
     - `flushSensorFrame` 헬퍼를 구현하여 단발 탭(`onTapFire`), 손목 스냅(`detectSnapFire`), 홀드 연사 토글(`onRapidFireChange`), 피버 더블탭(`onFeverTrigger`) 시 16ms 인터벌을 기다리지 않고 즉시 `SENSOR_FRAME`을 전송한다.
     - WebSocket `case 'FEVER_STATUS_RELAY':` 수신 시 `setIsFeverReady(msg.isFeverReady)`를 호출하고, `if (msg.isFeverReady)`이면 `triggerHaptic([60, 40, 80])`로 스마트폰에 피버 준비 완료 진동을 울린다.

### I05. 모바일 센서, 터치패드 및 피버 릴레이 테스트 확장 (`tests/controller-sensors.test.ts`, `tests/server-session.test.ts`)

- Related Files:
  - `tests/controller-sensors.test.ts` — 터치 즉시 단발 사격(`onTapFire`) 및 자이로 스무딩 검증 케이스 추가; modify
  - `tests/server-session.test.ts` — `FEVER_STATUS_SYNC` ➔ `FEVER_STATUS_RELAY` WebSocket 중계 검증 추가; modify

## Acceptance Criteria
- [ ] 휴대폰 터치패드를 가볍게 한 번 탭하면 손목 스냅 없이도 즉시 단발 사격(`snapFire: true`)이 전송된다.
- [ ] 단발 사격, 홀드 연사 시작/종료, 더블탭 피버 발동 시 16ms 타이머 대기 없이 즉시 WebSocket 패킷이 전송된다.
- [ ] `GunGripPad`에서 연사 상태 변경으로 리렌더링이 발생해도 `UnifiedTouchPadController`가 `dispose`되지 않아 홀드 연사가 끊기지 않는다.
- [ ] PC에서 피버 게이지가 100% 도달하면 `FEVER_STATUS_SYNC`가 전송되어 모바일 컨트롤러의 황금빛 피버 UI(`isFeverReady`)와 햅틱 진동이 즉시 활성화된다.

## Validation
- `npx vitest run tests/controller-sensors.test.ts tests/controller-ui-and-routing.test.ts tests/server-session.test.ts` — 모든 테스트 통과
- `npm test && npm run build` — 전체 테스트 스위트 및 프로덕션 빌드 통과

## Commit Message
```text
perf(controller): add zero-delay tap fire, gyro smoothing, fever sync, and stabilize touchpad

Plan: 2026-11-02-screen-stutter-and-aim-optimization
Phase: P01-stutter-and-aim-optimization
Task: T02-mobile-zero-delay-shot-and-gyro-smoothing

- Trigger immediate single shot (onTapFire) on touchpad pointer down alongside hold rapid-fire and double-tap fever
- Flush WebSocket SENSOR_FRAME immediately upon shot, rapid-fire toggle, or fever trigger
- Add adaptive EMA smoothing to GunGripTracker to suppress micro hand tremor
- Relay FEVER_STATUS_SYNC from PC to mobile controller FEVER_STATUS_RELAY with haptic feedback
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
