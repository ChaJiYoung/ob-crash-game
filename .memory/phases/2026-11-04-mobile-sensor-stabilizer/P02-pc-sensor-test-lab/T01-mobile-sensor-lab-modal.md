# Task: T01 `MobileSensorLabModal` 컴포넌트 구현

## Status: done


## Goal
PC 화면에서 모바일 기기가 보내는 센서 신호의 원시 떨림(Raw)과 필터 보정된 조준점(Filtered)을 2D 레이더 패널로 동시 비교 시각화하고, 실시간 센서 떨림 지수(RMS Jitter), 패킷 수신 주기(Hz), 원터치 기기 프리셋(아이폰 vs 갤럭시 A시리즈), 세부 튜닝 슬라이더, `localStorage` 영구 저장을 지원하는 독립 모달 컴포넌트를 구현한다.

## Decision Summary
- [D02] PC 화면에 상시 오픈 가능한 모바일 인식 테스트 및 보정 팝업.
- [D03] Raw(빨강) vs Filtered(초록) 실시간 비교 레이더 및 RMS Jitter 진단 지수 표시.
- [D04] 원터치 프리셋(기본 아이폰 vs 갤럭시 안정화) 및 브라우저 localStorage 자동 저장.
- [D05] **기본 조준 감각 보존**: 기본 프리셋(`default_iphone`)은 기존 로직 바이패스로 아이폰 13 미니의 조준 손맛을 절대 건드리지 않음.

## Implementation

### I01. `MobileSensorLabModal` UI 및 진단 로직 구현

- Related Files:
  - `src/pc/components/MobileSensorLabModal.tsx` :: `MobileSensorLabModal`, `MobileSensorLabModalProps`, `SensorTuningConfig` — 모바일 센서 진단 랩 모달 컴포넌트; new

#### Details
- **Signatures & Types**:
  ```typescript
  import React from 'react';
  import { OneEuroFilterConfig } from '../../controller/sensors/OneEuroFilter';

  export interface SensorTuningConfig extends OneEuroFilterConfig {
    isStabilizedMode: boolean; // false = 기존 아이폰 13 미니 로직 100% 유지, true = 1€ Filter 활성화
    sensitivityX: number;
    sensitivityY: number;
    invertY: boolean;
    preset: 'default_iphone' | 'stabilized_galaxy' | 'custom';
  }


  export interface SensorLiveMetrics {
    rawAimX: number;
    rawAimY: number;
    aimX: number;
    aimY: number;
    yawDeg: number;
    pitchDeg: number;
    rollDeg: number;
    packetHz: number;
    jitterRms: number; // 최근 30개 샘플의 변위 표준편차
    isCocked: boolean;
    lastSnapAt?: number;
  }

  export interface MobileSensorLabModalProps {
    isOpen: boolean;
    onClose: () => void;
    metrics: SensorLiveMetrics;
    tuningConfig: SensorTuningConfig;
    onUpdateConfig: (config: SensorTuningConfig) => void;
    onResetZero: () => void;
  }
  ```

- **Data & Schema Fields**:
  - `STORAGE_KEY`: `'beer_crusher_sensor_tuning_v1'`
  - 기본 설정(`DEFAULT_TUNING_CONFIG`):
    ```typescript
    export const DEFAULT_TUNING_CONFIG: SensorTuningConfig = {
      minCutoff: 1.0,
      beta: 0.015,
      dCutoff: 1.0,
      deadzone: 0.005,
      sensitivityX: 1.0,
      sensitivityY: 1.0,
      invertY: false,
      preset: 'balanced',
    };
    ```

