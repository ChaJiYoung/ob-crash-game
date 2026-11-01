# Task: T02 Three.js 올 뉴 카스 3D 투명 유리병·내부 액체·라벨·은색 왕관 뚜껑 모델링 및 렌더링

## Status: done

## Goal
Three.js의 물리 기반 투명 굴절 재질(`MeshPhysicalMaterial`)을 활용하여 '올 뉴 카스' 500ml 투명 유리병 모델(하단 바디 실린더 + 전용 1024×512 라벨 매핑 + 테이퍼 숄더 + 넥 + 림 + 상단 은색 왕관 뚜껑 + 내부 황금빛 맥주 액체 및 탄산 기포)을 구현하고 렌더링 검증 테스트를 통과시킨다.

## Decision Summary
- D02/D03 반영: 투명 유리(`MeshPhysicalMaterial`, transmission: 0.88, ior: 1.52, roughness: 0.05, clearcoat: 1.0) 바디 내부에 황금빛 맥주 액체(`MeshStandardMaterial`, color: 0xf59e0b)와 탄산 기포 구체들을 배치하고, 상단에 은색 왕관 뚜껑(크라운 캡, metalness: 0.95, roughness: 0.2)을 장착한다.
- `getTargetBaseY('bottle')`은 기존 지상 롤링/이동 고도인 `0.55`로 설정한다.

## Implementation

### I01. `TargetModels3D.ts` 내 카스 병맥주 3D 메시 생성 로직 구현

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `getOrCreateTargetLabelTexture` — `bottle` 텍스처 로딩 분기 추가; modify
  - `src/pc/three/TargetModels3D.ts` :: `getTargetBaseY` — `'bottle'` 입력 시 `0.55` 반환; modify
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh` — `kind === 'bottle'` 3D 모델 조립 블록 작성; modify

#### Details
- **Base Altitude (`getTargetBaseY`)**:
  ```typescript
  export function getTargetBaseY(kind: TargetKind): number {
    if (kind === 'caslight' || kind === 'pilgood') {
      return 2.5;
    }
    return 0.55; // Ground contact rolling altitude (bottle, obi, hanmac, mug)
  }
  ```
- **Label Texture Integration (`getOrCreateTargetLabelTexture`)**:
  - `kind: TargetKind | 'mug' | 'boss' | 'bottle'` 지원
  - 비동기 이미지 로드 경로: `/textures/labels/${kind}.jpg` (예: `/textures/labels/bottle.jpg`)
- **3D Bottle Hierarchy & Geometry (`createTargetMesh`)**:
  - `inner` 그룹 아래에 다음 메시들을 순서대로 조립:
  1. **외부 투명 유리 재질 (`glassMat`)**:
     ```typescript
     const glassMat = new THREE.MeshPhysicalMaterial({
       color: 0xffffff,
       transparent: true,
       opacity: 0.55,
       transmission: 0.88,
       ior: 1.52,
       roughness: 0.05,
       metalness: 0.05,
       clearcoat: 1.0,
       clearcoatRoughness: 0.04,
     });
     ```
  2. **유리 바디 (하단 몸체)**:
     - 실린더: 반경 `r = 0.28`, 높이 `h_body = 0.52`, 세그먼트 `24`
     - 위치: `y = 0.26`
  3. **카스 프레시 라벨 메시**:
     - 바디 표면보다 0.003 살짝 큰 실린더: 반경 `r * 1.008`, 높이 `0.30`, 세그먼트 `24`
     - 재질: `getOrCreateTargetLabelTexture('bottle')` 매핑한 `MeshStandardMaterial` (roughness: 0.35)
     - 위치: `y = 0.24`
  4. **숄더 (어깨 곡선)**:
     - 테이퍼 원뿔대 실린더: 하단 반경 `0.28`, 상단 반경 `0.11`, 높이 `0.18`, 세그먼트 `24`
     - 위치: `y = 0.52 + 0.09 = 0.61`
  5. **넥 (목 실린더)**:
     - 실린더: 반경 `0.11`, 높이 `0.26`, 세그먼트 `24`
     - 위치: `y = 0.70 + 0.13 = 0.83`
  6. **입구 림 (Lip Rim)**:
     - 토러스: 반경 `0.108`, 튜브 반경 `0.016`
     - 위치: `y = 0.96`
  7. **내부 황금빛 맥주 액체**:
     - 바디 내부 실린더: 반경 `0.25`, 높이 `0.48`, 재질: 황금 앰버 (`color: 0xf59e0b`, roughness: 0.2)
     - 숄더/목 내부 실린더: 하단 반경 `0.24`, 상단 반경 `0.09`, 높이 `0.30`
  8. **상승 탄산 기포 비즈 (Bubbles)**:
     - 구체 8개 (`SphereGeometry(0.014, 6, 6)`), 높이별로 나선형 배치
  9. **은색 왕관 뚜껑 (Crown Cap)**:
     - 캡 본체 실린더: 반경 `0.125`, 높이 `0.038`, 세그먼트 `20`
     - 재질: 메탈릭 실버 (`color: 0xe2e8f0`, metalness: 0.95, roughness: 0.18)
     - 위치: `y = 0.98`
     - 톱니 림 엠보싱: `TorusGeometry(0.124, 0.01, 8, 20)`
     - 이름 부여: `crownCap.name = 'crownCap'` (T03에서 분리 및 솟구침 파티클 참조용)

### I02. 3D 렌더링 단위 테스트 확장

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: `TargetModels3D suite` — `bottle` 타겟 3D 메시 및 baseY 검증 추가; modify

#### Details
- `createTargetMesh('bottle')` 호출 시:
  - `targetGroup.userData.kind === 'bottle'` 검증
  - 반환된 그룹 내 자식 노드 중 `crownCap` 메시가 존재하는지 검증
  - `getTargetBaseY('bottle') === 0.55` 검증

## Acceptance Criteria
- [x] `src/pc/three/TargetModels3D.ts`의 `createTargetMesh('bottle')`이 투명 유리 바디, 내부 액체, 라벨, 왕관 뚜껑을 갖춘 완전한 계층 구조를 생성한다.
- [x] `getTargetBaseY('bottle')`이 `0.55`를 정확히 반환한다.
- [x] `npx vitest run tests/three-stage-and-models.test.ts` 테스트가 100% 통과한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 3D 모델 및 베이스 고도 단위 테스트 검증

## Commit Message
```text
feat(three): implement All New Cass 3D transparent bottle model and crown cap

Plan: 2026-11-01-cass-bottle-target
Phase: P01-cass-bottle-target
Task: T02-three-bottle-model

- Create All New Cass 500ml 3D physical glass bottle mesh in TargetModels3D.ts
- Add procedural bottle label texture mapping and silver crown cap with toothed rim
- Add inner golden beer liquid and rising carbonation bubble spheres
- Configure getTargetBaseY('bottle') to return ground rolling contact altitude 0.55
- Add bottle model structure and altitude assertions in tests/three-stage-and-models.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
