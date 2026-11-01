# Task: T02 펍 소품형 아이템 4종 상단에 3D 아케이드 네온 빌보드 라벨 카드 상시 부유 구현

## Status: done

## Goal
사용자가 목업 비교에서 선택했던 '시안 1(아케이드 3D 네온 빌보드 라벨)'을 온전히 구현하여, 펍 소품형 아이템 4종(황금 병따개, 맥주 코스터, 얼음 버킷, 홉 열매) 상단에 항상 카메라를 정면으로 바라보는 네온 빌보드 카드(`[💥 DAMAGE 2X]`, `[🎯 WIDE 1.6X]`, `[🧊 SLOW 50%]`, `[🍺 LIFE +1]`)를 상시 부유시켜 18m 원거리에서도 0.1초 만에 효과를 인지할 수 있게 한다.

## Decision Summary
- D02 반영: `createItemMesh3D` 생성 시, 소품 머리 위(`y = +0.55m`)에 항상 플레이어 시점(카메라)을 바라보는 고해상도 아케이드 네온 스프라이트 빌보드 카드를 자식 노드로 장착한다.
- 네온 카드는 다크 반투명 라운드 박스 배경, 아이템 고유 색상 발광 테두리, 아이콘과 선명한 볼드 텍스트(`DAMAGE 2X` 등)를 포함하며, 소품의 상하 바운스 애니메이션과 동기화되어 자연스럽게 둥실둥실 부유한다.

## Implementation

### I01. 아이템 상시 네온 빌보드 텍스처 캐시 및 스프라이트 생성기 구현

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `getOrCreateItemBillboardTexture` — 4종 네온 카드 Canvas 텍스처 생성기 추가; modify
  - `src/pc/three/TargetModels3D.ts` :: `createItemMesh3D` — 소품 상단에 빌보드 스프라이트 카드 부착; modify

#### Details
- **Signatures & Helper (`getOrCreateItemBillboardTexture`)**:
  ```typescript
  function getOrCreateItemBillboardTexture(itemKind: ItemBuffKind): THREE.Texture
  ```
  - Canvas 크기: `512 x 128` (고해상도 4:1 카드)
  - 다크 반투명 라운드 사각형 배경 (`rgba(15, 23, 42, 0.92)`)
  - 고유 색상 두꺼운 발광 네온 테두리:
    - `power_shot`: `#ef4444` (화염 레드)
    - `wide_scope`: `#38bdf8` (스카이 블루)
    - `ice_freeze`: `#60a5fa` (프로스트 블루)
    - `bar_repair`: `#10b981` (에메랄드 그린)
  - 텍스트: 아이콘 + 굵은 볼드 영문 숏라벨
    - `💥 DAMAGE 2X`
    - `🎯 WIDE 1.6X`
    - `🧊 SLOW 50%`
    - `🍺 LIFE +1`
  - 캔버스 텍스처 반환 및 Map 캐싱
- **Sprite Attachment (`createItemMesh3D`)**:
  - `THREE.SpriteMaterial`: `map: getOrCreateItemBillboardTexture(itemKind)`, `transparent: true`, `opacity: 0.98`, `depthWrite: false`
  - `const billboard = new THREE.Sprite(mat);`
  - 스케일: `billboard.scale.set(1.5, 0.38, 1.0);`
  - 위치: `billboard.position.set(0, 0.60, 0);`
  - 식별자: `billboard.name = 'itemBillboard';`
  - `itemGroup.add(billboard);`

### I02. 빌보드 라벨 단위 테스트 검증 추가

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: `createItemMesh3D suite` — 4종 아이템에 `itemBillboard` 스프라이트 노드 존재 검증; modify

#### Details
- 4종 아이템 생성 루프에서:
  - `itemMesh.children.some(c => c.name === 'itemBillboard') === true` 단언
  - 스프라이트의 위치 `y > 0.4` 검증

## Acceptance Criteria
- [ ] `createItemMesh3D(itemKind)` 호출 시 반환된 그룹 내에 `itemBillboard` 이름의 스프라이트 카드가 존재한다.
- [ ] 4종 아이템(`power_shot`, `wide_scope`, `ice_freeze`, `bar_repair`) 각각에 맞는 고유 네온 텍스처와 라벨이 렌더링된다.
- [ ] `npx vitest run tests/three-stage-and-models.test.ts` 테스트가 100% 통과한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 4종 아이템 빌보드 노드 검증

## Commit Message
```text
feat(three): add persistent 3D neon billboard labels above pub item props

Plan: 2026-11-02-cass-real-texture-and-item-billboard
Phase: P01-cass-real-texture-and-item-billboard
Task: T02-item-3d-neon-billboard-labels

- Implement getOrCreateItemBillboardTexture with 512x128 neon rounded card canvas generator
- Attach itemBillboard Sprite above all 4 pub item props at y = +0.60m in createItemMesh3D
- Synchronize neon label floating animation with item prop floating physics
- Add itemBillboard child node and altitude assertions in tests/three-stage-and-models.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
