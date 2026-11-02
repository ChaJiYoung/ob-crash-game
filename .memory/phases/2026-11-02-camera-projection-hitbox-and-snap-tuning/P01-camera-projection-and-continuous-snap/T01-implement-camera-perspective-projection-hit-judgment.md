# Task: T01 Implement Camera Perspective Projection Hit Judgment

## Status: pending

## Goal
`BeerCrusherEngine.ts` 내부의 부정확한 각도 나눗셈 공식을 Three.js 3D 카메라의 실제 원근 투영(`Vector3.project(camera)`)으로 전면 교체하여, 화면상에 렌더링된 몬스터의 실제 화면 위치(NDC)와 조준경(`CrosshairOverlay`)의 NDC 좌표를 1:1로 직접 비교함으로써 "눈에 보이는 대로 쏘면 100% 명중"하는 완벽한 정밀 탄착군을 구현한다.

## Decision Summary
- **D01**:
  - `BeerCrusherEngine.ts`: 내부에 `THREE.PerspectiveCamera(52, this.aspect, 0.1, 100)`를 동기화하고 `(0, 1.65, 2.2)` 위치와 `(0, 1.35, -12)` 조준 방향을 유지.
  - `computeTargetAimCoords`: 타겟의 3D 월드 좌표 `(target.x, targetBaseY, target.z)`를 `camera.project()`하여 실제 화면 NDC X, Y를 산출.
  - `shootAt`: 입력 `(aimX, aimY)`를 `aimToNdc`를 통해 NDC 좌표계로 변환한 뒤, 프로젝션된 몬스터 위치와의 화면 유클리드 거리 `dist`를 계산하여 피격 판정 수행.

## Implementation

### I01. Three.js 카메라 뷰-투영 행렬 기반 타겟 좌표 산출
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine`, `computeTargetAimCoords`, `shootAt` — modify
  - `tests/engine-judgment-and-spawn.test.ts` — modify

#### Details
- **Signatures & Data Flow**:
  ```typescript
  import * as THREE from 'three';
  import { aimToNdc } from '../components/CrosshairOverlay';
  import { getTargetBaseY } from '../three/TargetModels3D';

  export class BeerCrusherEngine {
    // 3D Camera for 1:1 screen projection matching GameCanvas3D
    private projCamera: THREE.PerspectiveCamera;

    constructor(initialLives?: number, vFovDeg = 52, aspect = 16 / 9) {
      // ...
      this.projCamera = new THREE.PerspectiveCamera(vFovDeg, aspect, 0.1, 100);
      this.projCamera.position.set(0, 1.65, 2.2);
      this.projCamera.lookAt(0, 1.35, -12);
      this.syncProjectionCamera();
    }

    public syncProjectionCamera(): void {
      this.projCamera.fov = this.vFovDeg;
      this.projCamera.aspect = this.aspect;
      this.projCamera.updateProjectionMatrix();
      this.projCamera.updateMatrixWorld(true);
    }

    public computeTargetAimCoords(
      target: ActiveTargetEntity,
      wideScopeMult = 1.0
    ): TargetAimProjection {
      this.syncProjectionCamera();
      const baseY = target.customBaseY ?? getTargetBaseY(target.kind, target.isItem);
      const worldPos = new THREE.Vector3(target.x, baseY, target.z);
      
      const camDist = this.projCamera.position.distanceTo(worldPos);
      worldPos.project(this.projCamera); // worldPos.x, worldPos.y in NDC [-1, 1]

      const targetNormX = worldPos.x;
      const targetNormY = worldPos.y;

      // 3D perspective apparent hit radius in NDC space
      const baseRadiusM = target.hitRadiusM * 2.2 * wideScopeMult;
      const apparentHitRadius = Math.max(0.12, baseRadiusM / Math.max(2.5, camDist));

      return { targetNormX, targetNormY, apparentHitRadius };
    }

    public shootAt(aimX: number, aimY: number, nowMs: number): EngineShootResult {
      // Convert input aim (-1~1) to exact viewport NDC
      const { ndcX, ndcY } = aimToNdc(aimX, aimY);
      // Compare (ndcX, ndcY) directly against proj.targetNormX, proj.targetNormY
      // dist = Math.hypot(ndcX - proj.targetNormX, ndcY - proj.targetNormY)
      // ...
    }
  }
  ```

### I02. 엔진 판정 테스트 업데이트
- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` — modify

#### Details
- NDC 변환 좌표계를 바탕으로 중앙(0, 0), 좌/우 타겟에 대한 명중 판정 및 PERFECT/GREAT/GOOD/MISS 등급 검증.

## Acceptance Criteria
- [ ] 3D 화면상 조준경 링 안에 몬스터 메쉬가 걸려 있으면 오차 0.00으로 `PERFECT!` 또는 `GREAT!`가 즉시 발생한다.
- [ ] 24m 원거리부터 2.5m 근거리까지 모든 거리에서 화면 시각적 위치와 판정 위치가 100% 일치한다.
- [ ] `tests/engine-judgment-and-spawn.test.ts` 및 전체 테스트 통과.
- [ ] `npm run build` 성공.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 투영 좌표 및 판정 테스트 통과
- `npm run build` — 빌드 성공 확인

## Commit Message
```text
feat(engine): switch hit judgment to Three.js camera perspective projection

Plan: 2026-11-02-camera-projection-hitbox-and-snap-tuning
Phase: P01-camera-projection-and-continuous-snap
Task: T01-implement-camera-perspective-projection-hit-judgment

- Project target 3D world coordinates through PerspectiveCamera into viewport NDC
- Map aimX, aimY through aimToNdc for 1:1 zero-offset spatial alignment
- Eliminate sight-to-hitbox discrepancy completely across all distances
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
