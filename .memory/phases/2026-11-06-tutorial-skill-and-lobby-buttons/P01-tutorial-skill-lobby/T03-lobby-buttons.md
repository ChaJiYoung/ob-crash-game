# Task: T03 로비 버튼 나란히 + 가이드 모달 버튼 제거

## Status: done

## Goal
로비에서 `🎓 튜토리얼 시작`과 `📖 게임 가이드`가 한 줄에 나란히 있고, 가이드 모달 안에는 튜토리얼 버튼이 없다.

## Decision Summary
- `onStartTutorial?: () => void` 를 `QRPairingModal` 에 추가. 한쪽 콜백이 없으면 그 버튼만. `handleStartTutorial` 재사용.

## Implementation

### I01. 로비 버튼
- Related Files: `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps`, 가이드 버튼 블록(약 353~375행) — modify
#### Details
- props 에 `onStartTutorial?: () => void;` 추가, 컴포넌트 구조분해에도 추가.
- 기존 `{onOpenGuide && (<button …>📖 게임 가이드 & 튜토리얼 …)}` 를 `{(onStartTutorial || onOpenGuide) && (<div style={{display:'flex', gap:'10px'}}> … </div>)}` 로 교체. 각 버튼 `flex: 1`, `padding: 13px`, `fontSize: 14px`, `fontWeight: 800`, `lineHeight` 허용 줄바꿈(`whiteSpace: 'normal'`). 튜토리얼 버튼: `🎓 튜토리얼 시작`, 파란 톤(`#38bdf8`, 배경 `rgba(56,189,248,0.1)`, 테두리 `rgba(56,189,248,0.4)`). 가이드 버튼: `📖 게임 가이드`, 기존 앰버 톤 유지.

### I02. 페이지 연결
- Related Files: `src/pc/PCGamePage.tsx` :: `<QRPairingModal …>`(약 1298행), `<GuideModal …>`(약 1405~1410행) — modify
#### Details
- `QRPairingModal` 에 `onStartTutorial={handleStartTutorial}` 추가. `GuideModal` 에서 `showTutorialButton`, `onStartTutorial` 두 prop 삭제.

### I03. 가이드 모달 정리
- Related Files: `src/pc/components/GuideModal.tsx` :: props(15~16행), 구조분해(150~151행), 푸터(약 739~760행) — modify
#### Details
- `onStartTutorial`, `showTutorialButton` 삭제. 푸터의 튜토리얼 버튼 삼항식과 `<div />` 자리표시를 지우고 컨테이너 `justifyContent: 'space-between'` → `'flex-end'` 로 닫기 버튼이 오른쪽에 남게 한다.

### I04. 테스트
- Related Files: `tests/pc-modals-and-pairing.test.ts` — modify
#### Details
- 두 콜백을 넘긴 렌더에 `튜토리얼 시작`·`게임 가이드` 포함. 가이드 콜백만 넘기면 `튜토리얼 시작` 미포함, 튜토리얼 콜백만이면 `게임 가이드` 미포함. 소스 검사: `GuideModal.tsx` 에 `showTutorialButton`, `튜토리얼 플레이` 없음.

## Acceptance Criteria
- [x] 로비 한 줄에 튜토리얼·가이드 버튼, 가이드 모달에 튜토리얼 버튼 없음

## Validation
- `npx tsc --noEmit && npx vitest run` — 전체 통과

## Commit Message
```text
feat(lobby): put the tutorial and guide buttons side by side

Plan: 2026-11-06-tutorial-skill-and-lobby-buttons
Phase: P01-tutorial-skill-lobby
Task: T03-lobby-buttons

- add a tutorial start button next to the guide button in the lobby
- remove the tutorial button and its props from the guide modal
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
