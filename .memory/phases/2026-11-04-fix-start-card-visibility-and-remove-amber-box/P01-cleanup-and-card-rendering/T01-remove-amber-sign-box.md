# Task: T01 Remove Amber Sign Box

## Status: done

## Goal
`BreweryStage3D`의 배경에 글씨 없이 민무늬로 노출되던 주황색 직사각형 상자 메쉬(`amberSignMesh`)를 완전히 제거하여 화면 중앙 상단의 시각적 노이즈를 없애고, 따뜻한 실내 분위기를 유지하는 포인트 라이트(`amberNeon`)만 보존한다.

## Decision Summary
- **D01 (`2026-11-04-fix-start-card-visibility-and-remove-amber-box.md`)**: `amberSignMesh`(`BoxGeometry(4.2, 0.8, 0.1)`, `0xf59e0b`) 메쉬 생성을 삭제하고, `amberNeon` 포인트 라이트만 유지하여 펍 배경을 깔끔한 2K HDRI 뷰로 정리한다.

## Implementation

### I01. `BreweryStage3D.ts`에서 `amberSignMesh` 메쉬 생성 및 `root.add` 제거

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `buildBreweryStage3D` — 펍 스테이지 3D 조형물 및 조명 구축; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/three/BreweryStage3D.ts
  export function buildBreweryStage3D(scene: THREE.Scene): BreweryStageRig
  ```
- **Data & Schema Fields**:
  - `amberNeon`: `THREE.PointLight` — `color: 0xf59e0b`, `intensity: 2.6`, `distance: 15`, `position: (0, 6, -14)` (유지)
  - `amberSignMesh`: 삭제 대상 메쉬 (`BoxGeometry(4.2, 0.8, 0.1)`)
- **Execution Flow / Logic**:
  1. `buildBreweryStage3D` 내부의 `amberNeon` 포인트 라이트 생성 및 `root.add(amberNeon)`, `neonLights.push(amberNeon)`는 그대로 유지한다.
  2. `const amberSignMesh = new THREE.Mesh(...)` 블록과 `root.add(amberSignMesh)` 호출부를 삭제한다.
  3. `updateStageAnimation` 콜백의 `amberNeon` 펄스 애니메이션은 기존대로 유지한다.

### I02. `three-stage-and-models.test.ts`에 `amberSignMesh` 부재 검증 추가

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: `describe('Three.js Stage & Target Models 3D')` — 3D 스테이지 메쉬 및 조명 단위 테스트; modify

#### Details
- **Test Scenarios**:
  - `buildBreweryStage3D(scene)` 호출 후 `rig.root` 트래버스 시 `BoxGeometry(4.2, 0.8, 0.1)`를 가진 메쉬나 `(0, 6, -14.05)` 위치의 메쉬가 존재하지 않음을 단언(assertion)한다.
  - `rig.neonLights`에 `amberNeon`(`0xf59e0b`) 포인트 라이트가 여전히 정상 포함되어 있음을 확인한다.

## Acceptance Criteria
- [ ] `BreweryStage3D.ts`에서 `amberSignMesh` 생성이 완전히 제거되어 씬 트리에 등록되지 않는다.
- [ ] `amberNeon` 포인트 라이트는 정상 유지되어 조명 애니메이션이 깨지지 않는다.
- [ ] `tests/three-stage-and-models.test.ts`를 실행했을 때 모든 테스트가 성공한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 16개 이상의 단위 테스트 통과 및 amber sign 미존재 검증 성공

## Commit Message
```text
fix(stage): remove untextured amber sign box mesh from brewery background

Plan: 2026-11-04-fix-start-card-visibility-and-remove-amber-box
Phase: P01-cleanup-and-card-rendering
Task: T01-remove-amber-sign-box

- delete amberSignMesh BoxGeometry from buildBreweryStage3D
- preserve amberNeon PointLight to retain warm pub atmosphere
- add regression assertion in three-stage-and-models.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
