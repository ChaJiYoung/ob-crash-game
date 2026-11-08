# Decisions: 미지원 폰 차단과 센서 테스트장 숨기기

- Date: 2026-11-08
- Status: Confirmed

## D01. 미지원 기기 판별 기준 (사용자 선택)
- **Chosen**: 센서 실측 판별. 폰이 센서 권한을 허용한 직후 약 1초간 `devicemotion`/`deviceorientation`을 관찰한다. 센서 이벤트가 1초 안에 전혀 오지 않거나 `rotationRate`가 계속 `null`이면 미지원으로 판정한다. 값이 0에 가깝다는 이유로는 막지 않는다. 판정 로직은 순수 함수로 분리해 단위 테스트한다.
- **Rationale**: 브라우저에서 모델명을 안정적으로 알 수 없다(iPhone은 모델 비공개, Android는 UA가 축약되고 Client Hints는 Chrome 계열·HTTPS만 가능). 하드웨어 자이로가 없는 보급형(가상 자이로)은 `rotationRate`가 `null`이라 모델 목록 없이 판별된다. 가만히 든 정상 기기는 `rotationRate`가 `null`이 아니라 작은 숫자라서 "0에 가깝다"로 막으면 오차단이 난다.

## D02. 차단 강도 (사용자 선택)
- **Chosen**: 완전 차단. 우회 버튼이 없다. 폰에는 "이 기기는 센서가 지원되지 않아요. 다른 폰으로 접속해 주세요" 화면만 보이고 재시도하지 않는다.
- **Rationale**: 지난번 센서 안정화로도 해결되지 않았고, 구형 기기를 지원하지 않기로 했다. 경고만 하면 같은 문제가 반복된다.

## D03. PC 쪽 처리 (사용자 선택)
- **Chosen**: 폰이 새 메시지 `DEVICE_UNSUPPORTED`를 서버에 보낸다. 서버는 해당 슬롯을 비우고(연결 전 상태로 되돌림) PC에 안내를 띄운다("지원하지 않는 기기가 연결을 시도했어요. 다른 폰으로 접속해 주세요"). 같은 QR로 다른 폰이 들어올 수 있어야 한다. `deviceId`를 서버에 기억하는 것은 하지 않는다.
- **Rationale**: 폰은 페이지를 열면 바로 `DEVICE_CHECK`로 슬롯에 등록되고(`MobileControllerPage.tsx:164`), iOS는 사용자 터치 후에만 센서를 볼 수 있어서 판별이 등록 뒤에 나온다. PC가 모르면 "연결됐는데 에임이 안 움직이는" 상태로 남는다. 판정 기록을 서버에 저장하면 오판이 영구히 남는다.

## D04. 개발 모드 우회 (사용자 선택)
- **Chosen**: `import.meta.env.DEV`일 때만 판별을 건너뛴다. 배포 빌드에는 URL 파라미터 같은 우회 수단을 두지 않는다.
- **Rationale**: 개발자가 PC 브라우저로 폰 화면 디자인을 볼 수 있어야 한다. 현재 데스크톱은 센서 이벤트가 없어도 "허용"으로 처리되므로(`SensorPermission.ts`), 판별 도입 시 PC 브라우저가 막히는 부작용을 개발 모드에서만 푼다.

## D05. 센서 테스트장 접근 (사용자 선택)
- **Chosen**: 주소는 지금처럼 `/sensor-test`(및 `?mode=test`)를 그대로 쓰고, 일반 사용자에게 보이는 진입 버튼 3곳을 제거한다. (1) `QRPairingModal.tsx`의 "영점·센서 & 모듈 테스트장" 버튼 (2) `ArcadeOverlayHUD.tsx`의 `onOpenSensorLab` 버튼 (3) `PCGamePage.tsx`의 PAIRING/ZEROING 우상단 "모바일 센서 진단 & 안정화 랩" 플로팅 버튼. 관련 props(`onOpenSensorLab` 등)는 쓰이지 않게 되면 함께 정리하고, `SANDBOX` 모드에서 센서 랩 모달은 계속 열려야 한다.
- **Rationale**: 변경이 가장 작고 `resolveRouteMode` 테스트가 그대로 유지된다. 센서 진단만 보여 주는 화면이라 접근 통제가 필요하지 않다.

