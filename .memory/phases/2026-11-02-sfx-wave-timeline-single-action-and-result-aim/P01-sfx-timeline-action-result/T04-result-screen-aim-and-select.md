# Task: T04 Result Screen Crosshair and Shoot-to-Select

## Status: pending

## Goal
게임 종료(GAMEOVER) 및 승리(VICTORY) 결과 모달 위에서도 로비처럼 조준경을 최상위 레이어로 렌더링하고, "다시 도전하기" 및 "로비로 이동" 버튼 조준 시 네온 호버 반응과 함께 스냅 사격으로 버튼을 즉시 선택할 수 있도록 하여 마우스 없이도 컨트롤러만으로 완결되는 아케이드 UX를 완성한다.

## Decision Summary
- 결과 모달 위에 조준경 노출 (z-index 160) + 버튼 영역 호버 네온 반응 + 스냅 발사 1발로 즉시 실행 (마우스/터치 클릭도 동시 유지) ([D04](../../decisions/2026-11-02-sfx-wave-timeline-single-action-and-result-aim.md)).

## Implementation

### I01. ResultRankingModal Hover Feedback State

- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModal` — 호버 스타일 지원; modify

#### Details
- **Props**:
  ```typescript
  export interface ResultRankingModalProps {
    // 기존 props...
    hoveredAction?: 'restart' | 'lobby' | null;
  }
  ```
- **Visual Styling**:
  - `hoveredAction === 'restart'`:
    - "다시 도전하기" 버튼 스타일: `transform: scale(1.05)`, `boxShadow: '0 0 25px rgba(245, 158, 11, 0.9)'`, `filter: brightness(1.15)`.
    - 조준 타겟 마커 아이콘(🎯) 추가 노출.
  - `hoveredAction === 'lobby'`:
    - "로비로 이동" 버튼 스타일: `transform: scale(1.05)`, `boxShadow: '0 0 25px rgba(56, 189, 248, 0.9)'`, `borderColor: '#38bdf8'`, `filter: brightness(1.2)`.
    - 조준 타겟 마커 아이콘(🎯) 추가 노출.
  - 마우스 클릭 이벤트(`onClick={onRestart}`, `onClick={onReturnToLobby}`)는 그대로 100% 보존.

### I02. PCGamePage Crosshair Layer & Shoot-to-Select Logic

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 조준경 렌더링 및 사격 히트 판정; modify

#### Details
- **Crosshair Overlay Mounting**:
  - `(gamePhase === 'GAMEOVER' || gamePhase === 'VICTORY')` 조건일 때도 `CrosshairOverlay`를 `zIndex: 160`의 최상위 컨테이너로 마운트.
- **Bounding Box Hit Calculation**:
  - 결과 모달 내 버튼 위치를 판정하기 위해 화면 크기 대비 버튼의 NDC 영역을 계산하거나, 버튼 DOM ref의 `getBoundingClientRect()`를 사용:
    - 조준경 화면 픽셀 좌표: `screenX = ((aimX + 1) / 2) * window.innerWidth`, `screenY = ((1 - aimY) / 2) * window.innerHeight`.
    - `restartBtnRect` 내부에 `(screenX, screenY)`가 포함되면 ➔ `hoveredAction = 'restart'`.
    - `lobbyBtnRect` 내부에 `(screenX, screenY)`가 포함되면 ➔ `hoveredAction = 'lobby'`.
    - 둘 다 아니면 ➔ `null`.
- **Snap Fire Routing**:
  - `p.snapFire` 수신 시 `(curPhase === 'GAMEOVER' || curPhase === 'VICTORY')`:
    - `soundSynth.playShoot(false);`
    - `hoveredAction === 'restart'`:
      - `soundSynth.playHit('PERFECT');`
      - `handleStartGame();` (또는 카운트다운 재시작)
    - `hoveredAction === 'lobby'`:
      - `soundSynth.playHit('PERFECT');`
      - `handleReturnToLobby();`
    - 버튼 외부 사격 시: 단순 빗나감 격발음.

## Acceptance Criteria
- [ ] 게임오버 및 승리 화면에서도 모니터 화면에 조준경이 또렷하게 표시된다.
- [ ] 폰을 움직여 조준경을 "다시 도전하기" 버튼에 올리면 버튼이 환하게 빛나며 확대된다.
- [ ] 조준경을 "로비로 이동" 버튼에 올리면 버튼이 푸른빛으로 반응한다.
- [ ] 해당 상태에서 손목 스냅 사격을 가하면 즉시 재도전 또는 로비로 이동된다.
- [ ] 마우스로 버튼을 직접 클릭해도 정상 동작한다.

## Validation
- `pnpm test` — 전체 유닛 테스트 통과
- `pnpm build` — TypeScript 빌드 성공

## Commit Message
```text
feat(result): enable crosshair aiming and shoot-to-select on game over and victory screens

Plan: 2026-11-02-sfx-wave-timeline-single-action-and-result-aim
Phase: P01-sfx-timeline-action-result
Task: T04-result-screen-aim-and-select

- Render CrosshairOverlay on GAMEOVER and VICTORY result modals
- Add dynamic hover neon reaction on restart and return-to-lobby buttons
- Route snap fire events to trigger selected button actions seamlessly
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
