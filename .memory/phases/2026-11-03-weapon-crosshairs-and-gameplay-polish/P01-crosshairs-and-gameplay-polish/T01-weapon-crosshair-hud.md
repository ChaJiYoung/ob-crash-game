# Task: T01 Weapon Crosshair HUD & PC Game Integration

## Status: done

## Goal
기존 단일 88px 사각 브래킷 조준경을 개편하여 3종 무기 아키타입(🪠 맥주관 뚫어뻥 샷건 / 🍾 황금 병따개 리볼버 / 🍺 탄산 탭 개틀링) 및 무기 레벨(Lv.1~MAX)에 따른 고유한 조준경 비주얼(펠릿 링, 스나이퍼 십자선, 회전 톱니)을 렌더링하고 `PCGamePage`와 연동한다.

## Decision Summary
- `CrosshairOverlayProps`에 `weaponKind`, `weaponLevel`을 추가하고 무기별 SVG/CSS 조준경(샷건 120px 오렌지 펠릿 링, 리볼버 76px 골드 십자선/핀포인트 도트/수직 관통 레이, 개틀링 88px 시안 회전 톱니 레티클) 및 레벨별 디테일을 구현한다.

## Implementation

### I01. CrosshairVisualSpec & Component Visual Expansion
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlay`, `getCrosshairVisualSpec` — 무기별 비주얼 파라미터 및 전용 HUD 마크업 렌더링; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface CrosshairVisualSpecOptions {
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
    isAimLocked?: boolean;
    weaponKind?: WeaponKind;
    weaponLevel?: WeaponLevel;
  }

  export interface CrosshairOverlayProps {
    aimX: number;
    aimY: number;
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
    isAimLocked?: boolean;
    weaponKind?: WeaponKind;
    weaponLevel?: WeaponLevel;
    shotTriggerKey?: number;
  }
  ```
- **Data & Visual Parameters**:
  - `shotgun`:
    - `sizePx`: `isWide ? 160 : 120` (기본 120px)
    - `primaryColor`: `#f59e0b` (앰버 오렌지), `glowColor`: `rgba(245, 158, 11, 0.45)`
    - 펠릿 확산 원 (`borderRadius: 50%`, 점선 테두리) 및 8방향 펠릿 확산 도트 (`radial dots`)
    - 사격 시 1.3배 팽창 킥 애니메이션
  - `revolver`:
    - `sizePx`: `isWide ? 100 : 76` (기본 76px)
    - `primaryColor`: `#fbbf24` (럭셔리 골드), `glowColor`: `rgba(251, 191, 36, 0.55)`
    - 초정밀 헤어라인 십자선 (`1px solid`), 중심 3px 정밀 핀포인트 도트, 상하 수직 관통 가이드라인 표시
  - `gatling`:
    - `sizePx`: `isWide ? 120 : 88` (기본 88px)
    - `primaryColor`: `#38bdf8` (일렉트릭 시안), `glowColor`: `rgba(56, 189, 248, 0.45)`
    - 3각 톱니/터빈 노즐 링, 중앙 44px 스프레드 서클, 발사 시 회전 스핀 애니메이션
- **Execution Flow / Logic**:
  1. `getCrosshairVisualSpec(options)`에서 `weaponKind`에 따라 `sizePx`, `ringSizePx`, `primaryColor`, `glowColor` 기본값을 무기별로 분기.
  2. 만약 `isFeverActive`인 경우 피버 골드 테마 및 초고속 스핀 애니메이션 오버라이드.
  3. `CrosshairOverlay` 컴포넌트 JSX에서 `weaponKind`에 맞춰 전용 SVG/CSS 형태 렌더링.

### I02. PCGamePage Integration
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 현재 무기 상태를 CrosshairOverlay에 전달; modify

#### Details
- `hudState.weaponKind` 및 `hudState.weaponLevel`을 `PCGamePage` 내 모든 `CrosshairOverlay` 태그(인게임, 튜토리얼, 샌드박스 등)에 prop으로 바인딩.

## Acceptance Criteria
- [ ] 샷건 선택 시 120px 대형 오렌지 펠릿 링 조준경이 화면에 표시된다.
- [ ] 리볼버 선택 시 76px 골드 정밀 십자선 및 수직 관통 가이드라인이 표시된다.
- [ ] 개틀링 선택 시 88px 시안 회전 톱니 레티클이 표시된다.
- [ ] 사격 트리거 시 무기별 킥/스핀 애니메이션이 동작한다.

## Validation
- `npx tsc --noEmit` — 컴파일 에러 없음 (0 errors)
- `npx vitest run src/tests/` — 기존 테스트 67개 전원 통과

## Commit Message
```text
feat(hud): implement weapon-specific crosshair visuals and integrate PC game overlay

Plan: 2026-11-03-weapon-crosshairs-and-gameplay-polish
Phase: P01-crosshairs-and-gameplay-polish
Task: T01-weapon-crosshair-hud

- Add weaponKind and weaponLevel to CrosshairOverlayProps
- Render shotgun 120px pellet ring, revolver 76px sniper crosshair, gatling 88px rotary reticle
- Bind current weapon state to crosshair in PCGamePage
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
