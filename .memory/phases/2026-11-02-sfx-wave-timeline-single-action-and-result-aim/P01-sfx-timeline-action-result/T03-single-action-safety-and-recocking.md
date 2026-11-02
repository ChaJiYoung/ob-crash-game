# Task: T03 Single-Action Safety Lock and Re-Cocking Haptic Feedback

## Status: done

## Goal
손목 스냅 1발 발사 즉시 격발 잠금(isCocked = false)을 걸어 화면에서 손을 뗄 때까지 반동 흔들림으로 인한 2차 오발(Double-Fire)을 원천 차단하고, 손을 뗐다가 다시 누를 때 25ms 숏 햅틱과 찰칵 장전음으로 다음 탄환 준비를 명확히 인지시킨다.

## Decision Summary
- 1터치 1발 단발 안전장치(Single-Action Safety Lock) 적용. 발사 즉시 잠금 해제 및 화면 터치를 유지하는 동안 추가 발사 완전 차단 ([D03](../../decisions/2026-11-02-sfx-wave-timeline-single-action-and-result-aim.md)).

## Implementation

### I01. Single-Action Lock in Mobile Motion Handler

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 모션 핸들러 단발 잠금; modify

#### Details
- **Execution Flow / Logic**:
  1. `onMotion` 이벤트 핸들러:
     ```typescript
     if (snap && isCockedRef.current) {
       snapFireRef.current = true;
       // [단발 안전장치] 격발 즉시 코킹 해제 및 단발 잠금!
       isCockedRef.current = false;
       setIsCockedState(false);
       flushSensorFrame();
       tracker.unlockAim();
     }
     ```
  2. 화면을 손가락으로 누르고 있는 동안:
     - 손목 스냅 발사 직후 스마트폰의 감속이나 반동 흔들림으로 인해 추가적인 가속도 스파이크가 발생해도, `isCockedRef.current`가 `false`이므로 2차 발사가 절대 일어나지 않음.
  3. 손가락을 뗄 때 (`handlePointerUp`):
     - `isCockedRef.current = false;` (이미 false이지만 확인)
     - 다음 발사를 위한 재장전 대기 상태 진입.

### I02. Re-Cocking 25ms Haptic & Sound Feedback

- Related Files:
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 터치 다운 재코킹 피드백; modify
  - `src/controller/sensors/HapticFeedback.ts` :: `triggerHaptic` — 햅틱 지속시간 25ms 지원; read-only

#### Details
- **Touch Down Handler**:
  ```typescript
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setInternalCocked(true);
    // 25ms 숏 햅틱 피드백으로 가벼운 손맛 전달
    triggerHaptic(25);
    onCockingChangeRef.current?.(true);
    touchPadRef.current?.handlePointerDown();
  };
  ```
- **PC & Mobile Sound Coordination**:
  - `PCGamePage.tsx`에서 `p.isCocked && !lastIsCockedRef.current` 감지 시 `soundSynth.playCocking()`이 경쾌한 2단계 찰칵 장전음을 모니터 스피커로 출력.

### I03. Safety Lock Unit Tests

- Related Files:
  - `tests/controller-sensors.test.ts` :: 단발 안전장치 시나리오 테스트 추가; modify

#### Details
- **Test Scenarios**:
  1. `isCocked` 상태에서 1회 스냅 발생 시 `snapFire` 플래그가 전송되고, 코킹 상태가 즉시 `false`로 전이되는지 검증.
  2. 터치를 떼지 않고 후속 스냅 가속도가 연속 유입되어도 추가 `snapFire`가 발생하지 않는지 검증.
  3. `pointerUp` 후 다시 `pointerDown` 시 정상적으로 재코킹되는지 검증.

## Acceptance Criteria
- [ ] 손가락을 패드에 댄 채 손목을 1번 흔들어 쏘고 나면, 손을 떼기 전까지 아무리 세게 흔들어도 2차 발사가 일어나지 않는다.
- [ ] 손가락을 뗐다가 다시 대는 순간 25ms 숏 햅틱과 함께 찰칵 장전음이 나며 다음 1발이 즉시 준비된다.
- [ ] 단위 테스트가 성공적으로 통과한다.

## Validation
- `pnpm test tests/controller-sensors.test.ts` — 센서 및 단발 안전장치 테스트 통과
- `pnpm test` — 전체 테스트 100% 통과

## Commit Message
```text
fix(controller): enforce single-action safety lock to prevent recoil double-fire

Plan: 2026-11-02-sfx-wave-timeline-single-action-and-result-aim
Phase: P01-sfx-timeline-action-result
Task: T03-single-action-safety-and-recocking

- Enforce instant isCocked reset on snapFire to prevent recoil double-fire
- Add 25ms crisp haptic pulse on pointerDown re-cocking
- Add unit test verifying continuous-hold double-fire prevention
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
