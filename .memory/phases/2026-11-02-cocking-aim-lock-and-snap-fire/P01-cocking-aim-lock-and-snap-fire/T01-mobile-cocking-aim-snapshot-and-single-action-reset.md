# Task: T01 모바일 컨트롤러 코킹 시 조준 좌표 동결 스냅샷 및 1발 격발 즉시 자동 해제(리볼버 사이클) 구현

## Status: done

## Goal
모바일 화면 터치 시점(`PointerDown`, 코킹 장전)의 센서 조준 좌표(`aimX`, `aimY`)를 스냅샷하여 화면을 누르고 있는 동안 조준선이 흔들리지 않도록 고정하고, 손목을 위로 휙 채어올려 1발이 발사(`snapFire`)되는 즉시 코킹 및 조준 고정을 자동으로 해제하여(단발 리볼버 사이클) 손목 반동으로 인한 연발 오발을 방지한다. 피버 타임 중에는 조준 고정을 비활성화하여 자유 스윕 조준을 보장한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-cocking-aim-lock-and-snap-fire.md): 모바일 화면 터치 다운 즉시 조준 좌표 동결 (Instant Aim Freeze)
- [D02](../../decisions/2026-11-02-cocking-aim-lock-and-snap-fire.md): 1발 격발 즉시 조준 고정 해제 및 단발 리볼버 사이클 (Single-Action Reset)
- [D03](../../decisions/2026-11-02-cocking-aim-lock-and-snap-fire.md): 피버 타임(FEVER) 중에는 조준 고정을 비활성화하고 자유 조준 허용

## Implementation

### I01. MobileControllerPage 및 GunGripPad 조준 좌표 스냅샷 및 격발 리셋

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 코킹 시점의 조준 스냅샷(`lockedAimRef`), 60Hz 스트리밍 반영, `snapFire` 즉시 코킹 리셋; modify
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 격발 완료 시 UI 코킹 상태 리셋 연동; modify
  - `tests/controller-sensors.test.ts` :: `Sensor & Gesture` — 코킹 중 조준 좌표 고정 및 격발 즉시 리셋 검증 유닛 테스트; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/controller/MobileControllerPage.tsx
  const lockedAimRef = useRef<{ aimX: number; aimY: number } | null>(null);
  const isCockedRef = useRef<boolean>(false);
  ```
- **Execution Flow / Logic**:
  1. **터치 다운 (코킹 진입)**:
     - `onCockingChange(true)` 호출 시:
       - `isCockedRef.current = true;`
       - 만약 `!isFeverReady` 및 피버 상태가 아니라면:
         `lockedAimRef.current = tracker.computeAim(latestOrientationRef.current);`
       - 피버 상태라면:
         `lockedAimRef.current = null;` (D03: 피버 중 조준 고정 미적용)
  2. **60Hz 센서 스트리밍 (`flushSensorFrame`)**:
     - `const liveAim = tracker.computeAim(latestOrientationRef.current);`
     - 만약 `isCockedRef.current && lockedAimRef.current`:
       - 패킷의 `aimX, aimY`로 고정된 `lockedAimRef.current.aimX, lockedAimRef.current.aimY`를 전송!
       - `pitchDeg, yawDeg, rollDeg`는 센서 모니터링을 위해 실시간 값 유지.
     - 그 외 일반 상태:
       - `liveAim.aimX, liveAim.aimY`를 전송.
  3. **스냅 격발 (`onMotion` 감지)**:
     - `snap && isCockedRef.current` 조건 만족 시:
       - `snapFireRef.current = true;`
       - 즉시 1발 전송: `flushSensorFrame();`
       - **D02 단발 리볼버 리셋**:
         - `isCockedRef.current = false;`
         - `lockedAimRef.current = null;`
         - `GunGripPad` UI에도 코킹 해제를 알리기 위해 상태 동기화 콜백 전달.
  4. **터치 업 (손가락 뗌, 코킹 취소)**:
     - `onCockingChange(false)` 호출 시:
       - `isCockedRef.current = false;`
       - `lockedAimRef.current = null;`
       - `flushSensorFrame();` (PC에 즉시 `isCocked: false` 및 실시간 자이로 좌표 전송)

### I02. 컨트롤러 센서 파이프라인 단위 테스트 보강

- Related Files:
  - `tests/controller-sensors.test.ts` :: `Controller Sensor Pipeline` — 조준 좌표 스냅샷 및 격발 후 리셋 동작 테스트 추가; modify

#### Details
- 코킹 전 ➔ 코킹 중 센서 각도 변경 ➔ 패킷 좌표가 코킹 시점 좌표로 불변 유지됨을 검증.
- `snapFire` 발생 후 즉시 코킹이 해제되어 다음 프레임부터 실시간 각도로 복귀함을 검증.

## Acceptance Criteria
- [ ] 모바일 화면을 누르고 있는 동안(`isCocked === true`) 폰을 흔들거나 위로 휙 채어도 PC로 전송되는 `aimX, aimY`가 터치다운 순간의 좌표로 완벽하게 고정된다.
- [ ] 위로 휙 채어 `snapFire`가 발동되는 즉시 코킹과 조준 고정이 자동으로 풀려 실시간 각도로 복귀하며, 손을 뗐다가 다시 눌러야만 다음 코킹이 가능하다.
- [ ] 피버 타임 중에는 화면을 터치해도 조준이 고정되지 않고 자유롭게 회전한다.
- [ ] `tests/controller-sensors.test.ts` 테스트 통과.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 컨트롤러 조준 고정 및 리셋 테스트 통과

## Commit Message
```text
feat(controller): freeze aim coordinates on touch cocking and reset single-action on snap fire

Plan: 2026-11-02-cocking-aim-lock-and-snap-fire
Phase: P01-cocking-aim-lock-and-snap-fire
Task: T01-mobile-cocking-aim-snapshot-and-single-action-reset

- Snapshot aimX and aimY upon pointer down cocking and freeze coordinates during hold
- Reset isCocked and aim lock immediately after snapFire to prevent recoil double-firing
- Bypass aim lock during fever mode for unrestricted multi-target sweeping
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
