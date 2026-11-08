# Task: T01 센서 테스트장 숨기기 + 센서 랩 모달 흔들림 수정

## Status: done

## Goal
일반 사용자 화면(로비·인게임 HUD·페어링 우상단)에서 "영점·센서 & 모듈 테스트장"과 "모바일 센서 진단 & 안정화 랩" 진입 버튼을 없애고, `/sensor-test` 주소로만 테스트장을 열 수 있게 한다. 동시에 폰을 연결했을 때 센서 랩 모달이 높이가 커졌다 작아지는 문제를 고친다. 둘 다 `PCGamePage.tsx`와 `MobileSensorLabModal.tsx` 주변이라 한 Task로 묶는다.

## Decision Summary
- D05: 주소 `/sensor-test`(및 `?mode=test`)는 그대로. 버튼 3곳 제거. `SANDBOX` 모드에서 센서 랩 모달은 계속 열려야 한다.
- D07: 원인은 `PCGamePage.tsx`의 `setSensorLiveMetrics({...})`가 상태를 통째로 교체해 `fps/drawCalls/geometries/textures`를 `undefined`로 만들고, 250ms마다 렌더 지표가 다시 채우는 것. 모달은 `typeof metrics.fps === 'number'`일 때만 두 줄을 그려서(`MobileSensorLabModal.tsx` 약 398·407행) 높이가 흔들린다.
- 확인된 사실: `/sensor-test`는 `src/App.tsx`의 `resolveRouteMode` → `<PCGamePage initialPhase="SANDBOX" />`로 열리고, `PCGamePage.tsx` 약 191행의 effect가 `engine.startSandboxMode()`를 직접 호출한다. 그래서 로비 버튼이 부르던 `handleStartSandbox`는 이 버튼 외에는 쓰이지 않는다(`grep`으로 확인: `PCGamePage.tsx:1212`, `:1677`뿐).

## Implementation

