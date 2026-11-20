# Task: T01 Instanced Shadow Pool

## Status: done

## Goal
모든 몬스터·아이템·황금캔·투사체에 개별적으로 붙어 있던 바닥 원형 그림자(`shadowMesh`)를 씬 전체 단 1개의 `THREE.InstancedMesh`로 통합하여, 활성 객체 수만큼 증가하던 그림자 드로우콜을 매 프레임 1회로 압축한다.

## Decision Summary
- D02: 개별 `shadowMesh` 생성을 제거하고 `userData.shadowRadius` 메타데이터만 보관한 뒤, `GameCanvas3D` 렌더 루프에서 `InstancedShadowPool`이 월드 바닥(`y = 0.015`)에 일괄 배치한다.
- 기존 테스트(`tests/three-stage-and-models.test.ts`, `tests/boss-model-roles.test.ts`, `tests/poop-shell.test.ts`)의 `shadowMesh` 단언을 `shadowRadius` 검증으로 동기화한다.

## Implementation

### I01. `InstancedShadowPool` 신규 모듈 작성

- Related Files:
  - `src/pc/three/InstancedShadowPool.ts` :: `InstancedShadowPool` — 단일 `InstancedMesh` 기반 바닥 그림자 풀; new

#### Details
- **Signatures & Types**:
  ```typescript
  import * as THREE from 'three';

  export const MAX_INSTANCED_SHADOWS = 128;

  export class InstancedShadowPool {
    readonly mesh: THREE.InstancedMesh;
    constructor(maxCount?: number);
    beginFrame(): void;
    pushShadow(worldX: number, worldZ: number, radius: number, worldY?: number): void;
    endFrame(): void;
    dispose(): void;
  }
  ```
- **Execution Flow / Logic**:
  1. 생성자에서 `CircleGeometry(1, 24)`를 만들고 `geo.rotateX(-Math.PI / 2)` 적용, `MeshBasicMaterial({ color: 0x050814, transparent: true, opacity: 0.42, depthWrite: false })`로 `InstancedMesh(geo, mat, maxCount)` 생성.
  2. `this.mesh.name = 'InstancedDropShadows'`, `this.mesh.frustumCulled = false`, `this.mesh.count = 0`.
  3. `beginFrame()`: 내부 `activeCount = 0`.
  4. `pushShadow(worldX, worldZ, radius, worldY = 0.015)`: `activeCount >= maxCount`이면 early return. 공유 `_dummy: THREE.Object3D`에 `position.set(worldX, worldY, worldZ)`, `scale.set(radius, 1, radius)`, `updateMatrix()` 후 `this.mesh.setMatrixAt(activeCount++, _dummy.matrix)`.
  5. `endFrame()`: `this.mesh.count = activeCount`. `activeCount > 0`이면 `this.mesh.instanceMatrix.needsUpdate = true`.
  6. `dispose()`: `this.mesh.geometry.dispose()`, `(this.mesh.material as THREE.Material).dispose()`.

### I02. `TargetModels3D` 개별 그림자 제거 및 메타데이터 전환

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createFloorShadowMesh`, `createTargetMesh3D`, `createItemMesh3D`, `createGoldenCanMesh3D`, `createProjectileMesh3D`, `updateTargetAnimation3D`, `updateItemAnimation3D` — 개별 `shadowMesh` 생성/부착 제거 및 `userData.shadowRadius` 저장; modify

#### Details
- `createFloorShadowMesh` 제거(또는 미사용 시 삭제).
- `createTargetMesh3D(kind, bossRole)`: `shadowMesh` 생성 및 `root.add(shadowMesh)` 제거, `root.userData.shadowRadius = spec.hitRadiusM * 0.72` (대왕 보스의 경우 `bossRole === 'king'`이면 `spec.hitRadiusM * 0.72 * GAME_TUNING.boss.kingScale` 또는 `GameCanvas3D`에서 `modelScaleMult` 반영).
- `createItemMesh3D`: `root.userData.shadowRadius = 0.55`.
- `createGoldenCanMesh3D`: `root.userData.shadowRadius = 0.65`.
- `createProjectileMesh3D`: `root.userData.shadowRadius = 0.42`.
- `updateTargetAnimation3D` 및 `updateItemAnimation3D`: `shadowMesh.position.y` 갱신 제거. `frostRing.position.y`는 `shadowMesh` 대신 `-root.position.y + 0.025`로 직접 바닥 높이를 맞춘다.

### I03. `GameCanvas3D`에 `InstancedShadowPool` 연동 및 관련 테스트 동기화

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `InstancedShadowPool` — 씬 초기화 시 생성·추가, 매 프레임 활성 타겟 그림자 푸시, 언마운트 시 `dispose()`; modify
  - `tests/three-stage-and-models.test.ts` :: `shadowMesh` 단언 — `userData.shadowRadius` 검증으로 갱신; modify
  - `tests/boss-model-roles.test.ts` :: `shadowMesh` 단언 — `userData.shadowRadius` 및 `InstancedShadowPool` 검증으로 갱신; modify
  - `tests/poop-shell.test.ts` :: `shadowMesh` 단언 — `userData.shadowRadius` 검증으로 갱신; modify
  - `tests/instanced-shadow-pool.test.ts` :: `InstancedShadowPool` — 풀 동작(카운트, 상한 클램핑, 행렬 위치/스케일, dispose) 단위 테스트; new

#### Details
- `GameCanvas3D.tsx`:
  - 씬 초기화(`useEffect`)에서 `const shadowPool = new InstancedShadowPool(); scene.add(shadowPool.mesh);`
  - 프레임 루프에서 `shadowPool.beginFrame();`
  - `engine.activeTargets` 순회 시 타겟이 `visible`하고 물속 잠수(`isTargetSubmerged`) 상태가 아닐 때, `const radius = (mesh.userData.shadowRadius as number | undefined) ?? 0;`가 `> 0`이면 `const mult = target.modelScaleMult && !target.isItem && !target.isProjectile ? target.modelScaleMult : 1; shadowPool.pushShadow(mesh.position.x, mesh.position.z, radius * mult);` 호출.
  - 루프 끝(렌더 직전)에 `shadowPool.endFrame();`.
  - 클린업 시 `scene.remove(shadowPool.mesh); shadowPool.dispose();`.

## Acceptance Criteria
- [ ] 개별 타겟·아이템·투사체 `THREE.Group`에 `DropShadow` 자식 메시가 추가되지 않으며 `userData.shadowRadius`가 설정된다.
- [ ] `InstancedShadowPool`이 단일 `InstancedMesh`로 모든 활성 객체의 바닥 그림자를 렌더링한다.
- [ ] 신규 테스트(`tests/instanced-shadow-pool.test.ts`)와 수정된 기존 모델 테스트 3종을 포함한 `npm test` 전체가 통과한다.

## Validation
- `npx vitest run tests/instanced-shadow-pool.test.ts tests/three-stage-and-models.test.ts tests/boss-model-roles.test.ts tests/poop-shell.test.ts` — 전체 통과
- `npm test` — 전체 스위트 회귀 없음 확인

## Commit Message
```text
perf(three): batch target drop shadows via InstancedShadowPool

Plan: 2026-11-20-monster-render-optimization
Phase: P02-shadow-instancing-and-cache
Task: T01-instanced-shadow-pool

- Add InstancedShadowPool to render all active target/item/projectile drop shadows in a single draw call
- Remove per-mesh shadowMesh creation in TargetModels3D and store userData.shadowRadius instead
- Integrate InstancedShadowPool into GameCanvas3D render loop and sync unit tests
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
