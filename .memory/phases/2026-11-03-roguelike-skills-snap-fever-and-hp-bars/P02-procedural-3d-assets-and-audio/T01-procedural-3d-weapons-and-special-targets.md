---
id: T01-procedural-3d-weapons-and-special-targets
phase: P02-procedural-3d-assets-and-audio
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Procedural 3D Realistic Plunger, 3-Weapon Lv.1~MAX Evolutions & Special Target Meshes
status: done
---

# Goal

외부 `.glb` 파일 없이 순수 Three.js 프로시저럴 지오메트리로 **리얼한 고무 흡착컵 뚫어뻥(`createRealisticPlungerMesh`)**, **3종 무기 × 4단계(Lv.1~MAX) 외형 진화(`DraftTapGun3D`)**, 그리고 **황금 캔·투사체·사격형 카드 3D 메쉬 및 몬스터 뚫어뻥 부착 상태 표시(`TargetModels3D`)**를 구현한다.

---

# Procedural 3D Asset Reference Blueprint (에셋 상세 레퍼런스)

> [`weapon-showroom-preview.html`](../../../weapon-showroom-preview.html)에서 검증 완료된 프로시저럴 3D 지오메트리 및 머티리얼 규격입니다. 구현 시 아래 치수·색상·계층 구조를 그대로 참고하세요.

## 1. 리얼 3D 뚫어뻥 에셋 (`createRealisticPlungerMesh(scale = 1.0): THREE.Group`)
단순 원기둥이 아닌 **3단 고무 벨 돔 + 하단 두꺼운 흡착 테두리(Torus) + 나무 막대** 조합으로 누가 봐도 뚫어뻥임을 직관적으로 알아볼 수 있게 구성한다:
- **나무 손잡이 막대 (Wooden Stick)**:
  - `THREE.CylinderGeometry(0.032, 0.036, 0.95, 16)`, `MeshStandardMaterial({ color: 0xc89666, roughness: 0.65 })`, `rotation.x = Math.PI / 2`, `position.z = -0.25`
- **손잡이 끝 둥근 마감 (Stick End Cap)**:
  - `THREE.SphereGeometry(0.038, 12, 12)`, `color: 0xa67545`, `position.z = 0.22`
- **고무 소켓 목 (Rubber Neck Collar)**:
  - `THREE.CylinderGeometry(0.065, 0.05, 0.14, 16)`, `MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 })`, `rotation.x = Math.PI / 2`, `position.z = -0.68`
- **고무 벨 돔 상단 (Bell Dome Upper)**:
  - `THREE.SphereGeometry(0.18, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58)`, `MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.08, side: THREE.DoubleSide })`, `rotation.x = -Math.PI / 2`, `position.z = -0.72`
- **고무 플레어 스커트 하단 (Flared Skirt)**:
  - `THREE.CylinderGeometry(0.16, 0.25, 0.14, 24, 1, true)`, `color: 0xdc2626`, `rotation.x = Math.PI / 2`, `position.z = -0.82`
- **하단 두꺼운 흡착 림 (Suction Rim Lip)**:
  - `THREE.TorusGeometry(0.245, 0.038, 16, 28)`, `MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 })`, `position.z = -0.89`
- **흡착 림 내부 음영 디스크 (Dark Inner Cavity)**:
  - `THREE.CircleGeometry(0.22, 20)`, `MeshBasicMaterial({ color: 0x450a0a, side: THREE.DoubleSide })`, `position.z = -0.88`

## 2. 3종 무기 × Lv.1~MAX(Lv.4) 외형 진화 (`DraftTapGun3D.ts`)
`setWeaponAppearance(kind: WeaponKind, level: WeaponLevel)` 호출 시 총열 그룹(`barrelEvolutionGroup`)을 재구성하여 레벨업 시 외형이 드라마틱하게 진화한다:
- **아키타입 1: `shotgun` (🪠 맥주관 뚫어뻥 샷건)**:
  - 총몸 상단 황동 챔버(`#d4af37`) + 빨간 생맥주 탭 레버 손잡이(`#dc2626`)
  - **Lv.1**: 중앙 싱글 배럴(`CylinderGeometry(0.055, 0.065, 0.65)`) + 총구 끝 장착된 3D 뚫어뻥(`scale: 0.65`)
  - **Lv.2**: 좌우 더블 배럴(`x = ±0.065`) + 우측면 황동 CO2 압력 게이지(`#fbbf24`) 장착
  - **Lv.3**: 삼중 트라이 배럴(역삼각형 배치) + 상단 반투명 호박색 맥주 호스 브릿지(`TorusGeometry(0.12, 0.022)`, `#f59e0b`, `opacity: 0.85`)
  - **Lv.4 (MAX)**: 4연장 쿼드 배럴(`2×2` 배치) + 전방 2개 대형 뚫어뻥(`scale: 0.85`) + 회전하는 레드 네온 에너지 링(`TorusGeometry(0.18, 0.016)`, `#ef4444`)
