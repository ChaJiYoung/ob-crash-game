# Task: T02 PC 로비, HUD, 시스템에 `🎯 센서 진단` 버튼 통합 및 실시간 에임 인터랙션 연결

## Status: done


## Goal
PC 화면 상단(인게임 HUD, 로비 및 페어링 화면) 어디서든 클릭 한 번으로 열리는 `🎯 센서 진단` 버튼을 추가하고, `MobileSensorLabModal`을 연 상태에서도 모바일 총기를 쥔 채로 실시간 조준선이 움직이며 사격이 가능하도록 연동하며, 실시간 센서 떨림(Jitter RMS)을 계산하여 모달에 전달한다.

## Decision Summary
- [D02] 대기실(로비), QR 페어링, 인게임 HUD 상단 우측에 상시 오픈 버튼 배치.
- [D03] 최근 30프레임 센서 변위 분산(RMS Jitter) 실시간 계산 및 전달.

## Implementation

### I01. PC 게임 화면에 모달 및 상시 진단 버튼 통합

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `onOpenSensorLab?: () => void` props 추가, 상단 우측에 `🎯 센서 진단` 버튼 배치; modify
  - `src/pc/PCGamePage.tsx` :: `isSensorLabOpen` 상태, `tuningConfig` 상태, `MobileSensorLabModal` 렌더링; modify

#### Details
- **HUD 변경**:
  - `ArcadeOverlayHUDProps`에 `onOpenSensorLab?: () => void` 추가.
  - 상단 우측 `📖 가이드 & 도감` 버튼 옆에 `🎯 센서 진단` 버튼 나란히 배치:
    ```tsx
    {onOpenSensorLab && (
      <button
        onClick={onOpenSensorLab}
        style={{
          pointerEvents: 'auto',
          background: 'rgba(17, 24, 39, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(16, 185, 129, 0.6)',
          borderRadius: '10px',
          padding: '6px 14px',
          color: '#34d399',
          fontSize: '13px',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
          marginBottom: '4px',
        }}
      >
        🎯 센서 진단
      </button>
    )}
    ```

### I02. 실시간 Jitter RMS 계산 및 센서 파이프라인 연동

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `handleSensorRelay`, `recentRawSamplesRef`, `tuningConfig` — 실시간 지터 계산 및 에임 반영; modify

#### Details
- **Execution Flow / Logic**:
  1. `tuningConfig` 상태:
     - `const [tuningConfig, setTuningConfig] = useState<SensorTuningConfig>(() => loadSavedTuningConfig());`
     - `tuningConfigRef.current = tuningConfig`로 항상 최신 설정 참조.
  2. 실시간 지터 계산:
     - `recentRawSamplesRef = useRef<{ x: number; y: number }[]>([])`
     - `SENSOR_RELAY` 수신 시마다:
       - `rawAimX = p.rawAimX ?? p.aimX`
       - `rawAimY = p.rawAimY ?? p.aimY`
       - 최근 30개 샘플 큐에 push (`shift`로 30개 유지).
       - $dx_i = x_i - x_{i-1}$, $dy_i = y_i - y_{i-1}$의 제곱합 평균의 제곱근(RMS) 계산 -> `jitterRms`.
  3. 실시간 에임 반영:
     - PC 측에서도 `tuningConfig.sensitivityX`, `tuningConfig.sensitivityY`, `tuningConfig.invertY`를 곱하여 `updateAimDirect` 호출.
     - 모달이 열려 있어도 배경의 3D 캔버스와 크로스헤어가 가려지지 않고 실시간으로 움직이도록 팝업의 위치와 투명도를 세련되게 조절 (`pointerEvents` 백드롭 분리).
  4. 웹소켓 설정 동기화:
     - `tuningConfig` 변경 시, 연결된 모바일 컨트롤러가 있을 경우 WebSocket으로 `{ type: 'SENSOR_CONFIG_UPDATE', config: tuningConfig }`를 전송하여 모바일 `GunGripTracker`의 `OneEuroFilter` 파라미터도 즉시 실시간 동기화.

### I03. PC 모달 및 페어링 단위 테스트 확장

- Related Files:
  - `tests/pc-modals-and-pairing.test.ts` :: `MobileSensorLabModal Integration` — 진단 팝업 오픈 및 닫기, 프리셋 변경 시 저장 검증; modify

#### Details
- `tests/pc-modals-and-pairing.test.ts`에 다음 테스트 추가:
  - `MobileSensorLabModal`이 열렸을 때 2D 레이더 좌표 및 Jitter 수치가 정상 전달되는지 검증.
  - 프리셋 클릭 시 `onUpdateConfig`가 호출되어 `localStorage`에 저장되는지 검증.

## Acceptance Criteria
- [ ] 인게임 HUD 상단 우측에 `🎯 센서 진단` 버튼이 정상 렌더링되고 클릭 시 모달이 토글됨.
- [ ] 모달이 열린 상태에서도 모바일에서 들어오는 센서 신호에 맞춰 크로스헤어가 실시간으로 움직임.
- [ ] 최근 30개 센서 샘플을 기반으로 실시간 Jitter RMS가 정확히 계산되어 표시됨.
- [ ] `tests/pc-modals-and-pairing.test.ts`가 100% 통과함.

## Validation
- `npx vitest run tests/pc-modals-and-pairing.test.ts` — ALL PASS

## Commit Message
```text
feat(pc): integrate sensor lab button in HUD and link real-time jitter diagnostics

Plan: 2026-11-04-mobile-sensor-stabilizer
Phase: P02-pc-sensor-test-lab
Task: T02-integrate-hud-and-pc-live-aim

- Add sensor diagnostics button to top-right ArcadeOverlayHUD
- Compute real-time sensor jitter RMS over 30-frame rolling window
- Render MobileSensorLabModal with live aim pass-through
- Add integration tests in tests/pc-modals-and-pairing.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done

