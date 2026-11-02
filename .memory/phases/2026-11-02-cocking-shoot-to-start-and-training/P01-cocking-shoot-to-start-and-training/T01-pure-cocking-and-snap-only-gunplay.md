# Task: T01 터치패드 탭 사격 & 홀드 연사 완전 제거 및 순수 코킹-스냅 메커니즘과 모바일 패드 직행

## Status: done

## Goal
화면을 누를 때 발생하던 즉시 탭 사격(`onTapFire`)과 0.25초 홀드 연사(`rapidFireHold`)를 완전히 제거하여 화면 터치 = 오직 "철컥!" 코킹 장전 & 조준 고정(Aim Lock)만 수행하고, 오직 손목을 위로 채 올릴 때(Snap Up)만 마우스 클릭처럼 1발 단발 "탕!" 격발되도록 수정한다. 또한 폰 화면에 남아 있던 '준비 완료' 버튼과 사전 영점 화면을 완전히 없애고 닉네임 입력 후 곧바로 심플한 건 컨트롤러 패드로 직행하도록 만든다.

## Decision Summary
- [D01](../../decisions/2026-11-02-cocking-shoot-to-start-flow.md): 터치패드 탭 사격 및 홀드 연사 로직 완전 제거. 화면 터치 다운 = 장전 & 조준 고정 (총알 발사 0%), 위로 휙 채기 = 1발 단발 격발.
- [D02](../../decisions/2026-11-02-cocking-shoot-to-start-flow.md): 폰 화면의 '준비 완료' 버튼과 사전 영점 화면 제거, 닉네임 후 메인 패드 직행.

## Implementation

### I01. UnifiedTouchPadController 및 GunGripPad 탭 사격/홀드 연사 완전 제거

- Related Files:
  - `src/controller/sensors/UnifiedTouchPad.ts` :: `UnifiedTouchPadController` — `onTapFire`, `onRapidFireChange` 및 홀드 타이머 제거; modify
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 터치 다운 시 총알 격발 없이 오직 `isCocked=true` 전달, 폰 화면 '준비 완료' 버튼 삭제; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — `onTapFire` 콜백 제거 및 오직 `isCocked` 상태에서 `onMotion` 스냅 업 감지 시에만 `snapFire` 전송; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/controller/sensors/UnifiedTouchPad.ts
  export interface TouchPadCallbacks {
    onFeverTrigger: () => void; // 0.3초 더블탭 피버 발동만 유지
  }
  ```
- **Execution Flow / Logic**:
  1. `UnifiedTouchPadController`:
     - `handlePointerDown`: 더블탭 피버 발동 검사만 수행하고, 기존 `onTapFire()` 및 `holdTimer` 기반 0.25초 연사 로직 완전 제거.
     - `handlePointerUp`: 불필요해진 연사 해제 타이머 제거.
  2. `GunGripPad`:
     - `handlePointerDown`:
       - `setIsCocked(true)`
       - `triggerHaptic(35)` (금속성 코킹 손맛 진동)
       - `onCockingChangeRef.current?.(true)`
       - 총알 격발 함수 절대 호출하지 않음!
     - `handlePointerUp`:
       - `setIsCocked(false)`
       - `onCockingChangeRef.current?.(false)`
     - 폰 화면의 `{isGameWaiting && onRequestStartGame ? <button>... : null}` 버튼 완전 삭제!
  3. `MobileControllerPage`:
     - `handlePermissionGranted`: `setStep('PAD')` (사전 영점 없이 패드 직행).
     - `onMotion`: 오직 `isCockedRef.current === true` 일 때만 `snapFireRef.current = true; flushSensorFrame();`.

## Acceptance Criteria
- [x] 폰 화면을 엄지로 누르고 있어도 총알이 발사되지 않고 연사도 나가지 않는다.
- [x] 화면을 터치하는 순간 "철컥!" 코킹 효과음과 햅틱 진동이 발생하며 조준선이 고정된다.
- [x] 화면을 누른 채 손목을 위로 채 올릴 때만 "탕!" 하고 1발씩 단발 격발된다.
- [x] 닉네임 입력 및 권한 승인 후 폰 화면에 불필요한 '준비' 버튼이나 영점 화면 없이 바로 컨트롤러 패드가 뜬다.
- [x] `tests/controller-sensors.test.ts` 통과.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 코킹-스냅 단발 사격 검증
- `npx vitest run tests/controller-ui-and-routing.test.ts` — 컨트롤러 패드 직행 검증

## Commit Message
```text
feat(controller): eliminate tap-fire and hold rapid-fire for pure cocking-snap shooting

Plan: 2026-11-02-cocking-shoot-to-start-and-training
Phase: P01-cocking-shoot-to-start-and-training
Task: T01-pure-cocking-and-snap-only-gunplay

- Remove onTapFire and hold rapid-fire timer from UnifiedTouchPadController
- Ensure screen touch down only cocks gun (audio & haptic) without firing
- Restrict bullet discharge purely to upward snap while cocked
- Remove mobile ready button and zeroing guide to transition directly to pad
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
