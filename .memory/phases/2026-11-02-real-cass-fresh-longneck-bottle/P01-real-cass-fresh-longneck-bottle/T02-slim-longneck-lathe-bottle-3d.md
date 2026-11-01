# Task: T02 슬림 롱넥 3D 유리병(`LatheGeometry`) 모델링, 황금빛 앰버 액체(상단 투명 유리목), 전용 넥 라벨 매핑 구현

## Status: done

## Goal
`src/pc/three/TargetModels3D.ts`의 병맥주(`bottle`) 모델을 뚱뚱한 원기둥 단지에서 실제 '올 뉴 카스 프레시' 500ml 투명병 비율과 똑같은 **슬림 롱넥 곡선 회전체(`THREE.LatheGeometry`) 유리병**으로 교체하고, **목 상단이 비어 있는 황금빛 앰버 맥주 액체**, **하단 크리스탈 엠보싱 디테일**, 그리고 **바디 라벨(`bottle.jpg`)과 넥 라벨(`bottle-neck.jpg`) 분리 매핑**을 구현한다.

## Decision Summary
- D01 반영: `THREE.LatheGeometry`를 사용하여 바닥부터 하단 크리스탈 웨이스트, 슬림한 바디, 유려한 곡선형 어깨(Shoulder), 길고 날씬한 병목(Long-neck)까지 끊김 없는 유리 실루엣을 생성한다.
- 내부 액체는 넥 라벨 아래쪽(어깨 상단)까지만 채우고 병목 위쪽은 투명한 빈 유리(Headspace)로 두어 실제 카스 투명병 사진처럼 맑은 유리목이 투과되게 한다.
- 다른 캔 몬스터들과 동일하게 중심점(`y = 0`) 기준으로 상하 배치(`y = -0.46 ~ +0.58`)하여 인게임 바닥 그림자 및 스튜디오 단상과 높이를 정렬한다.

## Implementation