### I01. 로비 "테스트장" 버튼 제거
- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps.onStartSandbox`, 약 606~627행 `{onStartSandbox && (<button ...>🎯 영점·센서 & 모듈 테스트장 ...</button>)}` — 제거; modify
  - `src/pc/PCGamePage.tsx` :: `handleStartSandbox`(약 1212행), `<QRPairingModal onStartSandbox={handleStartSandbox} />`(약 1677행) — 제거; modify

#### Details
- **Execution Flow / Logic**:
  1. `QRPairingModalProps`에서 `onStartSandbox?: () => void;`와 구조분해의 `onStartSandbox,`, 버튼 JSX 블록 전체를 삭제한다. 튜토리얼/가이드 버튼 블록(`{(onStartTutorial || onOpenGuide) && ...}`)은 건드리지 않는다.
  2. `PCGamePage.tsx`에서 `handleStartSandbox` 정의와 `onStartSandbox={handleStartSandbox}` prop 전달을 삭제한다. 삭제 후 `getSoloSlot`, `syncProcessors`, `engine.startSandboxMode`가 다른 곳에서 계속 쓰이는지 `tsc`로 확인(안 쓰이는 import만 정리).
  3. 함정: `SANDBOX` 시작은 `initialPhase === 'SANDBOX'` effect(약 191행)가 맡으므로 이 effect와 `setPhase('SANDBOX')`를 쓰는 다른 경로(튜토리얼 종료 등)는 건드리지 않는다.

### I02. 센서 랩 열기 버튼을 SANDBOX에만 남기기
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUDProps.onOpenSensorLab`, 구조분해 `onOpenSensorLab`, 약 449~475행 버튼 — 제거; modify
  - `src/pc/PCGamePage.tsx` :: `<ArcadeOverlayHUD onOpenSensorLab={handleOpenSensorLab} />`(약 1504행) 전달 제거; PAIRING/ZEROING 우상단 플로팅 버튼 블록(약 1819~1843행 `{(gamePhase === 'PAIRING' || gamePhase === 'ZEROING') && (<button onClick={handleOpenSensorLab} ...>`) 제거; `<SensorAndModuleTestLabOverlay onOpenSensorLab={handleOpenSensorLab} />` 전달 추가; modify
  - `src/pc/components/SensorAndModuleTestLabOverlay.tsx` :: `SensorAndModuleTestLabOverlayProps`, `SensorAndModuleTestLabOverlay` — `onOpenSensorLab?: () => void` prop과 헤더의 "📊 센서 랩" 버튼 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // SensorAndModuleTestLabOverlay.tsx
  export interface SensorAndModuleTestLabOverlayProps {
    // ...기존 필드 유지
    /** SANDBOX(/sensor-test)에서만 렌더되므로 이 버튼도 URL로 들어온 사람에게만 보인다. */
    onOpenSensorLab?: () => void;
  }
  ```
- **Execution Flow / Logic**:
  1. 오버레이 헤더(`🎯 영점·센서 진단 및 게임 모듈 테스트장` 제목이 있는 flex 행, 약 140행 근처)의 오른쪽에 `onOpenSensorLab && <button data-testid="open-sensor-lab" onClick={onOpenSensorLab}>📊 센서 랩</button>`을 추가한다. 스타일은 같은 파일의 기존 버튼과 같은 계열(sky 색)로 맞춘다. 닫기 버튼 등 기존 버튼의 위치는 바꾸지 않는다.
  2. `PCGamePage.tsx`의 `isSensorLabOpen`/`handleOpenSensorLab`/`handleCloseSensorLab`/`<MobileSensorLabModal ... />`(약 1847행)는 그대로 둔다. 이제 SANDBOX 오버레이의 새 버튼만 모달을 연다.
  3. 함정: `SensorAndModuleTestLabOverlay`는 `gamePhase === 'SANDBOX'`일 때만 렌더된다(`PCGamePage.tsx` 약 1578행). `PCGamePage`의 진단 갱신(`isDiagnosticsNeeded = isSensorLabOpenRef.current || gamePhaseRef.current === 'SANDBOX'`)은 SANDBOX면 항상 켜져 있으므로 바꾸지 않는다.
  4. 가이드/튜토리얼 안내문이 제거된 버튼을 언급하는지 `grep -n "테스트장\|센서 랩\|안정화 랩\|센서 진단" src/pc/components/GuideModal.tsx docs/튜토리얼_훈련장_가이드.md README.md`로 확인하고, 있으면 "주소창에 `/sensor-test`를 입력해 접속" 취지로 고친다(없으면 변경 없음). `docs/` 아래 발표용 HTML은 건드리지 않는다.

### I03. 센서 지표 병합 헬퍼 + 흔들림 수정
- Related Files:
  - `src/pc/components/MobileSensorLabModal.tsx` :: `SensorLiveMetrics`(같은 파일 상단 인터페이스) 아래에 `mergeSensorFrameMetrics` 추가; modify
  - `src/pc/PCGamePage.tsx` :: 센서 프레임 처리부(약 652행 `setSensorLiveMetrics({ rawAimX: ... })`) — 헬퍼 사용으로 교체; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 센서 프레임이 채우는 필드. 렌더 성능 지표(fps/drawCalls/geometries/textures)는 포함하지 않는다. */
  export type SensorFrameMetrics = Omit<SensorLiveMetrics, 'fps' | 'drawCalls' | 'geometries' | 'textures'>;

  /** 센서 프레임 지표를 이전 지표 위에 얹는다. 렌더 성능 지표는 지우지 않는다. */
  export function mergeSensorFrameMetrics(prev: SensorLiveMetrics, frame: SensorFrameMetrics): SensorLiveMetrics {
    return { ...prev, ...frame };
  }
  ```
- **Execution Flow / Logic**:
  1. `PCGamePage.tsx`의 `setSensorLiveMetrics({...})` 호출을 `setSensorLiveMetrics((prev) => mergeSensorFrameMetrics(prev, { rawAimX, rawAimY, aimX, aimY, yawDeg, pitchDeg, rollDeg, packetHz, jitterRms, isCocked, lastSnapAt }))`로 바꾼다. 필드 값과 계산식(`packetCountRef.current * 4 || 60`, `lastSnapAt: p.snapFire ? Date.now() : undefined`)은 현재 그대로 옮긴다.
  2. 함정: `lastSnapAt`은 스냅이 아닐 때 일부러 `undefined`로 덮어쓴다. 객체 스프레드는 키가 있으면 `undefined`로도 덮어쓰므로 `{ lastSnapAt: undefined }`를 그대로 넘겨야 기존 동작이 유지된다(키를 생략하면 이전 값이 남는다).
  3. 함정: `handleRenderMetrics`(약 1309행)는 이미 `...prev`로 병합한다. 건드리지 않는다.
  4. 화면이 흔들리는 근본 이유가 "조건부 렌더로 줄이 생겼다 사라짐"이므로, 헬퍼만 고치고 모달의 `typeof metrics.fps === 'number'` 조건은 그대로 둔다(렌더 지표가 아직 한 번도 안 온 첫 순간에는 줄이 없는 것이 정상).

