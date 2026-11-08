# Decisions: 폰 복귀를 "게임으로 돌아가기" 버튼으로

- Date: 2026-11-08
- Status: Confirmed
- Supersedes: `2026-11-08-phone-background-pause` D05·D06의 자동 복귀 부분, `2026-11-08-controller-sensor-revive-after-screen-off` D03·D06③의 자동 재등록 부분

## D01. 배경 (실기기 로그)
- **Chosen**: 자동 복귀를 없애고 사용자가 버튼을 눌러 복귀한다.
- **Rationale**: 테스트 폰은 화면이 꺼지면 2~3초 안에 소켓을 닫고, 켜면 페이지를 처음부터 다시 연다(로그: `socket-closed` → `device-check` → 초록 버튼 뒤 `orientation-first`가 3회 반복). 같은 페이지 자동 복귀, 프레임 재개 복귀, 센서 워치독이 이 폰에서는 쓰이지 않았고, 기기마다 동작이 달라 경로가 계속 늘었다. 일시정지 알림(서버 `BACKGROUND` 1초 대기)은 정상 동작했다.

## D02. 영점 (사용자 선택)
- **Chosen**: 버튼을 누른 순간 폰이 향한 방향을 새 정면 영점으로 잡는다. 폰은 `resume` 없는 `CALIBRATE_ZERO`를 보내고 PC도 보정값을 초기화한다. 버튼 안내 문구에 "모니터 중앙을 겨누고 누르세요"를 넣는다.
- **Rationale**: 페이지가 새로 열리면 영점은 어차피 사라진다. 초록 버튼 자동 영점과 같은 경로라 하나로 통일된다. PC는 게임 중 `ZERO_CALIBRATED`를 받으면 `resume` 여부와 관계없이 `isConnected: true`로 바꾸고 재개 절차(`onSlotReconnected`)로 넘어간다(`PCGamePage.tsx`).

## D03. 버튼 노출 조건 (사용자 선택)
- **Chosen**: 같은 페이지가 유지된 채 화면이 1초 넘게 꺼졌다 돌아오면, 게임 단계와 관계없이 패드 위에 "게임으로 돌아가기" 버튼을 덮어 보여 준다. 누르기 전에는 패드 조작을 막는다. 페이지가 새로 열린 경우는 기존 초록 버튼(권한 허용 + 자동 영점)이 같은 역할을 하므로 새 버튼을 띄우지 않는다.
- **Rationale**: 서버가 PC에 끊김을 알리는 기준(1초)과 같아서, 버튼이 보이면 PC도 항상 멈춰 있다. 로비에서도 PC 슬롯이 "연결 끊김"으로 바뀌므로 같은 버튼으로 되돌린다.

## D04. 버튼을 누르면 (코드 확인으로 확정)
- **Chosen**: (1) iOS면 `DeviceOrientationEvent.requestPermission()`을 다시 호출(사용자 터치 안에서) (2) 센서 리스너를 재등록(`sensorEpoch` 증가) (3) 첫 센서 이벤트 뒤(최대 1초) `handleCalibrateZero` 실행 → `CALIBRATE_ZERO` 전송 (4) 버튼을 닫는다. 소켓이 닫혀 있으면 기존 재연결 경로가 붙은 뒤 다시 누를 수 있게 버튼을 유지한다.
- **Rationale**: 초록 버튼의 권한 요청·자동 영점 흐름(`LoginAndPermissionGate`, `runAutoZero`)을 재사용한다. iOS는 센서 권한에 사용자 터치가 필요한데 버튼이 그 터치를 겸한다.

## D05. 유지하는 것 (코드 확인으로 확정)
- **Chosen**: 폰의 `CONTROLLER_BACKGROUND`(숨김 즉시) / `CONTROLLER_FOREGROUND`(복귀 즉시, 1초 대기 취소용), 서버의 1초 대기 알림과 프레임 3초 끊김 알림, PC 중복 알림 방어, PC 자동 재연결, 서버 close 중복 방지, 소켓이 닫혔다 다시 붙을 때 기존 `AUTH_RESULT` → `CALIBRATE_ZERO(resume)` 자동 복귀(화면이 켜진 채 네트워크만 끊긴 경우).
- **Rationale**: 모두 "멈추는" 쪽이거나 화면 꺼짐과 무관한 경로다.

## D06. 제거하는 것 (코드 확인으로 확정)
- **Chosen**: (1) 폰 `onBackgroundSignals`의 복귀 시 `DEVICE_CHECK` 재전송 (2) 서버의 프레임 재개 복귀 알림(`notifyControllerBack`)과 `backgrounded` 집합 — `ControllerWatch`는 `lost`가 된 키를 프레임이 와도 풀지 않고, 폰의 `CALIBRATE_ZERO`(그 소켓에서 온 것)나 `DEVICE_CHECK`, 소켓 종료 때만 푼다 (3) 폰의 화면 복귀 자동 센서 재등록과 `SensorLiveness` 워치독(재등록은 버튼만 한다), `SensorLiveness`와 그 테스트.
- **Rationale**: 복귀 경로를 "버튼 → `CALIBRATE_ZERO`" 하나로 줄인다. 프레임이 와도 `lost`를 풀지 않으면 숨겨진 폰의 드문 프레임 때문에 PC가 재개되거나 3초마다 끊김 알림이 반복되는 일이 없다.

## D07. 버튼 대기 중 자동 복귀 막기 (코드 확인으로 확정)
- **Chosen**: 돌아가기 버튼이 떠 있는 동안 소켓이 다시 붙어도 `AUTH_RESULT`의 자동 `CALIBRATE_ZERO(resume)`를 보내지 않는다(버튼이 처리한다).
- **Rationale**: 같은 페이지에서 소켓도 끊겼다 다시 붙는 경우, 기존 재연결 경로가 버튼보다 먼저 PC를 재개시켜 버튼과 영점이 어긋난다.

## D08. 알려진 한계
- **Chosen**: 화면이 켜진 채 소켓은 살아 있고 프레임만 3초 끊겼다가 다시 오는 경우(드묾), PC는 멈춰 있고 폰에는 버튼이 뜨지 않는다. 이번에는 다루지 않고 실기기 테스트에서 발생하면 다시 본다.
- **Rationale**: 폰은 이 상황을 스스로 알 수 없고, 서버→폰 알림을 새로 만들어야 해 범위가 커진다.

## D09. 검증
- **Chosen**: 서버 통합 테스트(프레임이 다시 와도 `lost` 유지·PC 재개 없음, `CALIBRATE_ZERO`로 해제), 폰 소스 가드(버튼 노출 조건, 버튼 대기 중 `AUTH_RESULT` 자동 복귀 차단, 자동 재등록·워치독 제거), 실기기 시나리오(화면 껐다 켜기 → 버튼 → 재개와 조준, 페이지 재로드 → 초록 버튼 → 재개).
- **Rationale**: 자동 경로를 지운 뒤 남은 단일 경로를 테스트로 고정한다.
