# Task: T03 실사 펍 HDRI·UnrealBloomPass·레이저 탄도 궤적 및 88px 다이내믹 조준경·아이템 타이머 HUD 연동

## Status: done

## Goal
실사 펍 HDRI 배경·환경반사(`public/hdri/pub_interior_2k.hdr`), `UnrealBloomPass` 네온 발광, 실시간 그림자, 총구-조준점 레이저 탄도 궤적(`spawnTracerBeam`), 88px 다이내믹 아케이드 조준경(`CrosshairOverlay.tsx`), 그리고 5목숨·5웨이브·아이템 8초 타이머 HUD(`ArcadeOverlayHUD.tsx`, `PCGamePage.tsx`)를 통합 구현한다.

## Decision Summary
- `2026-11-01-visual-enhancement.md` (D02, D03): 88px 다이내믹 아케이드 레티클(4방향 브래킷 + 격발 반동 팽창 + 피버 회전링), 무대 조명 밝기 상향 + 총구-조준점 네온 레이저 궤적(`TracerBeam`) + 거품 파편 폭발 강화.
- `2026-11-01-visual-quality.md` (D03): Poly Haven CC0 2K 실내 펍 HDRI(`scene.background` + `scene.environment`) + `EffectComposer`/`UnrealBloomPass` + `renderer.shadowMap` 활성화.
- `2026-11-01-gameplay-systems.md` (D01, D02, D03): HUD에 5개 맥주잔 체력(`🍺x5`), `WAVE {wave} / 5`, 획득 아이템 실시간 남은 시간 타이머(`8.0s ➔ 0.0s`) 표시.

## Implementation

### I01. 실사 펍 HDRI 에셋 및 브루어리 무대 조명·환경맵(`BreweryStage3D.ts`) 고도화

- Related Files:
  - `public/hdri/pub_interior_2k.hdr` — Poly Haven CC0 2K 실내 바/펍 HDRI 환경맵; new
  - `src/pc/three/BreweryStage3D.ts` :: `buildBreweryStage3D` — HDRI 로더(`RGBELoader`) 및 절차적 PMREM 폴백 환경맵, 화사한 펍 조명, 그림자 캐스팅, 18m 거리 가이드 라인 적용; modify

#### Details
- Poly Haven CC0 실내 펍 HDRI(예: `bar` / `pub` 계열 2K `.hdr`)를 `public/hdri/pub_interior_2k.hdr`로 저장한다.
- `buildBreweryStage3D(scene, renderer?)`:
  - 즉시 사용 가능한 따뜻한 펍 컬러 Canvas 환경 텍스처를 `scene.environment` 기본값으로 세팅하여 금속/유리 반사가 첫 프레임부터 작동하게 하고, 브라우저 환경에서는 `RGBELoader`로 `/hdri/pub_interior_2k.hdr`를 로드하여 `scene.environment`와 `scene.background`에 적용(`scene.backgroundBlurriness = 0.06`, `scene.backgroundIntensity = 0.75`).
  - `AmbientLight(0xfff0d8, 1.15)` 및 `DirectionalLight(0xfff5e4, 1.75)`로 조명을 화사하게 상향하고 `mainDirLight.castShadow = true` 활성화.
  - 거리 아크 가이드를 `[6.0, 12.0, STAGE_CONSTANTS.SPAWN_RADIUS_M]`(18m)으로 조정.
  - 원목 바 카운터 상단에 황동 생맥주 탭 타워 장식과 네온 간판(`OB LAGER · CASS · HANMAC · FiLGOOD`) 배치.

### I02. 레이저 탄도 궤적(`ParticleEffects3D.ts`) 및 Bloom·그림자·아이템 렌더링(`GameCanvas3D.tsx`)

- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `ParticleEffects3D.spawnTracerBeam`, `ParticleEffects3D.spawnHitEffect` — 총구에서 타격 지점으로 발사되는 네온 레이저 빔과 머즐 플래시 구현; modify
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D.getMuzzleWorldPosition` — 3D 총구 노즐의 월드 좌표 반환 헬퍼 추가; modify
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D` — `EffectComposer` + `UnrealBloomPass` 연동, 그림자 활성화, 아이템(`isItem`) 3D 메시 분기, 사격 시 레이저 궤적 생성; modify

#### Details
- **Signatures & Logic (`src/pc/three/ParticleEffects3D.ts`)**:
  ```typescript
  public spawnTracerBeam(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    colorHex: string,
    isFeverOrPower?: boolean
  ): void;
  ```
  - `fromPos`(총구 노즐)와 `toPos`(조준 타겟 또는 전방 14m 지점)를 잇는 원통형 레이저 빔 메시(`CylinderGeometry(radius, radius, distance, 8)`)와 총구 머즐 플래시 구체(`SphereGeometry(0.14, 10, 10)`)를 생성하여 `0.15초` 동안 빠르게 페이드아웃시킨다.
  - `isFeverOrPower`일 때 빔 굵기를 1.8배 키우고 황금/크림슨 컬러를 적용한다.
