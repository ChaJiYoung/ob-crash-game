# Task 02: `TargetModels3D`·`DraftTapGun3D` 리소스 캐시(`userData.isShared`), `GameCanvas3D` 안전 `disposeGroup`·정적 그림자·셰이더 예열 및 `BreweryStage3D` 조명 다이어트 구현

- **Status**: done
- **Phase**: `P02-render-pooling-and-lighting-diet`
- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`

## Goal
몬스터(`createTargetMesh3D`), 아이템(`createItemMesh3D`), 황금캔(`createGoldenCanMesh3D`), 투사체(`createProjectileMesh3D`) 생성 시마다 반복 할당되던 지오메트리·텍스처·공통 머티리얼을 모듈 캐시(`userData.isShared = true`)로 공유하고, 몬스터 사망 시 호출되는 `disposeGroup`이 공유 리소스를 파괴하지 않도록 보호한다. 또한 배경 그림자 맵을 정적 1회 베이킹(`shadowMap.autoUpdate = false`)으로 전환하고, 씬 초기화 시 셰이더 사전 컴파일(`renderer.compile`) 및 `BreweryStage3D` 조명 다이어트를 적용한다.

## Decision Summary
- **D01 (`2026-11-04-render-perf-optimization.md`)**:
  1. `TargetModels3D.ts`: 지오메트리(`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `TorusGeometry`, `OctahedronGeometry`, `ConeGeometry`, `PlaneGeometry` 등)와 변하지 않는 장식용 머티리얼·캔버스 라벨 텍스처를 모듈 레벨 `Map` 캐시에 저장하고 `userData.isShared = true`로 마킹한다. 단, 슬로우(빙결) 틴트 효과가 개별 적용되는 몬스터 `bodyMaterials`와 체력바(`hpFill`), 보스 실드(`shieldMesh`), 카드 텍스처는 인스턴스별 독립 머티리얼로 유지하여 상태 오염을 방지한다.
  2. `GameCanvas3D.tsx`:
     - `disposeGroup(group)`에서 `if (!mesh.geometry.userData?.isShared) mesh.geometry.dispose()` 및 `if (!mat.userData?.isShared) mat.dispose()`로 공유 리소스 파괴를 방지한다.
     - `renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;`를 설정하고 몬스터/투사체 메쉬의 실시간 그림자 캐스팅을 비활성화해 배경 그림자만 1회 베이킹한다.
     - 씬 초기화 시 주요 아키타입(몬스터/아이템/발사체)을 임시로 씬에 올려 `renderer.compile(scene, camera)`로 셰이더를 사전 예열한다.
- **D03 (`2026-11-04-render-perf-optimization.md`)**:
  - `BreweryStage3D.ts`: 기존의 무거운 다중 광원 계산 부담을 줄이기 위해 `HemisphereLight(0xfff0d8, 0x1e293b, 0.85)`를 추가하여 입체적인 상하 색온도 반사광을 제공하고, 네온 위치 3곳(`(0, 6, -14)`, `(-10, 5, -8)`, `(0, 3, -2)`)에 자체 발광 네온 사인 메쉬(`THREE.MeshBasicMaterial`)를 배치한다. 기존 인터페이스 및 테스트(`rig.neonLights.length >= 3`) 호환성을 유지하면서 프래그먼트 셰이더 부하를 최소화한다.

## Implementation
- [x] **I01**: `src/pc/three/TargetModels3D.ts`에 모듈 레벨 지오메트리 캐시 헬퍼(`getCachedGeometry(key, factory)`), 공유 머티리얼 캐시 헬퍼(`getCachedMaterial(key, factory)`), 공유 텍스처 캐시 헬퍼(`getCachedTexture(key, factory)`)를 추가하고 모든 공유 리소스에 `userData.isShared = true`를 부여한다.
- [x] **I02**: `createTargetMesh3D`, `createItemMesh3D`, `createGoldenCanMesh3D`, `createProjectileMesh3D` 내부의 지오메트리와 정적 장식 머티리얼(눈, 동공, 거품, 병뚜껑, 금속 림, 오라 등)을 캐시 헬퍼 호출로 교체하되, `bodyMaterials`에 등록되는 몸체 머티리얼과 `hpFill`, `shieldMesh`, `createCardTargetMesh3D`의 카드 머티리얼은 개별 인스턴스로 생성한다.
- [x] **I03**: `src/pc/three/BreweryStage3D.ts`에 `THREE.HemisphereLight`와 자체 발광 네온 튜브/사인 메쉬를 추가하고, 배경 메쉬 외의 동적 오브젝트에 불필요한 그림자 연산이 일어나지 않도록 정리한다.
- [x] **I04**: `src/pc/components/GameCanvas3D.tsx`에서:
  1. `disposeGroup` 함수를 exported 헬퍼 `disposeSceneGroup(group: THREE.Group)`으로 정의하여 `userData?.isShared`가 아닌 지오메트리/머티리얼/텍스처만 `.dispose()`하도록 보호한다.
  2. `renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;`를 적용한다.
  3. 씬 초기화 직후 대표 타겟/발사체 메쉬로 `renderer.compile(scene, camera)`(메서드가 존재하는 경우)를 호출해 첫 스폰/첫 사격 셰이더 컴파일 스터터를 제거한다.

