# Task: T01 모바일 터치 홀드 & PC 마우스 좌클릭 홀드 공통 무기별 자동 연발(Hold Auto-Fire) 구현

## Status: done

## Goal
모바일 컨트롤러(`UnifiedTouchPad.ts`, `GunGripPad.tsx`, `MobileControllerPage.tsx`)와 PC 마우스(`GameCanvas3D.tsx`, `PCGamePage.tsx`) 모두 화면/좌클릭을 꾸욱 누르고 있으면 각 무기의 고유 발사 간격(`fireIntervalMs`: 샷건 ~300ms, 리볼버 ~250ms, 개틀링 ~100ms)에 맞춰 자동으로 연발 사격되도록 구현한다.

## Decision Summary
- **D06**: 모바일 터치 홀드와 PC 마우스 좌클릭 홀드를 100% 동일하게 동작시켜, 한 번 톡 탭/클릭하면 즉시 1발 단발 사격이 나가고, 꾸욱 누르고 있으면(Hold) 각 무기의 `fireIntervalMs` 템포에 맞춰 연속 발사(`투두두두`)되도록 한다.
- **D07**: `GunGripPad.tsx`의 안내 문구를 홀드 자동 연발 지원에 맞춰 업데이트한다.

## Implementation

### I01. 모바일 터치패드 홀드 연발 상태 감지 및 스트리밍 연동 (`UnifiedTouchPad.ts`, `GunGripPad.tsx`, `ZeroingGuide.tsx`, `MobileControllerPage.tsx`)

- Related Files:
  - `src/controller/sensors/UnifiedTouchPad.ts` :: `TouchPadCallbacks`, `UnifiedTouchPadController` — `handlePointerDown` 후 `RAPID_FIRE_HOLD_MS(180ms)` 이상 누르고 있을 때 `onRapidFireHoldChange(true)` 콜백 호출 및 `handlePointerUp` 시 `false` 해제; modify
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPadProps`, `GunGripPad` — `onRapidFireHoldChange` prop 연결 및 패드 하단 안내 문구 업데이트; modify
  - `src/controller/components/ZeroingGuide.tsx` :: `ZeroingGuide` — 모바일 최초 영점 설정 화면에 단발 탭 / 꾸욱 홀드 자동 연발 / 더블탭 피버 / 위로 휙! 액티브 스킬 조작 요약 안내 추가; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — `rapidFireHoldRef.current`를 `onRapidFireHoldChange`와 연결하여 60Hz `SENSOR_FRAME`에 실시간 반영; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/controller/sensors/UnifiedTouchPad.ts
  export interface TouchPadCallbacks {
    onSingleTapFire: () => void;
    onFeverTrigger: () => void;
    onRapidFireHoldChange?: (holding: boolean) => void;
  }

  // src/controller/components/GunGripPad.tsx
  export interface GunGripPadProps {
    // ...기존 props
    onRapidFireHoldChange?: (holding: boolean) => void;
  }
  ```
- **Data & Schema Fields**:
  - `UnifiedTouchPadController`:
    - `private holdTimer: ReturnType<typeof setTimeout> | null = null` (180ms 홀드 감지 타이머)
    - `private isRapidHolding: boolean = false` (현재 홀드 연사 활성 여부)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `handlePointerDown` 시 기존 `holdTimer`가 남아 있다면 먼저 `clearTimeout`하여 중복 타이머 누수를 방지한다.
  2. Core Processing:
     - `UnifiedTouchPadController`:
       - `handlePointerDown(nowMs?: number)`: 즉시 1발 발사(`this.callbacks.onSingleTapFire()`) 및 더블탭(300ms 이내) 시 `onFeverTrigger()` 호출을 수행하고, 동시에 `this.holdTimer = setTimeout(() => { if (this.isPointerHeld) { this.isRapidHolding = true; this.callbacks.onRapidFireHoldChange?.(true); } }, 180)`를 시작한다.
       - `handlePointerUp(_nowMs?: number)`: `this.isPointerHeld = false;` 처리 후 `this.holdTimer`를 해제하고, `if (this.isRapidHolding) { this.isRapidHolding = false; this.callbacks.onRapidFireHoldChange?.(false); }`를 호출한다.
     - `GunGripPad.tsx`:
       - `onRapidFireHoldChangeRef`를 통해 `UnifiedTouchPadController`와 연결하고, 하단 가이드 문구를 `"🎯 화면 톡 탭 / 꾸욱 홀드:"` ➔ `"1발 단발 사격 및 꾸욱 눌러 자동 연발!"`로 업데이트한다.
     - `ZeroingGuide.tsx`:
       - `STEP1_CENTER` 안내 박스에 `"3. 사격 & 스킬 조작: 화면 탭(단발) / 꾸욱 홀드(투두두두 자동 연발) / 더블탭(피버) / 위로 휙!(액티브 스킬)"` 안내 항목을 추가하여 최초 연결 시점부터 개편된 조작법을 명확히 인지시킨다.
     - `MobileControllerPage.tsx`:
       - `GunGripPad`에 `onRapidFireHoldChange={(holding) => { rapidFireHoldRef.current = holding; flushSensorFrame(); }}`를 전달한다.
  3. Error & Exception Handling:
     - 컴포넌트 언마운트 또는 `pointercancel` 발생 시에도 `handlePointerUp` / `dispose()`가 호출되어 `rapidFireHold`가 영구 `true`로 고착(Stuck)되지 않도록 보장한다.
  4. State Transition & Return:
     - `SENSOR_FRAME.payload.rapidFireHold`가 홀드 중 `true`, 해제 즉시 `false`로 PC 호스트에 전송된다.

