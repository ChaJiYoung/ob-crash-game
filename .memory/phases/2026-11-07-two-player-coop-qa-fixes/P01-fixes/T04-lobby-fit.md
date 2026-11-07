# Task: T04 로비 모달이 화면 안에 들어오게

## Status: done

## Goal
로비 모달(`QRPairingModal`)이 1440×900과 1024×768에서 잘리지 않게 한다. 지금 1440×900에서 모달 아래 마지막 안내 문구("크롬/사파리 사운드가…")가 화면 밖으로 잘린다(`.memory/references/two-player-coop-screens/01-lobby-empty.png`).

## Decision Summary
- 모달 크기 규칙만 고친다(내용·배치 변경 없음). 화면이 작으면 모달 안에서 스크롤.

## Implementation

### I01. 모달 크기

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: 바깥 모달 컨테이너 style; modify

#### Details
- 바깥 컨테이너에 `maxHeight: 'calc(100vh - 32px)'`, `overflowY: 'auto'`, `boxSizing: 'border-box'`. 모달을 감싼 전체 화면 레이어가 `alignItems: 'center'`로 위아래를 자르는 경우 `alignItems: 'safe center'` 또는 상단 정렬 + `margin: auto`로 바꿔 위쪽도 잘리지 않게 한다.
- 슬롯 카드 높이가 고정(`minHeight`)이면 그대로 두고 스크롤로 해결한다.

### I02. 확인

- 개발 서버를 띄워 Playwright로 1440×900, 1024×768 로비를 캡처하고 모달의 `getBoundingClientRect().bottom <= innerHeight`를 확인(스크롤 컨테이너면 컨테이너 bottom 기준). 캡처는 `.memory/references/two-player-coop-screens/T04-lobby-1440.png`, `T04-lobby-1024.png`로 저장.

## Acceptance Criteria
- [ ] 두 해상도에서 모달 아래가 잘리지 않거나, 잘리면 모달 안 스크롤로 끝까지 볼 수 있다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 캡처 2장 확인

## Commit Message
```text
fix(lobby): keep the lobby modal within the viewport

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P01-fixes
Task: T04-lobby-fit

- Cap the modal height to the viewport and scroll inside it on small screens
- Checked at 1440x900 and 1024x768

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
