# Task: T01 TargetModels3D.ts 카스 병맥주 MeshBasicMaterial 전환

## Status: done ✅

## Goal
3D 씬의 강한 조명과 톤매핑 노출 중첩으로 인해 카스 병맥주 몬스터가 샛노랗고 쨍하게 타버리는 현상을 제거하고, 사용자가 제공한 공식 투명 PNG 에셋 본래의 자연스러운 색감(트루 컬러)으로 1:1 렌더링되도록 수정한다.

## Decision Summary
- `.memory/decisions/2026-11-02-cass-png-true-color.md`의 D01, D02 결정 반영.
- `src/pc/three/TargetModels3D.ts`의 `cassBillboard` 메쉬 머티리얼을 `MeshStandardMaterial`에서 외부 광원 비반응형 `MeshBasicMaterial`로 교체.
- `inner.traverse`에서 `MeshBasicMaterial.color`가 수집되어 아이스 프리즈 서리 틴트(`0x93c5fd`) 및 피격 플래시(`applyTargetHitFlash3D`)가 100% 정상 작동하도록 보장.

## Implementation

### I01. TargetModels3D.ts의 bottle 빌보드 머티리얼 교체

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D` — 카스 병맥주 빌보드 메쉬 생성 로직 수정; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // MeshStandardMaterial -> MeshBasicMaterial 전환
  const billboardMat = new THREE.MeshBasicMaterial({
    map: cassTexture,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
  });
  ```
- **Execution Flow / Logic**:
  1. `createTargetMesh3D('bottle')`에서 `billboardMat` 선언 시 `THREE.MeshBasicMaterial`을 인스턴스화.
  2. `roughness`와 `metalness` 속성은 PBR 전용이므로 제거.
  3. `inner.traverse`를 통한 `bodyMaterials` 수집 로직은 `'color' in mat`을 검사하므로 `MeshBasicMaterial`의 `color` 속성(`0xffffff`)이 기존과 동일하게 수집되어 서리 결빙 틴트 연출 완벽 호환.
  4. 뚜껑 메쉬(`crownCap`)와 넥 라벨 메쉬(`neckLabel`) 앵커는 그대로 유지되어 단위 테스트 및 격파 파티클 100% 호환.

## Acceptance Criteria
- [ ] `src/pc/three/TargetModels3D.ts`의 `cassBillboard`가 `MeshBasicMaterial`로 생성됨.
- [ ] 조명에 의한 과포화/과노출 없이 원본 PNG 색상 그대로 출력됨.
- [ ] 아이스 프리즈 서리 틴트 및 피격 플래시가 정상 작동함.
- [ ] 기존 32개 단위 테스트 및 TypeScript 컴파일 오류 없이 통과함.

## Validation
- `npm test && npx tsc --noEmit` — 32 passed, 0 type errors

## Commit Message
```text
fix(three): switch Cass bottle billboard to MeshBasicMaterial for true color fidelity

Plan: 2026-11-02-cass-png-true-color
Phase: P01-cass-png-true-color
Task: T01-target-models-3d-true-color-basic-material

- Replace MeshStandardMaterial with MeshBasicMaterial for Cass bottle billboard
- Prevent lighting overexposure and oversaturation on pre-baked photo PNG
- Retain full compatibility with frost tint, hit flash, and 3D break explosion
- Pass all 32 unit test suites and TypeScript typecheck
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
