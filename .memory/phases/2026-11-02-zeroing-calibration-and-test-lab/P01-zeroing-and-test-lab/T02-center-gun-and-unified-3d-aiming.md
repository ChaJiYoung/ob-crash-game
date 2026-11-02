# Task: T02 3D 총기 중앙 하단 배치(Center Mount), 총구·조준선·탄도 궤적 단일 3D 좌표계 통합 및 몬스터 높이별 Y축 판정 보정

## Status: done

## Goal
3D 총기(`DraftTapGun3D`)를 화면 우측(`x = 0.48`)에서 정중앙 하단(`x = 0.0`)으로 이동하여 좌우 시차를 제거하고, 2D 조준선(`CrosshairOverlay`)·3D 총구 방향·빅 스코프 레이저·총알 궤적(`spawnTracerBeam`)·몬스터 상하좌우 피격 판정(`BeerCrusherEngine.shootAt`)이 모두 단일 3D 카메라 투영 좌표계를 공유하도록 일원화합니다.

## Decision Summary
- **D05**: `DraftTapGun3D`의 기본 위치를 화면 정중앙 하단(`x = 0.0, y = -0.46, z = -0.92`)에 배치하고, 카메라 역투영(Unproject) 기준 목표점을 향해 총구 회전과 총알 궤적이 정확히 직선으로 꽂히도록 통합합니다.
- **D06**: `BeerCrusherEngine.shootAt`에서 공중(`y = 1.45`), 보스/아이템(`y = 1.15`), 지상(`y = 0.55`) 몬스터의 실제 화면 투영 높이(`targetNormY`)를 계산하여 눈에 보이는 몬스터 위치와 명중 판정을 일치시킵니다.

## Implementation

### I01. 조준선 NDC 변환 헬퍼 및 3D 총기 정중앙 하단(Center Mount) 조준 정렬

- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `aimToNdc`, `viewportRatioToAim` — 조준선 퍼센트(`[8~92%], [10~90%]`)와 정확히 대응하는 NDC(`[-0.84, +0.84]`, `[-0.76, +0.76]`) 양방향 변환 함수 추가; modify
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D` — 정중앙 하단 배치(`x = 0.0`) 및 조준점 방향 정확한 총열 회전각 적용; modify
  - `src/pc/components/GameCanvas3D.tsx` :: `computeAimWorldPoint`, `GameCanvas3D` — 카메라 역투영을 통해 조준선 정중앙의 3D 월드 좌표를 계산하고 총알 궤적과 마우스 좌표를 일치시킴; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/components/CrosshairOverlay.tsx
  export function aimToNdc(aimX: number, aimY: number): { ndcX: number; ndcY: number } {
    const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
    return {
      ndcX: (leftPercent - 50) / 50, // [-0.84, +0.84]
      ndcY: (50 - topPercent) / 50,  // [-0.76, +0.76]
    };
  }

  export function viewportRatioToAim(normX: number, normY: number): { aimX: number; aimY: number } {
    // normX, normY in [-1, 1] from mouse event -> mapped so crosshair sits directly under cursor
    return {
      aimX: Math.max(-1, Math.min(1, normX / 0.84)),
      aimY: Math.max(-1, Math.min(1, normY / 0.76)),
    };
  }
  ```
- **`DraftTapGun3D` 중앙 배치 및 회전**:
  - `basePosition = new THREE.Vector3(0.0, -0.46, -0.92)`로 변경하여 화면 정중앙 하단에 총기를 위치시킵니다 (`gun.group.position.x` 초기값 `0`).
  - `updateAimAndRecoil(aimX, aimY, dtSec, isFeverActive)`에서 카메라 수평/수직 시야각(`vFov = 52°`, `aspect ≈ 16/9`)과 `aimToNdc` 비율에 맞춰 총열이 실제 조준선 방향을 정확히 가리키도록 회전각(`targetRotY = -aimX * 0.58`, `targetRotX = aimY * 0.36 + this.currentRecoilPitch`)과 미세 스웨이(`targetPosX = this.basePosition.x + aimX * 0.04`)를 갱신합니다.
- **`GameCanvas3D` 탄도 궤적(`spawnTracerBeam`) 및 마우스 일치**:
  - `export function computeAimWorldPoint(camera: THREE.PerspectiveCamera, aimX: number, aimY: number, distanceM = 14): THREE.Vector3` 헬퍼를 구현합니다:
    1. `const { ndcX, ndcY } = aimToNdc(aimX, aimY);`
    2. `const targetNDC = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);`
    3. `const dir = targetNDC.sub(camera.position).normalize();`
    4. `return camera.position.clone().addScaledVector(dir, distanceM);`
  - 사격 시:
    - 명중(`result.grade !== 'MISS' && result.target`)한 경우, 몬스터 중심 높이와 조준 광선이 만나는 지점(`computeAimWorldPoint(camera, curAim.aimX, curAim.aimY, result.target.radiusM)`와 몬스터 실제 3D 높이 `mesh.position.y + 0.35`를 보간)으로 레이저 궤적을 쏘아 조준선 한가운데로 총알이 꽂히게 합니다.
    - 빗나간(`MISS`) 경우에도 하드코딩 좌표 대신 `computeAimWorldPoint(camera, curAim.aimX, curAim.aimY, 16)`으로 발사하여 **항상 조준선 정중앙 점으로 총알이 날아가도록** 보장합니다.
  - 마우스 이동(`handleMouseMove`) 시 `viewportRatioToAim(normX, normY)`를 적용해 마우스 커서와 조준선 위치가 1px 오차 없이 일치하게 합니다.

