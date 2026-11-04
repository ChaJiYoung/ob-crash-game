# Task: T02 `GunGripTracker` 및 `SENSOR_FRAME` 프로토콜에 1€ Filter + Raw/Filtered 좌표 통합

## Status: done


## Goal
`GunGripTracker`의 기존 불완전한 지수 스무딩(0.92 즉시 반영 및 0.15 초과 시 스무딩 해제) 로직을 제거하고, X/Y축 독립 적응형 `OneEuroFilter`를 내장하여 날것의 원시 좌표(`rawAimX`, `rawAimY`)와 안정화된 조준 좌표(`aimX`, `aimY`)를 동시에 산출하도록 개선하며, WebSocket `SENSOR_FRAME` 전송 페이로드에 이를 포함하여 PC에서 실시간 대조 진단이 가능하도록 연동한다.

## Decision Summary
- [D01] `GunGripTracker.computeAim`에 X/Y축 독립 `OneEuroFilter` 탑재하여 갤럭시 A15 가상 자이로 노이즈 차단.
- [D03] `rawAimX`, `rawAimY`를 `AimResult` 및 `SENSOR_FRAME` 페이로드에 추가하여 PC에서 Raw vs Filtered 비교 렌더링 지원.
- [D05] **아이폰 13 미니 기본 조준 감각 100% 보존**: 기본 상태(`isStabilizedMode = false`)에서는 기존 검증된 로직(가벼운 smoothingAlpha)을 그대로 유지하고, 안정화 모드가 켜졌을 때만 1€ Filter + Deadzone이 개입.

## Implementation

### I01. 센서 프로토콜 타입 확장

- Related Files:
  - `src/shared/types.ts` :: `SensorFramePayload` — 원시 좌표 `rawAimX`, `rawAimY` 선택적 필드 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface SensorFramePayload {
    aimX: number;
    aimY: number;
    rawAimX?: number; // 필터링 이전 원시 조준 좌표 (-1.0 ~ 1.0)
    rawAimY?: number; // 필터링 이전 원시 조준 좌표 (-1.0 ~ 1.0)
    pitchDeg: number;
    yawDeg: number;
    rollDeg: number;
    snapFire: boolean;
    rapidFireHold: boolean;
    feverTriggered: boolean;
    isCocked: boolean;
    skillSnapTriggered: boolean;
    timestamp: number;
  }
  ```

### I02. `GunGripTracker`에 `OneEuroFilter` 통합 및 기본 감각 보존형 분기

- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker`, `AimResult` — 1€ Filter X/Y 인스턴스 장착, 안정화 모드 토글, 기본 모드는 기존 로직 100% 유지; modify

#### Details
- **Signatures & Types**:
  ```typescript
  import { OneEuroFilter, OneEuroFilterConfig, SENSOR_PRESETS } from './OneEuroFilter';

  export interface AimResult {
    aimX: number;     // 최종 조준 좌표 (-1 ~ 1, 기본 모드=기존 로직 / 안정화 모드=1€ Filter)
    aimY: number;     // 최종 조준 좌표 (-1 ~ 1, 기본 모드=기존 로직 / 안정화 모드=1€ Filter)
    rawAimX: number;  // 필터 이전 원시 조준 좌표 (-1 ~ 1)
    rawAimY: number;  // 필터 이전 원시 조준 좌표 (-1 ~ 1)
    yawDeg: number;
    pitchDeg: number;
    rollDeg: number;
  }
  ```
