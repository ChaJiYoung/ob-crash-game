# Task: T01 GunGripTracker 3D Forward Vector 및 중력 가상 평면 투영 알고리즘 전면 교체

## Status: done

## Goal
`GunGripTracker.ts`의 조준 각도 계산 방식을 기존의 W3C 오일러 각도 수동 감산(`alpha, beta, gamma`) 및 불완전한 조건부 보조(`deltaBeta + deltaGamma`) 방식에서, 폰 상단(총구) 단위 벡터 $\vec{F} = Q \cdot (0, 1, 0)$와 중력 기준 가상 모니터 직교 기저 평면 투영 방식으로 전면 교체하여, 대각선 조준 시의 축 꼬임과 짐벌락(좌상단 조준 시 우상단으로 튐) 현상을 원천 제거한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-forward-vector-raycast-aiming.md): W3C 오일러 각도 직접 감산 폐기 및 3D Forward Vector $\vec{F} = Q \cdot (0, 1, 0)$ 직접 추적.
- [D02](../../decisions/2026-11-02-forward-vector-raycast-aiming.md): 영점 시점의 총구 벡터 $\vec{F}_0$와 월드 수직축 $\vec{U}_{world}=(0, 0, 1)$의 외적으로 가상 모니터 평면$(\vec{R}_0, \vec{U}_0, \vec{F}_0)$을 구축하고, 현재 총구 벡터의 내적 투영으로 $(yawDeg, pitchDeg)$ 산출.

## Implementation

### I01. GunGripTracker 내부 상태 및 영점 기저(Orthonormal Basis) 정의

- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker` — 3D 직교 기저 필드 및 영점 캘리브레이션 알고리즘 교체; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export class GunGripTracker {
    private zeroForward = new THREE.Vector3(0, 1, 0);
    private zeroRight = new THREE.Vector3(1, 0, 0);
    private zeroUp = new THREE.Vector3(0, 0, 1);
    private isCalibrated = false;
    ...
  }
  ```
- **Execution Flow / Logic**:
  1. `calibrateZero(sample: EulerOrientation)`:
     - `qCurrent = this.eulerToQuaternion(sample)`
     - 로컬 총구 방향 $(0, 1, 0)$에 `qCurrent`를 곱해 월드 총구 벡터 $\vec{F}_0$ 산출:
       `this.zeroForward.set(0, 1, 0).applyQuaternion(qCurrent).normalize();`
     - W3C 좌표계의 월드 Up 벡터 $\vec{U}_{world} = (0, 0, 1)$과 외적하여 화면 수평축 $\vec{R}_0$ 계산:
       `const worldUp = new THREE.Vector3(0, 0, 1);`
       `this.zeroRight.crossVectors(this.zeroForward, worldUp);`
       (특이점 방지: 만약 `this.zeroRight.lengthSq() < 1e-4`이면 수평축을 `(1, 0, 0)` 기반으로 fallback 계산)
       `this.zeroRight.normalize();`
     - 화면 수평축과 총구 벡터를 외적하여 화면 수직축 $\vec{U}_0$ 계산:
       `this.zeroUp.crossVectors(this.zeroRight, this.zeroForward).normalize();`
     - `this.isCalibrated = true;`
     - 스무딩 초기화 (`smoothedAimX = 0, smoothedAimY = 0, hasSmoothedSample = false`)

### I02. 3D Forward Vector 투영 기반 computeRelativeAngles 재구현

- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `computeRelativeAngles` — 3D 기저 투영으로 오일러 짐벌락 없는 각도 산출; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public computeRelativeAngles(sample: EulerOrientation): { yawDeg: number; pitchDeg: number; rollDeg: number }
  ```
- **Execution Flow / Logic**:
  1. `if (!this.isCalibrated) return { yawDeg: 0, pitchDeg: 0, rollDeg: 0 };`
  2. 현재 쿼터니언 $Q = \text{this.eulerToQuaternion}(sample)$
  3. 현재 월드 총구 벡터:
     `const currentForward = new THREE.Vector3(0, 1, 0).applyQuaternion(Q).normalize();`
  4. 가상 모니터 기저에 내적(투영) 분해:
     - `const projX = currentForward.dot(this.zeroRight);`  // 우측 조준 편차
     - `const projY = currentForward.dot(this.zeroUp);`     // 상단 조준 편차
     - `const projZ = currentForward.dot(this.zeroForward);`// 정면 축 투영 성분
  5. 각도 편차 추출:
     - `const yawDeg = THREE.MathUtils.radToDeg(Math.atan2(projX, projZ));`
     - `const pitchDeg = THREE.MathUtils.radToDeg(Math.atan2(projY, projZ));`
     - `const rollDeg = 0;`
  6. 산출된 `{ yawDeg, pitchDeg, rollDeg }` 반환.

### I03. 기존 설정 및 스무딩, 가동 범위 측정과의 호환 유지

- `computeAim`에서는 `computeRelativeAngles`에서 얻은 `yawDeg`, `pitchDeg`를 바탕으로:
  - `rawAimX = clamp((yawDeg / config.yawHalfRangeDeg) * config.sensitivityX, -1, 1)`
  - `rawAimY = clamp((signedPitch / config.pitchHalfRangeDeg) * config.sensitivityY, -1, 1)`
  - 기존의 적응형 스무딩 및 반동 억제 로직 그대로 작동 유지.

## Acceptance Criteria
- [ ] 오일러 각도의 수동 감산 및 `deltaBeta < deltaGamma * 0.5` 휴리스틱이 제거된다.
- [ ] 폰을 정면 영점 후 좌측으로 기울이면 `yawDeg < 0` (`aimX < 0`), 우측은 `yawDeg > 0` (`aimX > 0`)이 산출된다.
- [ ] 폰을 위로 기울이면 `pitchDeg > 0` (`aimY > 0`), 아래는 `pitchDeg < 0` (`aimY < 0`)이 산출된다.
- [ ] 대각선(좌상단: 좌측+상단)으로 기울였을 때 `yawDeg < 0`과 `pitchDeg > 0`이 정확히 유지되며 우상단으로 반전되지 않는다.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 기존 5개 테스트가 깨지지 않고 모두 통과해야 함.

## Commit Message
```text
feat(controller): replace euler math with 3d forward vector screen projection

Plan: 2026-11-02-forward-vector-raycast-aiming
Phase: P01-forward-vector-aiming
Task: T01-forward-vector-projection

- Replace euler angle subtractions with 3D muzzle forward vector tracking
- Construct gravity-aligned virtual screen basis on zero calibration
- Project current forward vector to screen basis to eliminate diagonal gimbal lock
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
