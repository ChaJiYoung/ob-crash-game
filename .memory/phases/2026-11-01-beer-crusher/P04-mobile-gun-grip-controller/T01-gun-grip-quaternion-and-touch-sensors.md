# Task: T01 휴대폰 deviceId 발급, 권총 그립(+Y 총구·+X 상단 스냅) 3D 쿼터니언 센서 및 85% 통합 터치패드 제스처 머신 구현

## Status: pending

## Goal
스마트폰을 실제 권총처럼 쥐었을 때(**휴대폰 윗부분 `+Y`축 = 모니터 총구 방향, 화면 `+Z`축 = 좌측 방향, 우측 긴 모서리 `+X`축 = 천장 방향**) 짐벌락 없이 조준 좌표를 산출하는 3D 쿼터니언 추적기(`GunGripTracker`), `+X`축 상단 스냅 단발 사격 감지기, 그리고 화면 하단 85% 단일 패드에서 **꾹 누르기(`0.25s↑`) = 연사 / 더블탭(`0.3s↓`) = 피버**를 판별하는 제스처 컨트롤러(`UnifiedTouchPadController`)를 구현합니다.

## Decision Summary
- **D08**: `localStorage`의 `beer_crusher_device_id` 키를 사용하여 기기 고유 식별자를 영구 유지
- **D09**: 권총 그립(`+Y`축 총구, 화면 좌측)에서 오일러 각도 직접 뺄셈 시 발생하는 짐벌락을 막기 위해 `THREE.Quaternion`으로 로컬 `+Y` 단위벡터 $(0, 1, 0)$을 회전 투영하며, 단발 스냅은 `+X`축 선형 가속도(`>= 12 m/s²`), 연사/피버는 단일 통합 패드(`0.25s` 홀드 / `0.3s` 더블탭)로 처리

## Implementation

