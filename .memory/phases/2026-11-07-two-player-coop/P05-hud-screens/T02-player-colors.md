# Task: T02 플레이어 색: 십자선·트레이서·판정 팝업

## Status: pending

## Goal
2인 판에서 1P는 `#38bdf8`, 2P는 `#ff6b3d`로 십자선 링·이름표(`1P · SHOTGUN Lv.1`), 사격 트레이서(총구에서 나가는 광선), 판정 팝업(`1P PERFECT`)을 칠해 누가 쏜 것인지 구분한다(D09, 시안 5). 이탈자 십자선은 숨긴다(D20). 1인 판은 지금 색·모양 그대로이고 이름표는 `SHOTGUN Lv.1`(접두어 없음).

## Decision Summary
- 피버·파워샷·조준 고정 같은 상태 색은 2인 판에서 링 색을 바꾸지 않고 배지 문구(`FEVER UNLIMITED` 등)와 glow로만 표시한다. 링 색이 바뀌면 누구 십자선인지 헷갈리기 때문이다.
- 광선 시작점(총구)은 이 Task에서는 기존 총 하나다. 플레이어별 총구는 P05-T06(D21)에서 바꾼다.

## Implementation

### I01. 십자선

- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairVisualSpecOptions`, `computeCrosshairVisualSpec`(52행 부근 함수), `CrosshairOverlayProps`, `CrosshairOverlay`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface CrosshairVisualSpecOptions { /* 기존 */ playerColor?: string; nameTag?: string; }
  interface CrosshairOverlayProps { /* 기존 */ playerColor?: string; nameTag?: string; hidden?: boolean; }
  ```
- **Execution Flow / Logic**:
  1. `playerColor`가 있으면 상태별 분기 뒤 마지막에 `primaryColor = playerColor; glowColor = playerColor + '99'`. 상태 배지(`badgeText`)는 유지.
  2. 이름표: 링 위 34px에 `nameTag`를 시안 `.xh em` 스타일(배경 = 링 색, 글자 `#111`, 12px 800, radius 6px)로. 1인은 `nameTag` = `${WEAPON_LABEL} Lv.${level}`(무기 영문 대문자: SHOTGUN/REVOLVER/GATLING, MAX는 `Lv.MAX`), 2인은 `${slot}P · ` 접두어.
  3. `hidden`이면 `display: none`(ref 메서드는 계속 동작).
- PC 페이지: PLAYING·결과 화면의 `CrosshairOverlay`마다 `playerColor = pres.ringColorMode === 'player' ? pres.color : undefined`(`pres = presentations[i]`, P05-T01), `nameTag = formatCrosshairNameTag(kind, level, pres.slotLabel)`, `hidden = snapshot.players[i].isAway`. 로비 십자선은 슬롯 색(2인 여부 무관, 로비에서 자기 슬롯 구분용).

### I02. 트레이서

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `playShotFx`(`beamColor` 계산부, 210행 부근), `GameCanvas3DProps.playerColors`; modify

#### Details
- prop `playerColors?: (string | null)[]` = `presentations.map(p => p.ringColorMode === 'player' ? p.color : null)`. `beamColor = playerColors?.[result.playerIndex] ?? (기존 계산)`. 파워샷이면 2인에서도 광선 두께·파티클(기존 강조)은 그대로 두고 색만 플레이어 색.

### I03. 판정 팝업

- Related Files:
  - `src/pc/components/JudgmentBanner.tsx` :: `JudgmentBannerHandle.show`; modify
  - `src/pc/PCGamePage.tsx` :: `handleShootEvent`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  show(grade: JudgmentGrade, opts?: { color?: string; label?: string; side?: 'left' | 'right' }): void;
  ```
- 페이지: `const pres = presentations[result.playerIndex]; judgmentRef.current?.show(grade, pres.slotLabel ? { color: pres.color, label: pres.slotLabel, side: pres.popupSide } : undefined)` → 2인은 `1P PERFECT`가 해당 쪽 1/4 지점(`left: 25%` / `75%`), 1인은 지금과 같다. 인원수 비교 없이 표시 규칙 값만 쓴다.

### I04. 테스트

- Related Files:
  - `tests/weapon-crosshair-hit-detection.test.ts` 또는 새 `tests/player-colors.test.ts`; new

#### Details
- `computeCrosshairVisualSpec({ playerColor: '#ff6b3d', isFeverActive: true })` → `primaryColor === '#ff6b3d'`, `badgeText === 'FEVER UNLIMITED'`.
- `playerColor` 없음 + 피버 → 기존 `#fbbf24`(1인 회귀).
- 이름표 헬퍼 `formatCrosshairNameTag(kind, level, slotLabel: '1P' | '2P' | null)` 순수 함수로 두고 테스트: `('shotgun', 1, '1P')` → `1P · SHOTGUN Lv.1`, `('gatling', 4, null)` → `GATLING Lv.MAX`.

## Acceptance Criteria
- [ ] 2인 화면에서 두 십자선·광선·판정 팝업 색이 플레이어 색과 같다.
- [ ] 1인 화면은 이름표 문구 추가 외에 바뀌지 않는다.

## Validation
- `npx vitest run tests/player-colors.test.ts tests/weapon-crosshair-hit-detection.test.ts tests/reload-ring.test.ts tests/pc-hud-and-banner.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동 캡처: 2인 전투 화면을 시안 5와 비교

## Commit Message
```text
feat(hud): player colors for crosshairs, tracers and judgment popups

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T02-player-colors

- Coop crosshairs use 1P #38bdf8 / 2P #ff6b3d with "1P · SHOTGUN Lv.1" name tags; away players' crosshair is hidden
- Tracer beams and judgment popups take the shooter's color and side
- Solo keeps its amber look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
