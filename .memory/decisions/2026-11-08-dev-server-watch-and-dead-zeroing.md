# Decisions: 개발 서버 자동 재시작과 폰 영점 안내 화면 정리

- Date: 2026-11-08
- Status: Confirmed

## D01. 개발 서버 자동 재시작 (사용자가 포함 요청, 코드 확인으로 확정)
- **Chosen**: `package.json`의 `"server": "tsx server/index.ts"`를 `"server": "tsx watch server/index.ts"`로 바꾸고, `README.md`의 서버 실행 안내에 "서버 코드가 바뀌면 자동으로 다시 시작된다"를 한 줄 추가한다.
- **Rationale**: 오늘 서버 코드를 바꾼 뒤 서버를 재시작하지 않아 실기기 테스트가 두 번 무효가 됐다(옛 서버가 새 메시지를 몰랐다). `tsx watch`는 `import`된 파일(`server/*`, `src/shared/*`)이 바뀔 때만 재시작하며, 서버가 쓰는 `data/` 파일(랭킹·로그)은 `import` 대상이 아니라 재시작을 일으키지 않는다. 재시작하면 방(room)이 메모리에서 지워지지만 PC는 저장된 방 코드로 같은 방을 다시 만들고(`getOrCreateRoom`) 폰은 자동 재연결하므로 개발에 지장이 없다. 이 스크립트를 쓰는 테스트는 없다(`grep`으로 확인). `README.md`는 `tests/docs-sync.test.ts`가 읽는 문서라서 규칙을 어기는 문구를 넣으면 안 된다.

## D02. 폰 영점 안내 화면(`ZeroingGuide`) 정리 (사용자 선택)
- **Chosen**: 도달할 수 없는 화면 쪽만 제거한다. (1) `src/controller/components/ZeroingGuide.tsx` 파일 삭제 (2) `MobileControllerPage.tsx`의 `ZeroingGuide` import, `step === 'ZEROING'` 렌더 분기, `handleStartRangeMeasure`/`handleFinishRangeMeasure`, `step` 타입의 `'ZEROING'` 값 제거. `GunGripTracker`의 범위 측정 메서드(`startRangeMeasurement`/`recordRangeSample`/`finishRangeMeasurement`)와 `MeasuredRangeBounds`, 그 테스트는 남긴다.
- **Rationale**: `setStep('ZEROING')`를 호출하는 곳이 없다(이번 작업에서 `__setStep`을 지운 것이 마지막 경로였다). 폰은 허용 직후 바로 `PAD`로 가고 자동 영점(`2026-11-08-auto-zero-on-permission-grant`)을 쓴다. 감도를 손목 범위에 맞춰 계산하는 로직은 나중에 "처음에 손목 범위를 측정"하는 기능을 되살릴 때 재사용할 수 있어 남긴다.

## D03. 문서 동기화 (코드 확인으로 확정)
- **Chosen**: `README.md`의 "스마트폰 권총 컨트롤러 연결 방법" 2번과 4번을 새 흐름(허용 버튼을 누르면 영점이 자동으로 잡힌다, 어긋나면 패드의 영점 버튼으로 다시 맞춘다)에 맞게 고친다. `tests/controller-ui-and-routing.test.ts`의 로컬 `step` 타입에서 `'ZEROING'`을 뺀다. `docs/` 아래 발표 자료 HTML과 스크린샷은 건드리지 않는다.
- **Rationale**: README는 사용자가 따라 하는 설명서인데 지금은 "정면 영점 맞추기 버튼을 터치"를 필수 단계로 안내해 실제 흐름과 어긋난다. 발표 자료는 별도 산출물이라 이번 범위 밖이다.

## D04. 작업 단위 (코드 확인으로 확정)
- **Chosen**: 위 정리는 모두 소규모 정리라 하나의 Task로 묶는다. 실기기 검증 Phase 앞에 새 Phase로 둔다.
- **Rationale**: 같은 파일(`MobileControllerPage.tsx`)을 건드리므로 실기기 테스트 전에 정리를 끝내야 검증이 한 번에 끝난다. 각각은 단독 검증 가치가 없는 경미한 작업이다.
