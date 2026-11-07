# Task: T05 개틀링 링 스타일 경고 제거

## Status: pending

## Goal
개틀링 판에서 리렌더마다 나는 React 경고(`Updating border borderTopColor/borderBottomColor`, 판당 168건, D BUG-2)를 없앤다.

## Decision Summary
- 원인: `src/pc/components/CrosshairOverlay.tsx` 497~499행 회전 링이 `border: 2px solid ${color}`(축약)와 `borderTopColor`·`borderBottomColor`(개별)를 함께 쓴다.
- 고침: 축약을 쓰지 않고 `borderWidth: 2`, `borderStyle: 'solid'`, `borderLeftColor`/`borderRightColor: color`, `borderTopColor`/`borderBottomColor: 'transparent'`로 쪼갠다(보이는 모양 동일).
- 같은 패턴(축약 + 개별 속성 혼용)이 다른 컴포넌트에도 있는지 `grep -rnE "border: .*\n?.*border(Top|Bottom|Left|Right)Color" src/pc/components`로 확인해 함께 고친다.

## Implementation
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: 회전 링 style; modify

## Acceptance Criteria
- [ ] 개틀링 판 콘솔에 border 경고 0건.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 개발 서버에서 개틀링 1인 판 30초 플레이, `console.error` 0건(Playwright로 수집)

## Commit Message
```text
fix(hud): split the gatling ring border into longhand properties

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T05-gatling-ring-style

- Replace the border shorthand mixed with per-side colors to stop React style warnings
- Same ring look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
