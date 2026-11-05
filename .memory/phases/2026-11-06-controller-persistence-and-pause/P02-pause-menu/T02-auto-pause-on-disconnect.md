# Task: T02 폰 끊김 자동 일시정지

## Status: pending

## Goal
게임 중 폰 연결이 끊기면 자동으로 일시정지 메뉴가 뜨고 '폰 재연결 중'을 보여 준다. 폰이 돌아오면 메뉴가 '다시 연결됨'으로 바뀌고, 사용자가 이어하기를 누를 때까지 게임은 멈춰 있다.

## Decision Summary
- D06. 서버는 폰 소켓이 닫히면 PC에 `ERROR`/`CONTROLLER_DISCONNECTED`를 보내고(`wsServer.ts` `ws.on('close')`), 폰이 `DEVICE_CHECK`로 돌아오면 이미 등록된 플레이어에게 `CONTROLLER_PAIRED`를 보낸다. 새 서버 메시지는 필요 없다.
- 재연결 중에는 `이어하기`가 눌리지 않아야 한다. 폰이 없으면 조준할 수 없고, 카운트다운이 끝나자마자 억울하게 맞는다.
- 현재 PC `CONTROLLER_DISCONNECTED` 처리는 연사 타이머만 정리한다.

## Implementation

### I01. 연결 상태와 자동 일시정지
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `case 'ERROR'`(CONTROLLER_DISCONNECTED), `case 'CONTROLLER_PAIRED'`, `handleCloseGuide`, Esc 핸들러; modify

#### Details
- **Signatures & Types**:
  ```ts
  const [isControllerConnected, setIsControllerConnected] = useState<boolean>(false);
  ```
- **Execution Flow / Logic**:
  1. `case 'CONTROLLER_PAIRED'`: 기존 처리 뒤에 `setIsControllerConnected(true)`. 이미 `pauseMenu.reason === 'CONTROLLER_LOST'`로 열려 있으면 메뉴는 그대로 열어 둔다(오버레이가 `isControllerConnected`로 문구만 바꾼다).
  2. `case 'ERROR'` `CONTROLLER_DISCONNECTED`: 기존 연사 타이머 정리 뒤 `setIsControllerConnected(false)`. `gamePhaseRef.current === 'PLAYING'`이면: 메뉴가 이미 열려 있지 않을 때 `handleOpenPause('CONTROLLER_LOST')`를 호출(내부에서 `canOpenPauseMenu` 통과 시 일시정지). 사용자가 이미 `USER`로 메뉴를 연 상태라면 `reason`을 `CONTROLLER_LOST`로 바꾼다(`setPauseMenu({open:true, reason:'CONTROLLER_LOST'})`, 엔진은 이미 일시정지).
  3. 소켓 콜백은 렌더 밖에서 실행되므로 `handleOpenPause`는 `useRef`로 최신 함수를 들고 호출한다(`handleOpenPauseRef.current = handleOpenPause`). 현재 코드도 `startCountdownAndGameRef` 방식을 쓴다.
  4. `handleCloseGuide`: 재개 카운트다운을 시작하기 전에 `!isControllerConnectedRef.current`이면 카운트다운 대신 `setPauseMenu({open:true, reason:'CONTROLLER_LOST'})`로 메뉴를 연다(엔진은 이미 일시정지 상태 유지). 단, PAIRING 등 폰과 무관한 단계에서는 기존 동작.
  5. Esc 핸들러(T01): `reason === 'CONTROLLER_LOST' && !isControllerConnected`이면 이어하기를 하지 않는다(무시). 연결 상태 값은 ref로 읽는다.

### I02. 오버레이 문구·비활성
- Related Files:
  - `src/pc/components/PauseMenuOverlay.tsx` :: `PauseMenuOverlay`; modify

#### Details
- `reason === 'CONTROLLER_LOST' && !isControllerConnected`: 제목 `📡 폰 재연결 중...`, 부제 `폰 화면을 켜고 연결을 기다려 주세요`, `이어하기` 버튼은 `disabled`(흐린 스타일, 클릭 무시), `다시시작`은 활성.
- `reason === 'CONTROLLER_LOST' && isControllerConnected`: 제목 `✅ 폰이 다시 연결되었습니다`, 이어하기 활성.
- `reason === 'USER'`: 변경 없음(`isControllerConnected` 무시).

### I03. 테스트
- Related Files:
  - `tests/pause-menu.test.ts` :: 추가 케이스; modify

#### Details
- `renderToStaticMarkup`: `CONTROLLER_LOST`+미연결 → `폰 재연결 중` 포함, 이어하기 버튼 `disabled` 속성 존재. `CONTROLLER_LOST`+연결 → `다시 연결되었습니다` 포함, `disabled` 없음. `USER`+미연결 → `disabled` 없음.
- 서버 통합(`tests/room-persistence.test.ts`): 폰 소켓을 닫으면 PC가 `CONTROLLER_DISCONNECTED`를 받고, 같은 `deviceId`·닉네임으로 폰이 다시 `DEVICE_CHECK`하면 PC가 `CONTROLLER_PAIRED`를 받는다(등록된 플레이어를 `REGISTER_NICKNAME`으로 먼저 만들어 둔다).

## Acceptance Criteria
- [ ] 게임 중 폰 소켓이 끊기면 몇백 ms 내 일시정지 메뉴가 뜬다.
- [ ] 끊긴 동안 이어하기가 비활성이고 Esc로도 재개되지 않는다.
- [ ] 재연결되면 문구가 바뀌고 이어하기를 눌러야만 재개된다.
- [ ] 로비·결과 화면에서 폰이 끊겨도 일시정지 메뉴는 뜨지 않는다.

## Validation
- `npx vitest run tests/pause-menu.test.ts tests/room-persistence.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(pause): pause automatically when the controller drops

Plan: 2026-11-06-controller-persistence-and-pause
Phase: P02-pause-menu
Task: T02-auto-pause-on-disconnect

- open the pause menu on CONTROLLER_DISCONNECTED while playing
- disable resume until the controller pairs again
- show reconnecting / reconnected states in the overlay
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
