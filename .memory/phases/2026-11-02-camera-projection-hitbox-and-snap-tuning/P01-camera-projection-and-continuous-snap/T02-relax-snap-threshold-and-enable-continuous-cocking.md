# Task: T02 Relax Snap Threshold and Enable Continuous Cocking

## Status: pending

## Goal
모바일 스냅 발사 가속도 인식 역치를 기존 4.8 m/s²에서 2.2 m/s²로 완화하여 가벼운 손목 까딱임만으로 즉각 격발되도록 하고, 화면 터치를 누르고 있는 동안에는 발사 후 코킹이 강제로 해제되던 버그를 제거(Continuous Cocking)하며 쿨다운을 180ms에서 110ms로 단축하여 손가락을 댄 채 "타닥타닥타닥" 딜레이 없이 즉각 연속 발사되는 쾌적한 아케이드 건슈팅 조작감을 구현한다.

## Decision Summary
- **D02**:
  - `constants.ts`: `WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2`: `4.8` ➔ `2.2`
  - `GunGripTracker.ts`: `detectSnapFire` 내부 `cooldownMs = 110` (기존 180ms)
  - `MobileControllerPage.tsx`: `onMotion`에서 발사 후 `isCockedRef.current = false` 강제 리셋 제거 (사용자가 화면을 터치하고 있는 동안에는 코킹 상태 유지). 손가락을 뗄 때(`pointerUp`)만 코킹 해제.

## Implementation

### I01. 발사 가속도 역치 및 쿨다운 단축
- Related Files:
  - `src/shared/constants.ts` :: `WEAPON_CONSTANTS` — modify
  - `src/controller/sensors/GunGripTracker.ts` :: `detectSnapFire` — modify
  - `tests/shared-protocol.test.ts` — modify
  - `tests/controller-sensors.test.ts` — modify

#### Details
- **Constants & Tracker Logic**:
  ```typescript
  // src/shared/constants.ts
  export const WEAPON_CONSTANTS = {
    MAX_AMMO: 10,
    AUTO_RELOAD_MS: 1200,
    RAPID_FIRE_HOLD_MS: 250,
    RAPID_FIRE_INTERVAL_MS: 115,
    FEVER_DOUBLE_TAP_MS: 300,
    SNAP_ACCEL_THRESHOLD_MPS2: 2.2, // 기존 4.8 -> 2.2 m/s² 대폭 완화
    FEVER_AUTO_FIRE_INTERVAL_MS: 95,
  } as const;

  // src/controller/sensors/GunGripTracker.ts
  public detectSnapFire(sample: LinearAccelerationSample): boolean {
    const threshold = WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2; // 2.2
    const cooldownMs = 110; // 기존 180ms -> 110ms (초당 최대 9발 연사)
    const magnitude = Math.hypot(sample.x, sample.y, sample.z);

    if (magnitude >= threshold) {
      if (sample.timestampMs - this.lastSnapTimeMs >= cooldownMs) {
        this.lastSnapTimeMs = sample.timestampMs;
        return true;
      }
    }
    return false;
  }
  ```

### I02. 터치 유지 중 연속 코킹(Continuous Cocking) 지원
- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `onMotion` — modify

#### Details
- **Continuous Cocking on Mobile**:
  - 기존 코드에서는 `snapFire` 발생 직후 `isCockedRef.current = false; setIsCockedState(false);`를 실행하여 손가락을 대고 있어도 조준이 풀렸음.
  - 수정: 발사 직후 코킹을 강제로 풀지 않고 유지! 손가락이 화면에 닿아 있는 동안 계속 코킹 상태를 유지하여 손목을 가볍게 까딱일 때마다 "타닥타닥" 연속 발사 가능.
  - 사격 직후 조준 좌표 고정(Lock)만 실시간 좌표로 갱신되도록 `tracker.unlockAim()`을 호출하여 부드러운 타겟 추적 지원.

## Acceptance Criteria
- [ ] 손목을 가볍게 튕겼을 때(가속도 2.2 m/s² 이상) 즉각 발사된다.
- [ ] 손가락으로 화면을 누르고 있는 동안 손목을 연속으로 튕기면 "타닥타닥타닥" 지연 없이 연속 발사된다.
- [ ] 손가락을 화면에서 떼면 코킹이 정상 해제된다.
- [ ] 전체 테스트 통과 및 `npm run build` 성공.

## Validation
- `npx vitest run tests/controller-sensors.test.ts tests/shared-protocol.test.ts` — 완화된 스냅 역치 및 연속 격발 테스트 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(controller): lower snap threshold to 2.2 m/s2 and enable continuous cocking

Plan: 2026-11-02-camera-projection-hitbox-and-snap-tuning
Phase: P01-camera-projection-and-continuous-snap
Task: T02-relax-snap-threshold-and-enable-continuous-cocking

- Lower SNAP_ACCEL_THRESHOLD_MPS2 from 4.8 to 2.2 m/s2 for effortless flick trigger
- Reduce snap fire cooldown from 180ms to 110ms
- Keep isCocked active while holding touch to allow rapid continuous snap firing
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
