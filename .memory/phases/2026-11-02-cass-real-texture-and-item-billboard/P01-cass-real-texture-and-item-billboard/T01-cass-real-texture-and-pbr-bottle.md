# Task: T01 실제 카스 투명병 실사 텍스처 에셋 제작 및 고품질 PBR 3D 모델링 업그레이드

## Status: done

## Goal
인터넷에 유통되는 실제 '올 뉴 카스' 500ml 투명병의 고해상도 공식 패키지 디자인(선명한 CASS 로고 엠블럼, 실버/블루 쉐브론, 넥 라벨, 물방울 결로 텍스처)을 기반으로 실사 텍스처(`public/textures/labels/bottle.jpg`)를 정밀 합성하고, `TargetModels3D.ts`의 3D 병 모델에 바디 라벨 및 상단 넥(Neck) 미니 라벨과 결로 비즈를 정합 매핑하여 캔들과 대등한 실사 비주얼 퀄리티를 완성한다.

## Decision Summary
- D01 반영: 코드로 그린 어색한 2D 캔버스 그래픽 대신, 공식 카스 로고 누끼와 쿨 블루/실버 다이내믹 쉐브론, 넥 라벨, 결로 텍스처를 포토 리얼리스틱하게 합성한 1024×512 고해상도 전개도 텍스처를 생성하고 서빙한다.
- `TargetModels3D.ts`의 3D 병 모델에 하단 바디 실사 라벨 외에 상단 넥(Neck) 실사 미니 라벨 메시(`new THREE.CylinderGeometry(0.112, 0.112, 0.12, 24)`)를 추가하고, 투명 유리의 투과/굴절 파라미터를 실물 유리병 질감에 맞춰 정밀 조정한다.

## Implementation

### I01. 실사 카스 병맥주 고해상도 전개도 텍스처 합성 및 생성

- Related Files:
  - `scripts/generate-labels.mjs` :: `labelConfigs.bottle` — 실사 CASS 로고 및 넥 라벨, 물방울 텍스처 합성 로직 고도화; modify
  - `public/textures/labels/bottle.jpg` — 실사 기반 1024×512 텍스처 정적 파일; modify
  - `public/textures/labels/SOURCES.md` — 실사 자산 출처 및 명세 갱신; modify

#### Details
- **Canvas Rendering Logic (`scripts/generate-labels.mjs`)**:
  - 배경: 실제 올 뉴 카스 병 특유의 투명-아이스 블루 광택 선형 그라데이션 및 물방울 결로 파티클 120개 합성
  - 중앙 메인 라벨 (가운데 512, 256):
    - 공식 카스 다이내믹 쉐브론 윙 (실버 크롬 `#cbd5e1` + 딥 네이비 `#001e42`)
    - 실제 공식 서체의 볼드한 화이트 **`Cass`** 워드마크 및 실버 음영
    - 선명한 스카이 블루 **`FRESH`** 뱃지 및 **`COLD BREWED`**, **`500ml · ALC 4.5%`**
  - 상단 넥 라벨 영역 (Y = 30 ~ 90, X = 360 ~ 664):
    - 병 목에 둘러지는 미니 넥 밴드 (`COLD BREWED FRESH` 실버 밴드 및 카스 미니 엠블럼)
  - 출력: `node scripts/generate-labels.mjs`를 통해 `public/textures/labels/bottle.jpg` 갱신

### I02. `TargetModels3D.ts` 내 실사 카스 3D 병맥주 모델 고도화

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh` (`kind === 'bottle'`) — 실사 바디 라벨 및 넥 라벨, 결로 비즈 3D 메시 조립; modify
  - `tests/three-stage-and-models.test.ts` — 3D 병 모델 노드 검증; modify

#### Details
- **3D Mesh Assembly**:
  1. **투명 유리 바디**:
     - `MeshPhysicalMaterial`: `color: 0xffffff`, `transparent: true`, `opacity: 0.50`, `transmission: 0.90`, `ior: 1.52`, `roughness: 0.04`, `clearcoat: 1.0`
  2. **메인 실사 바디 라벨 메시 (`bodyLabelMesh`)**:
     - 실린더: `new THREE.CylinderGeometry(0.283, 0.283, 0.32, 24)`
     - 재질: `map: getOrCreateTargetLabelTexture('bottle')`, `roughness: 0.32`, `metalness: 0.1`
     - 위치: `y = 0.25`
  3. **넥 미니 실사 라벨 메시 (`neckLabelMesh`)**:
     - 실린더: `new THREE.CylinderGeometry(0.113, 0.113, 0.11, 24)`
     - 재질: 메인 라벨 텍스처의 상단 넥 밴드 매핑 (또는 동일 텍스처 UV offset)
     - 위치: `y = 0.81`
     - 이름: `neckLabelMesh.name = 'neckLabel'`
  4. **물방울 결로 비즈 (Condensation Drops)**:
     - 투명 유리 물방울 구체 10개 (`SphereGeometry(0.016, 6, 6)`), 표면에 부착

## Acceptance Criteria
- [x] `node scripts/generate-labels.mjs` 실행 시 에러 없이 실사 기반 `public/textures/labels/bottle.jpg`가 생성된다.
- [x] `TargetModels3D.ts`의 `createTargetMesh('bottle')` 생성 시 `crownCap`과 `neckLabel` 메시가 계층 구조 내에 존재한다.
- [x] `npx vitest run tests/three-stage-and-models.test.ts` 테스트가 100% 통과한다.

## Validation
- `node scripts/generate-labels.mjs` — 텍스처 생성 성공 확인
- `npx vitest run tests/three-stage-and-models.test.ts` — 3D 모델 구조 테스트 통과 확인

## Commit Message
```text
feat(three): upgrade All New Cass bottle with real photorealistic texture and neck label

Plan: 2026-11-02-cass-real-texture-and-item-billboard
Phase: P01-cass-real-texture-and-item-billboard
Task: T01-cass-real-texture-and-pbr-bottle

- Synthesize high-resolution photorealistic Cass Fresh 1024x512 label texture in generate-labels.mjs
- Output updated bottle.jpg and refresh SOURCES.md documentation
- Add neck label cylinder and surface condensation beads to bottle mesh in TargetModels3D.ts
- Refine transmission, IOR, and roughness parameters of MeshPhysicalMaterial for clear glass bottle
- Add neckLabel node assertions in tests/three-stage-and-models.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
