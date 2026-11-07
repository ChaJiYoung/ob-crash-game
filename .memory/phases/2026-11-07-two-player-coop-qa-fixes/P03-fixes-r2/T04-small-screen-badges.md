# Task: T04 작은 화면에서 배지·이름표가 화면 안에 들어오게

## Status: pending

## Goal
1024×768에서 선택 화면의 카드 소유 배지(1P/2P)와 십자선 이름표가 화면 밖으로 잘리지 않게 한다(B BUG-4: 1P 배지 x=−24.4, 2P 배지 right=1048.4 — `B-mouse-phone/report.md` 94행 부근).

## Decision Summary
- 카드 위치 자체는 엔진의 화면 맞춤(`computeSelectLayout`의 `fit`)이 이미 줄여 준다. 잘리는 것은 그 위에 HTML로 띄우는 배지·이름표다. → **HTML 오버레이가 화면 가장자리에서 안쪽으로 밀어 넣는다**(clamp). 엔진은 건드리지 않는다.

## Implementation

- Related Files:
  - `src/pc/components/SelectRoundOverlay.tsx` :: 카드 소유 배지 위치 계산; modify
  - `src/pc/components/CrosshairOverlay.tsx` :: 이름표 위치; modify
  - `src/pc/overlayClamp.ts` :: `clampToViewport`; new

#### Details
```typescript
/** 가운데 정렬 요소의 왼쪽 x를 [margin, viewportWidth - width - margin]로 제한한다. */
export function clampToViewport(centerX: number, width: number, viewportWidth: number, margin = 8): number;
```
- 배지·이름표는 렌더 후 `offsetWidth`를 재서(또는 고정 폭) 이 함수로 left를 정한다. 이름표는 십자선이 화면 가장자리에 있을 때만 안쪽으로 밀리고 링은 그대로.

### 확인
- 1024×768과 1440×900에서 2인 무기 선택·전투 화면 캡처, 배지·이름표 rect가 화면 안(`0 <= left`, `right <= innerWidth`).

## Acceptance Criteria
- [ ] 1024×768에서 배지·이름표가 화면 안에 있다.

## Validation
- `npx vitest run` (clampToViewport 단위 테스트 추가: 왼쪽 끝·오른쪽 끝·가운데)
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
fix(hud): keep card badges and crosshair tags on screen at small sizes

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T04-small-screen-badges

- clampToViewport pushes edge badges and name tags back inside the viewport
- Checked at 1024x768 and 1440x900

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