- **Execution Flow / Logic**:
  1. **2D 실시간 레이더 패널 (280x280px)**:
     - 중심 십자선(0, 0) 및 안전 가이드 원형 렌더링.
     - **원시 센서 위치(Raw)**:
       - `left = 50 + rawAimX * 45%`, `top = 50 - rawAimY * 45%`
       - 네온 레드(`#ef4444`) 8px 원형 + 최근 15프레임 흔적(트레일 잔상 도트)을 표시하여, 갤럭시 A15의 가상 자이로가 가만히 있어도 덜덜덜 떠는 모양이 시각적으로 즉각 노출됨.
     - **보정 조준점(Filtered)**:
       - `left = 50 + aimX * 45%`, `top = 50 - aimY * 45%`
       - 네온 그린(`#10b981`) 14px 십자 타겟 + 외곽 링을 표시하여, 1€ Filter와 Deadzone 덕분에 한곳에 얌전하게 멈춰 있는 모습 대조.
  2. **실시간 센서 상태 인디케이터**:
     - `Jitter Score`: `metrics.jitterRms.toFixed(4)`
     - 안정성 등급 뱃지:
       - `jitterRms < 0.005`: `🟢 매우 안정 (아이폰 수준)`
       - `0.005 <= jitterRms < 0.018`: `🟡 보통 (양호)`
       - `jitterRms >= 0.018`: `🔴 센서 노이즈 심함 (Galaxy A 가상 자이로 - 강력 안정화 권장)`
     - `수신 주기`: `{metrics.packetHz} Hz` (녹색 인디케이터 깜빡임)
     - `자이로 각도`: Yaw `{metrics.yawDeg.toFixed(1)}°`, Pitch `{metrics.pitchDeg.toFixed(1)}°`
  3. **원터치 프리셋 버튼**:
     - `[📱 일반 균형 (iPhone 권장)]`: `minCutoff: 1.2`, `beta: 0.015`, `deadzone: 0.003`, `preset: 'balanced'` 적용.
     - `[🛡️ 강력 안정화 (Galaxy A시리즈 권장)]`: `minCutoff: 0.35`, `beta: 0.005`, `deadzone: 0.012`, `preset: 'stabilized'` 적용.
     - 클릭 시 즉시 `onUpdateConfig` 호출 및 `localStorage` 자동 동기화.
  4. **미세조정 슬라이더**:
     - `손떨림 방지 강도 (minCutoff)`: `0.1` ~ `3.0` (step `0.05`)
     - `조준 반응 속도 (beta)`: `0.001` ~ `0.050` (step `0.001`)
     - `정지 데드존 (deadzone)`: `0.000` ~ `0.025` (step `0.001`)
     - `감도 X / 감도 Y`: `0.5` ~ `2.5` (step `0.1`)
     - `Y축 반전`: 체크박스
     - 슬라이더 조작 시 `preset: 'custom'`으로 변경 및 저장.
  5. **조작 버튼**:
     - `🎯 현재 위치로 영점 맞추기`: `onResetZero()` 호출.
     - `닫기 (ESC)`: `onClose()` 호출.

### I02. 설정 스토리지 헬퍼 함수 구현

- Related Files:
  - `src/pc/components/MobileSensorLabModal.tsx` :: `loadSavedTuningConfig`, `saveTuningConfig` — 브라우저 로컬 저장소 헬퍼; new

#### Details
```typescript
export function loadSavedTuningConfig(): SensorTuningConfig {
  try {
    const raw = localStorage.getItem('beer_crusher_sensor_tuning_v1');
    if (raw) return { ...DEFAULT_TUNING_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_TUNING_CONFIG;
}

export function saveTuningConfig(config: SensorTuningConfig): void {
  try {
    localStorage.setItem('beer_crusher_sensor_tuning_v1', JSON.stringify(config));
  } catch {}
}
```

## Acceptance Criteria
- [ ] `MobileSensorLabModal.tsx` 파일이 생성되고 `MobileSensorLabModal`, `loadSavedTuningConfig`, `saveTuningConfig`가 export 됨.
- [ ] 2D 레이더 패널에서 Raw(빨강)과 Filtered(초록) 조준점이 시각적으로 분리되어 렌더링됨.
- [ ] 원터치 프리셋 버튼 클릭 시 설정값이 즉시 갱신되고 `localStorage`에 저장됨.
- [ ] 슬라이더로 파라미터를 조절할 수 있고 수치가 정확히 표기됨.

## Validation
- `npm run build` — TypeScript 컴파일 에러 없이 성공

## Commit Message
```text
feat(pc): implement MobileSensorLabModal for real-time mobile recognition test

Plan: 2026-11-04-mobile-sensor-stabilizer
Phase: P02-pc-sensor-test-lab
Task: T01-mobile-sensor-lab-modal

- Add 2D radar visualizer comparing raw vs filtered sensor positions
- Display live jitter RMS score, packet Hz, and stability badge
- Add one-touch presets for iPhone and Galaxy A series
- Add fine-tuning sliders for minCutoff, beta, deadzone, sensitivity
- Persist tuning configuration in localStorage
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done

