# Task: T02 Ground Floor Defense Line and Shadows

## Status: pending

## Goal
1.8m 방어선 바닥(`y = 0.02`)에 두툼한 폭(약 30cm)의 옐로우/블랙 사선 스트라이프 및 붉은색 네온 발광 아크 경고선(Hazard Stripe Line)을 배치하여 "이 선을 밟으면 침범"임을 한눈에 알 수 있게 하고, 공중에 떠서 이동하던 몬스터 발밑 그림자를 실제 월드 바닥(`y = 0.01`)에 완전히 밀착 고정한다.

## Decision Summary
- **D02**:
  - `BreweryStage3D.ts`: 1.8m 바닥에 반경 1.65m ~ 1.95m(폭 30cm)의 사선 캔버스 텍스처 스트라이프 아크 및 붉은색 네온 발광 라인 생성.
  - `TargetModels3D.ts`: `createFloorShadowMesh`의 로컬 position.y를 `-baseY + 0.01`로 설정하여 부모 그룹의 높이 오프셋을 역상쇄, 월드 바닥 `y = 0.01`에 밀착.

## Implementation

### I01. 3D 펍 바닥 1.8m 안전 경고선(Hazard Stripe & Neon Arc) 구현
- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `buildBreweryStage3D` — modify

#### Details
- **Hazard Stripe Canvas Texture**:
  - 절차적 캔버스로 45도 사선 옐로우(`#f59e0b`)와 블랙/다크브라운(`#1f140e`)의 반복 스트라이프 텍스처 생성.
  - `RingGeometry(1.65, 1.95, 64, 1, 0, Math.PI)`에 텍스처 매핑하고 `y = 0.02`에 배치.
  - 그 외곽 테두리(`RingGeometry(1.94, 1.97)`)에 붉은색/골드 네온 펄스 라인 매핑.
- **Animation Sync**:
  - `dangerAlert` 발생 시 네온 라인이 선명한 붉은색(`#ef4444`)으로 점멸.

### I02. 몬스터 원형 그림자 바닥 밀착 보정
- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `createItemMesh3D` — modify

#### Details
- **Ground Snapping Logic**:
  ```typescript
  // createTargetMesh3D:
  const baseY = getTargetBaseY(kind);
  const shadowMesh = createFloorShadowMesh(spec.hitRadiusM * 0.72);
  // 부모 그룹의 y = baseY를 상쇄하여 월드 y = 0.01에 정확히 밀착
  shadowMesh.position.y = -baseY + 0.01;
  root.add(shadowMesh);
  ```

## Acceptance Criteria
- [x] 3D 씬의 1.8m 바 카운터 앞 바닥에 30cm 폭의 선명한 경고 띠 및 발광 아크가 렌더링된다.
- [x] 몬스터 발밑 그림자가 공중에 뜨지 않고 실제 바닥 표면에 밀착되어 몬스터와 함께 이동한다.
- [x] `tests/three-stage-and-models.test.ts` 통과.
- [x] `npm run build` 성공.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 3D 스테이지 및 타겟 모델 생성 검증
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(stage): add 1.8m hazard stripe floor defense line and snap shadows to ground

Plan: 2026-11-02-screen-edge-aim-defense-line-and-latency
Phase: P01-fix-aim-deadzone-defense-line-and-latency
Task: T02-ground-floor-defense-line-and-shadows

- Create 30cm-wide yellow/black hazard stripe and neon arc at R=1.8m on floor (y=0.02)
- Offset target drop shadows by -baseY + 0.01 to lock directly onto the wooden floor
- Clarify visual breach threshold for players intuitively
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
