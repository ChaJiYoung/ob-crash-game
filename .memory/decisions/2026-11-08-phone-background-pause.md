# Decisions: 폰 화면 꺼짐 시 일시정지

- Date: 2026-11-08
- Status: Confirmed

## D01. 증상과 원인
- **Chosen**: 폰 화면이 꺼지거나 앱이 백그라운드로 가도 PC가 일시정지하지 않는다. 폰이 보내는 `visibilitychange(hidden)` 신호는 임시 진단 로그(`DEBUG_LOG`)로만 쓰이고 PC에 전달되지 않는다.
- **Rationale**: 서버가 PC에 `CONTROLLER_DISCONNECTED`를 보내는 경우는 `ws.on('close')`와 슬롯 이동뿐이다(`server/wsServer.ts`). 실기기 로그에서 화면이 꺼진 뒤 센서 프레임이 멈췄지만 서버 소켓은 `ESTABLISHED`로 남아 있었다(폰 → 터널 → vite 프록시 → 서버 경로의 중간 경유지가 연결을 붙잡는 것으로 보임). 서버·PC에 하트비트가 없어 연결이 소리 없이 멈추면 감지할 방법이 없다.

## D02. 감지 방식 (사용자 선택)
- **Chosen**: 두 가지를 함께 쓴다. (1) 화면이 꺼질 때 폰이 "백그라운드" 신호를 보낸다. (2) 서버가 센서 프레임이 끊기는 것을 안전망으로 감지한다.
- **Rationale**: (1)은 즉시 동작하지만 앱이 먼저 얼면 신호를 못 보낸다. (2)는 신호가 없어도 잡지만 2~3초 늦다. 둘을 합치면 빠르고 빠짐이 없다.

## D03. 잠깐 꺼짐 무시 (사용자 선택)
- **Chosen**: 폰은 `hidden` 후 1초 넘게 `visible`로 돌아오지 않을 때만 "백그라운드" 신호를 보낸다. 1초 안에 돌아오면 아무 신호도 보내지 않는다.
- **Rationale**: 알림 센터를 잠깐 내리는 정도로 일시정지와 재개 카운트다운이 걸리면 플레이가 자주 끊긴다.

## D04. 서버 전달 방식 (코드 확인으로 확정)
- **Chosen**: 폰이 새 메시지 `CONTROLLER_BACKGROUND`(`roomId`, `deviceId`, `slot`)를 보내면, 서버는 소켓을 제거하지 않고 PC에 기존과 같은 `ERROR code: CONTROLLER_DISCONNECTED`(`slot` 포함)를 보낸다.
- **Rationale**: PC는 이미 이 메시지로 슬롯 연결 해제 표시, 일시정지, 유예 카운트다운(`disconnectGraceMs`)을 처리한다. 새 PC 로직 없이 재사용한다. 소켓은 살아 있으므로 지우면 안 된다.

## D05. 복귀 방식 (코드 확인으로 확정)
- **Chosen**: 화면이 다시 켜졌을 때(`visible`) 폰이 "백그라운드" 신호를 보낸 적이 있고 소켓이 열려 있으면, 재연결할 때와 똑같이 `DEVICE_CHECK`를 다시 보내고 `AUTH_RESULT`를 받으면 `CALIBRATE_ZERO`(`resume: true`)를 보낸다. 소켓이 닫혀 있으면 기존 재연결 경로를 그대로 쓴다.
- **Rationale**: 서버의 `attachControllerSocket`은 같은 `deviceId`의 재연결을 허용하고, 그 뒤 `CONTROLLER_PAIRED`가 PC로 가서 슬롯이 연결 상태로 돌아온다. `resume: true`면 PC가 영점을 유지한 채 재개 카운트다운으로 넘어간다(`onSlotReconnected`). 현재 `reviveIfDead`는 소켓이 열려 있으면 아무것도 하지 않아 이 경우가 빠져 있다.

## D06. 서버 안전망 (사용자 선택 + 값은 자동 확정)
- **Chosen**: 서버가 컨트롤러마다 마지막 `SENSOR_FRAME` 수신 시각을 기록하고, 1초마다 확인해서 3초 넘게 프레임이 없으면 D04와 같은 `CONTROLLER_DISCONNECTED`를 PC에 보낸다(컨트롤러당 한 번). 이후 같은 컨트롤러의 프레임이 다시 오면 복귀로 보고, 폰이 재연결할 때와 같은 알림(`CONTROLLER_PAIRED` 후 `ZERO_CALIBRATED`의 `resume: true`)을 PC에 보낸다.
- **Rationale**: 3초는 센서 스트림(초당 약 35프레임)이 정상일 때 거짓 감지가 없고, 일시정지가 너무 늦지도 않은 값이다. 안정성이 떨어지면 계획 단계에서 조정한다. 프레임이 다시 오기만 하고 폰 쪽 재연결 절차가 없는 경우에도 PC가 정상 상태로 돌아와야 해서 복귀 알림이 필요하다.

