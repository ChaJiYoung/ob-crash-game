# Task: T01 16:9 풀스크린 Three.js 캔버스, 4코너 아케이드 오버레이 HUD 및 판정 배너 구현

## Status: pending

## Goal
PC 화면 전체(`100vw × 100vh`)에 Three.js WebGL 캔버스를 채우고(`D05`), 그 위에 반투명 글래스모피즘으로 떠 있는 4코너 아케이드 오버레이 HUD(플레이어 닉네임·점수·콤보·라이프·보스 HP·탄창·자동장전·피버 게이지 LOCK 배지), 3단계 판정 배너(`PERFECT! +150` / `GREAT! +100` / `GOOD! +50`), 그리고 1인칭 조준 크로스헤어를 구현합니다.

## Decision Summary
- **D05**: 별도 좌/우 패널 분할 없이 `100vw × 100vh` 16:9 풀스크린 3D 캔버스 + 4코너 아케이드 오버레이 HUD 구성
- **D06**: `PERFECT`(황금 네온 `#fbbf24`), `GREAT`(시안 네온 `#38bdf8`), `GOOD`(라임 그린 `#4ade80`), `MISS`(레드 `#f87171`) 배너 및 피버 100% 완충 시 `LOCK 100% — READY!` 황금 배지 표시

## Implementation

### I01. 4코너 아케이드 오버레이 HUD, 판정 배너, 크로스헤어 및 풀스크린 3D 캔버스 구현
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUD`, `formatAmmoStatusText`, `formatFeverStatusBadge` — 4코너 아케이드 오버레이 HUD 컴포넌트 및 포맷 헬퍼; new
  - `src/pc/components/JudgmentBanner.tsx` :: `JudgmentBanner`, `getJudgmentBannerSpec` — `PERFECT`/`GREAT`/`GOOD`/`MISS` 플로팅 네온 배너 컴포넌트; new
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlay`, `aimToViewportPercent` — 정규화 조준 좌표(`aimX`, `aimY`)를 화면 `%` 좌표로 변환해 표시하는 1인칭 조준점; new
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D` — `BreweryStage3D`, `TargetModels3D`, `DraftTapGun3D`, `ParticleEffects3D`, `BeerCrusherEngine`을 `requestAnimationFrame` 루프로 구동하는 풀스크린 캔버스; new

#### Details
- **Signatures & Types**:
  ```typescript
  export function formatAmmoStatusText(ammo: number, maxAmmo: number, isReloading: boolean, isFeverActive: boolean): string;
  export function formatFeverStatusBadge(feverGauge: number, isFeverReady: boolean, isFeverActive: boolean): {
    label: string;
    isLocked: boolean;
    accentColor: string;
  };
  export function getJudgmentBannerSpec(grade: JudgmentGrade): {
    title: string;
    subtitle: string;
    colorHex: string;
    scale: number;
  };
  export function aimToViewportPercent(aimX: number, aimY: number): { leftPercent: number; topPercent: number };
  ```
- **Execution Flow / Logic**:
  1. **4코너 아케이드 오버레이 HUD (`ArcadeOverlayHUD.tsx`)**:
     - **좌상단**: 현재 로그인 플레이어 배지(`🔫 PLAYER: [닉네임]`), `SCORE` 6자리 카운터, `COMBO x1.5` 배지, 방어선 라이프(`🍺 🍺 🍺`).
     - **중앙 상단**: `WAVE 1 / 3` 배지, 남은 웨이브 타이머, Wave 3 진입 시 대형 `BOSS: 업소용 생맥주 냉각기 (HP 30/30)` 체력바.
     - **좌하단**: 10발 물방울 탄창 아이콘 바 + `isReloading === true` 시 `"⚡ 자동 장전 중 (1.2s)..."` 프로그레스 바.
     - **우하단**: `FEVER GAUGE (0~100%)` 게이지 바. `isFeverReady === true` 도달 시 `"🔥 FEVER 100% LOCK — 더블탭 또는 Space키로 발동!"` 황금 네온 점멸 배지 표시.
  2. **풀스크린 3D 캔버스 (`GameCanvas3D.tsx`)**:
     - 카메라를 `(0, 1.65, 2.2)`, `lookAt(0, 1.35, -12)`, `vFOV = 52°`로 고정.
     - 스마트폰 센서 입력(`aimX`, `aimY`, `snapFire`, `rapidFireHold`, `feverTriggered`)뿐만 아니라 **PC 마우스/키보드 폴백**(마우스 이동 = 조준, 클릭 = 발사/연사, `Space` = 피버 발동, `C` = 영점 초기화)을 동시 지원.

### I02. HUD 포맷터·판정 배너·조준 좌표 변환 단위 테스트
- Related Files:
  - `tests/pc-hud-and-banner.test.ts` :: `describe('PC Fullscreen HUD & Judgment Banner')` — HUD 상태 포맷터, 판정 배너 스펙, 조준점 뷰포트 변환 검증; new

#### Details
- `formatFeverStatusBadge`: 게이지 `100` 및 `isFeverReady = true`일 때 `isLocked: true`와 `"LOCK"` 안내 문구가 포함되는지 검증.
- `getJudgmentBannerSpec`: `PERFECT`(`+150`, `#fbbf24`), `GREAT`(`+100`, `#38bdf8`), `GOOD`(`+50`, `#4ade80`), `MISS`(`#f87171`) 스펙 검증.
- `aimToViewportPercent`: `(0, 0) -> (50%, 50%)`, `(-1, 1) -> (8%, 12%)`, `(1, -1) -> (92%, 88%)` 클램핑 및 변환 검증.

## Acceptance Criteria
- [ ] `GameCanvas3D`가 `100vw × 100vh` 풀스크린으로 3D 스테이지·6종 타겟·1인칭 탭건을 렌더링함
- [ ] `ArcadeOverlayHUD`와 `JudgmentBanner`, `CrosshairOverlay`가 4코너 및 타격 지점에 정확히 표시됨
- [ ] `npx vitest run tests/pc-hud-and-banner.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/pc-hud-and-banner.test.ts` — PC HUD 상태 포맷터, 판정 배너, 뷰포트 좌표 변환 단위 테스트 통과

## Commit Message
```text
feat(pc-hud): implement 16:9 fullscreen 3D canvas, 4-corner arcade HUD, and judgment banner

Plan: 2026-11-01-beer-crusher
Phase: P03-pc-arcade-display
Task: T01-fullscreen-3d-canvas-and-hud

- Implement GameCanvas3D mounting BreweryStage3D, 6 targets, DraftTapGun3D, and BeerCrusherEngine
- Implement ArcadeOverlayHUD with Fever 100% lock badge and auto-reload indicator
- Implement JudgmentBanner and CrosshairOverlay
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
