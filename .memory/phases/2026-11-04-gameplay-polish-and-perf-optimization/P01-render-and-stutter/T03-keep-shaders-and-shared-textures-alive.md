# Task: T03 Keep Shaders and Shared Textures Alive

## Status: done

## Goal
플레이 중 셰이더 재생성과 공유 텍스처 재업로드를 없애 0.6~2초 멈춤과 카드 등장 시 0.57초 멈춤을 해결한다.

## Decision Summary
- D04: 같은 재질의 몬스터가 필드에서 모두 사라지면 셰이더가 삭제되고 다음 스폰 때 다시 만들어진다.
- `GameCanvas3D.tsx:317`은 예열 직후 샘플을 dispose해 예열 효과를 없앤다.
- `disposeSceneGroup`은 공유 라벨 텍스처까지 폐기해 처치할 때마다 재업로드가 일어난다.

## Implementation

### I01. 공유 텍스처 보호

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `getOrCreateTargetLabelTexture`, `getOrCreateItemBillboardTexture`, `getOrCreateOfficialCassTexture`, `createDataTextureFallback` — 공유 표시; modify

#### Details
- 위 함수가 반환하는 모든 텍스처(폴백 포함)에 `texture.userData.isShared = true`를 지정한다.
- `disposeSceneGroup`(`GameCanvas3D.tsx`)의 `map.userData?.isShared` 검사는 이미 있으므로 수정하지 않는다.

### I02. 카드 리소스 캐시

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createCardTargetMesh3D` — 텍스처·지오메트리·머티리얼 재사용; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  const cardTextureCache = new Map<string, THREE.CanvasTexture>();
  // key: `${title}|${subtitle}|${colorHex}|${icon}`
  ```
- **Execution Flow / Logic**:
  1. 캐시에 있으면 재사용하고, 없을 때만 512×680 캔버스를 그린다. 저장 시 `userData.isShared = true`.
  2. 지오메트리를 `getCachedGeometry('card-frame-geo', ...)`, `'card-border-h-geo'`, `'card-border-v-geo'`, `'card-front-geo'`로 공유한다.
  3. 머티리얼을 `getCachedMaterial` 키 `card-frame-mat-${colorHex}`, `card-border-mat-${colorHex}`, `card-front-mat-${key}`로 공유한다.
  4. Node 환경처럼 `document`가 없으면 지금처럼 텍스처 없이 동작한다.

### I03. 셰이더 앵커 그룹

- Related Files:
  - `src/pc/three/ShaderWarmup.ts` :: `buildShaderAnchorGroup` — 쓰이는 모든 재질을 담은 그룹; new
  - `src/pc/three/ParticleEffects3D.ts` :: `createWarmupObjects` — 이펙트 재질 샘플; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function buildShaderAnchorGroup(particles: ParticleEffects3D): THREE.Group;
  // ParticleEffects3D
  public createWarmupObjects(): THREE.Object3D[];
  ```
- **그룹 구성**:
  - `createTargetMesh3D`: pilgood, caslight, obi, hanmac, bottle, boss
  - `createItemMesh3D`: power_shot, wide_scope, ice_freeze, bar_repair
  - `createGoldenCanMesh3D`, `createProjectileMesh3D`
  - `createCardTargetMesh3D('warmup', 'warmup', '#ffffff', '🃏')`
  - `new DraftTapGun3D()`에 `setWeaponAppearance(kind, 4)`를 적용한 그룹 3종의 `group`
  - `particles.createWarmupObjects()`: 트레이서·플래시, 무기별 발사체, 파티클, 플로팅 라벨, 스킬 이펙트 재질 샘플
- 마지막에 `group.traverse((o) => { o.visible = true; })`로 숨겨진 자식(쉴드, 프리즈 링, 록온)까지 컴파일 대상에 넣는다.
- **이 그룹은 앵커다.** dispose하면 셰이더가 해제되므로, 살아 있는 동안 참조를 유지한다.

### I04. 환경맵 로드 뒤 예열

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `applyCachedHdriToScene`, `buildBreweryStage3D` — 환경맵 준비 콜백; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 예열 블록 — 앵커 사용; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function applyCachedHdriToScene(scene: THREE.Scene, onReady?: () => void): void;
  export function buildBreweryStage3D(scene: THREE.Scene, onEnvironmentReady?: () => void): BreweryStageRig;
  ```
- **Execution Flow / Logic**:
  1. `applyCachedHdriToScene`: 캐시가 있으면 적용 후 즉시 `onReady`, 로드 성공 콜백에서 호출, 실패 시에도 호출한다. 한 번만 호출되게 한다.
  2. `GameCanvas3D`의 예열 블록을 함수로 바꿔 `onEnvironmentReady`에서 실행한다.
     ```typescript
     const runShaderWarmup = () => {
       if (!renderer || disposed) return;
       const anchors = buildShaderAnchorGroup(particles);
       anchors.position.set(0, -999, 0);
       scene.add(anchors);
       renderer.compile(scene, camera);
       anchors.traverse((obj) => {
         const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
         if (mat && !Array.isArray(mat) && mat.map) renderer!.initTexture(mat.map);
       });
       scene.remove(anchors);
       shaderAnchors = anchors;
     };
     ```
  3. `particles`를 만든 뒤에 `buildBreweryStage3D`를 호출하도록 순서를 맞추거나, 콜백이 `particles` 생성 뒤 실행되게 한다.
  4. cleanup에서 `disposed = true`로 표시하고 `shaderAnchors`를 `disposeSceneGroup`으로 정리한다. 공유 리소스는 보호된다.
- **함정**: 환경맵이 128×64 폴백에서 2K HDRI로 바뀌면 `envMapCubeUVHeight`가 달라져 PBR 셰이더가 전부 다시 만들어진다. 그래서 예열은 **HDRI 로드 뒤**에 해야 한다. 먼저 하면 예열이 무효가 된다.

### I05. 테스트

- Related Files:
  - `tests/three-stage-and-models.test.ts` — 새 `it` 추가; modify

#### Details
- 라벨 텍스처 `userData.isShared === true`이고, 몬스터를 `disposeSceneGroup`해도 해당 텍스처의 `dispose`가 호출되지 않는다(`vi.spyOn`).
- `createCardTargetMesh3D`를 같은 인자로 두 번 호출하면 같은 지오메트리·머티리얼 인스턴스를 쓴다.
- `buildShaderAnchorGroup(new ParticleEffects3D())`가 예외 없이 만들어지고, 모든 자식이 `visible === true`다.
- 기존 "비공유 머티리얼은 dispose된다" 테스트는 그대로 통과해야 한다.

## Acceptance Criteria
- [x] 몬스터가 모두 죽은 뒤 다시 나와도 멈춤이 없다.
- [x] 카드가 두 번째부터 끊김 없이 나타난다.
- [x] 처치할 때 라벨 텍스처가 다시 올라가지 않는다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- 실측 검증은 T08에서 한다(`linkProgram` 0회, 처치 시 업로드 0회).

## Commit Message
```text
perf(render): keep shader programs and shared textures alive during play

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T03-keep-shaders-and-shared-textures-alive

- Mark label textures as shared so monster disposal keeps them
- Cache reward card textures, geometries, and materials
- Compile an undisposed shader anchor group after the HDRI loads
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: perf(render): keep shader programs and shared textures alive during play