- **아키타입 2: `revolver` (🍾 황금 병따개 리볼버)**:
  - 골드 프레임(`#f59e0b`) + 회전식 육각 왕관 병뚜껑 실린더(`CylinderGeometry(0.13, 0.13, 0.22, 12)` + 가장자리 톱니 크라운 림 6~8개) + 후방 오프너 갈고리 해머(`TorusGeometry(0.06, 0.018)`)
  - **Lv.1**: 기본 크롬 팔각 총열(`length: 0.55`) + 6연발 골드 병뚜껑 실린더
  - **Lv.2**: `1.5`배 연장 롱 스나이퍼 배럴(`length: 0.85`) + 골드 총구 링
  - **Lv.3**: 상단 시안 네온 레이저 조준경(`#00f5d4`) 브라켓 장착 + 전방 시안 레이저 가이드 빔(`scopeBeamMesh`) 상시 활성화
  - **Lv.4 (MAX)**: 총구 끝 대형 4면 골드 머즐 브레이크 컴펜세이터(`BoxGeometry(0.14, 0.14, 0.22)`, `#fbbf24`) + 8연발 확장 실린더 + 골드 오라 링
- **아키타입 3: `gatling` (🍺 탄산 탭 개틀링)**:
  - 회전 배럴 클러스터(`gatlingClusterGroup`, 사격 및 대기 중 Z축 회전) + 카스 블루 탄산 드럼통 탄창(`#0284c7`)
  - **Lv.1**: 6연장 황동 회전 총열(`radius: 0.075`) + 하단 단일 카스 블루 드럼통(`CylinderGeometry(0.13, 0.13, 0.26)`) + 전방 바인더 링 1개
  - **Lv.2**: 8연장 회전 총열 + 전방 바인더 링 2개 + 측면 황동 회전 모터 기어
  - **Lv.3**: 10연장 회전 총열 + 좌/우 듀얼 카스 블루 드럼통 탄창(`x = ±0.16`) + 상단 시안 네온 냉각 파이프 2줄(`#00f5d4`)
  - **Lv.4 (MAX)**: 12연장 헤비 회전 총열 + 전방 시안 아크 스파크 링(`TorusGeometry(0.16, 0.018)`, `#00f5d4`) + 황금/시안 이중 냉각 호스

## 3. 타겟 모델 상태 표시 및 특수 타겟 메쉬 (`TargetModels3D.ts`)
- **몬스터에 꽂힌 뚫어뻥 표시**: `updateTargetAnimation3D` 옵션에 `stuckPlungerCount?: number`, `isStunned?: boolean`, `isSlowed?: boolean` 추가. `isStunned`일 때 몬스터 몸체 전면에 미니 3D 뚫어뻥 메쉬(`plungerStuckGroup`)를 노출하고 부르르 떨림 연출.
- **황금 캔 (`createGoldenCanMesh3D`)**: 눈부신 골드 메탈릭 캔(`#fbbf24`, `emissive: #d97706`) + 회전하는 황금 스타 오라 링 + `"★ GOLDEN BONUS ★"` 3D 빌보드.
- **몬스터 거품/병뚜껑 투사체 (`createProjectileMesh3D`)**: 회전하는 붉은 네온 병뚜껑/거품 구체(`radius: 0.28`, `#f43f5e` / `#fef08a`) + `"SHOOT!"` 경고 링.
- **사격형 무기 선택 / 웨이브 보상 카드 3D 타겟 (`createCardTargetMesh3D`)**: 3D 홀로그램 아케이드 카드 프레임(`BoxGeometry(1.1, 1.45, 0.08)`) + 상단 아이콘/타이틀 캔버스 텍스처 빌보드.

---

# Target Files & Symbols

1. `src/pc/three/DraftTapGun3D.ts`
   - `createRealisticPlungerMesh(scale?: number): THREE.Group` export 함수 추가
   - `DraftTapGun3D.setWeaponAppearance(kind: WeaponKind, level: WeaponLevel): void` 추가
   - `DraftTapGun3D.updateAimAndRecoil` 내부에서 `gatling`일 때 총열 클러스터 상시/사격 회전 애니메이션 처리
2. `src/pc/three/TargetModels3D.ts`
   - `createGoldenCanMesh3D(): THREE.Group`, `createProjectileMesh3D(): THREE.Group`, `createCardTargetMesh3D(title: string, subtitle: string, colorHex: string): THREE.Group` 추가
   - `createTargetMesh3D` 내부에 `plungerStuckGroup` 추가 및 `updateTargetAnimation3D`에서 `isStunned`, `isSlowed`, `stuckPlungerCount` 시각화 반영
3. `tests/three-stage-and-models.test.ts`
   - `createRealisticPlungerMesh`, `DraftTapGun3D.setWeaponAppearance` (3종 × Lv.1~4), `createGoldenCanMesh3D`, `createProjectileMesh3D`, `createCardTargetMesh3D` 단위 테스트 추가

# Verification Command

```bash
npx vitest run tests/three-stage-and-models.test.ts
```

# Commit Message

```text
feat(three): add procedural 3D realistic plunger, 3-weapon Lv1-4 evolutions, and special target meshes

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P02-procedural-3d-assets-and-audio
Task: T01-procedural-3d-weapons-and-special-targets
```
