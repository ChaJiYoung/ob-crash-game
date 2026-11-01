# Task: T02 제품 라벨 에셋 수집, LatheGeometry 캔·물리 유리잔·지상/공중 분리·바닥 그림자 및 아이템 4종 3D 모델 구현

## Status: done

## Goal
오비맥주 4종 캔·생맥주잔·냉각기 보스의 라벨 텍스처 에셋(`public/textures/labels/`)을 준비하고, `TargetModels3D.ts`를 `LatheGeometry` 실물 캔 곡선과 `MeshPhysicalMaterial` 유리 투과 재질·1.85배 아케이드 스케일·바닥 원형 그림자(`DropShadow`)·지상/공중 모션 분리로 업그레이드하며, 오비 펍 소품형 아이템 4종 3D 모델(`createItemMesh3D`)을 구현한다.

## Decision Summary
- `2026-11-01-visual-quality.md` (D01, D02, D04): 웹 제품 라벨 이미지 수집(`public/textures/labels/*.jpg`, Git 커밋 포함, `SOURCES.md` 기록) + 고해상도 브랜드 라벨 폴백, `LatheGeometry` 캔 프로파일, `MeshPhysicalMaterial` 알루미늄/유리 투과, 오비 펍 소품형 아이템 4종(황금 병따개, 맥주 코스터, 얼음 버킷, 홉 다발 + 색상 오라).
- `2026-11-01-visual-enhancement.md` (D01): 몬스터 1.85배 확대, 지상 몬스터(`obi`, `hanmac`, `mug`, `boss`) 바닥 밀착 롤링/바운스 + 바닥 드롭 섀도우, 공중 몬스터(`pilgood`, `caslight`) 비행 + 하단 거품 추진 파티클.

## Implementation

### I01. 오비맥주 브랜드 라벨 이미지 에셋 및 출처 문서 생성

- Related Files:
  - `public/textures/labels/pilgood.jpg` — 필굿(FiLGOOD) 캔 전면 라벨 텍스처; new
  - `public/textures/labels/caslight.jpg` — 카스 라이트(Cass Light) 캔 전면 라벨 텍스처; new
  - `public/textures/labels/obi.jpg` — 오비 라거(OB Lager) 랄라베어 캔 전면 라벨 텍스처; new
  - `public/textures/labels/hanmac.jpg` — 한맥(HANMAC) 캔 전면 라벨 텍스처; new
  - `public/textures/labels/mug.jpg` — 생맥주잔 로고 배지 텍스처; new
  - `public/textures/labels/boss.jpg` — 업소용 생맥주 냉각기 전면 패널 텍스처; new
  - `public/textures/labels/SOURCES.md` — 수집된 이미지 출처 URL 및 폴백 생성 내역 기록; new

#### Details
- 웹 검색을 통해 공식 제품 이미지를 확보하여 `public/textures/labels/{kind}.jpg`에 저장하고, 다운로드 차단이나 저해상도인 항목은 고해상도(1024×512) 브랜드 아트워크(필굿 고래 일러스트·카스라이트 실버 블루 타이포·오비라거 랄라베어 엠블럼·한맥 골드 리본 크레스트)로 정밀 렌더링하여 저장한다.
- `.gitignore`에 제외하지 않고 저장소에 그대로 포함하며, `public/textures/labels/SOURCES.md`에 각 파일의 출처와 사양을 기록한다.

### I02. 실물 프로파일 캔(`LatheGeometry`)·투과 유리잔·바닥 그림자 및 아이템 4종 3D 모델(`TargetModels3D.ts`)

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `createItemMesh3D`, `updateTargetAnimation3D`, `updateItemAnimation3D`, `getTargetBaseY` — 몬스터 6종 PBR 모델 고도화, 지상/공중 Y좌표 계산, 바닥 그림자, 아이템 4종 소품 메시 생성; modify
  - `tests/three-stage-and-models.test.ts` — 6종 몬스터(스케일, 그림자, 유리잔 핸들) 및 4종 아이템 3D 메시 생성·애니메이션 검증 테스트; modify

#### Details
- **Signatures & Types (`src/pc/three/TargetModels3D.ts`)**:
  ```typescript
  export function getTargetBaseY(kind: TargetKind, isItem?: boolean): number;
  export function createTargetMesh3D(kind: TargetKind): THREE.Group;
  export function createItemMesh3D(itemKind: ItemBuffKind): THREE.Group;
  export function updateTargetAnimation3D(
    root: THREE.Group,
    kind: TargetKind,
    elapsedSec: number,
    hpRatio: number
  ): void;
  export function updateItemAnimation3D(
    root: THREE.Group,
    itemKind: ItemBuffKind,
    elapsedSec: number
  ): void;
  ```