- **`GameCanvas3D.tsx`**:
  - `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMappingExposure = 1.35;`
  - `EffectComposer`, `RenderPass`, `UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.35, 0.82)` 구성.
  - `engine.activeTargets` 순회 시:
    - `target.isItem && target.itemKind`이면 `createItemMesh3D(target.itemKind)` 생성 및 `updateItemAnimation3D(mesh, target.itemKind, time / 1000)` 호출.
    - 일반 몬스터는 `createTargetMesh3D(target.kind)` 생성 및 `updateTargetAnimation3D` 호출.
    - Y 위치는 `getTargetBaseY(target.kind, target.isItem)` 사용.
  - 사격(`lastShootResult`) 발생 시:
    - 총구 월드 좌표(`tapGun.getMuzzleWorldPosition(camera)`)에서 명중 타겟 위치(빗나갔을 경우 조준 방향 전방 14m 월드 좌표)로 `particles.spawnTracerBeam(...)` 호출.
    - 명중 시 `particles.spawnHitEffect(..., result.killed ? 36 : 18)`로 맥주 거품과 금빛 파편 2배 폭발.

### I03. 88px 다이내믹 아케이드 레티클(`CrosshairOverlay.tsx`) 및 5목숨·아이템 타이머 HUD(`ArcadeOverlayHUD.tsx`, `PCGamePage.tsx`)

- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlay`, `getCrosshairVisualSpec` — 88px 기본 크기(빅 스코프 시 140px), 4방향 브래킷, 격발 반동 팽창, 피버 회전링 구현; modify
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUD`, `formatActiveBuffBadge` — 5개 맥주잔 라이프(`🍺x5`), `WAVE {wave} / 5`, 활성 아이템 8초 카운트다운 배지 바 표시; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `activeBuffs` 상태 동기화 및 `CrosshairOverlay`·`ArcadeOverlayHUD` props 전달; modify
  - `tests/pc-hud-and-banner.test.ts` — 88px/140px 레티클 스펙 계산 및 아이템 타이머 배지 포맷 테스트 추가; modify

#### Details
- **Signatures & Logic (`src/pc/components/CrosshairOverlay.tsx`)**:
  ```typescript
  export interface CrosshairOverlayProps {
    aimX: number;
    aimY: number;
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
    shotTriggerKey?: number;
  }

  export function getCrosshairVisualSpec(options: {
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
  }): {
    sizePx: number;
    ringSizePx: number;
    primaryColor: string;
    glowColor: string;
    badgeText?: string;
  };
  ```
  - 기본 크기: `sizePx = 88`, `ringSizePx = 68`.
  - `isWideScopeActive === true`: `sizePx = 140` (`88 * 1.6`), `ringSizePx = 112`, `badgeText = 'WIDE 1.6X'`.
  - `isPowerShotActive === true`: `primaryColor = '#ef4444'`, `badgeText = 'POWER 2X'`.
  - `isFeverActive === true`: `primaryColor = '#fbbf24'`, 외곽 점선 링 회전 애니메이션.
  - 상하좌우 4방향 코너 타겟팅 브래킷(`┌ ┐ └ ┘` 형태의 굵은 3px 네온 보더) + 중심 십자선 + 10px 레이저 도트.
  - `shotTriggerKey` 변경 시 120ms 동안 `scale(1.28)` 반동 팽창 후 `scale(1.0)` 복귀.
- **`src/pc/components/ArcadeOverlayHUD.tsx`**:
  - `maxLives = 5`, `totalWaves = 5`, `activeBuffs?: ActiveBuffState[]` props 추가.
  - `Array.from({ length: maxLives })`로 `🍺` 5개 렌더링 (`STAGE_CONSTANTS.PLAYER_MAX_LIVES` 연동).
  - 상단 중앙 웨이브 배지: `WAVE {wave} / {totalWaves}` 및 활성 버프 배지 리스트(아이콘 + 이름 + `(remainingMs / 1000).toFixed(1)s` + 진행률 게이지 바) 표시.
- **`src/pc/PCGamePage.tsx`**:
  - `activeBuffs` 상태를 `engine.getActiveBuffs()`와 동기화하여 `ArcadeOverlayHUD` 및 `CrosshairOverlay`(`isWideScopeActive`, `isPowerShotActive`, `shotTriggerKey`)에 전달.
  - `VICTORY` 달성 시 `submitScore(feverState.totalScore, STAGE_CONSTANTS.TOTAL_WAVES, ...)`로 호출하여 기존 하드코딩된 `3` 대신 `5`웨이브 기록이 저장되도록 함께 수정.

## Acceptance Criteria
- [ ] `public/hdri/pub_interior_2k.hdr` 파일이 존재하고 3D 씬 환경 반사 및 배경이 화사하게 렌더링된다.
- [ ] 조준경 기본 크기가 `88px`이며, `wide_scope` 발동 시 `140px`로 확대되고 사격 시 반동 애니메이션과 총구 레이저 궤적이 표시된다.
- [ ] HUD에 맥주잔 체력 5개(`🍺x5`), `WAVE 1 / 5`, 활성 아이템 카운트다운 타이머가 정확히 표시된다.

## Validation
- `npx vitest run tests/pc-hud-and-banner.test.ts tests/three-stage-and-models.test.ts && npx tsc --noEmit` — 모든 테스트 통과 및 타입 에러 0건.

## Commit Message
```text
feat(ui,3d): add pub HDRI, UnrealBloomPass, laser tracer beam, 88px reticle, and item timer HUD

Plan: 2026-11-01-arcade-v2-upgrade
Phase: P01-arcade-v2-upgrade
Task: T03-hdri-bloom-and-arcade-hud

- Add CC0 pub interior HDRI and bright brewery lighting with soft shadows
- Implement EffectComposer with UnrealBloomPass and muzzle-to-target laser tracer beams
- Upgrade CrosshairOverlay to 88px dynamic arcade reticle with brackets and wide-scope scaling
- Update ArcadeOverlayHUD for 5 lives, 5 waves, and live 8s item buff countdown bars
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
