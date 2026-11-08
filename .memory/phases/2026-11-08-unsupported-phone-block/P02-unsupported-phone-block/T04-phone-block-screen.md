# Task: T04 폰 차단 화면 연결

## Status: pending

## Goal
폰이 센서 권한을 허용하면 곧바로 센서 판별을 돌리고, 미지원이면 서버에 알린 뒤 "다른 폰으로 접속해 주세요" 차단 화면만 보여 준다. 정상 폰은 지금 흐름(PAD 화면 + 자동 영점)을 그대로 탄다. 개발 모드에서는 판별을 건너뛴다.

## Decision Summary
- D01·D02: 권한 허용 뒤 `probeSensorSupport()`로 판별, 미지원이면 우회 없는 완전 차단.
- D03: 폰은 `DEVICE_UNSUPPORTED`를 보내고 재접속하지 않는다. 서버가 소켓을 닫고 PC 슬롯을 비운다(T02·T03).
- D04: `import.meta.env.DEV`이면 판별을 건너뛴다. 배포 빌드에는 우회 수단이 없다.
- D11: PC 브라우저로 폰 화면을 열면(센서 없음) 배포 환경에서는 막혀도 된다.
- D12: `src/controller/sensors/SensorPermission.ts`는 수정하지 않는다.
- 순서 보장: 판별이 끝나기 전에는 `setSensorsActive(true)`·`setStep('PAD')`·자동 영점 예약(`autoZeroPendingRef`)을 하지 않는다. 그래야 미지원 폰이 PC로 `CALIBRATE_ZERO`를 보내 로비를 "영점 완료"로 만드는 일이 없다.

## Implementation

### I01. 차단 화면 컴포넌트
- Related Files:
  - `src/controller/components/UnsupportedDeviceScreen.tsx` :: `UnsupportedDeviceScreen` — new

#### Details
- **Signatures & Types**:
  ```typescript
  import type { UnsupportedReason } from '../../shared/types';
  export interface UnsupportedDeviceScreenProps { reason: UnsupportedReason }
  export const UnsupportedDeviceScreen: React.FC<UnsupportedDeviceScreenProps>;
  ```
- **Execution Flow / Logic**: 전체 화면(`minHeight: '100vh'`, `LoginAndPermissionGate`와 같은 배경 `#0a0d14`·폰트·카드 스타일)에 📵 아이콘, 제목 "이 기기는 지원하지 않아요", 본문 "조준에 필요한 자이로 센서를 확인할 수 없어서 게임을 할 수 없어요. 다른 폰으로 PC 화면의 QR을 다시 찍어 접속해 주세요." 를 보여 준다. `data-testid="unsupported-device-screen"`, `data-reason={reason}`. 버튼은 두지 않는다(우회·재시도 없음). 하단 작은 글씨로 `reason === 'NO_EVENTS' ? '센서 신호가 들어오지 않았어요.' : '자이로 값이 확인되지 않았어요.'`를 보여 준다.

### I02. 게이트에서 판별 시간 동안 버튼 잠금
- Related Files:
  - `src/controller/components/LoginAndPermissionGate.tsx` :: `LoginAndPermissionGateProps.onPermissionGranted`, `handleRequestPermission`, 버튼 문구(약 182행); modify

#### Details
- **Signatures & Types**:
  ```typescript
  onPermissionGranted: () => void | Promise<void>;
  ```
- **Execution Flow / Logic**: `handleRequestPermission`에서 `await onPermissionGranted();`로 바꾼다(`requestSensorPermission()`을 부르는 위치와 `finally { setIsRequestingPermission(false) }`는 유지). 판별이 도는 약 1초 동안 `isRequestingPermission`이 `true`라서 버튼이 잠긴다. 문구는 `'권한 요청 중...'` → `'센서 확인 중...'`으로 바꾼다(권한 요청과 판별을 합친 대기 상태이므로).
- 함정: iOS는 `requestPermission()`을 **사용자 터치 호출 흐름 안**에서 불러야 한다. 그 호출은 `await onPermissionGranted()`보다 앞이고 바꾸지 않는다. 판별은 권한을 받은 뒤 `onPermissionGranted` 안에서 하므로 iOS 제약과 충돌하지 않는다.

### I03. 컨트롤러 페이지 흐름
- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `handlePermissionGranted`(약 450행), `blockedRef`(30행), 렌더부(약 686행 `step === 'LOGIN_GATE'`); modify

#### Details
- **Signatures & Types**:
  ```typescript
  const [unsupportedReason, setUnsupportedReason] = useState<UnsupportedReason | null>(null);

  const handlePermissionGranted = async () => {
    // 개발 모드에서는 PC 브라우저로도 폰 화면을 볼 수 있게 판별을 건너뛴다. 배포 빌드에는 우회가 없다.
    if (!import.meta.env.DEV) {
      const verdict = await probeSensorSupport();
      if (!verdict.supported) {
        rejectUnsupportedDevice(verdict.reason);
        return;
      }
    }
    setSensorsActive(true);
    setStep('PAD');
    // ...기존 autoZero 예약 코드 그대로
  };
  ```