- **몬스터 6종 3D 모델 고도화 (`createTargetMesh3D`)**:
  1. **아케이드 스케일 적용**: `const scale = TARGET_SPECS[kind].modelScale ?? 1.85; inner.scale.setScalar(scale);` (`root.userData.baseScale = scale` 저장 후 피격 플래시 복구 시 `baseScale`로 복원).
  2. **캔 4종 (`pilgood`, `caslight`, `obi`, `hanmac`)**:
     - `THREE.LatheGeometry`로 하단 라운드 베이스 ➔ 직선 바디 ➔ 상단 테이퍼 숄더 ➔ 알루미늄 더블 시밍 림(Rim) 단면 회전 생성.
     - 바디는 `MeshPhysicalMaterial({ map: labelTex, metalness: 0.72, roughness: 0.22, clearcoat: 0.65, clearcoatRoughness: 0.15 })` 적용. 브라우저 환경에서는 `THREE.TextureLoader`로 `/textures/labels/${kind}.jpg`를 비동기 오버레이 로드하여 Canvas 텍스처를 갱신.
     - 표면에 차가운 결로 물방울(`SphereGeometry` 미세 투명 비즈 8개) 부착.
     - `pilgood`, `caslight`는 하단에 탄산 거품 제트 분사구(`jetPlume` 메시)를 추가하여 공중 비행 이유를 시각적으로 표현.
  3. **500ml 생맥주잔 (`mug`)**:
     - 외벽 유리: `THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, transmission: 0.75, ior: 1.5, roughness: 0.08, metalness: 0.05, clearcoat: 1.0 })`.
     - 내부 황금빛 맥주액 + 상승하는 탄산 기포 구체 6개 + 풍성한 크림 거품 크라운.
  4. **업소용 생맥주 냉각기 보스 (`boss`)**:
     - 전면 패널에 `/textures/labels/boss.jpg` 텍스처 적용, 상단 디지털 온도계(`-4°C` 그린 발광 패널), 크롬 드래프트 타워, 듀얼 골드 탭 추출구 및 오렌지 레버, 하단 캐스터 바퀴 4개.
  5. **실시간 바닥 원형 그림자 (`shadowMesh`)**:
     - 모든 몬스터 `root` 하위에 반투명 검정 원판(`CircleGeometry(r * 1.45, 24)`)을 추가(`root.userData.shadowMesh = shadow`).
     - `getTargetBaseY(kind, isItem)`:
       - `isItem === true`: `1.15` (눈에 잘 띄는 중간 고도 부유)
       - `kind === 'pilgood' || kind === 'caslight'`: `1.45` (공중 활공 고도)
       - `kind === 'boss'`: `1.15` (바닥 접지 대형 캐비닛 중심)
       - `kind === 'mug' || kind === 'obi' || kind === 'hanmac'`: `0.55` (바닥 밀착 접지 고도)
     - `updateTargetAnimation3D`에서 지상 몬스터는 바닥에서 통통 튀는 바운스(`Math.abs(Math.sin(...)) * 0.18`)와 정면 라벨이 잘 보이도록 제한된 좌우 회전(`Math.sin(...) * 0.22`)을 수행하고, `shadowMesh.position.y = -root.position.y + 0.02`로 항상 바닥면(`y = 0.02`)에 그림자를 밀착시킨다.
- **오비 펍 소품형 아이템 4종 3D 모델 (`createItemMesh3D`)**:
  - 공통: 외곽에 회전하는 발광 토러스 오라 링(`TorusGeometry(0.65, 0.035, 12, 32)`, `ITEM_BUFF_SPECS[itemKind].auraColorHex`) + 바닥 원형 그림자.
  - `power_shot`: 황금빛 메탈 병따개(오프너 핸들 + 원형 링 헤드) + 붉은 오라.
  - `wide_scope`: 원형 오비 맥주 코스터 표적판(골드/시안 동심원 과녁 디스크) + 하늘색 오라.
  - `ice_freeze`: 은색 메탈 얼음 버킷 + 반투명 하늘색 각얼음 3개 + 파란 냉기 오라.
  - `bar_repair`: 에메랄드빛 홉(Hop) 열매 솔방울 클러스터 3송이 + 골드 리본 + 초록 오라.

## Acceptance Criteria
- [ ] `public/textures/labels/` 하위에 6종 이미지 파일과 `SOURCES.md`가 존재한다.
- [ ] `createTargetMesh3D`가 1.85배 스케일(`inner.scale`), `shadowMesh`, 지상/공중 분리 애니메이션을 포함하여 동작한다.
- [ ] `createItemMesh3D`가 4종(`power_shot`, `wide_scope`, `ice_freeze`, `bar_repair`) 모두에 대해 고유 3D 소품 메시와 오라 링을 생성한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts && npx tsc --noEmit` — 모든 3D 모델 및 아이템 메시 테스트 통과.

## Commit Message
```text
feat(3d): upgrade PBR beer models with Lathe cans, glass mug, shadows, and 4 pub item meshes

Plan: 2026-11-01-arcade-v2-upgrade
Phase: P01-arcade-v2-upgrade
Task: T02-pbr-assets-and-3d-models

- Add product label textures in public/textures/labels/ and SOURCES.md
- Remodel cans with LatheGeometry, physical clearcoat, and glass mug transmission
- Separate ground vs airborne target heights with floor-locked drop shadows
- Implement 4 pub-themed item 3D models with glowing aura rings
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
