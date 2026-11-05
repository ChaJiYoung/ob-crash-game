# Task: T01 일시정지 메뉴

## Status: done

## Goal
게임 중(PLAYING) PC 화면의 `⏸ 일시정지` 버튼 또는 Esc로 게임을 멈추고, 메뉴에서 `이어하기`(3초 카운트다운 뒤 재개)와 `다시시작`(점수 저장 없이 무기 선택부터 새 게임)을 고를 수 있다.

## Decision Summary
- D04, D05. 폰에는 버튼을 두지 않는다. 대상 단계는 `PLAYING`만(TUTORIAL·SANDBOX 제외).
- 엔진에는 `setPaused()`와 `freezeTimers`가 이미 있다. `shootAt`·`update`는 `isPaused`면 일찍 반환한다(`BeerCrusherEngine.ts` 약 1147, 1880행).
- `startResumeCountdown`(PCGamePage)은 3초 뒤 `engine.setPaused(false)`와 영점 재설정을 한다. 가이드 모달(`handleCloseGuide`)도 이걸 쓴다.
- **함정**: `engine.startGame()`은 `isPaused`를 초기화하지 않는다. 다시시작은 반드시 `engine.setPaused(false)` 뒤에 `handleStartGame()`을 부른다. 진행 중인 재개 카운트다운 타이머(`countdownTimerRef`)도 정리해야 한다(안 하면 새 게임 위에서 `setPaused(false)`와 영점 리셋이 뒤늦게 실행된다).

## Implementation

### I01. 순수 판단 함수
- Related Files:
  - `src/pc/pauseFlow.ts` :: `canOpenPauseMenu`; new

#### Details
- **Signatures & Types**:
  ```ts
  import type { GamePhase } from '../shared/types';
  export type PauseReason = 'USER' | 'CONTROLLER_LOST';
  export function canOpenPauseMenu(input: {
    phase: GamePhase;
    isPaused: boolean;        // engine.isPaused
    isMenuOpen: boolean;
    isGuideOpen: boolean;
    countdownSec: number | null;
  }): boolean;
  ```
- **Logic**: `phase === 'PLAYING' && !isPaused && !isMenuOpen && !isGuideOpen && countdownSec === null`일 때만 true.

### I02. 메뉴 오버레이
- Related Files:
  - `src/pc/components/PauseMenuOverlay.tsx` :: `PauseMenuOverlay`, `PauseMenuOverlayProps`; new

#### Details
- **Signatures & Types**:
  ```ts
  export interface PauseMenuOverlayProps {
    reason: PauseReason;
    isControllerConnected: boolean; // T02에서 의미 부여. 이 Task에서는 USER일 때 무시
    onResume: () => void;
    onRestart: () => void;
  }
  ```
- **UI**: 전체 화면 반투명 어두운 배경(`position: fixed; inset: 0; zIndex: 9000대, pointerEvents: 'auto'`), 가운데 카드. 제목 `⏸ 일시정지`. 버튼 2개: `▶ 이어하기 (Esc)`, `🔁 다시시작 (무기 선택부터)`. 다시시작 아래에 작은 글씨 `이번 판 점수는 저장되지 않습니다`. 스타일은 `GuideModal.tsx`/`QRPairingModal.tsx`의 다크 카드·앰버 계열 색을 따른다. 오버레이 클릭이 캔버스로 새지 않게 `onMouseDown`/`onClick`/`onContextMenu`에서 `stopPropagation`.
- `reason === 'CONTROLLER_LOST'`의 분기는 T02에서 채운다. 지금은 `reason`을 받기만 하고 제목을 `USER`와 같게 둔다.