- **Execution Flow / Logic**:
  1. `rejectUnsupportedDevice(reason)`: (a) `blockedRef.current = true`(재연결 루프·`reviveIfDead`·화면 복귀 재연결을 모두 막는다; 이미 `SLOT_OCCUPIED` 처리에서 쓰는 장치) (b) 소켓이 열려 있으면(`wsRef.current?.readyState === WebSocket.OPEN`) `JSON.stringify({ type: 'DEVICE_UNSUPPORTED', roomId, deviceId, slot: slotRef.current, reason })` 전송 (c) `setUnsupportedReason(reason)`. 소켓은 서버가 닫는다. 서버 응답을 기다리지 않는다.
  2. 렌더: 최상위에서 `unsupportedReason !== null`이면 `<UnsupportedDeviceScreen reason={unsupportedReason} />`만 렌더하고 return한다(게이트·PAD·재연결 배너·카운트다운 모두 숨김). 훅 순서가 바뀌지 않게 이 분기는 모든 `useState/useEffect/useCallback` 선언 **뒤**, JSX 반환 직전에 둔다.
  3. 함정: 판별 중에 `needsReturn`, 카운트다운 등 PAD 관련 상태는 건드리지 않는다. `startCountdown`은 `sensorsActiveRef.current`가 `false`면 PAD로 가지 않는다(약 510행 주석 참조). 판별 전에 서버가 카운트다운을 보내도 게이트에 머문다.
  4. 함정: 화면을 껐다 켜는 동작(`visibilitychange`)의 백그라운드 신호 전송 effect가 닫힌 소켓에 `send`하지 않는지 확인한다(`readyState` 검사가 이미 있으면 변경 없음, 없으면 `OPEN`일 때만 보내게 한다).
  5. 알려진 한계(결정 D03에 따른 의도된 동작): 차단된 폰이 페이지를 새로고침하면 다시 `DEVICE_CHECK`로 슬롯에 붙었다가, 권한 허용 버튼을 누르면 다시 차단된다. 서버는 판정을 기억하지 않는다.
  6. `import` 추가: `probeSensorSupport`(`./sensors/SensorSupportProbe`), `UnsupportedDeviceScreen`, `UnsupportedReason`. `LoginAndPermissionGate`의 `onPermissionGranted`에는 위 async 함수를 그대로 넘긴다.

### I04. 테스트와 README
- Related Files:
  - `tests/unsupported-device-screen.test.tsx` :: new — 차단 화면 렌더
  - `tests/controller-ui-and-routing.test.ts` 또는 게이트를 렌더하는 기존 테스트 :: 버튼 문구 변경 반영; modify
  - `README.md` :: "스마트폰 권총 컨트롤러 연결 방법" 2번 아래와 "모바일" 요구사항 줄; modify

#### Details
- `UnsupportedDeviceScreen`을 `renderToStaticMarkup`으로 그려 `data-testid="unsupported-device-screen"`, 제목 "이 기기는 지원하지 않아요", `data-reason`이 있는지, `<button`이 **없는지**(우회 없음)를 단언한다. `reason`별 보조 문구가 다른지도 확인한다.
- `LoginAndPermissionGate`의 기존 렌더 테스트가 `'권한 요청 중...'` 문구를 단언하면 `'센서 확인 중...'`으로 고친다(`grep -rn "권한 요청 중" tests src`로 확인).
- `README.md`: 연결 방법 2번 문장 끝에 "센서(자이로)가 없는 폰은 '이 기기는 지원하지 않아요' 안내가 뜨며 연결되지 않으니, 다른 폰으로 접속하세요."를 붙이고, "모바일" 요구사항 줄(약 96행)에 "(자이로가 없는 보급형 폰은 지원하지 않음)"을 덧붙인다. `tests/docs-sync.test.ts`가 README를 읽으므로 먼저 이 테스트가 요구하는 규칙(금지 문구·필수 문구)을 읽고 어기지 않는다. `docs/` 아래 발표용 HTML은 건드리지 않는다.

## Acceptance Criteria
- [ ] 개발 모드(`npm run dev`)에서는 기존과 같이 허용 버튼 → PAD 화면 → 자동 영점으로 간다.
- [ ] 운영 빌드에서 센서가 없는 환경(PC 브라우저 등)은 허용 버튼 뒤 차단 화면만 보이고, PC 로비 슬롯은 비워지며 안내 칩이 뜬다.
- [ ] 차단된 폰은 자동 재연결을 하지 않는다.
- [ ] README에 안내가 있고 `tests/docs-sync.test.ts`가 통과한다.

## Validation
- `npx vitest run tests/unsupported-device-screen.test.tsx tests/sensor-support-probe.test.ts tests/docs-sync.test.ts tests/controller-ui-and-routing.test.ts` — 통과
- `npx vitest run` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run build` — 성공(운영 빌드에서 `import.meta.env.DEV`가 `false`로 치환되는지는 P04에서 실기기로 확인)

## Commit Message
```text
feat(controller): 센서 없는 폰은 권한 허용 뒤 차단 화면으로 막기

Plan: 2026-11-08-unsupported-phone-block
Phase: P02-unsupported-phone-block
Task: T04-phone-block-screen

- I01: UnsupportedDeviceScreen(우회 버튼 없는 차단 화면)
- I02: 게이트가 판별 시간 동안 버튼을 잠그고 문구를 "센서 확인 중"으로 변경
- I03: 권한 허용 뒤 probeSensorSupport 실행, 미지원이면 DEVICE_UNSUPPORTED 전송 후 재연결 중단, 개발 모드는 건너뜀
- I04: 차단 화면 테스트, README 안내 추가
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
