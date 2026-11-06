# Task: T01 로비 나가기 버튼·확인 단계·핸들러

## Status: done

## Goal
일시정지 메뉴에 `🏠 로비로 나가기`를 두고, 누르면 확인 단계 → 확인 시 점수 제출 없이 PAIRING 으로 이동한다.

## Decision Summary
- 확인 상태는 페이지가 소유(Esc 핸들러가 window 전역이라 오버레이 로컬 state 로는 Esc=취소를 만들 수 없음). 점수는 제출하지 않음. 일시정지 플래그를 먼저 풀어야 함.

## Implementation

### I01. PauseMenuOverlay
- Related Files:
  - `src/pc/components/PauseMenuOverlay.tsx` :: `PauseMenuOverlayProps`, `PauseMenuOverlay` — modify
#### Details
- **Signatures & Types**: props 추가
  ```typescript
  isExitConfirmOpen: boolean;
  onRequestExit: () => void;
  onCancelExit: () => void;
  onConfirmExit: () => void;
  ```
- **Logic**:
  1. `isExitConfirmOpen=false`: 기존 이어하기·다시시작 아래에 `🏠 로비로 나가기` 버튼(onClick=onRequestExit). 폰 연결·reason 과 무관하게 항상 표시.
  2. `true`: 제목 `🏠 로비로 나갈까요?`, 부제 `이번 판 점수는 저장되지 않습니다`, 버튼 `나가기`(onConfirmExit), `취소 (Esc)`(onCancelExit)만 표시. 이어하기/다시시작은 숨김.

### I02. PCGamePage 핸들러
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `handleExitToLobbyFromPause`, Esc `useEffect`, `<PauseMenuOverlay>` 사용부, `pauseMenu` state — modify
#### Details
- state `isExitConfirmOpen` + ref `isExitConfirmOpenRef`(매 렌더 동기화, 기존 `pauseMenuOpenRef` 패턴 따름).
- `handleExitToLobbyFromPause` (useCallback [engine, handleReturnToLobby]): `handleRestartFromPause` 와 같은 순서 — countdownTimerRef clear → `setCountdownSec(null)` → `engine.setPaused(false, performance.now())` → `setPauseMenu({open:false, reason:'USER'})` → `setIsExitConfirmOpen(false)` → `handleReturnToLobby()`. `submitScore` 호출 금지. handleReturnToLobby 는 선언 순서상 아래에 있으므로 호출 가능하도록 핸들러를 handleReturnToLobby 선언 뒤로 두거나 ref 사용.
- Esc: 메뉴가 열려 있고 `isExitConfirmOpenRef.current` 면 확인만 닫고(resume 호출 금지) return.
- 메뉴가 닫히거나 phase 가 PLAYING 이 아니게 되면 `isExitConfirmOpen=false` 로 리셋(기존 "Leaving the run" effect 와 handleResumeFromPause/handleOpenPause 경로 포함).

### I03. 테스트
- Related Files:
  - `tests/pause-menu.test.ts` — modify (기존 render 헬퍼에 새 props 기본값 추가)
#### Details
- 오버레이: 기본 렌더에 `로비로 나가기` 포함; `reason:'CONTROLLER_LOST', isControllerConnected:false` 에도 포함; `isExitConfirmOpen:true` 면 `나갈까요`·`점수는 저장되지 않습니다`·`나가기` 포함하고 `이어하기` 미포함.
- 소스 검사: `handleExitToLobbyFromPause` 본문에 `engine.setPaused(false` 와 `handleReturnToLobby` 포함, `submitScore` 미포함.

## Acceptance Criteria
- [x] 일시정지 메뉴에서 버튼 → 확인 → 로비로 이동, 점수 제출 없음
- [x] 확인 중 Esc 는 게임을 재개하지 않고 확인만 닫음
- [x] 로비 후 새 게임을 시작하면 멈춰 있지 않음

## Validation
- `npx tsc --noEmit && npx vitest run tests/pause-menu.test.ts` — 통과
- `npx vitest run` — 전체 통과

## Commit Message
```text
feat(pause): leave to the lobby from the pause menu

Plan: 2026-11-06-pause-to-lobby
Phase: P01-pause-exit-to-lobby
Task: T01-exit-button-and-handler

- add a confirm step and a lobby button to the pause menu
- lift the pause before returning to the lobby and skip score submission
- Esc cancels the confirm step instead of resuming
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
