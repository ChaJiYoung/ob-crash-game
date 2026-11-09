# Task: T01 튜토리얼 버튼 연동 + 폰 실전 시작 수정

## Status: done

## Goal
(1) 로비의 튜토리얼 버튼은 시작 버튼이 활성일 때만 눌린다(D12). (2) 튜토리얼 수료 화면에서 "실전 배틀 시작"을 누르면 폰이 연결된 상태에서도 카운트다운을 거쳐 게임이 시작된다(D13).

## Decision Summary
- 원인(확정, 코드 근거): `startCountdownAndGame`(PCGamePage)이 단계가 PAIRING/ZEROING이 아니면 조용히 반환 → 튜토리얼(TUTORIAL)에서 폰 경로는 무반응. 마우스만이면 `handleStartGame`을 바로 불러 동작.
- `setPhase`는 `gamePhaseRef.current`를 즉시 갱신하므로 `handleExitTutorial()` 직후 `pressScreenButton('start')`를 불러도 단계 검사를 통과한다.

## Implementation

### I01. 튜토리얼 실전 시작 경로
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `handleExitTutorial`(약 1344행), `pressScreenButton`, `<TutorialGuideOverlay onStartRealGame>`(약 1699행) — modify
#### Details
- `handleExitTutorial` 정의 뒤에 `const handleStartRealGameFromTutorial = useCallback(() => { handleExitTutorial(); pressScreenButton('start'); }, [handleExitTutorial, pressScreenButton]);` 추가하고 TutorialGuideOverlay의 `onStartRealGame`에 연결. 센서 랩(SANDBOX)의 `onStartRealGame`은 그대로(범위 밖).
- 시작 시도가 게이트에서 거절되면(아무도 준비 안 됨) 튜토리얼은 이미 정리되어 로비로 돌아가 시작 불가 알림이 뜬다 — 의도된 동작.

### I02. 튜토리얼 버튼 비활성
- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: "🎓 튜토리얼 시작" 버튼(약 650~670행), `startView`(`getStartButtonView`) — modify
#### Details
- `startView.enabled`가 false면 `disabled`, `onClick` 없음, 회색(`rgba(30,41,59,0.5)` 배경, `#94a3b8` 글자, `cursor: 'not-allowed'`), 글자 "🎓 튜토리얼 시작 (기기 연결 후 가능)". 활성이면 기존 스타일·글자. `data-testid="lobby-tutorial-button"`, `data-enabled`.

### I03. 테스트
- Related Files:
  - `tests/lobby-slot-cards.test.tsx` — modify(케이스 추가)
#### Details
- `onStartTutorial`을 넘긴 렌더에서: 빈 로비 → 튜토리얼 버튼 `disabled`·"(기기 연결 후 가능)", 1P 준비+2P 미연결 → 활성·"🎓 튜토리얼 시작", 2P 영점 중(시작 비활성) → 비활성.
- 수료 화면 경로(I01)는 컴포넌트 테스트가 없어 단위 검증 불가: 위 근거와 `tsc`로 대체하고 수동 확인 항목으로 남긴다.

## Acceptance Criteria
- [ ] 시작 버튼이 비활성인 동안 튜토리얼 버튼도 비활성(사유 문구)
- [ ] 시작 버튼 활성(1P 준비, 2P 미연결 포함) 시 튜토리얼 버튼 활성
- [ ] 튜토리얼 수료 화면의 실전 시작이 폰 연결 상태에서도 로비 시작 흐름으로 이어진다(코드 경로 확인)
- [ ] `npm test`, `tsc` 통과

## Validation
- `npx vitest run tests/lobby-slot-cards.test.tsx` · `npm test` · `npx tsc --noEmit`

## Commit Message
```text
fix(lobby): 튜토리얼 버튼을 시작 버튼 활성과 연동, 튜토리얼에서 폰으로 실전 시작되게 수정

Plan: 2026-11-10-lobby-2p-default-mobile
Phase: P05-tutorial-entry
Task: T01-tutorial-button-gate-and-real-start

- 튜토리얼 버튼: 시작 버튼 비활성이면 disabled + "(기기 연결 후 가능)"
- 수료 화면 실전 시작: 튜토리얼 정리 후 로비 시작 흐름으로 이어 폰 연결 상태에서도 동작
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-tutorial-button-gate-and-real-start"
