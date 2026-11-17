# Task: T01 Debug Mode Wiring and HUD Badge

## Status: done

## Goal
`?debug=1`로 연 PC 화면에서 시작하는 판은 엔진 무적·시작 조건이 켜지고, GAME_BEGIN에 `debug`가 실려 서버에 디버그 판으로 저장되며, HUD에 `DEBUG · 무적` 배지가 보인다.

## Decision Summary
- D01: URL 파라미터만으로 켠다(배포 환경 포함). D05: 설정은 localStorage에 기억(try/catch). D08: HUD 배지.
- 패널 UI(설정 변경)는 T02. 이 Task는 저장된 설정(없으면 W1 프리셋)으로 동작한다.

## Implementation

### I01. 디버그 헬퍼 모듈

- Related Files:
  - `src/pc/debug/debugMode.ts` :: `isDebugModeSearch`, `presetForStart`, `loadDebugStartConfig`, `saveDebugStartConfig`, `clampDebugStartConfig`; new

#### Details
- ```typescript
  export const DEBUG_CONFIG_STORAGE_KEY = 'beer.debugStartConfig.v1';
  export function isDebugModeSearch(search: string): boolean; // URLSearchParams(search).get('debug') === '1'
  export function presetForStart(startAt: DebugStartPoint): DebugStartConfig;
  export function clampDebugStartConfig(v: unknown): DebugStartConfig; // 잘못된 값은 W1 프리셋 기준으로 보정
  export function loadDebugStartConfig(): DebugStartConfig;  // localStorage 읽기 실패·파싱 실패 → presetForStart('W1')
  export function saveDebugStartConfig(cfg: DebugStartConfig): void; // 실패 무시
  ```
- 프리셋(상한은 `GAME_TUNING.cards`에서 읽는다):
  - W1: Lv.1, 카드 전부 0
  - W6: Lv.3, `damage_up/skill_cooldown/fever_extend/rapid_reload/lucky_drop` 2, `hit_zone_up` 1
  - EX: Lv.4, 모든 카드 최대(damage_up 3, skill_cooldown 3, fever_extend 3, hit_zone_up 2, rapid_reload 3, lucky_drop 3)
- `App.tsx`의 `resolveRouteMode`는 수정 불필요(`debug`는 `room`/`mode=test`와 겹치지 않아 PC로 간다) — 테스트로 확인만.

### I02. PCGamePage 연결

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `isDebugMode`(useMemo), `debugConfig` state, `handleStartGame`(1031행); modify
  - `src/pc/scoreSubmission.ts` :: `buildGameBegin`; modify

#### Details
- `const isDebugMode = useMemo(() => typeof window !== 'undefined' && isDebugModeSearch(window.location.search), []);`
- `const [debugConfig, setDebugConfig] = useState<DebugStartConfig>(() => loadDebugStartConfig());` + ref(`debugConfigRef`). setter 래퍼 `updateDebugConfig(cfg)`는 state·ref 갱신 후 `saveDebugStartConfig`(T02 패널이 사용).
- `handleStartGame`에서 `engine.startGame(...)` **직전**:
  ```typescript
  engine.debugInvincible = isDebugMode;
  engine.debugStart = isDebugMode ? debugConfigRef.current : null;
  ```
- `buildGameBegin(slots, map, roomId, beginId, debug?: DebugStartConfig)` → 반환 객체에 `...(debug ? { debug } : {})`. 호출부에 `isDebugMode ? debugConfigRef.current : undefined`.
- 튜토리얼 시작(`handleStartTutorial`)·샌드박스 진입 경로에서는 `engine.debugInvincible = false; engine.debugStart = null;`로 되돌린다(엔진이 mode로 막지만 명시적으로).
- **함정**: 일시정지 "다시시작"(`handleRestartFromPause`, `sameRoster: true`)도 `handleStartGame`을 거치므로 같은 설정이 다시 적용된다 — 별도 처리 불필요, 테스트로 확인.

### I03. HUD 배지

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUDProps.isDebug`; modify
  - `src/pc/PCGamePage.tsx` :: `<ArcadeOverlayHUD isDebug={isDebugMode} .../>`(1754행); modify

#### Details
- `isDebug?: boolean`(기본 false). true면 화면 좌하단 고정 위치(`position:absolute; left:12px; bottom:12px`, pointerEvents none)에 작은 배지 `DEBUG · 무적`(배경 반투명 주황 `rgba(234,88,12,0.85)`, 흰 글자 12px, 둥근 모서리). 기존 HUD 요소(목숨·웨이브·탄약)와 겹치지 않는지 확인하고 겹치면 위치만 조정.

### I04. 테스트

- Related Files:
  - `tests/debug-mode.test.ts` — new
  - `tests/coop-start-flow.test.ts` 등 `buildGameBegin` 기존 테스트 — 회귀 확인; read-only

#### Details
- `isDebugModeSearch('?debug=1') === true`, `'?debug=0'`, `''`, `'?room=AB&debug=1'`(컨트롤러 라우트이지만 함수 자체는 true — 라우트는 App이 먼저 CONTROLLER로 보냄) 확인. `resolveRouteMode('/', '?debug=1') === 'PC'`.
- `loadDebugStartConfig`: localStorage 없음/깨진 JSON/범위 밖 값 → 보정. `saveDebugStartConfig` 후 load 동일.
- `buildGameBegin(..., cfg)`에 `debug` 포함, 인자 없으면 `debug` 키 없음.
- HUD: `isDebug` true일 때 `DEBUG · 무적` 텍스트 렌더(@testing-library 사용 방식은 `tests/ex-hud.test.ts` 따름).

## Acceptance Criteria
- [x] `?debug=1`에서 시작한 판은 엔진 무적·시작 조건이 켜지고 GAME_BEGIN에 `debug`가 실린다.
- [x] URL에 `debug=1`이 없으면 기존과 완전히 같다(`debug` 키 없음, 무적 꺼짐).
- [x] 디버그 판 HUD에 배지가 보인다.

## Validation
- `npx vitest run tests/debug-mode.test.ts tests/coop-start-flow.test.ts tests/ex-hud.test.ts tests/pc-page-smoke.test.tsx` — 통과
- `npx tsc --noEmit` — 에러 0

## Commit Message
```text
feat(pc): wire ?debug=1 into game start, GAME_BEGIN and HUD badge

Plan: 2026-11-17-debug-mode
Phase: P03-pc-debug-ui
Task: T01-debug-mode-wiring-and-hud-badge

- I01: add debugMode helpers for URL detection, presets and saved config
- I02: set engine debug flags and send debug config with GAME_BEGIN
- I03: show DEBUG invincible badge on the in-game HUD
- I04: test helpers, GAME_BEGIN payload and HUD badge
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
