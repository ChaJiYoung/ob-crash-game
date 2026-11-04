# Decisions: Render Performance Optimization (No Resolution Downscale)

- Date: 2026-11-04
- Status: Confirmed
- Related: 2026-11-04-aim-sync-and-start-flow-fix.md (D03: 진단 연산은 모달 오픈 시에만)

## D01. 최적화 범위 — 리소스 공유/풀링 (그래픽 품질 유지)
- **Chosen**: 해상도·조명 품질은 그대로 두고, 아래 4가지만 적용
  1. **발사체/트레이서 오브젝트 풀** (`src/pc/three/ParticleEffects3D.ts`)
     - `spawnTracerBeam`, `spawnWeaponProjectile`(샷건 펠릿/리볼버 볼트/개틀링 버블)에서 매 발사마다 `new Geometry/Material/Mesh` 하던 구조를 제거
     - 지오메트리·머티리얼은 무기 종류별로 1회 생성 후 공유, 메시는 미리 할당한 풀에서 대여/반납
     - 트레이서 길이·방향은 단위 길이 지오메트리 + `scale`/`quaternion`으로 표현
     - 풀이 고갈되면 가장 오래된 활성 객체를 회수해 재사용 (새로 만들지 않음) — 코드 탐색으로 자동 확정
  2. **몬스터 리소스 캐시** (`src/pc/three/TargetModels3D.ts` `createTargetMesh3D` 등)
     - `TargetKind`별 지오메트리·머티리얼·텍스처를 모듈 레벨 캐시로 공유
     - 피격 플래시/프리즈 틴트처럼 개별 색 변화가 필요한 머티리얼만 인스턴스 단위로 복제 (현재 L499 `origColor` 로직 유지)
     - `disposeGroup`은 공유 리소스를 dispose 하지 않도록 수정 (공유 리소스 해제 버그 방지)
  3. **정적 그림자 1회 계산** (`src/pc/components/GameCanvas3D.tsx`)
     - `renderer.shadowMap.autoUpdate = false`, 씬 구성 직후 `shadowMap.needsUpdate = true` 1회
  4. **셰이더 예열**
     - 씬 구성 후 모든 몬스터/아이템/카드/발사체 머티리얼을 1회씩 포함한 상태로 `renderer.compile(scene, camera)` 호출 → 첫 스폰 시 셰이더 컴파일 끊김 제거
- **Rationale**: 병목은 해상도가 아니라 "발사·스폰 시점마다 GPU 리소스를 새로 만들어 업로드하고 GC를 유발하는 구조"였음. 품질 손실 없이 프레임 스파이크를 제거할 수 있음.

## D02. 검증 방식 — 진단 패널 렌더 지표 + 회귀 테스트
- **Chosen**:
  - 기존 센서 진단 모달(`MobileSensorLabModal` / `SensorAndModuleTestLabOverlay`)에 `FPS`, `drawCalls`, `geometries`, `textures`(`renderer.info` 기반) 표시. **모달이 열려 있을 때만** 갱신 (D03 원칙 준수)
  - vitest 회귀 테스트: "100발 사격 + 몬스터 30마리 스폰/제거 후에도 생성된 geometry/material 수가 증가하지 않음"을 검증
- **Rationale**: 풀링·캐시는 체감으로 판별이 어려우므로 수치로 확인하고, 향후 매번 생성하는 코드로 회귀하는 것을 테스트로 차단.

## D03. 조명 다이어트 — 시각적으로 동등한 대체 (조건부 승인)
- **Chosen**: `BreweryStage3D.ts`의 장식용 `PointLight` 3개(amberNeon, cyanNeon, alertLight)를 아래로 대체
  - 같은 위치에 **emissive 네온 메시**(간판/스트립)를 배치하고 Bloom이 빛 번짐을 담당
  - 바닥/벽에 닿던 색광은 **HemisphereLight 1개** 또는 기존 Ambient 색조 보정으로 근사
  - 기존 `updateStageAnimation`의 피버 금색 전환·펄스·위험 경보 깜빡임은 `emissive`/`emissiveIntensity` 및 Hemisphere 색 애니메이션으로 **동작 그대로 유지**
  - 그림자용 `mainDirLight`, `ambientLight`는 유지
- **조건**: "비슷한 분위기"가 전제. 전/후 스크린샷(`.memory/references/scripts/capture-start-state.mjs`)을 비교해 분위기가 크게 다르면 해당 라이트만 원복
- **Rationale**: `MeshStandardMaterial`은 픽셀마다 모든 라이트를 계산하므로, 라이트 3개 제거 시 화면 전체 고정 비용이 크게 줄어듦. 사용자가 "비슷하게면 상관없음"으로 승인.

## Out of Scope
- 해상도/pixelRatio/Bloom 해상도 축소: 사용자 요청으로 제외

## 참고 자료
- 진단 스크립트: `.memory/references/scripts/` (README 참조)
