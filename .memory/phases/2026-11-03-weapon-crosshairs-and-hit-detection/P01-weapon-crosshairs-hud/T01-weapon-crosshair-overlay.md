# Task Blueprint: T01-weapon-crosshair-overlay

- **Phase**: P01-weapon-crosshairs-hud
- **Status**: todo

## 1. 대상 파일 및 심볼
- `src/pc/components/CrosshairOverlay.tsx`
  - `CrosshairOverlayProps`: `weaponKind?: WeaponKind`, `weaponLevel?: WeaponLevel` 필드 추가
  - `CrosshairVisualSpecOptions`: `weaponKind?: WeaponKind`, `weaponLevel?: WeaponLevel` 필드 추가
  - `getCrosshairVisualSpec`: 무기별 기본 크기, 색상, 형태 파라미터 반환
    - 샷건: `sizePx: 120`, `ringSizePx: 104`, 컬러 `#f59e0b` (오렌지), 8방향 펠릿 확산 점 표시
    - 리볼버: `sizePx: 76`, `ringSizePx: 48`, 컬러 `#fbbf24` (골드), 핀포인트 3px 도트, 수직 관통 가이드라인 표시
    - 개틀링: `sizePx: 88`, `ringSizePx: 64`, 컬러 `#38bdf8` (시안), 3각 터빈 노즐 및 스핀 애니메이션 표시
  - `CrosshairOverlay` 컴포넌트 JSX: 무기별 차별화된 SVG/CSS 구조 렌더링
- `src/pc/PCGamePage.tsx`
  - `CrosshairOverlay` 렌더링부에 `weaponKind={weaponState.weaponKind}` 및 `weaponLevel={weaponState.weaponLevel}` 전달

## 2. 모델 스키마 & 인터페이스
```ts
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

## 3. 검증 커맨드
```bash
npx tsc --noEmit
npx vitest run src/tests/
```

## 4. 커밋 메시지
```text
feat(hud): implement weapon-specific crosshair visuals and integrate PC game overlay

Plan: 2026-11-03-weapon-crosshairs-and-hit-detection
Phase: P01-weapon-crosshairs-hud
Task: T01-weapon-crosshair-overlay
```