### I04. 테스트
- Related Files:
  - `tests/pc-modals-and-pairing.test.ts` :: 새 `it` — `mergeSensorFrameMetrics`; modify
  - `tests/lobby-slot-cards.test.tsx` :: 로비 마크업에 테스트장 버튼이 없음을 확인; modify
  - `tests/pc-hud-and-banner.test.ts` 또는 HUD를 렌더하는 기존 테스트 :: HUD에 센서 랩 버튼이 없음; modify
  - `tests/controller-ui-and-routing.test.ts` :: `resolveRouteMode('/sensor-test', '')`가 `'SANDBOX'`인 기존 테스트가 그대로 통과하는지만 확인; read-only

#### Details
- `mergeSensorFrameMetrics`: (1) `prev`에 `fps: 60, drawCalls: 12, geometries: 5, textures: 3`이 있고 `frame`에 이 필드가 없으면 결과에 그대로 남는다 (2) `frame.rawAimX` 등 센서 필드는 새 값으로 바뀐다 (3) `frame.lastSnapAt === undefined`(키 포함)일 때 `prev.lastSnapAt = 123`이 `undefined`로 덮인다.
- 렌더 테스트: 기존 테스트가 `renderToStaticMarkup`으로 `QRPairingModal`을 그린다면(`tests/pc-modals-and-pairing.test.ts`, `tests/lobby-slot-cards.test.tsx`), 결과 문자열에 `테스트장`이 없다는 단언을 추가한다. `onStartSandbox` prop을 넘기던 호출이 있으면 제거한다(타입 오류가 나므로 `tsc`가 알려 준다).
- 오버레이 버튼: `SensorAndModuleTestLabOverlay`를 `onOpenSensorLab={() => {}}`로 그렸을 때 마크업에 `data-testid="open-sensor-lab"`이 있고, prop을 안 주면 없다. 이 컴포넌트가 훅/DOM 의존으로 `renderToStaticMarkup`이 어렵다면 소스 문자열 단언(`fs.readFileSync`)으로 대신하되, 그 사유를 테스트 주석에 쓴다.

## Acceptance Criteria
- [ ] 로비(PAIRING)·인게임 HUD·페어링 우상단 어디에도 "테스트장" "센서 진단 & 안정화 랩" 버튼이 없다.
- [ ] `/sensor-test`로 열면 테스트장이 뜨고, 오버레이의 "📊 센서 랩" 버튼으로 센서 랩 모달이 열린다.
- [ ] 폰을 연결한 채 센서 랩 모달을 열어도 "렌더 성능"·"GPU 메모리" 두 줄이 깜빡이지 않는다(코드상 `mergeSensorFrameMetrics`가 렌더 지표를 지우지 않는다).
- [ ] `tsc`에 미사용 심볼/타입 오류가 없다.

## Validation
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run tests/pc-modals-and-pairing.test.ts tests/lobby-slot-cards.test.tsx tests/controller-ui-and-routing.test.ts` — 통과
- `npx vitest run` — 전체 통과(HUD·QR 모달을 렌더하는 다른 테스트가 깨지지 않았는지 확인)

## Commit Message
```text
feat(pc): 센서 테스트장 진입 버튼 제거와 센서 랩 모달 흔들림 수정

Plan: 2026-11-08-unsupported-phone-block
Phase: P01-hide-lab-and-fix-flicker
Task: T01-sensor-lab-url-only

- I01: 로비 "영점·센서 & 모듈 테스트장" 버튼과 handleStartSandbox 제거
- I02: HUD·페어링 우상단 센서 랩 버튼 제거, /sensor-test 오버레이에만 "센서 랩" 버튼 유지
- I03: mergeSensorFrameMetrics로 센서 프레임이 렌더 지표를 지우지 않게 수정
- I04: 병합 헬퍼·버튼 부재 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
