# Task: T02 Fix rAF Cancel & Card Scene Sync

## Status: pending

## Goal
`GameCanvas3D` 컴포넌트 클린업 시 `cancelAnimationFrame`을 호출하여 React StrictMode 및 컴포넌트 재마운트 시 백그라운드에 남는 좀비 애니메이션 루프를 원천 제거하고, 활성 씬과 타겟 메쉬 간의 부모-자식 관계(`mesh.parent === scene`)를 보장하여 3D 시작 카드 3장 및 웨이브 보상 카드가 화면에 항상 100% 정상 노출되도록 복원한다.

## Decision Summary
- **D02 (`2026-11-04-fix-start-card-visibility-and-remove-amber-box.md`)**:
  - `GameCanvas3D.tsx`의 `return () => { ... }` 클린업 함수에서 `if (animId) cancelAnimationFrame(animId); animId = 0;`을 실행한다.
  - 타겟 메쉬를 씬에 동기화할 때 `!mesh || mesh.parent !== scene` 조건을 검사하여, 캐시에 메쉬가 있더라도 활성 씬의 자식이 아니라면 이전 부모에서 분리(`mesh.parent.remove(mesh)`)하고 활성 씬에 다시 추가(`scene.add(mesh)`)한다.
  - `TargetModels3D.ts`의 `createCardTargetMesh3D`에서 Canvas 2D `ctx.roundRect` 미지원 환경 대비 안전 폴백 가드를 추가한다.

## Implementation

### I01. `GameCanvas3D.tsx` 클린업 함수에 `cancelAnimationFrame` 적용

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `useEffect` cleanup — WebGL 애니메이션 루프 및 이벤트 해제; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/components/GameCanvas3D.tsx
  let animId = 0;
  // cleanup function:
  return () => {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = 0;
    }
    // ...
  };
  ```
- **Execution Flow / Logic**:
  1. `return () => {` 진입 시 `animId = 0;` 단독 할당 전에 `if (animId) cancelAnimationFrame(animId);`를 호출하여 브라우저에 등록된 다음 프레임 콜백을 명시적으로 취소한다.
  2. 첫 번째 씬의 `animate` 루프가 즉시 영구 정지되어 두 번째 마운트의 활성 씬과 충돌하지 않도록 보장한다.

### I02. `GameCanvas3D.tsx`의 타겟 메쉬 씬 소속 검증 및 재부착(Re-parenting) 로직 구현

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `animate` — 매 프레임 타겟 메쉬 씬 동기화; modify

#### Details
- **Execution Flow / Logic**:
  1. `engine.activeTargets.forEach((target) => {` 루프 내부에서:
     ```typescript
     let mesh = targetMeshMap.get(target.id);
     const needsAdd = !mesh || mesh.parent !== scene;

     if (mesh && mesh.parent && mesh.parent !== scene) {
       mesh.parent.remove(mesh);
     }

     if (!mesh) {
       // 타겟 종류별 메쉬 생성 (createCardTargetMesh3D, createTargetMesh3D 등)
       // ...
       targetMeshMap.set(target.id, mesh);
     }

     if (needsAdd) {
       scene.add(mesh);
     }
     ```
  2. 캐시에 메쉬가 존재하더라도 현재 활성 `scene`에 붙어있지 않은 고아(Orphaned) 상태라면 즉시 활성 씬의 자식으로 등록하여 화면 렌더링을 보장한다.

### I03. `TargetModels3D.ts`의 `createCardTargetMesh3D` Canvas 2D `roundRect` 호환성 폴백

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createCardTargetMesh3D` — 3D 카드 텍스처 생성; modify

#### Details
- **Execution Flow / Logic**:
  1. `ctx.roundRect` 호출부를 감싸는 안전 헬퍼 함수를 정의한다:
     ```typescript
     const safeRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
       if (typeof ctx.roundRect === 'function') {
         ctx.roundRect(x, y, w, h, r);
       } else {
         ctx.rect(x, y, w, h);
       }
     };
     ```
  2. 카드 배경(`(16, 16, 480, 648, 28)`) 및 사격 버튼 배지(`(48, 500, 416, 96, 24)`)에 `safeRoundRect`를 적용하여 구형 브라우저 및 헤드리스 환경에서도 Canvas 2D 텍스처 생성이 절대 예외를 던지지 않도록 보호한다.

### I04. `tests/three-stage-and-models.test.ts`에 씬 재마운트 및 카드 렌더링 회귀 검증 추가

- Related Files:
  - `tests/three-stage-and-models.test.ts` — 단위 테스트 추가; modify

#### Details
- **Test Scenarios**:
  1. `createCardTargetMesh3D`가 `ctx.roundRect` 부재 환경에서도 안전하게 메쉬를 생성하는지 검증.
  2. 두 개의 서로 다른 Scene 인스턴스 간에 타겟 메쉬 맵을 공유하는 환경을 모사하여, `!mesh || mesh.parent !== activeScene` 로직을 거친 후 `activeScene`에 카드가 정상 소속되는지 단위 검증.

## Acceptance Criteria
- [ ] `GameCanvas3D.tsx` 클린업에서 `cancelAnimationFrame`이 반드시 호출된다.
- [ ] 타겟 메쉬가 활성 `scene`의 자식으로 항상 부착되어 React StrictMode 마운트 환경에서도 카드가 100% 렌더링된다.
- [ ] `TargetModels3D.ts`의 `safeRoundRect`가 예외 없이 동작한다.
- [ ] `vitest run` 실행 시 전체 테스트가 성공한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 18개 이상 테스트 통과
- `npx vitest run` — 109개 이상 전체 스위트 올 그린

## Commit Message
```text
fix(canvas): add rAF cancel on cleanup and ensure target mesh scene attachment

Plan: 2026-11-04-fix-start-card-visibility-and-remove-amber-box
Phase: P01-cleanup-and-card-rendering
Task: T02-fix-raf-cancel-and-card-scene-sync

- invoke cancelAnimationFrame(animId) in GameCanvas3D cleanup to eliminate zombie loop
- guard mesh scene re-parenting with mesh.parent !== scene to guarantee active card rendering
- add safeRoundRect fallback guard in createCardTargetMesh3D
- add unit tests verifying card scene re-attachment and roundRect resilience
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
