# Task: T06 판 시작 순서 점검(화면 단계 → 처리부)

## Status: done

## Goal
판이 시작될 때 처리부가 "게임 중" 상태로 만들어지게 한다. 지금 `PCGamePage.handleStartGame`은 `syncProcessors()`를 `setGamePhase('PLAYING')`보다 먼저 부른다. 그 순간 `gamePhaseRef.current`는 아직 `PAIRING`/`ZEROING`이라 `syncProcessors`가 로비 분기(슬롯 매핑 다시 만들기)를 탄다. 또 화면 단계가 다음 렌더까지 `ZEROING`으로 남는다(A DIFF-2: 폰 시작 뒤 무기 선택 중 단계값 `ZEROING`). 그동안 처리부는 `fireDown`을 메뉴 사격(가운데 = 시작 버튼)으로 처리하므로, 무기 선택 첫 사격이 무시되거나 시작을 다시 누르는 것으로 처리될 수 있다.

## Decision Summary
- `gamePhaseRef`를 렌더 때만 갱신하지 말고 **단계를 바꾸는 함수에서 ref를 먼저 바꾼다**: `setPhase(next)` 헬퍼 = `gamePhaseRef.current = next; setGamePhase(next);`. 모든 `setGamePhase(` 호출을 이 헬퍼로 바꾼다(지금 10곳 안팎, `grep -n "setGamePhase(" src/pc/PCGamePage.tsx`).
- `handleStartGame`에서는 `setPhase('PLAYING')`을 `syncProcessors()`보다 먼저.

## Implementation
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `setPhase`(new), `handleStartGame`, 그 외 `setGamePhase` 호출부; modify

### 테스트
- Related Files:
  - `tests/pc-page-smoke.test.tsx` 또는 `tests/start-order.test.ts`; modify/new
- 처리부 단위 테스트로 재현: `getPhase`가 `'ZEROING'`을 돌려주는 동안 엔진이 무기 선택 중이면 `fireDown`이 `onButton('start')`로 가는 것을 확인(현재 동작 고정) → 페이지 쪽 `setPhase` 순서를 소스 검사로 확인(`handleStartGame` 본문에서 `setPhase('PLAYING')`이 `syncProcessors()`보다 앞).

## Acceptance Criteria
- [ ] 판 시작 직후(같은 틱) `gamePhaseRef.current === 'PLAYING'`.
- [ ] `setGamePhase(`를 직접 부르는 곳이 `setPhase` 내부 하나뿐.

## Validation
- `grep -c "setGamePhase(" src/pc/PCGamePage.tsx` — `1`(헬퍼 안)
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
fix(pc): switch the phase ref before rebuilding processors at game start

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T06-start-order

- setPhase updates gamePhaseRef immediately, then React state
- handleStartGame sets PLAYING before syncProcessors so the first weapon-select shot is a game shot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 2d25863
