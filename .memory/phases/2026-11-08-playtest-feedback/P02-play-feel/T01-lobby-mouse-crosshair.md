# Task: T01 로비에서 마우스 십자선 표시

## Status: done

## Goal
로비(PAIRING/ZEROING)에서 마우스 슬롯에 참여하면 그 플레이어 색의 메뉴용 십자선이 보이고 마우스 커서를 따라간다. 지금은 모바일 슬롯만 보이고 마우스는 게임에 들어가야 보인다.

## Decision Summary
- 결정 D06. 원인은 두 가지다.
  1. `PCGamePage.tsx`(약 1675행)의 로비 십자선은 `slots.some((s) => s.input === 'mobile' && s.isZeroCalibrated)`일 때만 그린다.
  2. 마우스 이동은 `GameCanvas3D` 컨테이너의 `mousemove`로만 받는다(`GameCanvas3D.tsx:522`). 로비에서는 `QRPairingModal`이 캔버스를 덮어 이벤트가 캔버스에 닿지 않는다.
- 해결: 이동 이벤트만 `window`에서 받는다. 좌표는 지금처럼 컨테이너 `getBoundingClientRect()` 기준으로 계산한다. 클릭(`mousedown`)은 캔버스에만 붙여 둔다(D26: 버튼 클릭이 사격이 되면 안 된다).

## Implementation

### I01. 마우스 이동을 창 전체에서 받기
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `handleMouseMove` 등록/해제(약 522행, 895행) — modify

#### Details
1. `container.addEventListener('mousemove', handleMouseMove)` → `window.addEventListener('mousemove', handleMouseMove)`. 정리 코드도 `window.removeEventListener`로 바꾼다.
2. `handleMouseMove`의 좌표 계산(`rect`, `normX`, `normY`, `viewportRatioToAim`)은 그대로 둔다. `normX`, `normY`는 [-1.2, 1.2]로 자른다. 커서가 창 밖에 걸쳐 있으면 값이 범위를 넘을 수 있기 때문이다.
3. `mousedown`, `mouseleave`는 지금처럼 컨테이너에 둔다. `mouseleave`는 발사를 멈추는 용도라 그대로 둔다.
4. 이 변경으로 게임 중에도 HUD 패널 위에서 조준점이 멈추지 않는다. 의도한 개선이다.

### I02. 로비 십자선 표시 조건
- Related Files:
  - `src/pc/PCGamePage.tsx` :: 로비 `CrosshairOverlay` 블록(약 1675~1697행) — modify
  - `src/pc/coopSlots.ts` :: `isSlotReady` — read-only (마우스는 참여 즉시 준비, 모바일은 영점 완료와 연결 필요)

#### Details
1. 바깥 조건을 `slots.some(isSlotReady)`로 바꾼다.
2. `processorsRef.current.map((proc, i) => ...)` 안에서 `slot = indexToSlot(slotIndexMapRef.current, i)`의 `SlotState`를 찾는다. `!slotState || !isSlotReady(slotState)`이면 `null`을 반환한다. 지금은 준비 안 된 슬롯의 십자선도 (0,0)에 그려질 수 있다.
3. 확인 사항: 로비에서 `slotIndexMapRef.current`에 마우스 슬롯이 매핑되어 있고, `MouseAdapter`의 `processorFor(getMouseBinding(...))`가 null이 아니어야 한다. null이면 로비 진입 시 모바일과 같은 방식으로 매핑한다. 모바일이 매핑되는 위치를 찾아 `handleChooseInput`의 마우스 분기에도 같은 매핑을 넣는다.

### I03. 테스트
- Related Files:
  - `tests/lobby-slot-cards.test.tsx` 또는 `tests/pc-page-smoke.test.tsx` — modify

#### Details
- 마우스 슬롯이 참여한 로비 상태에서 메뉴 십자선이 렌더된다(`variant="menu"` 십자선 DOM 존재).
- 모바일 슬롯이 영점 전이면 그 슬롯의 십자선은 렌더되지 않는다.
- 렌더 테스트가 어려우면 표시 조건을 `shouldShowLobbyCrosshair(slot: SlotState | undefined): boolean` 순수 함수로 `coopSlots.ts`에 빼고 단위 테스트한다.

## Acceptance Criteria
- [ ] 로비에서 마우스 슬롯을 고르고 닉네임을 확정하면 십자선이 보이고 QR 모달 위에서도 커서를 따라간다.
- [ ] 모바일 슬롯은 영점 완료 후에만 십자선이 보인다(기존 동작).
- [ ] 로비 버튼 클릭이 사격으로 처리되지 않는다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npm test` — 전체 통과
- 수동: `npm run dev`로 로비에서 마우스 슬롯 선택 → 십자선 이동 확인

## Commit Message
```text
fix(lobby): 마우스 슬롯을 고르면 로비에서도 십자선이 커서를 따라가게

Plan: 2026-11-08-playtest-feedback
Phase: P02-play-feel
Task: T01-lobby-mouse-crosshair

- 마우스 이동을 캔버스 대신 창 전체에서 받기(로비 모달·HUD 위에서도 조준)
- 로비 십자선을 준비된 슬롯마다 그리기(마우스 포함)
- 로비 십자선 표시 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (tsc, vitest 752, build. 로비 육안 확인은 사용자)
- commit: pending