## Related Files
- `src/pc/three/TargetModels3D.ts` (modify)
- `src/pc/three/BreweryStage3D.ts` (modify)
- `src/pc/components/GameCanvas3D.tsx` (modify)

## Signatures & Types
```typescript
// src/pc/three/TargetModels3D.ts
export function getSharedTargetResourceStats(): {
  cachedGeometries: number;
  cachedMaterials: number;
  cachedTextures: number;
};

// src/pc/components/GameCanvas3D.tsx
export function disposeSceneGroup(group: THREE.Group): void;
```

## Data & Schema Fields
- `geometry.userData.isShared`: `true` (`boolean`)
- `material.userData.isShared`: `true` (`boolean`)
- `texture.userData.isShared`: `true` (`boolean`)
- `material.userData.disposed`: `true` (`boolean`) - `disposeSceneGroup`에서 실제 `.dispose()`가 호출된 비공유 머티리얼에 기록하는 테스트 검증용 플래그
- `geometry.userData.disposed`: `true` (`boolean`) - `disposeSceneGroup`에서 실제 `.dispose()`가 호출된 비공유 지오메트리에 기록하는 테스트 검증용 플래그

## Execution Flow / Logic
1. `TargetModels3D.ts`:
   - `const geometryCache = new Map<string, THREE.BufferGeometry>();`
   - `const materialCache = new Map<string, THREE.Material>();`
   - `const textureCache = new Map<string, THREE.Texture>();`
   - `getCachedGeometry(key, factory)`는 캐시 미스 시 `factory()`로 생성 후 `geo.userData.isShared = true`를 설정해 저장한다.
   - `createTargetMesh3D`:
     - 모든 `new THREE.*Geometry(...)` 호출을 결정론적 키(예: `'yeast-blob'`, `'lager-bottle-body'`, `'ipa-can-body'`, `'hp-bg'`, `'hp-fill'` 등)를 가진 `getCachedGeometry`로 교체한다.
     - 몬스터의 `bodyMaterials` 배열에 들어가는 메인 몸체 머티리얼은 슬로우 효과 시 개별 색상(`setHex(0x38bdf8)`)이 변경되므로 인스턴스별로 생성(`isShared` 아님)하거나 복제하고, 눈/동공/거품/왕관/병뚜껑 등 변하지 않는 머티리얼은 `getCachedMaterial`로 공유한다.
2. `GameCanvas3D.tsx`:
   - `disposeSceneGroup(group: THREE.Group)`에서:
     - `mesh.geometry && !mesh.geometry.userData?.isShared`일 때만 `mesh.geometry.userData.disposed = true; mesh.geometry.dispose();`를 수행한다.
     - 머티리얼(배열 포함) 순회 시 `!mat.userData?.isShared`일 때만 내부 텍스처(`map`, `emissiveMap` 등, `!tex.userData?.isShared`인 경우)와 머티리얼을 `.dispose()`하고 `mat.userData.disposed = true`를 표시한다.

## Acceptance Criteria
- 동일 종류의 몬스터 30마리를 생성해도 `getSharedTargetResourceStats().cachedGeometries` 개수가 첫 생성 이후 증가하지 않는다.
- 몬스터 A와 몬스터 B를 생성한 뒤 몬스터 A에 `disposeSceneGroup(monsterA)`를 호출해도 몬스터 B가 참조하는 공유 지오메트리와 공유 장식 머티리얼은 `disposed`되지 않고 정상 유지되며, 몬스터 A의 개별 `bodyMaterials`만 안전하게 `disposed`된다.
- `BreweryStage3D`가 `HemisphereLight`와 네온 라이트/메쉬를 포함하여 정상 생성된다.

## Validation
```bash
npx vitest run tests/three-stage-and-models.test.ts
```

## Commit Message
```text
perf(three): cache target geometries/materials, protect shared dispose, and optimize stage lighting

Plan: 2026-11-04-aim-sync-and-render-optimization
Phase: P02
Task: T02
```

## Progress
- 2026-11-04: I01~I04 구현 완료. TargetModels3D 지오메트리/머티리얼 캐시(getCachedGeometry, getCachedMaterial, getSharedTargetResourceStats) 구현, GameCanvas3D disposeSceneGroup(userData.isShared 보호 및 disposed 플래그) 구현, 정적 그림자 맵(shadowMap.autoUpdate = false) 및 셰이더 컴파일 예열 적용, BreweryStage3D HemisphereLight 추가 및 조명 다이어트 완료. Vitest 14개 테스트 통과.
