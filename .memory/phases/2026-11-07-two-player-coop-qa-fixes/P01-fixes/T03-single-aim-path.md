# Task: T03 조준 경로를 하나로

## Status: pending

## Goal
조준(십자선·총)이 바뀌는 경로를 "어댑터 → 처리부 `aim` 신호 → `onAim(x, y, playerIndex)` → 캔버스 `setAim(..., playerIndex)`" 하나로 만든다. 지금은 캔버스의 마우스 핸들러가 이 경로를 건너뛰고 1P 총(0번)과 옛 조준 ref를 직접 덮어써서, 마우스가 2P에 묶였거나(1P 폰+2P 마우스) 어디에도 묶이지 않은(폰 2대) 판에서 1P 총이 마우스를 따라 움직인다.

## Decision Summary
- D25: 장치 차이는 어댑터 안, 실제 동작은 처리부 한 곳. 캔버스는 마우스 **신호만** 낸다(P01-T05 원칙).
- 마우스는 지금 "즉시 반영"(보간 없음), 폰은 보간이다. 이 차이는 장치 특성이므로 `aim` 신호에 `immediate` 표시로 싣는다(어댑터가 정함).

## Implementation

### I01. 신호에 즉시 반영 표시

- Related Files:
  - `src/pc/input/inputSignals.ts` :: `InputSignal` 'aim'; modify
  - `src/pc/input/MouseAdapter.ts` :: `onMove`; modify
  - `src/pc/input/PlayerActionProcessor.ts` :: `send` 'aim', `ProcessorContext.onAim`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  | { type: 'aim'; aimX: number; aimY: number; immediate?: boolean }
  onAim: (aimX: number, aimY: number, playerIndex: PlayerIndex, immediate: boolean) => void;
  ```
- MouseAdapter `onMove` → `{ type: 'aim', aimX, aimY, immediate: true }`. PhoneAdapter는 그대로(없음 = false).

### I02. 캔버스 직접 쓰기 제거

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `handleMouseMove`(498~512행 부근), `targetAimRef`·`currentAimRef`(194·195·315·317·505·506·569~573행), `playShotFx`의 기본 조준(249행); modify

#### Details
- `handleMouseMove`는 `onMouseAim(x, y)` 호출만 남긴다(`gunAimsRef`·`targetAimRef`·`currentAimRef` 쓰기 삭제).
- `targetAimRef`·`currentAimRef`는 0번 총 조준의 중복 사본이라 삭제하고, 쓰던 곳은 `gunAimsRef.current[i]`로 바꾼다(`playShotFx` 기본값은 `gunAimsRef.current[result.playerIndex]?.current`).
- `setAim(x, y, immediate, playerIndex)`가 총 조준을 바꾸는 유일한 진입점이다.

### I03. 페이지 정리

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `updateAimDirect`(335행 부근, 호출처 없음), `latestAimRef`(219·336·470·1523·1524·1603·1604행), 처리부 `onAim`; modify

#### Details
- `updateAimDirect` 삭제(호출처 없음을 grep으로 다시 확인).
- `latestAimRef`는 로비·결과 화면 십자선의 초기 좌표로만 쓰인다. `processorsRef.current[0]?.aim`으로 대체하고 `latestAimRef`를 삭제한다.
- 처리부 `onAim(x, y, idx, immediate)` → `crosshairRefs.current[idx]?.current?.updatePosition(x, y, immediate)`, `canvasRef.current?.setAim(x, y, immediate, idx)`.

### I04. 테스트

- Related Files:
  - `tests/input-adapters.test.ts`, `tests/slot-binding.test.ts`; modify

#### Details
- MouseAdapter `onMove` → `aim` 신호에 `immediate: true`.
- 1P 폰·2P 마우스 바인딩: 마우스 이동 → 처리부 1의 `onAim(…, 1, true)`만 호출, 처리부 0은 호출되지 않음.
- 폰 2대 바인딩(마우스 묶음 null): 마우스 이동 → 어떤 `onAim`도 호출되지 않음.
- 소스 검사: `GameCanvas3D.tsx`의 `handleMouseMove` 본문에 `gunAimsRef`가 없음(문자열 검사).

## Acceptance Criteria
- [ ] 총·십자선 조준을 바꾸는 경로가 처리부 `onAim` 하나다.
- [ ] `updateAimDirect`, `latestAimRef`, `targetAimRef`, `currentAimRef`가 소스에 없다.

## Validation
- `grep -rn "updateAimDirect\|latestAimRef\|targetAimRef\|currentAimRef" src | wc -l` — `0`
- `npx vitest run tests/input-adapters.test.ts tests/slot-binding.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
fix(input): one aim path from adapters through processors to the canvas

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P01-fixes
Task: T03-single-aim-path

- The canvas mouse handler only emits a signal; it no longer moves gun 0 directly
- aim signals carry immediate (mouse) vs smoothed (phone)
- Remove the unused updateAimDirect and duplicate aim refs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