### I01. `getOrCreateTargetLabelTexture` 확장 및 슬림 롱넥 `LatheGeometry` 카스 병맥주 구현

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `getOrCreateTargetLabelTexture` — `'bottle-neck'` 텍스처 키 지원; modify
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D` (`kind === 'bottle'`) — 슬림 롱넥 `LatheGeometry` 병 외벽, 앰버 액체, 크리스탈 패싯, 분리형 바디/넥 라벨 구현; modify
  - `tests/three-stage-and-models.test.ts` :: `createTargetMesh3D suite` — `bottle` 모델의 `crownCap`, `neckLabel` 및 전용 텍스처 분리 검증; modify

#### Details
- **Texture Helper (`getOrCreateTargetLabelTexture`)**:
  ```typescript
  export function getOrCreateTargetLabelTexture(kind: TargetKind | 'bottle-neck'): THREE.Texture
  ```
  - `'bottle-neck'` 요청 시 Canvas 폴백에도 `COLD BREWED` 골드/블루 미니 밴드를 그리고, 브라우저 환경에서는 `/textures/labels/bottle-neck.jpg`를 로드한다.
- **Slim Long-neck Bottle 3D Profile (`kind === 'bottle'`)**:
  - 전체 높이 약 `1.04m` (`y = -0.46` 바닥 ~ `y = +0.58` 왕관 뚜껑), 바디 최대 반경 `0.175m` (하단부터 상단까지 날씬한 1:3 비율):
    1. **Outer Glass Lathe (`glassBody`, `THREE.LatheGeometry`)**:
       - 2D Profile Points (`[radius, y]`):
         - `[0.0, -0.46]`, `[0.155, -0.46]`, `[0.172, -0.43]`, `[0.166, -0.35]` (하단 크리스탈 잘록한 곡선),
         - `[0.175, -0.26]`, `[0.175, 0.08]` (슬림한 메인 바디),
         - `[0.165, 0.14]`, `[0.135, 0.21]`, `[0.095, 0.28]`, `[0.072, 0.35]` (매끄러운 곡선형 숄더),
         - `[0.066, 0.45]`, `[0.063, 0.55]` (길고 날씬한 롱넥),
         - `[0.070, 0.565]`, `[0.062, 0.575]` (병 입구 립)
       - 재질: `MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, transmission: 0.92, ior: 1.52, roughness: 0.04, clearcoat: 1.0 })`
    2. **Inner Golden Amber Beer Liquid (`liquidMesh`, `THREE.LatheGeometry`)**:
       - 바닥(`y = -0.44`)부터 어깨 상단(`y = +0.33`, 넥 라벨 바로 아래)까지만 채워지고, **병목 상단(`y = 0.33 ~ 0.57`)은 액체가 없는 투명 유리 공간(Headspace)**으로 비워둔다!
       - 액체 상단 수면(`y = 0.33`)에 얇은 화이트/골드 거품 링(`meniscusRing`)을 추가해 리얼리티를 높인다.
       - 재질: 실제 카스 라거의 깊고 맑은 황금빛 앰버 골드(`color: 0xd97706`, `emissive: 0x451a03`, `emissiveIntensity: 0.25`, `roughness: 0.15`, `metalness: 0.08`).
    3. **Lower Crystal Embossing Facets (하단 크리스탈 조각 양각)**:
       - `y = -0.35` 부근에 반투명 유리 각면 링(`CylinderGeometry(0.174, 0.168, 0.11, 10)`)을 wireframe/faceted 유리 재질로 감싸 하단 크리스탈 엠보싱 질감을 표현한다.
    4. **Body Label (`labelMesh`)**:
       - `new THREE.CylinderGeometry(0.177, 0.177, 0.33, 32, 1, true)` (위아래 뚜껑이 열린 원통 쉘, `openEnded: true`)
       - 위치: `y = -0.09`
       - 텍스처: `getOrCreateTargetLabelTexture('bottle')`
    5. **Neck Label (`neckLabelMesh`, `name = 'neckLabel'`)**:
       - `new THREE.CylinderGeometry(0.066, 0.073, 0.10, 28, 1, true)` (병목 테이퍼에 맞춘 원뿔대 쉘, `openEnded: true`)
       - 위치: `y = 0.38`
       - 텍스처: `getOrCreateTargetLabelTexture('bottle-neck')` (바디 라벨과 분리된 전용 텍스처!)
    6. **Silver Crown Cap (`crownCap`, `name = 'crownCap'`)**:
       - 위치: `y = 0.58`, 반경 `0.072`, 높이 `0.032` 은색 크라운 병뚜껑.

## Acceptance Criteria
- [ ] `createTargetMesh3D('bottle')`이 `THREE.LatheGeometry` 기반 슬림 롱넥 유리병과 황금빛 앰버 액체, 분리된 `bottle` 및 `bottle-neck` 라벨을 포함하여 생성된다.
- [ ] 바디 라벨(`labelMesh`)과 넥 라벨(`neckLabel`)의 텍스처 인스턴스가 서로 다르게 분리되어 있다.
- [ ] `npx vitest run tests/three-stage-and-models.test.ts` 단위 테스트가 100% 통과한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 3D 병맥주 구조 및 전용 넥 라벨 검증 통과

## Commit Message
```text
feat(three): remodel Cass Fresh bottle with slim long-neck LatheGeometry and dedicated neck label

Plan: 2026-11-02-real-cass-fresh-longneck-bottle
Phase: P01-real-cass-fresh-longneck-bottle
Task: T02-slim-longneck-lathe-bottle-3d

- Remodel bottle geometry using smooth LatheGeometry profile matching real 500ml slim long-neck silhouette
- Fill golden amber beer liquid up to upper shoulder leaving realistic clear glass headspace in neck
- Map dedicated bottle-neck.jpg texture to tapered neckLabel cylinder shell
- Add crystal embossing facet ring on lower bottle waist and update unit tests
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
