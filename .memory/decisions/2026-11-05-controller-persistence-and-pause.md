# Decisions: 컨트롤러 연결 유지 + 일시정지 메뉴

- Date: 2026-11-05
- Status: Confirmed

## D01. QR 재스캔이 필요한 두 원인을 모두 해결한다
- **Chosen**: 폰 자동 재연결 + PC 방 코드 유지, 둘 다
- **Rationale**: 코드 확인 결과 원인이 두 곳이다. (1) `MobileControllerPage.tsx`는 소켓 `onclose` 처리와 재연결이 없다. (2) `PCGamePage.tsx`는 로드마다 `CREATE_ROOM`을 방 코드 없이 보내 매번 새 코드가 생긴다. 사용자가 "둘 다"를 선택했다.

## D02. PC 방 코드는 localStorage에 저장한다
- **Chosen**: PC가 방 코드를 localStorage에 저장하고, 시작할 때 `CREATE_ROOM`에 그 코드를 실어 같은 방을 재생성한다. 'QR 새로 발급' 버튼으로 초기화할 수 있다.
- **Rationale**: 창을 닫거나 서버가 재시작돼도 같은 QR이 유효하다. `RoomManager.createRoom(requestedRoomId)`가 이미 지정 코드를 지원하므로 서버 프로토콜 변경이 거의 없다. (사용자 선택)

## D03. 폰은 방 코드를 기억하고 끊기면 자동 재연결한다
- **Chosen**: 폰이 마지막 방 코드를 localStorage에 저장(URL에 `room`이 없으면 이를 사용)하고, 소켓이 끊기면 지수 백오프로 `DEVICE_CHECK`를 재전송한다. `ROOM_NOT_FOUND`면 PC가 돌아올 때까지 재시도하며 '재연결 중' 표시를 띄운다.
- **Rationale**: 서버의 방은 두 소켓이 모두 끊기면 삭제되지만, PC가 D02로 같은 코드를 재생성하므로 서버 유예 시간은 추가하지 않는다. 닉네임은 `deviceId`로 이미 서버에 저장돼 재입력이 없다. (코드로 자동 확정)

## D04. 일시정지는 PC 화면 버튼과 Esc 키만 둔다
- **Chosen**: PLAYING 단계에서만 PC 화면의 일시정지 버튼과 Esc 키로 일시정지한다. 폰에는 버튼을 두지 않는다.
- **Rationale**: 사용자가 "PC 화면 버튼 + Esc 키만"을 선택했다. 폰 센서는 일시정지 중 사격 입력을 무시한다. TUTORIAL과 SANDBOX는 범위에서 제외한다. (대상 단계는 코드로 자동 확정)

## D05. 일시정지 메뉴는 이어하기와 다시시작을 제공한다
- **Chosen**: 이어하기는 기존 `startResumeCountdown`(3초 카운트다운과 영점 재정렬)을 재사용한다. 다시시작은 점수를 랭킹에 저장하지 않고 버린 뒤 웨이브 1로 초기화하고 무기 선택 화면부터 새 게임을 시작한다. 폰 연결과 영점 보정은 유지한다.
- **Rationale**: `engine.setPaused()`와 타이머 보정(`freezeTimers`)이 이미 있고 가이드 모달이 같은 방식으로 재개한다. 새 로직을 줄이고 QR과 영점 단계를 다시 거치지 않게 한다. (사용자 선택 + 코드 확인)

## D06. 게임 중 폰 연결이 끊기면 자동 일시정지한다
- **Chosen**: `CONTROLLER_DISCONNECTED` 수신 시 PLAYING이면 자동 일시정지하고 '폰 재연결 중...'을 표시한다. 재연결되면(`CONTROLLER_PAIRED`) 일시정지 메뉴로 전환하며 이어하기를 누를 때까지 진행하지 않는다.
- **Rationale**: 지금은 끊겨도 게임이 계속 돌아 억울하게 죽을 수 있고, 자동 재연결(D03)과 함께 써야 의미가 있다. (사용자 선택)
