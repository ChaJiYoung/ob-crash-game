# Task: T01 더블클릭 피버와 Space·R 키 제거

## Status: done

## Goal
마우스 왼쪽 버튼을 300ms 안에 두 번 누르면 (피버 준비 시) 피버가 켜지고, `Space`·`R` 키는 아무 동작도 하지 않는다. 우클릭 스킬은 유지.

## Decision Summary
- `WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS`(300) 재사용. 브라우저 `dblclick` 사용 금지(OS 설정 시간 의존). 첫·둘째 클릭 모두 평소처럼 발사.

## Implementation

### I01. 판정 순수 함수
- Related Files:
  - `src/pc/mouseFever.ts` :: `detectDoubleClick` — new
#### Details
- **Signatures & Types**:
  ```typescript
  export interface DoubleClickResult { triggered: boolean; nextLastClickMs: number }
  export function detectDoubleClick(lastClickMs: number, nowMs: number, windowMs: number): DoubleClickResult
  ```
- **Logic**: `lastClickMs > 0 && nowMs - lastClickMs <= windowMs` 이면 `{triggered:true, nextLastClickMs:0}` (3연타 중복 방지), 아니면 `{triggered:false, nextLastClickMs:nowMs}`. 폰 `UnifiedTouchPad.handlePointerDown`과 동일 규칙.

### I02. GameCanvas3D 연결과 Space 제거
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `handleMouseDown`, `handleKeyDown`, 리스너 등록·해제부(약 479~495, 808행) — modify; `WEAPON_CONSTANTS` import 확인
#### Details
- 지역 변수 `let lastClickMs = 0`. `handleMouseDown` 의 `e.button === 0` 안에서 `executeShot('press')` 후 `detectDoubleClick(lastClickMs, performance.now(), WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS)` 로 갱신, `triggered` 면 기존 Space 분기 본문(`engine.activateFever` → 성공 시 `soundSynth.playFeverStart()`, 튜토리얼 step 3이면 `engine.spawnTutorialStep3Enemies()`)을 지역 함수 `tryActivateFever()` 로 빼서 호출.
- `handleKeyDown`, `window.addEventListener('keydown', ...)`, 해제부의 `removeEventListener('keydown', handleKeyDown)` 삭제(다른 keydown 사용 없음 확인됨).
- 주의: 발사 후 피버가 켜지는 순서는 폰과 같다(발사 → 피버 판정).

### I03. R 키 제거
- Related Files:
  - `src/pc/PCGamePage.tsx` :: 'Keyboard R & Mouse Right-Click' `useEffect`(약 250행) — modify
#### Details
- `handleKeyDown`(KeyR)과 keydown 리스너를 지우고 `contextmenu` 리스너만 남긴다. 주석은 "Mouse right-click skill trigger"로.
- `e.preventDefault()` 로 우클릭 메뉴 차단은 유지.

### I04. 테스트
- Related Files:
  - `tests/mouse-double-click-fever.test.ts` — new
#### Details
- `detectDoubleClick`: 첫 클릭(last=0)→false/next=now; 300ms 이내→true/next=0; 정확히 300ms→true; 301ms→false/next=now; 3연타(클릭1→2 triggered, 3은 false).
- 소스 검사(`fs.readFileSync`): `GameCanvas3D.tsx` 에 `'Space'` 없음, `detectDoubleClick` 와 `FEVER_DOUBLE_TAP_MS` 포함, `'keydown'` 없음; `PCGamePage.tsx` 에 `'KeyR'` 없음, `contextmenu` 포함.

## Acceptance Criteria
- [x] 피버 준비 상태에서 300ms 내 더블클릭하면 피버가 켜진다 (튜토리얼 3단계 포함)
- [x] Space·R 키를 눌러도 아무 일도 없고 우클릭 스킬은 된다

## Validation
- `npx tsc --noEmit && npx vitest run` — 전체 통과

## Commit Message
```text
feat(controls): fever on mouse double-click, drop Space and R keys

Plan: 2026-11-06-mouse-controls-and-lobby-hint
Phase: P01-controls
Task: T01-double-click-fever-and-key-removal

- add detectDoubleClick and wire it to left mouse down
- remove the Space fever and R skill key handlers
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
