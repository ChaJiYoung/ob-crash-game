# Task: T01 카스 프레시 고해상도 라벨 텍스처(bottle.jpg) 생성 및 데이터 모델/스폰 엔진 등록

## Status: done

## Goal
오비맥주 카스 프레시 500ml 병맥주 전용 고해상도(1024×512) 라벨 텍스처 에셋을 생성하고, `TargetKind` 및 `TARGET_SPECS`에 `bottle` 사양을 등록하며, 게임 엔진의 웨이브 스폰 목록을 갱신하여 데이터 모델 레이어를 준비한다.

## Decision Summary
- D01/D03/D05 반영: 적 타겟 라인업에 `bottle`을 추가하고 `scripts/generate-labels.mjs`에 카스 프레시 시그니처(딥 블루 그라데이션, 실버 쉐브론, CASS 타이포, 500ml 신선 로고) 캔버스 렌더러를 작성하여 `public/textures/labels/bottle.jpg`를 생성한다.
- 하위 호환성을 위해 `TargetKind` 유니온에 `bottle`을 추가하고(T03에서 `mug` 최종 정리 전까지 병행 허용), `TARGET_SPECS.bottle`에 체력 3, 속도 2.3m/s, 처치점수 160점, 지상형 스펙을 정의한다.

## Implementation

### I01. Playwright 라벨 생성기 확장 및 `bottle.jpg` 정적 자산 생성

- Related Files:
  - `scripts/generate-labels.mjs` :: `labelConfigs` — 카스 프레시 병맥주 라벨 생성 함수 추가; modify
  - `public/textures/labels/bottle.jpg` — 1024×512 전개도 텍스처 파일; new
  - `public/textures/labels/SOURCES.md` — 카스 프레시 병맥주 라벨 명세 추가; modify

#### Details
- **Canvas Rendering Logic (`scripts/generate-labels.mjs`)**:
  - `name: 'bottle'` 설정 추가
  - 배경: 좌우 대칭 딥 블루 선형 그라데이션 (`#002855` -> `#004b91` -> `#0077c8` -> `#004b91` -> `#002855`)
  - 상단/하단: 실버 크롬 보더 (`#e2e8f0` / `#94a3b8`)
  - 중앙 엠블럼:
    - 카스 시그니처 화이트/실버 사선 다이내믹 쉐브론 스트라이프 3줄
    - 굵은 볼드 영문 **`CASS`** 워드마크 (실버 그림자 + 화이트 필)
    - 하단 서브텍스트: **`FRESH`** (스카이 블루 `#38bdf8`), **`COLD BREWED · 100% FRESH AROMA`**
    - 좌우 용량/알코올 표기: **`500ml · ALC 4.5%`**, **`SEOUL, KOREA`**
  - 출력: `public/textures/labels/bottle.jpg` (JPEG quality 95)
- **Documentation (`public/textures/labels/SOURCES.md`)**:
  - `bottle.jpg` 항목 추가: 대상 `카스 프레시 500ml 병맥주(Cass Fresh Bottle)`, 해상도 `1024×512`

### I02. `TargetKind` 및 `TARGET_SPECS.bottle` 데이터 모델 등록

- Related Files:
  - `src/shared/types.ts` :: `TargetKind` — 유니온 타입에 `'bottle'` 추가; modify
  - `src/shared/constants.ts` :: `TARGET_SPECS` — `bottle` 사양 객체 추가; modify

#### Details
- **Signatures & Types (`src/shared/types.ts`)**:
  ```typescript
  export type TargetKind = 'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'bottle' | 'mug' | 'boss';
  ```
- **Data & Schema Fields (`src/shared/constants.ts`)**:
  ```typescript
  bottle: {
    kind: 'bottle',
    displayName: '카스 프레시 병맥주 (Cass Fresh Bottle)',
    maxHp: 3,
    speedMps: 2.3,
    hitRadiusM: 1.15,
    killBonusScore: 160,
    brandColorHex: '#004b91',
    accentColorHex: '#e2e8f0',
    isAirborne: false,
    modelScale: 1.95,
  },
  ```

### I03. 스폰 엔진 웨이브 설정 및 단위 테스트 업데이트

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `waveConfigurations` — 웨이브 1~3의 등장 타겟 목록에 `bottle` 교체 반영; modify
  - `tests/shared-protocol.test.ts` :: `TARGET_SPECS Protocol Verification` — `bottle` 스펙 검증 테스트 추가; modify

#### Details
- **Engine Logic (`src/pc/engine/BeerCrusherEngine.ts`)**:
  - 웨이브 1: `kinds: ['bottle', 'caslight', 'obi', 'hanmac']`
  - 웨이브 2: `kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle']`
  - 웨이브 3: `kinds: ['hanmac', 'bottle', 'pilgood', 'caslight']`
- **Unit Test (`tests/shared-protocol.test.ts`)**:
  - `TARGET_SPECS.bottle`의 `maxHp === 3`, `speedMps === 2.3`, `killBonusScore === 160`, `isAirborne === false` 검증
  - `TargetKind` 배열에 `'bottle'` 포함 검증

## Acceptance Criteria
- [x] `node scripts/generate-labels.mjs` 실행 시 에러 없이 `public/textures/labels/bottle.jpg` 파일(1024×512)이 생성된다.
- [x] `src/shared/types.ts`의 `TargetKind`에 `'bottle'`이 포함되고, `TARGET_SPECS.bottle`이 정의된다.
- [x] `src/pc/engine/BeerCrusherEngine.ts`의 웨이브 1, 2, 3 스폰 목록에 `'bottle'`이 반영된다.
- [x] `npx vitest run tests/shared-protocol.test.ts` 테스트가 100% 통과한다.

## Validation
- `node scripts/generate-labels.mjs && ls -lh public/textures/labels/bottle.jpg` — 파일 생성 확인
- `npx vitest run tests/shared-protocol.test.ts` — 프로토콜 단위 테스트 통과 확인

## Commit Message
```text
feat(assets): generate Cass Fresh bottle label texture and register bottle TargetSpec

Plan: 2026-11-01-cass-bottle-target
Phase: P01-cass-bottle-target
Task: T01-label-texture-and-data-model

- Add Cass Fresh procedural 1024x512 label generator in scripts/generate-labels.mjs
- Output public/textures/labels/bottle.jpg and update SOURCES.md
- Add 'bottle' to TargetKind in src/shared/types.ts and register TARGET_SPECS.bottle
- Update wave spawn configurations in BeerCrusherEngine to include bottle
- Add bottle specification unit tests in tests/shared-protocol.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