- **Execution Flow / Logic**:
  1. `GunGripTracker` 멤버 변수로 `isStabilizedMode = false` (기본값 OFF, 아이폰 13 미니 기존 감각 보존), `filterX: OneEuroFilter`, `filterY: OneEuroFilter` 초기화.
  2. `calibrateZero(sample)` 호출 시:
     - 기존 영점 직교 기저(zeroForward, zeroRight, zeroUp) 계산 유지.
     - 기존 `smoothedAimX = 0; smoothedAimY = 0; hasSmoothedSample = false;` 초기화 유지.
     - `filterX.reset()`, `filterY.reset()` 호출하여 필터 상태도 깨끗이 동기화.
  3. `computeAim(sample, smoothingAlpha = 0.92, timestampMs)`:
     - `computeRelativeAngles(sample)`로부터 `yawDeg`, `pitchDeg` 계산.
     - `rawAimX = clamp((yawDeg / yawHalfRangeDeg) * sensitivityX, -1, 1)`
     - `signedPitch = invertY ? -pitchDeg : pitchDeg`
     - `rawAimY = clamp((signedPitch / pitchHalfRangeDeg) * sensitivityY, -1, 1)`
     - **[분기 1: 기본 모드 - isStabilizedMode === false (아이폰 13 미니 기본)]**:
       - **기존 코드 100% 동일 실행**:
         `const delta = Math.hypot(rawAimX - this.smoothedAimX, rawAimY - this.smoothedAimY);`
         `const effectiveAlpha = !this.hasSmoothedSample || delta > 0.15 ? 1.0 : smoothingAlpha;`
         `this.smoothedAimX += (rawAimX - this.smoothedAimX) * effectiveAlpha;`
         `this.smoothedAimY += (rawAimY - this.smoothedAimY) * effectiveAlpha;`
         `this.hasSmoothedSample = true;`
       - 반환: `{ aimX: this.smoothedAimX, aimY: this.smoothedAimY, rawAimX, rawAimY, yawDeg, pitchDeg, rollDeg }`
       - 👉 **아이폰 13 미니 사용자는 기존 조준 손맛과 반응성이 1%도 변하지 않음.**
     - **[분기 2: 안정화 모드 - isStabilizedMode === true (갤럭시 A15 등 가상 자이로 기기)]**:
       - `const nowMs = timestampMs ?? performance.now()`
       - `const filteredAimX = this.filterX.filter(rawAimX, nowMs)`
       - `const filteredAimY = this.filterY.filter(rawAimY, nowMs)`
       - 반환: `{ aimX: filteredAimX, aimY: filteredAimY, rawAimX, rawAimY, yawDeg, pitchDeg, rollDeg }`
       - 👉 **가상 자이로의 부들부들 떨림과 표류가 1€ Filter + Deadzone으로 완벽 차단됨.**
  4. 설정 메서드 추가:
     - `public setStabilizedMode(enabled: boolean): void`
     - `public isStabilized(): boolean`
     - `public setFilterConfig(config: Partial<OneEuroFilterConfig>): void`
     - `public getFilterConfig(): OneEuroFilterConfig`
     - `public applyPreset(presetKey: 'balanced' | 'stabilized'): void`


### I03. 모바일 컨트롤러 페이지 프레임 전송 연동

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `flushSensorFrame` — `rawAimX`, `rawAimY`를 `SENSOR_FRAME` 메시지에 포함; modify

#### Details
- `flushSensorFrame` 내부:
  ```typescript
  const effective = tracker.getEffectiveAim(latestOrientationRef.current);
  const aim = effective.aim;
  // payload에 rawAimX: aim.rawAimX, rawAimY: aim.rawAimY 추가 전송
  ```

### I04. 컨트롤러 센서 단위 테스트 확장

- Related Files:
  - `tests/controller-sensors.test.ts` :: `GunGripTracker Suite` — `rawAimX`/`rawAimY` 반환 확인 및 프리셋 적용 검증; modify

#### Details
- 기존 테스트 검증 케이스 유지하면서:
  - `tracker.computeAim()` 결과에 `rawAimX`와 `rawAimY`가 숫자로 유효하게 존재하는지 검증.
  - `tracker.applyPreset('stabilized')` 호출 후 정지 상태 노이즈 주입 시 `aimX`가 부드럽게 유지되는지 검증.

## Acceptance Criteria
- [ ] `AimResult`와 `SensorFramePayload`에 `rawAimX`, `rawAimY`가 정상 정의되고 전송됨.
- [ ] `GunGripTracker`가 `OneEuroFilter`를 사용하여 조준 좌표를 계산함.
- [ ] `calibrateZero` 호출 시 필터가 리셋되어 영점 변경 즉시 새로운 원점을 기준으로 필터링함.
- [ ] `npx vitest run tests/controller-sensors.test.ts`가 100% 통과함.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 10개 이상 테스트 ALL PASS

## Commit Message
```text
feat(sensor): integrate OneEuroFilter into GunGripTracker and sensor frame protocol

Plan: 2026-11-04-mobile-sensor-stabilizer
Phase: P01-sensor-filter-core
Task: T02-integrate-filter-into-tracker-and-protocol

- Add rawAimX and rawAimY to SensorFramePayload and AimResult
- Replace legacy alpha smoothing with dual-axis OneEuroFilter in GunGripTracker
- Forward rawAim coordinates in MobileControllerPage flushSensorFrame
- Update tests/controller-sensors.test.ts to verify filter integration
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done

