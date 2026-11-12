# Task: T04 찰랑 3D 모델과 라벨 에셋

## Status: pending

## Goal
찰랑의 3D 모델(검은 덩어리 몸체, 눈 두 개, 그 위의 투명 병과 찰랑 라벨)을 만들고, 라벨 텍스처 `public/textures/labels/chalang.jpg`를 생성해 출처 문서에 등록한다.

## Decision Summary
- D08: 제공 이미지를 기준으로 3D 모델을 직접 만들고 라벨은 찰랑 느낌으로 재현한다. 오비맥주 공식 파일은 쓰지 않는다.
- 기존 라벨 방식(`scripts/generate-labels.mjs` → `public/textures/labels/*.jpg` → `SOURCES.md` 기록)을 그대로 따른다.
- 모델 치수는 `TARGET_SPECS.chalang.modelScale`(1.9, P01)을 곱해 다른 몬스터와 같은 크기 감각을 맞춘다.

## Implementation

### I01. 찰랑 라벨 텍스처 생성기 추가

- Related Files:
  - `scripts/generate-labels.mjs` :: `labelConfigs`(line 9) — `chalang` 설정 추가; modify
  - `public/textures/labels/chalang.jpg` — 스크립트가 생성하는 산출물; new
  - `public/textures/labels/SOURCES.md` :: 표 — `chalang.jpg` 행 추가; modify

#### Details
- **Data & Schema Fields** (`labelConfigs` 항목 형식은 기존 `bottle` 항목을 그대로 따른다):
  - 해상도 1024×512, JPEG 품질 95%
  - 배경: 세로 그라데이션 `#0c4a6e` → `#38bdf8`(청록 바다 느낌, 기사 설명 "푸른 바다")
  - 상단 병목 쪽에 잔잔한 물결 곡선 3줄(흰색, 투명도 0.35)
  - 중앙 텍스트: `찰랑` (굵은 흰색, 세로 중앙), 그 아래 작은 글씨 `ZERO SUGAR · 15%`
  - 좌하단 원형 엠블럼 자리(스크립트 기존 엠블럼 헬퍼가 있으면 재사용, 없으면 흰색 원 1개)
- **SOURCES.md 행 (표 형식 그대로)**:
  `| \`chalang.jpg\` | 찰랑(Chalang) | 1024×512 | 블루 물결 라벨, 찰랑 한글 로고, ZERO SUGAR 표기 | 오비맥주 찰랑 보도자료 제품 사진의 색감 참조(공식 파일 미사용, D08) |`
- **Execution Flow**:
  1. `scripts/generate-labels.mjs`의 `labelConfigs`에 `chalang` 항목 추가.
  2. 스크립트 상단 주석의 실행 방법으로 생성한다(Playwright 캔버스 렌더러).
  3. 생성된 `chalang.jpg`가 1024×512인지 확인한다.

### I02. 찰랑 3D 모델 빌드

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`(line 288) — `kind === 'chalang'` 분기 추가; modify
  - `src/pc/three/TargetModels3D.ts` :: `getTargetBaseY`(line 242) — 변경 없음(기본값 0.55가 지상 몬스터 높이와 맞음); read-only
  - `src/pc/three/TargetModels3D.ts` :: `isGround` 목록(line 981) — `kind === 'chalang'` 추가; modify

#### Details
- **Signatures & Types**: 기존 `createTargetMesh3D(kind, bossRole?)`를 바꾸지 않는다. 내부에 분기만 추가한다.
- **Model Parts** (모두 `getCachedGeometry`/`getCachedMaterial`로 캐시, 이름 키 `chalang-*`):
  1. 몸체: `SphereGeometry(0.6, 24, 16)`를 `scale(1.25, 0.6, 1.0)`. 재질 `MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })`. 명명: `inner.userData` 또는 `root.userData.chalangBody`에 저장.
  2. 눈 2개: `SphereGeometry(0.16, 16, 12)`, 흰색 재질. 위치 `(±0.22, 0.25, 0.5)`. 눈동자: `SphereGeometry(0.07, 12, 8)`, 파란색 `0x38bdf8`, 눈 앞쪽 `z + 0.08`.
  3. 병: `CylinderGeometry(0.13, 0.13, 0.62, 20)`, 재질 `MeshPhysicalMaterial({ color: 0x7dd3fc, transmission: 0.6, roughness: 0.1, transparent: true, opacity: 0.85 })`. 위치 `y = 0.55`(몸체 위).
  4. 병 라벨: `PlaneGeometry(0.22, 0.3)`, 재질 `MeshBasicMaterial({ map: getOrCreateTargetLabelTexture('chalang') })`. 병 원통 표면 앞쪽(`z = 0.135`)에 배치.
  5. 물결 링: `TorusGeometry(0.9, 0.04, 8, 32)`, `rotation.x = -Math.PI/2`, 재질 `MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })`, `visible = false`. 이름 `chalangRipple`(T05가 켠다).
- **Execution Flow**: 분기 안에서 위 1~5를 `root`(또는 기존 `inner` 그룹)에 추가한다. `obi`의 `obiShield`처럼 참조를 `root.userData`에 넣어 T05가 찾을 수 있게 한다: `root.userData.chalangBody`, `root.userData.chalangEyes`(눈 2개 그룹), `root.userData.chalangBottle`, `root.userData.chalangRipple`.
- **Error & Exception Handling**: `getOrCreateTargetLabelTexture`는 `document`가 없으면 자동으로 폴백 텍스처를 준다(기존 동작). 별도 처리 불필요.

## Acceptance Criteria
- [ ] `chalang.jpg`가 `public/textures/labels/`에 있고 1024×512다.
- [ ] `SOURCES.md`에 `chalang.jpg` 행이 있다.
- [ ] `createTargetMesh3D('chalang')`이 몸체·눈·병·라벨·링을 가진 그룹을 반환한다(userData 키 4개 존재).
- [ ] `chalang`이 `isGround` 목록에 있다.
- [ ] `tsc`와 기존 테스트가 통과한다.

## Validation
- `npx tsc --noEmit` — 오류 0개
- `npx vitest run` — 전체 통과(3D 모델은 DOM 없는 환경에서 폴백 텍스처 경로가 실행된다)
- 수동: `npm run dev`로 샌드박스(테스트 랩)에서 찰랑을 소환해 모델을 본다(P04에서 함께 확인)

## Commit Message
```text
feat(chalang): 찰랑 3D 모델과 라벨 에셋을 추가

Plan: 2026-11-12-chalang-monster
Phase: P03-visuals-and-asset
Task: T04-model-and-label-asset

- I01: 찰랑 라벨 생성기 설정과 chalang.jpg, SOURCES.md 기록
- I02: 검은 덩어리 몸체·눈·투명 병·라벨·물결 링 모델 빌드, 지상 목록 등록
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
