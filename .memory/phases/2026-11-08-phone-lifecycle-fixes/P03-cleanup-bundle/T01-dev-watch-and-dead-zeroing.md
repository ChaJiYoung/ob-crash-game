# Task: T01 개발 서버 자동 재시작과 폰 영점 안내 화면 정리

## Status: pending

## Goal
(1) `npm run server`가 서버 코드 변경 시 자동으로 다시 시작되게 한다. (2) 어디서도 도달할 수 없는 폰 영점 안내 화면(`ZeroingGuide`)과 그 연결 코드를 제거한다. (3) README의 폰 연결 설명을 실제 흐름(허용 버튼 직후 자동 영점)에 맞춘다.

## Decision Summary
- dev-server-watch-and-dead-zeroing D01~D04. 모두 경미한 정리라 한 Task, 한 커밋으로 묶는다.
- `GunGripTracker`의 범위 측정 메서드와 그 테스트는 남긴다(D02). PC의 `ZEROING` 게임 단계는 별개이므로 건드리지 않는다.

## Implementation

### I01. 개발 서버 자동 재시작

- Related Files:
  - `package.json` :: `scripts.server` — `tsx watch`로 변경; modify
  - `README.md` :: "### 2. 서버 실행" 아래 "#### 터미널 1: 웹소켓 세션 & 랭킹 서버 실행" 설명 — 한 줄 추가; modify

#### Details
- **Signatures & Types**:
  ```json
  "server": "tsx watch server/index.ts"
  ```
- **Execution Flow / Logic**:
  1. `package.json`의 `"server": "tsx server/index.ts"` 한 줄만 `tsx watch server/index.ts`로 바꾼다. `dev`, `dev:vite`, `dev:tunnel`은 그대로 둔다.
  2. `README.md`의 서버 실행 안내(`npm run server`와 "포트 8787에서 구동되며..." 불릿) 아래에 불릿 한 줄을 추가한다: "서버 코드(`server/`, `src/shared/`)를 수정하면 자동으로 다시 시작됩니다. 재시작하면 연결이 잠깐 끊기며, PC와 폰은 자동으로 다시 붙습니다."
  3. `tests/docs-sync.test.ts`가 `README.md`에서 금지 문구를 검사하므로(규칙 패턴 목록 참고) 새 문구가 그 패턴에 걸리는지 `npx vitest run tests/docs-sync.test.ts`로 확인한다.
- **주의(회귀 방지)**: `tsx watch`는 `import`된 파일만 감시한다. 서버가 쓰는 `data/`(랭킹, 로그)는 감시 대상이 아니라 재시작을 일으키지 않는다. `package.json` 자체가 바뀐 이번 변경은 사용자가 서버를 한 번 직접 재시작해야 적용된다(이 사실을 완료 보고에 적는다).

### I02. 폰 영점 안내 화면 죽은 코드 제거

- Related Files:
  - `src/controller/components/ZeroingGuide.tsx` :: `ZeroingGuide`, `ZeroingGuideProps` — 파일 전체 삭제; delete
  - `src/controller/MobileControllerPage.tsx` :: `import { ZeroingGuide }`(5행 부근), `useState<'LOGIN_GATE' | 'ZEROING' | 'PAD'>`(31행 부근), `useRef<'LOGIN_GATE' | 'ZEROING' | 'PAD'>`(61행 부근), `handleStartRangeMeasure`/`handleFinishRangeMeasure`(540행 부근), `{step === 'ZEROING' && (<ZeroingGuide ... />)}` 렌더 분기(690행 부근) — 제거; modify
  - `src/controller/sensors/GunGripTracker.ts` :: `startRangeMeasurement`, `recordRangeSample`, `finishRangeMeasurement`, `MeasuredRangeBounds` — 변경 없음; read-only
  - `tests/controller-ui-and-routing.test.ts` :: `it('should transition directly to PAD on permission granted (bypassing ZEROING guide)')` — 로컬 `step` 타입에서 `'ZEROING'` 제거, 테스트 제목의 "(bypassing ZEROING guide)" 제거; modify
  - `tests/controller-reconnect.test.ts` :: `describe('MobileControllerPage reconnect wiring (source guard)')` — 소스 가드 추가; modify