### I03. HUD 버튼
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUDProps`에 `onPause?: () => void`, 가이드 버튼 옆(약 463행 `onOpenGuide` 블록)에 버튼; modify

#### Details
- 기존 `onOpenGuide` 버튼과 같은 스타일에 `⏸ 일시정지` 라벨. `pointerEvents: 'auto'`.

### I04. PCGamePage 연결
- Related Files:
  - `src/pc/PCGamePage.tsx` :: 신규 상태·핸들러, `executeSkill`, `SENSOR_RELAY` 처리, 키 이벤트 effect, 렌더; modify

#### Details
- **Signatures & Types**:
  ```ts
  const [pauseMenu, setPauseMenu] = useState<{ open: boolean; reason: PauseReason }>({ open: false, reason: 'USER' });
  const pauseMenuOpenRef = useRef(false); pauseMenuOpenRef.current = pauseMenu.open;
  const handleOpenPause = useCallback((reason: PauseReason = 'USER') => void, [engine]);
  const handleResumeFromPause = useCallback(() => void, [startResumeCountdown]);
  const handleRestartFromPause = useCallback(() => void, [engine, handleStartGame]);
  ```
- **Execution Flow / Logic**:
  1. `handleOpenPause`: `canOpenPauseMenu({ phase: gamePhaseRef.current, isPaused: engine.isPaused, isMenuOpen: pauseMenuOpenRef.current, isGuideOpen, countdownSec })`가 false면 return. 아니면 `rapidFireTimerRef` 정리, `engine.setPaused(true, performance.now())`, `setPauseMenu({ open: true, reason })`. (`isGuideOpen`, `countdownSec`는 ref로 최신값을 읽거나 의존성에 포함.)
  2. `handleResumeFromPause`: `setPauseMenu({ open: false, reason: 'USER' })` 후 `startResumeCountdown()`. 카운트다운 중에는 메뉴가 닫혀 있고 엔진은 여전히 `isPaused`.
  3. `handleRestartFromPause`: `countdownTimerRef.current`가 있으면 `clearInterval` 후 null, `setCountdownSec(null)`, `engine.setPaused(false, performance.now())`, `setPauseMenu({ open: false, reason: 'USER' })`, `handleStartGame()`. **`submitScore`는 호출하지 않는다.** 폰에는 시작 알림이 필요 없다(폰은 PLAYING 화면 그대로).
  4. Esc: 별도 `useEffect`로 `keydown` `e.code === 'Escape'` — 메뉴가 열려 있고 `reason === 'USER'`면 `handleResumeFromPause()`, 닫혀 있으면 `handleOpenPause('USER')`. `e.repeat`는 무시. (`CONTROLLER_LOST`에서 Esc는 이어하기를 막기 위해 T02가 처리.)
  5. 입력 차단: `executeSkill` 첫 줄에 `if (pauseMenuOpenRef.current) return;`. `SENSOR_RELAY`에서 조준 갱신(`updateAimDirect`) 직후, `p.snapFire` 처리 전에 `if (pauseMenuOpenRef.current) { rapidFireTimerRef 정리; break; }`를 넣는다(`feverTriggered`, 연사, 스킬 스냅 모두 건너뜀). 엔진이 이미 막지만 이중 방어다.
  6. 렌더: `gamePhase === 'PLAYING'`이고 `pauseMenu.open`이면 `<PauseMenuOverlay …/>`. HUD에는 `onPause={() => handleOpenPause('USER')}` 전달(PLAYING HUD 한 곳, 약 1140행 부근 `ArcadeOverlayHUD` 사용처). `gamePhase`가 PLAYING이 아니게 되면(`handleReturnToLobby` 등) `pauseMenu.open`은 false로 닫는다(`useEffect`로 `gamePhase`가 PLAYING 아니면 리셋).
- **함정**: 가이드 모달을 연 상태에서 Esc를 눌러도 일시정지 메뉴가 겹쳐 뜨면 안 된다 — `canOpenPauseMenu`의 `isGuideOpen` 검사로 막는다.

### I05. 테스트
- Related Files:
  - `tests/pause-menu.test.ts` :: new

#### Details
- `canOpenPauseMenu`: PLAYING+모두 false → true. `GAMEOVER`, `TUTORIAL`, `SANDBOX`, `PAIRING` → false. `isPaused`, `isMenuOpen`, `isGuideOpen`, `countdownSec=2` 각각 → false.
- 엔진 재시작: `new BeerCrusherEngine()`, `startGame({withWeaponSelect:true})`, `currentWave`를 올려 둔 뒤 `setPaused(true)` → `setPaused(false)` → `startGame({withWeaponSelect:true})` 하면 `currentWave === 1`, `isPaused === false`, `isWeaponSelectPending === true`, `lives === maxLives`. 그리고 `setPaused(true)` 상태에서 그냥 `startGame()`을 부르면 `isPaused`가 남는다는 사실을 한 줄 주석으로 남겨 왜 `setPaused(false)`가 먼저인지 설명한다(테스트로 고정).
- `renderToStaticMarkup(<PauseMenuOverlay …/>)`에 `이어하기`, `다시시작`, `점수는 저장되지 않습니다` 포함.
- 소스 가드: `PCGamePage.tsx`에서 `handleRestartFromPause` 본문에 `submitScore`가 없다(정규식으로 함수 본문 추출).

## Acceptance Criteria
- [ ] PLAYING 중 버튼 또는 Esc로 게임이 멈춘다(몬스터·타이머 정지).
- [ ] 이어하기는 3초 카운트다운 후 재개되고, 멈춘 시간만큼 타이머가 밀린다.
- [ ] 다시시작은 웨이브 1, 무기 선택 화면이며 랭킹 점수 제출이 일어나지 않는다.
- [ ] 메뉴가 열린 동안 폰 사격·스킬·피버 입력이 무시된다.
- [ ] 가이드·튜토리얼·샌드박스·로비에서는 열리지 않는다.

## Validation
- `npx vitest run tests/pause-menu.test.ts tests/pc-hud-and-banner.test.ts tests/hud-render-cost.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(pause): add a pause menu with resume and restart

Plan: 2026-11-06-controller-persistence-and-pause
Phase: P02-pause-menu
Task: T01-pause-menu

- add a pause button and Esc key that freeze the run while playing
- resume reuses the 3-second countdown, restart goes back to weapon select without saving the score
- ignore controller input while the menu is open
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: (this commit)