### I02. PC 마우스 좌클릭 홀드 자동 연발 및 모바일 홀드 수신 정밀화 (`GameCanvas3D.tsx`, `PCGamePage.tsx`)

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D` — 마우스 좌클릭(`mousedown`) 시 즉시 1발 격발 후, 누르고 있는 동안 35ms 주기로 `executeShot()`을 호출(엔진 내부 `canFire`가 무기별 `fireIntervalMs`를 정확히 지킴)하고 `mouseup` / `mouseleave` / `blur` 시 해제; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 모바일 `p.rapidFireHold` 수신 타이머를 `40ms` 간격으로 실행하여 개틀링(`83~150ms`)·리볼버(`210~280ms`)·샷건(`260~320ms`)의 고유 연사 속도가 지연 없이 발휘되도록 개선; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // GameCanvas3D internal handlers
  const stopMouseHold = (): void => { ... };
  const handleMouseDown = (e: MouseEvent): void => { ... };
  ```
- **Data & Schema Fields**:
  - `mouseHoldInterval: ReturnType<typeof setInterval> | null = null` (35ms 폴링 인터벌 핸들)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `e.button === 0` (마우스 좌클릭)일 때만 홀드 연발을 시작하며, 우클릭(`e.button === 2`)은 액티브 스킬 발동으로 유지한다.
  2. Core Processing:
     - `GameCanvas3D.tsx`:
       - `handleMouseDown(e)`: `e.button === 0`이면 즉시 1회 `executeShot()`을 호출한 뒤, `stopMouseHold()` 후 `mouseHoldInterval = setInterval(() => { executeShot(); }, 35)`를 시작한다. (`engine.shootAt` 내부에서 `weaponSystem.canFire(now, isFever)`가 각 무기의 `fireIntervalMs`가 경과했을 때만 발사를 허용하므로 무기별 고유 연사 속도가 100% 정확히 지켜진다.)
     - `PCGamePage.tsx`:
       - `SENSOR_RELAY` 핸들러에서 `const aimLocked = false; setIsAimLocked(false);`로 설정하여 터치 홀드 연사 중 조준선이 녹색 `AIM LOCKED`로 덮어써지지 않고 무기 고유 조준경이 유지되게 한다.
       - `p.rapidFireHold` 인터벌 주기를 기존 `100ms`에서 `40ms`로 줄여 개틀링 Lv.4(`80ms`)의 초고속 연사도 프레임 누락 없이 발사되게 한다.
  3. Error & Exception Handling:
     - 마우스를 누른 채 창 밖으로 나가거나(`mouseleave`), 다른 창으로 포커스가 이동(`window.blur`)하거나, `mouseup`이 발생할 때 모두 `stopMouseHold()`를 호출해 무한 발사 고착을 방지한다.
  4. State Transition & Return:
     - 홀드 중 무기별 `fireIntervalMs`마다 `onShoot` 콜백이 실행되어 3D 반동·레이저·사운드·판정이 동기화된다.

### I03. 컨트롤러 터치 홀드 연발 유닛 테스트 업데이트 (`tests/controller-sensors.test.ts`)

- Related Files:
  - `tests/controller-sensors.test.ts` :: `GunGripTracker & UnifiedTouchPadController` — 단발 탭 즉시 사격, 180ms 이상 홀드 시 `onRapidFireHoldChange(true)` 활성화 및 손 뗄 때 `false` 해제, 300ms 이내 더블탭 시 피버 발동 검증; modify

#### Details
- **Signatures & Types**: Vitest fake timers(`vi.useFakeTimers()`) 기반 유닛 테스트.
- **Data & Schema Fields**: `onSingleTapFire`, `onFeverTrigger`, `onRapidFireHoldChange` 스파이 함수.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `vi.useFakeTimers()` 활성화.
  2. Core Processing:
     - `handlePointerDown(1000)` 시 즉시 `onSingleTapFire` 1회 호출 확인.
     - `vi.advanceTimersByTime(200)` 경과 시 `onRapidFireHoldChange`가 `true`로 호출됨을 검증.
     - `handlePointerUp(1500)` 시 `onRapidFireHoldChange`가 `false`로 호출됨을 검증.
     - 300ms 이내 빠른 더블탭 시 `onFeverTrigger`가 정상 호출됨을 검증.
  3. Error & Exception Handling: 테스트 종료 시 `vi.useRealTimers()` 복원.
  4. State Transition & Return: 모든 센서·터치패드 테스트 통과.

## Acceptance Criteria
- [ ] 모바일 패드에서 화면을 톡 탭하면 1발이 즉시 발사되고, 180ms 이상 꾸욱 누르고 있으면 `onRapidFireHoldChange(true)`가 활성화되어 손을 뗄 때까지 무기별 `fireIntervalMs` 주기로 자동 연발된다.
- [ ] PC 마우스 모드에서 좌클릭을 꾸욱 누르고 있으면 마우스를 움직여 조준하는 동안 각 무기의 `fireIntervalMs` 주기에 맞춰 자동으로 연속 발사되며, 마우스 버튼을 떼면 즉시 멈춘다.
- [ ] 빠른 더블탭(300ms 이내) 시 모바일 피버 발동이 기존과 동일하게 작동한다.

## Validation
- `npm test -- tests/controller-sensors.test.ts` — 모든 테스트 통과

## Commit Message
```text
feat(controls): enable hold auto-fire for both mobile touch pad and PC mouse

Plan: 2026-11-04-combat-roguelike-boss-overhaul
Phase: P02-autofire-controls-and-3d-hud-polish
Task: T01-hold-autofire-for-mobile-and-pc

- Trigger onRapidFireHoldChange when holding mobile touch pad beyond 180ms
- Add left-click hold auto-fire loop in GameCanvas3D respecting weapon fireIntervalMs
- Update GunGripPad guide text and controller sensor unit tests
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
