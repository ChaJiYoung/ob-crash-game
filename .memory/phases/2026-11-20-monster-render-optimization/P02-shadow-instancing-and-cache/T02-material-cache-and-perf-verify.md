# Task: T02 Material Cache, Warmup, and Performance Verification

## Status: done

## Goal
`TargetModels3D.ts`에서 피격/빙결 색 변화가 필요 없는 정적 재질(`chalangWaterline` 등)을 공유 캐시(`getCachedMaterial`)로 전환하고, `ShaderWarmup.ts`에 `InstancedShadowPool` 웜업을 포함해 스폰 시점 프레임 스파이크를 방지한 뒤, 전체 테스트·빌드 및 브라우저 프로파일링으로 최적화 효과를 검증한다.

## Decision Summary
- D02: `isBodyMaterial = true`인 본체 재질(피격 플래시·얼음 틴트 대상)은 몬스터 간 색상 오염 방지를 위해 인스턴스별 독립 재질을 유지하고, 정적 재질만 캐싱한다.
- D03: `npm test`, `npm run build` 통과 및 브라우저 DevTools Trace 재측정으로 개선 수치를 확인한다.

## Implementation

### I01. `TargetModels3D` 정적 재질 공유 캐시 전환 및 `ShaderWarmup` 보강

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D` — `chalangWaterline` 재질(`waterlineMat`) 등 비-`isBodyMaterial` 정적 재질을 `getCachedMaterial`로 전환; modify
  - `src/pc/three/ShaderWarmup.ts` :: `buildShaderAnchorGroup` — `InstancedShadowPool` 1개 인스턴스 웜업용 오브젝트 포함; modify
  - `tests/three-stage-and-models.test.ts` :: `getSharedTargetResourceStats` — 공유 재질/지오메트리 캐시 사용 검증; modify

#### Details
- **TargetModels3D.ts**:
  - `chalang` 분기의 `waterlineMat`을 `getCachedMaterial('chalang-waterline-mat', () => new THREE.MeshBasicMaterial({ ... }))`로 변경해 스폰마다 텍스처 바인딩/셰이더 프로그램 재생성이 일어나지 않도록 한다.
  - `bottle`의 `billboardMat`, `boss`의 `bodyMat`/`topMat` 등 `isBodyMaterial`에 포함되는 재질은 `tests/boss-model-roles.test.ts`의 독립 색상 계약(`body colours are not shared`)을 지키기 위해 **절대 캐싱하지 않는다**.
- **ShaderWarmup.ts**:
  - `buildShaderAnchorGroup`에 `InstancedShadowPool(1)`의 `mesh`를 추가(단, `beginFrame(); pushShadow(0, 0, 1); endFrame();`)하여 첫 게임 프레임 전에 그림자 `InstancedMesh` 셰이더도 함께 `renderer.compile` 되도록 한다.

### I02. 전체 테스트·빌드 및 브라우저 성능 검증

- Related Files:
  - `.memory/phases/2026-11-20-monster-render-optimization/P02-shadow-instancing-and-cache/T02-material-cache-and-perf-verify.md` — 검증 결과 기록; read-only

#### Details
1. `npm test` 실행해 전체 단위/통합 테스트 통과 확인.
2. `npm run build` 실행해 TypeScript 컴파일 및 Vite 번들링 오류 없음 확인.
3. 로컬 프로덕션 프리뷰(`http://localhost:5174/?debug=1`, EX 모드) 대상으로 Chrome DevTools Performance Trace를 재측정하여 아래 Baseline 대비 개선 수치를 비교한다:
   - **Before Baseline (구현 전 로컬 측정, 1,404 프레임):**
     - Avg rAF: `4.05 ms`, P95 rAF: `9.08 ms`, Max rAF: `363.78 ms`
     - Dropped frames (>16.6ms): `7회`
     - `Layout` + `UpdateLayoutTree`: `1,478회` (총 `1,155.29 ms`)

## Acceptance Criteria
- [ ] `chalangWaterline` 등 비-`isBodyMaterial` 정적 재질이 `getCachedMaterial`로 공유된다.
- [ ] `boss` / `bottle` 등 `isBodyMaterial`의 색상 독립성 테스트(`boss-model-roles.test.ts`)가 그대로 통과한다.
- [ ] `npm test` 및 `npm run build`가 모두 성공한다.

## Validation
- `npm test` — 전체 테스트 통과
- `npm run build` — 타입체크 및 프로덕션 빌드 성공

## Commit Message
```text
perf(three): cache static target materials and warm up instanced shadows

Plan: 2026-11-20-monster-render-optimization
Phase: P02-shadow-instancing-and-cache
Task: T02-material-cache-and-perf-verify

- Cache static chalang waterline material via getCachedMaterial while preserving per-instance body materials
- Include InstancedShadowPool mesh in ShaderWarmup anchor group
- Verify full test suite and production build pass
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
