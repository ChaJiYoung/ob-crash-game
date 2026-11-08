# Decisions: 폰 화면 꺼짐 후 재연결 시 조준 고정 수정

- Date: 2026-11-08
- Status: Confirmed


> **대체됨(2026-11-08)**: 자동 복귀 부분은 [2026-11-08-return-button](./2026-11-08-return-button.md)의 "게임으로 돌아가기" 버튼 방식으로 바뀌었다. 아래 내용 중 자동 복귀·자동 센서 재등록·워치독은 더 이상 코드에 없다.

## D01. 증상과 원인 가설
- **Chosen**: 1P 폰 / 2P 마우스 상태에서 폰 화면이 꺼졌다 켜진 뒤 재연결되면, 발사는 되지만 십자선과 탄착점이 화면 정중앙(0,0)에 고정된다. 원인은 폰 쪽 `deviceorientation`/`devicemotion` 리스너가 화면 복귀 후 재개되지 않는 것으로 본다.
- **Rationale**: `MobileControllerPage.tsx`의 `visibilitychange` 처리(`reviveIfDead`)는 WebSocket 재연결만 한다. 센서 리스너는 `sensorsActive`가 켜질 때 한 번만 등록되고 재등록 경로가 없다. 발사는 터치 기반이라 계속 되고 조준값만 멈추는 증상과 일치한다. PC 쪽 경로(`SENSOR_RELAY` → `PhoneAdapter` → `PlayerActionProcessor` → `onAim`)는 정상으로 확인했다. 실기기 검증은 아직 안 했다.

## D02. 수정 위치
- **Chosen**: 폰 컨트롤러(`src/controller/MobileControllerPage.tsx`)만 수정한다. PC 코드는 건드리지 않는다.
- **Rationale**: PC는 들어온 센서 프레임을 그대로 반영하고 있어서 문제가 없다.

## D03. 복구 방식
- **Chosen**: 화면이 다시 보일 때(`document.visibilityState === 'visible'`) 센서 리스너를 해제 후 재등록한다. 영점은 기존 값을 유지하고 자동 재영점은 하지 않는다.
- **Rationale**: 폰을 들고 바로 이어서 쏠 수 있고, 재연결 시 영점을 유지하는 기존 방식(`CALIBRATE_ZERO` + `resume: true`)과 일관된다. 각도가 어긋나면 폰 화면의 영점 버튼으로 맞추면 된다.

## D04. 회귀 방지 상태 정리
- **Chosen**: 센서 재등록 시 조준 잠금(`tracker.lockAim`)과 스냅 동결 타이머가 남아 있으면 같이 해제한다.
- **Rationale**: 화면이 꺼지는 동안 타이머가 멈추면 `snapFreezeTimerRef`가 실행되지 못해 조준이 고정된 채 남을 수 있다. 복구 시 같은 증상이 다른 경로로 재발하지 않게 한다.

## D06. 함께 처리할 범위 (사용자 확정)
- **Chosen**: 본 수정 + ① `PhoneAdapter.autoZeroFromLatest` 영점 누적 오류 수정 + ③ 센서 이벤트 정지 워치독. ② 처리기 재생성 시 조준값 초기화는 제외.
- **Rationale**: 셋 다 폰 컨트롤러와 `PhoneAdapter` 안에서 끝나고 같은 증상 계열이라 한 번에 검증할 수 있다. ②는 처리기 생성 흐름을 건드려 회귀 위험이 있고, 첫 센서 프레임이 오면 바로 덮어써지는 짧은 현상이라 보류한다.
- **① 세부**: `PhoneAdapter`가 마지막 원시 센서값을 저장하고, 영점을 `offset = 마지막 원시값`으로 잡는다. 이미 영점이 적용된 값은 쓰지 않는다.
- **③ 세부**: 폰이 센서 이벤트 마지막 수신 시각을 기록한다. 화면이 보이는 상태에서 일정 시간 이벤트가 없으면 D03의 재등록 함수를 재사용해 리스너를 다시 등록한다. 임계값은 실기기 로그를 보고 정한다.

## D07. 실기기 로그
- **Chosen**: 실행 단계에서 폰 쪽 센서 이벤트 수신 시각과 재등록 시점을 로그로 남기고, 사용자가 로컬 서버에서 테스트한 뒤 로그를 읽어 가설을 확인한다. 확인이 끝나면 임시 로그는 제거한다.
- **Rationale**: 센서 이벤트가 멈추는 동작은 브라우저와 기기에 따라 달라서 실기기 로그로만 확인할 수 있다.

## D08. 조준 잠금 자동 만료 추가 (사용자 확정, 범위 확장)
- **Chosen**: `GunGripTracker`에 조준 잠금 자동 만료를 넣는다. `lockAim(sample, nowMs?)`가 잠근 시각을 기록하고, `expireAimLock(nowMs)`가 `AIM_LOCK_MAX_MS`(600ms)를 넘긴 잠금을 해제한다. 폰이 매 프레임 전송 직전에 `expireAimLock(performance.now())`를 호출한다.
- **Rationale**: 해제를 `setTimeout` 하나에만 맡기면 화면 꺼짐·cleanup으로 타이머가 취소될 때 조준이 영원히 고정된다(D04는 cleanup 경로만 막는다). 시간 기반 만료는 어떤 경로든 막는다. 600ms는 정상 동결 시간(350ms)보다 길어서 정상 동작에는 영향이 없다.
- **호환**: `nowMs`를 생략하면 만료되지 않는다. 기존 테스트(`gameplay-polish`, `controller-sensors`)가 시간 없이 `lockAim`을 호출하므로 동작을 보존해야 한다.

## D09. `__setStep` 전역 노출 제거 (사용자 확정, 범위 확장)
- **Chosen**: `MobileControllerPage.tsx`의 `(window as any).__setStep = setStep;` 블록을 제거한다.
- **Rationale**: 소스·테스트 어디에서도 쓰이지 않는다(grep으로 확인). 프로덕션 코드에 남은 디버그 훅이고 `as any`로 타입 검사를 우회한다.

## D05. 검증
- **Chosen**: `tests/controller-reconnect.test.ts` 계열에 단위 테스트를 추가하고, 마지막에 실기기(폰 화면 껐다 켜기, 1P 폰 / 2P 마우스)에서 확인한다.
- **Rationale**: 센서 이벤트 재등록은 자동 테스트로 흉내 낼 수 있지만, 브라우저가 이벤트를 멈추는 동작은 실기기에서만 확인할 수 있다.