#### Details
- **Execution Flow / Logic**:
  1. 시작 전에 사용처를 다시 확인한다: `grep -rnE "ZeroingGuide|setStep\('ZEROING'\)|handleStartRangeMeasure|handleFinishRangeMeasure" src tests`. `setStep('ZEROING')` 호출이 새로 생겼으면 제거하지 말고 사용자에게 알린다.
  2. `MobileControllerPage.tsx`에서 위 5곳을 제거한다. `step` 상태의 타입은 `'LOGIN_GATE' | 'PAD'`가 된다. `stepRef`도 같은 타입으로 맞춘다.
  3. `handleFinishRangeMeasure`가 `setStep('PAD')`를 포함하고 있으나 `PAD` 전환은 다른 핸들러(`handleCalibrateZero`, `handlePermissionGranted`, `AUTH_RESULT` 경로)가 이미 한다. 제거해도 PAD로 가는 경로는 줄지 않는다.
  4. 제거 후 미사용이 된 `import`(예: `ZeroingGuide`)가 없는지 `tsc`로 확인한다. `triggerHaptic`은 `ZeroingGuide.tsx` 안에서만 쓰는 import이므로 `MobileControllerPage.tsx`의 `triggerHaptic` import는 건드리지 않는다.
  5. `GunGripTracker`의 범위 측정 메서드는 호출부가 없어지지만 `tests/controller-sensors.test.ts`가 테스트하므로 그대로 둔다.
  6. 소스 가드 테스트: `MobileControllerPage.tsx` 소스에 `ZeroingGuide`와 `'ZEROING'`이 없다.
- **주의(회귀 방지)**:
  - PC의 `'ZEROING'`은 별개의 게임 단계(`gamePhase`)다(`PCGamePage.tsx`의 `setPhase('ZEROING')`, `coopSlots.ts` 등). 폰의 `step`과 이름만 같으므로 `src/pc`는 건드리지 않는다. 소스 가드는 폰 파일 하나에만 적용한다.
  - 센서 복구 effect와 자동 영점(P02-T02)이 `step`을 읽는다(`stepRef.current === 'PAD'`, `step === 'LOGIN_GATE'`). 타입에서 값 하나가 빠져도 이 비교는 그대로 유효하다.

### I03. README 동기화

- Related Files:
  - `README.md` :: "## 📱 스마트폰 권총 컨트롤러 연결 방법" 2번·4번 항목 — 새 흐름 반영; modify

#### Details
- **Execution Flow / Logic**:
  1. 2번을 "폰 브라우저에서 **센서 권한 허용** 버튼을 누릅니다. 누른 순간의 폰 방향이 자동으로 정면 영점이 되고, PC 화면에 조준경이 나타납니다."로 고친다.
  2. 4번의 "정면 영점 맞추기 버튼을 터치합니다."를 "조준이 어긋나면 휴대폰 윗부분을 모니터 정중앙에 겨눈 채 패드의 **정면 영점** 버튼을 터치해 다시 맞춥니다."로 고친다. 5번은 그대로 둔다.
  3. 패드의 버튼 문구는 `GunGripPad.tsx`의 `정면 영점 (모니터 겨누고 탭)`을 확인해 README 표현과 모순되지 않게 한다.
  4. `docs/beer-crusher-presentation*.html`과 `docs/screens/*.png`는 별도 산출물이라 이번 Task에서 건드리지 않는다.
  5. 완료 후 `npx vitest run tests/docs-sync.test.ts`로 문서 동기화 테스트를 통과시킨다.

## Acceptance Criteria
- [ ] `package.json`의 `server` 스크립트가 `tsx watch server/index.ts`이고, README에 자동 재시작 안내가 있다.
- [ ] `ZeroingGuide.tsx`가 삭제되고, 폰 `step`에서 `'ZEROING'`과 범위 측정 핸들러·렌더 분기가 사라졌다.
- [ ] `GunGripTracker`의 범위 측정 메서드와 `tests/controller-sensors.test.ts`는 그대로 통과한다.
- [ ] README의 폰 연결 설명이 허용 직후 자동 영점 흐름과 일치한다.
- [ ] `tsc`, 전체 `vitest`가 통과한다.

## Validation
- `grep -rnE "ZeroingGuide|setStep\('ZEROING'\)" src tests` — 소스 가드 테스트의 문자열 외에는 출력 없음
- `npx vitest run tests/controller-reconnect.test.ts tests/controller-ui-and-routing.test.ts tests/controller-sensors.test.ts tests/docs-sync.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
chore(controller): 개발 서버 자동 재시작, 폰 영점 안내 화면 정리

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P03-cleanup-bundle
Task: T01-dev-watch-and-dead-zeroing

- npm run server를 tsx watch로 전환하고 README에 안내 추가
- 도달할 수 없던 ZeroingGuide 화면과 'ZEROING' 단계, 범위 측정 핸들러 제거 (GunGripTracker 계산 로직은 유지)
- README 폰 연결 설명을 허용 직후 자동 영점 흐름에 맞춰 수정
- 소스 가드 테스트와 라우팅 테스트의 타입 정리
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
