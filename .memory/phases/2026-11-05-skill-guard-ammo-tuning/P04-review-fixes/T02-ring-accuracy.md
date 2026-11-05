# Task: T02 장전 링을 실제 장전과 맞추기

## Status: done

## Goal
링이 100ms HUD 갱신 주기 때문에 실제 장전보다 늦게 시작해 일찍 사라지는 문제, 샌드박스·튜토리얼에서 카드 때문에 링만 멈추는 문제, 장전마다 `<style>`이 생겼다 사라지는 문제를 고친다. 링 고정 동작은 소스 문자열이 아니라 순수 함수 테스트로 검증한다.

## Decision Summary
- 링은 마운트될 때 엔진의 남은 장전 시간을 한 번 읽어 `animation-delay`를 음수로 주어 이미 지난 부분을 건너뛴다(스냅샷에 매 프레임 값을 넣지 않는다: 렌더 폭증 방지).
- 시작 시 시간/남은 시간 캡처는 `ReloadRing` 자식 컴포넌트의 `useState` 초기화 함수로 한다(렌더 중 ref 쓰기 제거).
- keyframes는 `pathLength={1}`로 정규화해 고정 이름 하나만 쓰고, 항상 마운트된 `<style>`(이미 있는 `crosshair-spin` 옆)에 넣는다.

## Implementation

### I01. 순수 함수와 `ReloadRing` 컴포넌트
- Related Files (modify): `src/pc/components/CrosshairOverlay.tsx`
#### Details
```ts
/** 링 애니메이션 길이와 시작 지연. 장전이 시작된 지 이미 지난 만큼은 음수 지연으로 건너뛴다. */
export function computeReloadRingTiming(startDurationMs: number, remainingMs: number | undefined): { durationMs: number; delayMs: number } {
  const duration = Math.max(0, startDurationMs);
  if (remainingMs === undefined || !Number.isFinite(remainingMs)) return { durationMs: duration, delayMs: 0 };
  const remaining = Math.min(duration, Math.max(0, remainingMs));
  return { durationMs: duration, delayMs: -(duration - remaining) };
}
```
- `getReloadRingSpec`: `circumferencePx` 제거(정규화 길이 1 사용), 나머지 유지(+ 기존 테스트 갱신).
- `CrosshairOverlayProps`에 `getReloadRemainingMs?: () => number` 추가. `ReloadRing`(조건부 마운트)이 마운트 시 `useState(() => computeReloadRingTiming(reloadDurationMs, getReloadRemainingMs?.()))`로 타이밍을 한 번 고정한다. 그 값이 곧 "시작 길이 고정"이므로 `startDurationMsRef`와 렌더 중 ref 쓰기를 삭제한다.
- 링 `<circle>`: `pathLength={1} strokeDasharray={1}`, `style={{ animation: 'reload-ring-fill ${durationMs}ms linear ${delayMs}ms forwards', animationPlayState }}`.
- 항상 마운트된 `<style>`에 `@keyframes crosshair-spin {…}`와 `@keyframes reload-ring-fill { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }`를 함께 둔다. 링 안의 `<style>` 삭제.

### I02. `PCGamePage` 연결과 일시정지 조건
- Related Files (modify): `src/pc/PCGamePage.tsx` (CrosshairOverlay 3곳)
#### Details
- `getReloadRemainingMs={() => Math.max(0, engine.weaponSystem.getState().reloadEndTimeMs - performance.now())}` — 엔진 시계와 같은 `performance.now()` 기준인지 `update(nowMs)` 호출부에서 확인한다. 다르면 같은 시계를 쓰도록 맞춘다.
- `isPaused`: 정규 플레이 곳은 현재처럼 `hudState.isPaused || hudState.isRewardCardPending || hudState.isWeaponSelectPending`, **튜토리얼·샌드박스 곳은 `hudState.isPaused`만**(엔진이 이 모드에서는 카드 때문에 시계를 멈추지 않는다: `BeerCrusherEngine.update`의 `!isTutorialMode && !isSandboxMode && isCardSelectPending`).

### I03. 테스트
- Related Files (modify/new): `tests/reload-ring.test.ts`
#### Details
- `computeReloadRingTiming(1680, 1680)` → `{1680, 0}`; `(1680, 400)` → `delayMs -1280`; `(1680, 0)` → `delayMs -1680`; `(1680, 9999)` → 지연 0(상한); `(1680, undefined)` → 0; 음수·NaN 안전.
- 소스 검사: 링 안에 `<style>`이 없고(고정 keyframes는 `pathLength`와 함께), `reload-ring-fill`이 정확히 한 번 정의된다.
- PCGamePage 정규 플레이/튜토리얼/샌드박스 세 곳의 `isPaused` 표현을 구분해 검사한다(튜토리얼·샌드박스는 `isRewardCardPending`이 없다).

## Acceptance Criteria
- [ ] 링이 장전 시작 후 마운트돼도 실제 종료 시각에 맞춰 가득 찬다(헤드리스 확인: 지연 적용된 `currentTime`)
- [ ] 샌드박스에서 카드를 띄워도 링이 멈추지 않는다
- [ ] 장전마다 `<style>` 요소가 생기지 않는다
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` 통과

## Validation
- `npx tsc --noEmit && npm test && npm run build`

## Commit Message
```text
fix(hud): sync the reload ring with the real reload end and stop restyling the page per reload

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P04-review-fixes
Task: T02-ring-accuracy

- ReloadRing captures duration/remaining once on mount (negative animation-delay)
- fixed pathLength-based keyframes in the always-mounted style tag
- tutorial/sandbox ring pauses only on the user pause, as the engine does
- unit tests for the ring timing
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
