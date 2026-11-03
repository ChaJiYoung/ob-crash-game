# Task: T01 모바일 컨트롤러 1회 탭 단발 발사, 홀드 연타 제거, 300ms 더블 탭 피버 구현

## Status: done

## Goal
모바일 컨트롤러의 손목 스냅(흔들기) 및 터치 조준 잠금(Cocking) 메커니즘을 걷어내고, 화면 1회 탭 즉시 단발 발사(0ms 딜레이), 홀드 시 연타 방지, 300ms 이내 더블 탭 피버 발동을 구현하여 직관적인 조준 사격 조작감을 완성한다.

## Decision Summary
- [D01, D02, D03](../decisions/2026-11-03-controller-single-tap-and-double-tap-fever.md): 화면 1회 탭(`pointerDown`) 즉시 1발 발사 및 25ms 햅틱 피드백. 홀드 시 자동 연타 완전 제거(손을 떼었다 다시 탭해야 발사). 첫 탭 지연 없이 즉각 발사되며 300ms 내 재탭 시 피버 발동.
- **사용자 확정 지침**:
  1. `GunGripTracker.ts`의 '휙 하는 스냅 동작(`detectSnapFire`)' 로직은 향후 활용 가능성을 위해 삭제하지 않고 온전히 보존(유지/보류).
  2. PC 환경의 키보드([Space] 피버) 및 마우스(좌클릭 발사) 조작 체계 100% 보존.

## Implementation

### I01. UnifiedTouchPadController 단발 탭 및 더블 탭 피버 로직 개편

- Related Files:
  - `src/controller/sensors/UnifiedTouchPad.ts` :: `UnifiedTouchPadController` — 단발 탭 및 더블 탭 감지 컨트롤러; modify
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 터치패드 뷰 및 햅틱 연동; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface TouchPadCallbacks {
    onSingleTapFire: () => void;
    onFeverTrigger: () => void;
  }

  export class UnifiedTouchPadController {
    private callbacks: TouchPadCallbacks;
    private lastTapMs = 0;
    private isPointerHeld = false;

    constructor(callbacks: TouchPadCallbacks);
    public handlePointerDown(nowMs?: number): void;
    public handlePointerUp(nowMs?: number): void;
    public dispose(): void;
  }
  ```
- **Execution Flow / Logic**:
  1. `handlePointerDown(nowMs)`:
     - 이미 `isPointerHeld === true`라면 리턴(중복 터치/홀드 연타 방지).
     - `isPointerHeld = true`.
     - 즉시 단발 사격 콜백 호출: `this.callbacks.onSingleTapFire()`.
     - 더블 탭 검사: `this.lastTapMs > 0 && (now - this.lastTapMs <= WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS)`.
       - 조건 만족 시 `this.callbacks.onFeverTrigger()` 호출 및 `this.lastTapMs = 0`.
       - 조건 미만족 시 `this.lastTapMs = now`.
  2. `handlePointerUp(_nowMs)`:
     - `isPointerHeld = false`. (손가락을 떼어야 다음 단발 사격 가능)
  3. `GunGripPad.tsx`:
     - `UnifiedTouchPadController` 생성 시 `onSingleTapFire`와 `onFeverTrigger` 바인딩.
     - 탭 시 25ms 숏 햅틱 피드백 트리거 (`triggerHaptic(25)`).
     - 더블 탭 피버 시 다중 햅틱 피드백 트리거 (`triggerHaptic([50, 50, 100])`).

### I02. MobileControllerPage 발사 이벤트 및 센서 통신 연동

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 센서 스트리밍 및 격발 플러시; modify
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker` — 스냅 가속도 계산 로직 보존 및 조준 잠금 참조 해제; read-only/modify

#### Details
- **Execution Flow / Logic**:
  1. `onSingleTapFire`:
     - `snapFireRef.current = true`.
     - 실시간 자이로 조준 좌표로 즉시 센서 프레임 전송 (`flushSensorFrame()`).
  2. `GunGripPad`의 `onCockingChange`:
     - 터치 중 조준을 억지로 멈추던 `tracker.lockAim()`을 비활성화하여 자이로 조준선이 터치 중에도 실시간으로 부드럽게 움직이도록 유지.
  3. `GunGripTracker` 및 `onMotion`:
     - 사용자의 지침에 따라 `tracker.detectSnapFire()` 가속도 계산 로직은 삭제하지 않고 온전히 보존(향후 기능용 보류).
     - 발사는 화면 탭(`pointerDown`)을 주력으로 하되, 기존 스냅 코드는 온전히 유지하여 회귀 방지.
  4. PC 환경 조작 보존:
     - `PCGamePage.tsx`의 마우스 좌클릭 단발 사격 및 [Space] 키 피버 발동 조작은 변경 없이 100% 보존.

### I03. 단위 테스트 갱신 및 신규 동작 검증

- Related Files:
  - `tests/controller-sensors.test.ts` :: `describe('GunGripTracker & UnifiedTouchPadController')` — 단발 탭 및 더블 탭 테스트; modify

#### Details
- `should trigger single tap fire on pointerDown and fever on double-tap without rapid fire on hold`:
  - 1회 pointerDown 시 `onSingleTapFire` 1회 호출 확인.
  - pointerDown 유지(홀드 500ms) 시 추가 발사 없음 확인.
  - pointerUp 후 200ms 내 재 pointerDown 시 `onSingleTapFire` 2회째 호출 및 `onFeverTrigger` 1회 호출 확인.

## Acceptance Criteria
- [x] 화면 터치패드 영역을 1회 탭할 때마다 지연 없이 즉시 발사된다.
- [x] 화면을 길게 누르고 있어도 1발 발사 후 추가 연타가 나가지 않는다.
- [x] 피버 게이지 100% 상태에서 300ms 이내 더블 탭 시 즉시 피버가 발동된다.
- [x] 손목을 흔들 필요 없이 터치만으로 100% 발사된다.
- [x] `tests/controller-sensors.test.ts` 테스트가 모두 통과한다.

## Validation
- `npm test tests/controller-sensors.test.ts` — 모든 컨트롤러 센서 및 터치패드 테스트 통과 (exit code 0)

## Commit Message
```text
feat(controller): implement single tap fire and double tap fever

Plan: 2026-11-03-difficulty-controls-and-monsters
Phase: P01-controls-difficulty-and-monsters
Task: T01-controller-single-tap-and-double-tap-fever

- Add onSingleTapFire callback and pointer hold suppression in UnifiedTouchPadController
- Connect immediate tap fire to flushSensorFrame in MobileControllerPage
- Remove cocking aim lock and acceleration-based fire dependency
- Update controller unit tests for tap fire and double-tap fever
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