### I02. `BeerCrusherEngine` 몬스터 종류별 3D 높이 반영 수직(`targetNormY`) 명중 판정 보정

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `computeTargetAimCoords`, `shootAt` — 몬스터 종류별 높이(공중/보스/지상)를 반영한 정규화 조준 좌표 계산 및 판정; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface TargetAimProjection {
    targetNormX: number;
    targetNormY: number;
    apparentHitRadius: number;
  }

  // BeerCrusherEngine method
  public computeTargetAimCoords(
    target: ActiveTargetEntity,
    wideScopeMult = 1.0
  ): TargetAimProjection;
  ```
- **Execution Flow / Logic**:
  1. `targetNormX`: 기존과 동일하게 `target.thetaRad / (hHalfFov * STAGE_CONSTANTS.FAN_MARGIN_RATIO)`로 계산합니다.
  2. `targetNormY`:
     - 몬스터 시각적 중심 높이 `visualCenterY`:
       - 공중(`pilgood`, `caslight`): `1.55`
       - 아이템 또는 보스(`isItem` 또는 `boss`): `1.20`
       - 지상(`bottle`, `obi`, `hanmac`): `0.72`
     - 카메라 기준 시선 높이(`eyeRefY = 1.18`)와의 높이 차 `deltaY = visualCenterY - eyeRefY`를 거리 `effDist = Math.max(2.5, target.radiusM)` 및 수직 반시야각(`vHalfFovRad = THREE.MathUtils.degToRad(this.vFovDeg / 2)`)으로 투영:
       `targetNormY = Math.max(-0.85, Math.min(0.85, deltaY / (effDist * Math.tan(vHalfFovRad) * 0.76)))`
  3. **수직/수평 거리 판정 (`shootAt`)**:
     - `dx = aimX - targetNormX`
     - 몬스터 메시는 원통/병 형태로 수직 길이가 길고, 기존 수평 중심 사격(`aimY = 0`)과의 호환성도 유지하기 위해 수직 오차는 `dy = Math.min(Math.abs(aimY - targetNormY), Math.abs(aimY) * 0.65) * 0.65` (단, 정지 과녁 상하 조준 테스트 시 `target.customNormY !== undefined`가 지정된 경우 `dy = aimY - target.customNormY`)로 계산합니다.
     - `dist = Math.hypot(dx, dy)`를 `apparentHitRadius`와 비교해 `evaluateHitJudgment`에 전달합니다.

### I03. 3D 총기 중앙 배치 및 수직/수평 명중 판정 유닛 테스트

- Related Files:
  - `tests/three-stage-and-models.test.ts` — `DraftTapGun3D` 중앙 배치(`x === 0`), 조준 회전, `computeAimWorldPoint` 검증; modify
  - `tests/engine-judgment-and-spawn.test.ts` — 공중 몬스터(`targetNormY > 0`)와 지상 병맥주(`targetNormY < 0`)의 투영 높이 계산 및 명중 판정 검증; modify
  - `tests/pc-hud-and-banner.test.ts` — `aimToNdc`, `viewportRatioToAim` 양방향 일관성 검증; modify

## Acceptance Criteria
- [ ] `DraftTapGun3D`의 기본 X 좌표가 `0.0`(화면 정중앙 하단)으로 배치되어 좌우 시차가 사라진다.
- [ ] `computeAimWorldPoint(camera, aimX, aimY)`로 계산된 3D 좌표를 카메라로 다시 투영(`project(camera)`)하면 `aimToNdc(aimX, aimY)`(조준선 중심)와 정확히 일치한다.
- [ ] 공중 캔(`pilgood`)은 `targetNormY > 0`, 지상 병맥주(`bottle`)는 `targetNormY < 0`으로 계산되며, 해당 높이를 조준해 사격했을 때 `PERFECT` 명중 판정이 발생한다.
- [ ] 기존 모든 엔진 및 HUD 유닛 테스트가 100% 통과한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts tests/engine-judgment-and-spawn.test.ts tests/pc-hud-and-banner.test.ts` — 모든 테스트 통과

## Commit Message
```text
feat(pc): center-mount 3D gun and unify crosshair, tracer, and hit judgment coordinates

Plan: 2026-11-02-zeroing-calibration-and-test-lab
Phase: P01-zeroing-and-test-lab
Task: T02-center-gun-and-unified-3d-aiming

- Move DraftTapGun3D to bottom-center (x=0) to eliminate horizontal parallax
- Unify CrosshairOverlay NDC, camera unprojection tracer target, and mouse aim mapping
- Incorporate 3D target elevation (airborne vs ground) into BeerCrusherEngine hit judgment
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: completed
