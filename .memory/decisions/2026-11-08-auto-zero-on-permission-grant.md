# Decisions: 센서 권한 허용 직후 자동 영점

- Date: 2026-11-08
- Status: Confirmed

## D01. 증상과 원인
- **Chosen**: 로비에서 폰 센서 권한 허용(초록 버튼)을 눌러도 PC에 조준경이 뜨지 않고, 폰의 영점 버튼을 한 번 더 눌러야 뜬다. 원인은 PC 쪽 표시 조건이 `main`과 달라진 것이다.
- **Rationale**: `main`의 PC 로비 조준경 조건은 `(isZeroCalibrated || pairedPlayer)`라서 폰이 연결되기만 해도 보였다. `feature/1p-2p`는 2인용 로비로 바꾸면서 `slots.some(mobile && isZeroCalibrated)`(`PCGamePage.tsx:1644`)가 되었고, `isZeroCalibrated`는 폰이 `CALIBRATE_ZERO`를 보낼 때만 켜진다. 폰의 `handlePermissionGranted`는 `main`과 동일하며 `CALIBRATE_ZERO`를 보내지 않는다. 시작 게이트(`isSlotReady`, `coopSlots.ts`)도 `isZeroCalibrated`를 요구해서 영점 버튼을 눌러야 게임도 시작된다.

## D02. 해결 방식 (사용자 선택)
- **Chosen**: 센서 권한 허용 직후 폰이 자동으로 영점 신호(`CALIBRATE_ZERO`)를 PC에 보낸다. PC 쪽 표시 조건과 시작 게이트는 바꾸지 않는다.
- **Rationale**: `main`에서는 폰의 `GunGripTracker`가 첫 센서값에서 스스로 영점을 잡았다(`computeAim`의 `!isCalibrated`). 폰은 이미 허용 순간을 영점으로 쓰는데 PC가 그 사실을 모르는 상태이므로, 그 사실을 PC에 알리면 조준경과 시작 준비가 함께 해결된다. 영점이 어긋나면 폰의 영점 버튼으로 다시 맞춘다.

## D03. 첫 센서값을 기다린 뒤 영점 (코드 확인으로 확정)
- **Chosen**: 허용 직후 `deviceorientation` 첫 이벤트가 올 때까지 기다린 뒤 영점 처리(`handleCalibrateZero` 경로)를 한다. 1초 안에 이벤트가 없으면(센서가 없는 데스크톱 등) 그대로 영점 신호를 보낸다.
- **Rationale**: 허용 직후에는 `latestOrientationRef`가 초기값 (0,0,0)이다. 그대로 영점을 잡으면 폰이 실제로 향한 방향이 아니라 (0,0,0) 자세가 중앙이 되어 조준이 크게 어긋난다. 데스크톱 브라우저는 이벤트가 오지 않을 수 있어 폴백이 없으면 영원히 영점이 안 된다.

## D04. 적용 범위 (코드 확인으로 확정)
- **Chosen**: 1P·2P 폰 모두 같은 코드(`handlePermissionGranted`)를 쓰므로 둘 다 적용한다. 허용 버튼은 로그인 게이트에서만 나타나므로 이미 영점을 잡은 뒤 재연결하는 경우(`resume: true` 경로)에는 영향이 없다.
- **Rationale**: 폰 컨트롤러는 슬롯과 무관하게 같은 컴포넌트다. 재연결은 `AUTH_RESULT`의 `resume` 경로로 처리되고 허용 버튼을 거치지 않는다.

## D05. 검증
- **Chosen**: 소스 가드 테스트로 "허용 처리가 첫 센서값을 기다린 뒤 영점을 보내고, 폴백 타이머가 있다"를 확인하고, 마지막에 실기기(1P 폰/2P 마우스, 2P 폰)에서 허용 버튼만으로 조준경이 뜨고 시작 가능한지 확인한다.
- **Rationale**: 센서 첫 이벤트 시점과 브라우저별 권한 동작은 실기기에서만 확인할 수 있다.