## D06. 기존 안정화 프리셋 (사용자 선택)
- **Chosen**: 그대로 둔다. `OneEuroFilter.ts`, `MobileSensorLabModal`의 프리셋, `PhoneAdapter`의 튜닝 설정, 관련 테스트는 건드리지 않는다.
- **Rationale**: 이번 작업은 "차단"과 "버튼 숨기기"만 한다. 필터는 지원 기기에서도 손떨림을 줄일 수 있고, 지우면 변경 범위와 테스트 수정이 크게 늘어난다.

## D07. 센서 랩 모달 높이 흔들림 수정 (사용자가 증상 보고, 코드로 원인 확정)
- **Chosen**: `PCGamePage.tsx:652`의 `setSensorLiveMetrics({...})`를 `setSensorLiveMetrics((prev) => ({ ...prev, ... }))`로 바꿔 `fps`, `drawCalls`, `geometries`, `textures`가 지워지지 않게 한다. 회귀 테스트를 추가한다(센서 프레임이 렌더 지표를 지우지 않는지).
- **Rationale**: 센서 프레임(약 60ms)이 상태 객체를 통째로 교체하며 렌더 지표 필드를 `undefined`로 만들고, 렌더 지표(250ms)가 다시 채운다. 모달은 `typeof metrics.fps === 'number'`일 때만 "렌더 성능"·"GPU 메모리" 두 줄을 그리므로(`MobileSensorLabModal.tsx:398,407`) 두 줄이 켜졌다 꺼지며 모달 높이가 움찔거린다.

## D08. 문서·안내 동기화 (코드 확인으로 확정)
- **Chosen**: 버튼 제거와 차단 동작에 맞게 `README.md`의 폰 연결 안내에 "센서가 없는 폰은 연결할 수 없다"를 한 줄 추가한다. `README.md`는 `tests/docs-sync.test.ts`가 읽으므로 규칙을 어기는 문구를 넣지 않는다. 버튼 문구를 검사하는 기존 테스트(`tests/pc-modals-and-pairing.test.ts` 등)는 새 동작에 맞게 고친다. `docs/` 아래 발표 자료는 건드리지 않는다.
- **Rationale**: README는 사용자가 따라 하는 설명서다. 발표 자료는 별도 산출물이라 이번 범위 밖이다.

## D09. 안정화 코드의 후속 처리 (사용자 선택)
- **Chosen**: 지금은 그대로 두고 따로 메모하지 않는다. (D06 확정)
- **Rationale**: 가상 자이로 기기를 막으면 "강력 안정화 모드"를 쓸 일이 줄지만, 지원 기기의 손떨림 완화에도 쓸 수 있고 남겨 두어도 게임에 해롭지 않다. 필요해지면 그때 판단한다.

## D10. 실기기 검증 Phase (사용자 선택)
- **Chosen**: 계획의 마지막 Phase로 "실기기 검증"을 둔다. 지난번 문제가 된 보급형 폰(차단되는지)과 정상 폰(iPhone 13 mini 등, 통과하는지)을 각각 연결해 확인한다. 보급형 폰이 없으면 그 항목만 "미확인"으로 남긴다. 결과가 기대와 다르면 판별 규칙을 고치는 후속 작업을 한다.
- **Rationale**: "보급형은 `rotationRate`가 `null`로 온다"는 가정은 코드·문서로 확인할 수 없고, 틀리면 막아야 할 폰이 통과하거나 정상 폰이 막힌다(완전 차단이라 구제도 불가). 임시 진단 화면은 쓰고 지워야 할 코드만 늘려 두지 않는다.

## D11. 배포 환경의 PC 브라우저 (사용자 선택)
- **Chosen**: 배포 환경에서 PC 브라우저로 폰 화면을 열면 센서가 없어 "지원하지 않는 기기"로 막혀도 된다. 별도 예외를 두지 않는다.
- **Rationale**: PC에는 마우스로 플레이하는 모드가 이미 있어 폰 화면이 꼭 필요하지 않다. D02의 완전 차단과 일관된다.

## D12. 센서 권한 요청 코드는 변경하지 않는다 (사용자 선택)
- **Chosen**: `src/controller/sensors/SensorPermission.ts`의 `requestSensorPermission`은 그대로 둔다(오류는 `'granted'`로 처리). 센서 실측 판별은 권한 허용 다음 단계로 따로 추가하며, 센서 데이터가 오지 않으면 판별이 최종적으로 차단한다.
- **Rationale**: 권한은 "받았는지"만, 판별은 "센서가 실제로 되는지"만 본다. 역할이 나뉘고 `tests/sensor-permission.test.ts`를 고칠 필요가 없다.