### I01. `DeviceIdentity`, `GunGripTracker`, `UnifiedTouchPadController`, `HapticFeedback` 구현
- Related Files:
  - `src/controller/sensors/DeviceIdentity.ts` :: `getOrCreateDeviceId`, `DEVICE_ID_STORAGE_KEY` — 휴대폰 고유번호 조회 및 생성 유틸리티; new
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker`, `EulerOrientation`, `LinearAccelerationSample` — 3D 쿼터니언 기반 `+Y` 총구 조준 투영 및 `+X`축 상단 스냅 단발 사격 감지기; new
  - `src/controller/sensors/UnifiedTouchPad.ts` :: `UnifiedTouchPadController`, `TouchPadCallbacks` — `0.25s` 홀드 연사 및 `0.30s` 더블탭 피버 제스처 상태 머신; new
  - `src/controller/sensors/HapticFeedback.ts` :: `triggerHaptic` — `navigator.vibrate` 안전 래퍼 함수; new

#### Details
- **Signatures & Types**:
  ```typescript
  export const DEVICE_ID_STORAGE_KEY = 'beer_crusher_device_id';
  export function getOrCreateDeviceId(storage?: Pick<Storage, 'getItem' | 'setItem'>): string;

  export interface EulerOrientation {
    alpha: number; // 0 ~ 360
    beta: number;  // -180 ~ 180
    gamma: number; // -90 ~ 90
  }
  export interface LinearAccelerationSample {
    x: number;
    y: number;
    z: number;
    timestampMs: number;
  }

  export class GunGripTracker {
    calibrateZero(sample: EulerOrientation): void;
    computeAim(sample: EulerOrientation): { aimX: number; aimY: number; yawDeg: number; pitchDeg: number; rollDeg: number };
    detectSnapFire(sample: LinearAccelerationSample): boolean;
  }

  export class UnifiedTouchPadController {
    constructor(callbacks: { onRapidFireChange: (active: boolean) => void; onFeverTrigger: () => void });
    handlePointerDown(nowMs?: number): void;
    handlePointerUp(nowMs?: number): void;
    dispose(): void;
  }
  ```
- **Execution Flow / Logic**:
  1. **`GunGripTracker` 3D 쿼터니언 회전 투영 (`D09`)**:
     - W3C DeviceOrientation 표준 회전 순서 `'YXZ'`로 `THREE.Euler(degToRad(beta), degToRad(alpha), -degToRad(gamma), 'YXZ')`를 구성해 현재 기기 쿼터니언 $q_{cur}$ 생성.
     - `calibrateZero(sample)` 호출 시 $q_{zero}^{-1} = q_{cur}.\text{clone}().\text{invert}()$ 저장.
     - `computeAim(sample)` 호출 시 상대 회전 $q_{rel} = q_{zero}^{-1} \cdot q_{cur}$를 계산하여 로컬 총구 방향 벡터 $\vec{v}_{barrel} = (0, 1, 0)$에 적용.
     - 권총 그립(화면 좌측 = 기기 로컬 `+X`축이 위쪽 천장, `-Z`축이 우측 수평 방향) 기준:
       - 우측 조준 편차 `yawDeg` 및 상단 조준 편차 `pitchDeg`를 추출하여:
       - `aimX = clamp(yawDeg / 25, -1, 1)`
       - `aimY = clamp(pitchDeg / 18, -1, 1)` 반환.
  2. **`+X`축 상단 스냅 단발 사격 (`detectSnapFire`)**:
     - `Math.abs(sample.x) >= 12.0` (`WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2`) 이고 `sample.timestampMs - lastSnapMs >= 180`일 때 `lastSnapMs = sample.timestampMs` 갱신 후 `true` 반환.
  3. **`UnifiedTouchPadController` 제스처 판별**:
     - `handlePointerDown(nowMs)`: 직전 탭 시각과의 차이가 `<= 300ms`이면 즉시 `onFeverTrigger()` 호출. 아니면 `250ms` 타이머 설정 후 만료 시 `onRapidFireChange(true)` 호출.
     - `handlePointerUp(nowMs)`: 홀드 타이머 취소, 만약 연사 활성 중이었다면 `onRapidFireChange(false)` 호출.

### I02. 권총 그립 쿼터니언 조준·`+X` 스냅·통합 터치패드 단위 테스트
- Related Files:
  - `tests/controller-sensors.test.ts` :: `describe('GunGripTracker & UnifiedTouchPadController')` — `deviceId` 영속성, 쿼터니언 조준, `+X` 스냅 쿨다운, 홀드 연사/더블탭 피버 검증; new

#### Details
- `getOrCreateDeviceId`: 최초 호출 시 UUID 생성 후 두 번째 호출 시 동일 ID를 반환하는지 검증.
- `GunGripTracker`:
  - 권총 그립 자세(`beta: 0, gamma: -85, alpha: 180`)에서 `calibrateZero` 수행 직후 동일 각도 입력 시 `aimX === 0, aimY === 0` 반환 검증.
  - 총구(`+Y`)를 우측/위쪽으로 회전시켰을 때 짐벌락 없이 `aimX > 0`, `aimY > 0`으로 비례 변환되는지 검증.
  - `detectSnapFire`: `x = 14.5 m/s²` 입력 시 `true` 반환, `100ms` 뒤 연속 입력 시 쿨다운(`180ms`)에 의해 `false` 반환, `200ms` 뒤 입력 시 다시 `true` 반환 검증.
- `UnifiedTouchPadController`: `250ms` 경과 시 `onRapidFireChange(true)` 호출 및 포인터 업 시 `false` 복귀, `300ms` 이내 더블탭 시 `onFeverTrigger()` 1회 호출 검증.

## Acceptance Criteria
- [ ] `GunGripTracker`가 권총 그립(`+Y` 총구·화면 좌측)에서 짐벌락 없이 `aimX`, `aimY`를 산출하고 `+X`축 가속도 피크로 단발 스냅을 감지함
- [ ] `UnifiedTouchPadController`가 단일 패드에서 `0.25s` 홀드 연사와 `0.3s` 더블탭 피버를 정확히 구분함
- [ ] `npx vitest run tests/controller-sensors.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — `DeviceIdentity`, `GunGripTracker`, `UnifiedTouchPadController` 단위 테스트 통과

## Commit Message
```text
feat(controller-sensors): implement deviceId generator, gun-grip quaternion tracker, and unified touch pad

Plan: 2026-11-01-beer-crusher
Phase: P04-mobile-gun-grip-controller
Task: T01-gun-grip-quaternion-and-touch-sensors

- Implement getOrCreateDeviceId with localStorage persistence
- Implement GunGripTracker using 3D quaternion projection (+Y barrel, +X upward snap)
- Implement UnifiedTouchPadController for 0.25s hold rapid-fire and 0.3s double-tap fever
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
