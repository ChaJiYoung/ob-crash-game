# Task: T03 결과 화면에서 십자선이 결과 숫자를 가리지 않게

## Status: done

## Goal
결과 화면(1인·2인)에서 십자선 링과 이름표("1P · SHOTGUN Lv.1")가 결과 카드의 점수·KILL·콤보 숫자를 가리지 않게 한다(B BUG-3 `B-mouse-phone/V-mp-11-result-game1.png`, D BUG-1).

## Decision Summary
- 결과 화면에서도 십자선은 필요하다(D11: 폰은 조준해서 결과 버튼을 쏜다, 두 십자선이 보인다). 그래서 숨기지 않고 **이름표만 숨기고, 결과 화면에서는 십자선을 작고 반투명하게** 그린다. 십자선은 로비·결과 모달보다 위 층(z-index 130, 모달 100)에 두고 `pointer-events: none`을 유지한다 — 폰 플레이어가 결과 버튼을 조준해 쏘므로 십자선이 보여야 한다(D11, D26/D33). 이름표 제거와 작고 반투명한 링으로 숫자 가림을 막는다.
- 표시 규칙은 `CrosshairOverlay`의 새 prop 하나로 받는다(결과 화면 여부는 페이지가 정함).

## Implementation

- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlayProps.variant`(`'play' | 'menu'`); modify
  - `src/pc/PCGamePage.tsx` :: GAMEOVER/VICTORY 렌더의 `CrosshairOverlay`와 그 감싼 레이어 z-index; modify

#### Details
- `variant: 'menu'`이면 이름표 렌더 안 함, 링 크기 0.6배, `opacity: 0.55`.
- 결과 화면에서 십자선 레이어 z-index를 결과 모달보다 낮게. 지금 레이어 순서를 `grep -n "zIndex" src/pc/PCGamePage.tsx src/pc/components/ResultRankingModal.tsx`로 확인하고 숫자만 조정.
- 로비 십자선도 같은 `variant: 'menu'`(로비 카드 글자 위 겹침 방지).

### 확인
- 개발 서버로 1인·2인 결과 화면을 1440×900에서 캡처(`.memory/references/two-player-coop-screens/T03-result-solo.png`, `T03-result-coop.png`), 결과 카드 숫자 요소의 `elementFromPoint` 중심이 숫자 요소 자신인지 확인.

## Acceptance Criteria
- [ ] 결과 카드 숫자가 십자선·이름표에 가려지지 않는다.
- [ ] 폰 조준으로 결과 버튼을 쏘는 동작은 그대로다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 캡처 2장

## Commit Message
```text
fix(result): keep crosshairs from covering result numbers

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T03-result-overlay

- CrosshairOverlay menu variant hides the name tag and draws a smaller, translucent ring
- Result and lobby crosshairs sit above the modal layer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 27281b4
- 후속(리뷰어 지시): 첫 구현에서 십자선을 모달 아래(z 99)에 뒀더니 모달 배경(78~85%)에 가려 보이지 않아, 모달 위(z 130)로 되돌리고 menu variant 모양은 유지. 캡처 재촬영.
