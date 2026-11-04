# Task: T06 Strip HUD Compositing Costs

## Status: pending

## Goal
전투 HUD의 블러와 그림자를 없애 프레임 튐을 줄인다. 측정에서 느린 쪽 5% 프레임이 28ms에서 14ms로 줄어든 항목이다.

## Decision Summary
- D06: `backdropFilter`, `filter: drop-shadow`, 그림자를 제거하고 어두운 불투명 패널로 바꾼다.
- 대상은 전투 중 항상 보이는 요소다. 일시정지·결과 모달은 전투 중 표시되지 않으므로 유지한다.

## Implementation

### I01. 전투 HUD

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUD` — 스타일 정리; modify
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlay` — 그림자 제거; modify
  - `src/pc/components/JudgmentBanner.tsx` :: `JudgmentBanner` — 글자 그림자 단순화; modify
  - `src/pc/PCGamePage.tsx` :: 금색 캔 경고, 카드 안내 배너 — 그림자 제거; modify

#### Details
- **`ArcadeOverlayHUD.tsx`**:
  - `backdropFilter` 전부 삭제: `:321`, `:420`, `:472`, `:532`, `:556`, `:582`, `:630`, `:752`
  - `boxShadow` 전부 삭제: `:307`, `:328`, `:407`, `:424`, `:458`, `:476`, `:543`, `:567`, `:587`, `:635`, `:688`, `:715`, `:757`, `:793`
  - `filter: 'drop-shadow(...)'` 삭제: `:248`
  - 체력 아이콘 `:379` `filter: i < lives ? 'none' : 'grayscale(1)'` → `opacity: i < lives ? 1 : 0.25`
  - 패널 배경 `rgba(17, 24, 39, 0.88)`류를 투명도 0.95 이상으로 올린다. 테두리는 유지해 구분되게 한다.
- **`CrosshairOverlay.tsx`**: `boxShadow`(`:281`, `:302`, `:316`, `:333`, `:344`, `:365`, `:384`, `:428`, `:444`, `:456`, `:468`, `:480`)와 `textShadow`(`:493`)를 지운다. 크로스헤어가 배경에 묻히면 `1px solid rgba(0, 0, 0, 0.6)` 외곽선을 쓴다.
- **`JudgmentBanner.tsx`**: `:82` `textShadow`를 `0 2px 2px #000` 한 겹으로 줄인다.
- **`PCGamePage.tsx`**: `:814`, `:833`, `:892`의 `boxShadow`를 지운다. 금색 캔 경고는 `border`로 표시한다. `:863`은 P02-T02에서 배너와 함께 삭제되므로 건드리지 않는다. `:1109`, `:1121`, `:1184`, `:1195`는 모달이므로 유지한다.
- 줄 번호는 앞선 Task로 달라질 수 있으니 `grep -n "backdropFilter\|boxShadow\|textShadow\|filter:"`로 찾는다.

### I02. 회귀 방지

- Related Files:
  - `tests/hud-render-cost.test.ts` :: 소스 검사; new

#### Details
- `ArcadeOverlayHUD.tsx`, `CrosshairOverlay.tsx`를 읽어 `backdropFilter`, `boxShadow`, `drop-shadow`, `grayscale(`가 없는지 확인한다.
- `JudgmentBanner.tsx`에 그림자 값을 쉼표로 이은 다중 `textShadow`가 없는지 확인한다.

## Acceptance Criteria
- [ ] 전투 HUD가 불투명 패널로 또렷하게 보인다.
- [ ] 크로스헤어가 어떤 배경에서도 잘 보인다.
- [ ] 금색 캔 경고와 카드 안내가 그림자 없이도 눈에 띈다.

## Validation
- `npx vitest run tests/hud-render-cost.test.ts` — 통과
- `npx vitest run tests/pc-hud-and-banner.test.ts` — 회귀 없음
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
perf(hud): remove blur and shadows from combat overlays

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T06-strip-hud-compositing-costs

- Remove backdrop filters and shadows from the combat HUD and crosshair
- Use opaque panels and plain borders
- Add source checks to prevent regressions
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