## D07. 적용 단계 (코드 확인으로 확정)
- **Chosen**: 게임 단계(로비, 플레이 중, 결과)와 관계없이 동일하게 처리한다. PC의 기존 `CONTROLLER_DISCONNECTED` 처리가 단계별로 분기하므로 서버와 폰은 단계를 몰라도 된다.
- **Rationale**: 소켓이 닫혔을 때와 같은 동작이어야 일관되고, 서버는 게임 단계를 알지 못한다.

## D08. 중복 알림 방어 (코드 확인으로 확정)
- **Chosen**: 같은 슬롯의 `CONTROLLER_DISCONNECTED`가 연속으로 오면(예: 백그라운드 신호 뒤 소켓이 닫힘, 또는 신호와 프레임 끊김 감지가 겹침) PC가 유예 카운트다운의 기한을 다시 시작하지 않는다.
- **Rationale**: 현재 PC 핸들러(`PCGamePage.tsx`의 `CONTROLLER_DISCONNECTED` 처리)는 같은 슬롯에 대해 유예를 새로 시작하므로, 중복 알림이 오면 카운트다운이 계속 늘어난다.

## D09. 임시 진단 코드와 순서
- **Chosen**: 이 작업은 진행 중인 `센서 복구` 계획(P02-T02 실기기 테스트, T03 정리)과 같은 파일(`MobileControllerPage.tsx`, `server/wsServer.ts`)을 건드린다. 계획 단계에서 순서를 정한다. 임시 진단 코드(`TEMP(sensor-debug)`)는 이 작업의 `visibility`/`CONTROLLER_BACKGROUND` 신호가 생기면 중복되므로, 이 작업이 끝난 뒤 센서 복구 T03에서 함께 제거한다.
- **Rationale**: 두 작업이 같은 위치를 건드려 충돌하기 쉽고, 진단 로그는 실기기 검증이 끝나기 전까지 필요하다.

## D10. 검증
- **Chosen**: (1) 서버 단위 테스트: `CONTROLLER_BACKGROUND` 수신 시 PC에 `CONTROLLER_DISCONNECTED`가 가고 소켓은 유지된다, 프레임이 3초 끊기면 한 번만 알린다, 프레임 재개 시 복귀 알림이 간다. (2) PC 단위 테스트: 같은 슬롯의 중복 `CONTROLLER_DISCONNECTED`가 유예 기한을 늘리지 않는다. (3) 폰 소스 가드 테스트: 1초 지연, 복귀 시 `DEVICE_CHECK` 재전송. (4) 실기기: 1P 폰/2P 마우스에서 화면을 껐다 켜서 일시정지와 재개 확인.
- **Rationale**: 소켓이 열린 채로 멈추는 상황은 실제 기기에서만 재현되므로 자동 테스트와 실기기 확인을 같이 한다.

## D11. 계획 단계 보정: 1초 대기는 서버가 맡는다
- **Chosen**: D03의 "1초 넘게 꺼졌을 때만 처리"를 폰의 타이머가 아니라 서버의 타이머로 구현한다. 폰은 `hidden`이 되는 즉시 `CONTROLLER_BACKGROUND`를, `visible`이 되는 즉시 `CONTROLLER_FOREGROUND`를 보낸다. 서버는 BACKGROUND를 받으면 1초를 기다리고, 그 사이 FOREGROUND가 오지 않으면 PC에 `CONTROLLER_DISCONNECTED`를 보낸다. 폰은 숨겨져 있던 시간이 0.5초 이상이면 복귀 때 `DEVICE_CHECK` 재전송(D05)도 한다.
- **Rationale**: 화면이 꺼지면 폰의 JS 타이머가 얼어서 "1초 뒤에 보낸다"가 영영 실행되지 않을 수 있다(실기기 로그에서 `hidden` 직후 프레임이 멈췄다). 서버 타이머는 얼지 않는다. 사용자에게 보이는 동작은 D03과 같다. 폰의 복귀 임계값(0.5초)을 서버 대기(1초)보다 짧게 잡아, 서버가 이미 PC에 알렸는데 폰이 복귀 절차를 건너뛰는 틈을 없앤다(불필요한 재전송은 해롭지 않다). 시간 측정은 기기가 잠들면 멈출 수 있는 `performance.now()`가 아니라 `Date.now()`를 쓴다.

## D12. 계획 통합
- **Chosen**: `센서 복구`(진행 중), `허용 직후 자동 영점`, `백그라운드 일시정지` 세 작업을 `2026-11-08-phone-lifecycle-fixes` 한 계획으로 통합한다. 센서 복구 계획의 남은 P02-T02(실기기 테스트)·T03(정리)는 새 계획의 마지막 Phase로 흡수한다.
- **Rationale**: 세 작업이 같은 파일과 같은 임시 진단 코드를 공유한다. 실기기 테스트와 임시 코드 제거를 한 번에 하면 서버 재시작과 폰 테스트 횟수가 줄고, 파일 충돌이 없다.
