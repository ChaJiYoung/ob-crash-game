# Task: T01 자이로 상하(Pitch)/좌우(Yaw) 축 교정, 2단계 가동 범위 캘리브레이션, 영점-게임시작 분리 프로토콜 구현

## Status: done

## Goal
스마트폰을 위아래로 기울일 때(`beta`) 상하 조준(`aimY`)이 정상 인식되도록 `GunGripTracker`의 회전 각도 추출 로직을 교정하고, 사용자의 실제 상하좌우 손목 가동 범위를 측정해 `[-1, +1]`로 매핑하는 2단계 영점 조절 UI 및 영점 완료와 게임 시작을 분리하는 WebSocket 메시지를 구현합니다.

## Decision Summary
- **D01**: W3C `DeviceOrientationEvent` 표준(`Z-X'-Y''`)에 맞춰 `alpha` 변화량으로 수평 Yaw(`yawDeg`), `beta` 변화량(및 측면 파지 시 `gamma` 변화량 보조)으로 수직 Pitch(`pitchDeg`)를 추출하여 파지 자세와 무관하게 상하좌우 조준이 정확히 동작하도록 교정합니다.
- **D02**: 1단계 정면 영점 고정 후 2단계에서 사용자가 상·하·좌·우로 움직인 최대/최소 각도 범위를 측정해 개인별 조준 스케일을 자동 설정합니다.
- **D03**: `CALIBRATE_ZERO`와 별도로 `START_GAME_REQUEST` / `GAME_START_RELAY` WebSocket 메시지를 추가해 영점 직후 바로 게임이 시작되지 않도록 분리합니다.

## Implementation

### I01. 공유 프로토콜 타입 확장 (`SANDBOX` 페이즈 및 `START_GAME_REQUEST` 메시지)

- Related Files:
  - `src/shared/types.ts` :: `GamePhase`, `ClientToServerMessage`, `ServerToClientMessage` — 게임 페이즈 및 웹소켓 메시지 유니온 확장; modify
  - `server/wsServer.ts` :: `createBeerCrusherServer` — `START_GAME_REQUEST` 수신 시 PC 소켓으로 `GAME_START_RELAY` 중계; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/types.ts
  export type GamePhase =
    | 'PAIRING'
    | 'ZEROING'
    | 'PLAYING'
    | 'TUTORIAL'
    | 'SANDBOX'
    | 'GAMEOVER'
    | 'VICTORY';

  export type ClientToServerMessage =
    | { type: 'CREATE_ROOM'; roomId?: string }
    | { type: 'DEVICE_CHECK'; roomId: string; deviceId: string }
    | { type: 'REGISTER_NICKNAME'; roomId: string; deviceId: string; nickname: string }
    | { type: 'CALIBRATE_ZERO'; roomId: string; deviceId: string }
    | { type: 'START_GAME_REQUEST'; roomId: string; deviceId: string }
    | { type: 'SENSOR_FRAME'; roomId: string; deviceId: string; payload: SensorFramePayload }
    | { type: 'FEVER_STATUS_SYNC'; roomId: string; isFeverReady: boolean }
    | { type: 'GAME_SCORE_SUBMIT'; roomId: string; deviceId: string; score: number; waveReached: number; maxCombo: number };

  export type ServerToClientMessage =
    | { type: 'ROOM_CREATED'; roomId: string; rankings: PlayerProfile[]; lanIp?: string }
    | { type: 'AUTH_RESULT'; roomId: string; isNewUser: boolean; player?: PlayerProfile; rankings: PlayerProfile[] }
    | { type: 'CONTROLLER_PAIRED'; roomId: string; player: PlayerProfile }
    | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string }
    | { type: 'GAME_START_RELAY'; roomId: string; deviceId: string }
    | { type: 'SENSOR_RELAY'; roomId: string; deviceId: string; payload: SensorFramePayload }
    | { type: 'FEVER_STATUS_RELAY'; roomId: string; isFeverReady: boolean }
    | { type: 'RANKING_UPDATED'; rankings: PlayerProfile[]; updatedPlayer?: PlayerProfile }
    | { type: 'ERROR'; code: string; message: string };
  ```
- **Execution Flow / Logic**:
  1. `server/wsServer.ts`의 `switch (msg.type)` 블록에 `case 'START_GAME_REQUEST':` 분기를 추가합니다.
  2. `roomId`와 `deviceId`가 유효하지 않으면 `INVALID_REQUEST` 에러를 반환하고, 유효하면 해당 방의 `session.pcSocket`으로 `{ type: 'GAME_START_RELAY', roomId, deviceId }`를 전송합니다.

### I02. `GunGripTracker` 상하/좌우 오일러 각도 추출 교정 및 2단계 가동 범위 캘리브레이션

- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker`, `AimCalibrationConfig` — 상하/좌우 상대 각도 추출, 가동 범위 측정, 감도 배율 및 드리프트 보정 구현; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface AimCalibrationConfig {
    yawHalfRangeDeg: number;   // 기본 22 (최소 8, 최대 45)
    pitchHalfRangeDeg: number; // 기본 16 (최소 6, 최대 40)
    sensitivityX: number;      // 기본 1.0 (0.4 ~ 2.5)
    sensitivityY: number;      // 기본 1.0 (0.4 ~ 2.5)
    invertY: boolean;          // 기본 false
  }

  export interface MeasuredRangeBounds {
    minYawDeg: number;
    maxYawDeg: number;
    minPitchDeg: number;
    maxPitchDeg: number;
    sampleCount: number;
  }

  export class GunGripTracker {
    public calibrateZero(sample: EulerOrientation): void;
    public startRangeMeasurement(): void;
    public recordRangeSample(sample: EulerOrientation): MeasuredRangeBounds;
    public finishRangeMeasurement(): AimCalibrationConfig;
    public setCalibrationConfig(partial: Partial<AimCalibrationConfig>): AimCalibrationConfig;
    public getCalibrationConfig(): AimCalibrationConfig;
    public computeRelativeAngles(sample: EulerOrientation): { yawDeg: number; pitchDeg: number; rollDeg: number };
    public computeAim(sample: EulerOrientation, smoothingAlpha?: number): AimResult;
    public detectSnapFire(sample: LinearAccelerationSample): boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. **Signed Shortest Angle Helper**:
     - `shortestAngleDeltaDeg(fromDeg, toDeg)`: `((toDeg - fromDeg + 540) % 360) - 180`으로 0°/360° 경계 점프를 방지합니다.
  2. **수평 Yaw (`yawDeg`) 및 수직 Pitch (`pitchDeg`) 계산 (`computeRelativeAngles`)**:
     - `yawDeg = shortestAngleDeltaDeg(sample.alpha, this.zeroSample.alpha)` (우측 회전 시 `alpha`가 감소하므로 `zero.alpha - sample.alpha > 0`이 되어 우측 `+X`로 이동).
     - `deltaBeta = shortestAngleDeltaDeg(this.zeroSample.beta, sample.beta)` (폰 상단 총구를 위로 치켜들면 `beta`가 증가하므로 `sample.beta - zero.beta > 0`).
     - `deltaGamma = -(sample.gamma - this.zeroSample.gamma)` (권총 측면 파지 `|zero.gamma| >= 60` 상태에서 `beta` 변화 없이 `gamma`만 변하는 환경/기존 유닛 테스트 호환을 위해 `Math.abs(deltaBeta) >= Math.abs(deltaGamma) * 0.5 ? deltaBeta : deltaBeta + deltaGamma`로 결합).
     - `rollDeg = sample.gamma - this.zeroSample.gamma`.
  3. **2단계 가동 범위 측정 (`startRangeMeasurement`, `recordRangeSample`, `finishRangeMeasurement`)**:
     - 측정 중 들어오는 샘플들의 `yawDeg`, `pitchDeg` 최소/최대값을 기록합니다.
     - 완료 시 `measuredYawHalf = Math.max(Math.abs(minYawDeg), Math.abs(maxYawDeg), (maxYawDeg - minYawDeg) / 2)`를 `[8, 45]` 범위로 클램핑하여 `yawHalfRangeDeg`에 반영하고, `measuredPitchHalf = Math.max(Math.abs(minPitchDeg), Math.abs(maxPitchDeg), (maxPitchDeg - minPitchDeg) / 2)`를 `[6, 40]` 범위로 클램핑하여 `pitchHalfRangeDeg`에 저장합니다.
  4. **정규화 조준 좌표 및 스무딩 (`computeAim`)**:
     - `rawAimX = clamp((yawDeg / config.yawHalfRangeDeg) * config.sensitivityX, -1, 1)`
     - `signedPitch = config.invertY ? -pitchDeg : pitchDeg`
     - `rawAimY = clamp((signedPitch / config.pitchHalfRangeDeg) * config.sensitivityY, -1, 1)`
     - 기존 적응형 스무딩(`delta > 0.15 ? 1.0 : smoothingAlpha`)을 동일하게 적용해 반환합니다.

### I03. 모바일 2단계 영점 가이드(`ZeroingGuide`) 및 전투 시작 버튼(`GunGripPad`, `MobileControllerPage`) 업데이트

- Related Files:
  - `src/controller/components/ZeroingGuide.tsx` :: `ZeroingGuide` — 1단계(정면 영점) + 2단계(상하좌우 범위 측정/스킵) UI 제공; modify
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 게임 시작 대기 시 '🚀 준비 완료! 게임 시작' 버튼 및 상단 영점 즉시 리셋 제공; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 영점 완료 시 실시간 센서 스트리밍 시작 및 `START_GAME_REQUEST` 전송 연동; modify

#### Details
- `ZeroingGuideProps`는 기존 `{ onCalibrateZero: () => void }`와의 하위 호환성을 유지하면서 선택적 props(`currentAngles?: { yawDeg: number; pitchDeg: number }`, `rangeBounds?: MeasuredRangeBounds`, `onStartRangeMeasure?: () => void`, `onFinishRangeMeasure?: () => void`)를 지원합니다.
- `MobileControllerPage`는 `ZEROING` 단계에서도 영점 1단계 완료 즉시 `SENSOR_FRAME` 스트리밍을 활성화하여 PC 화면의 조준선이 실시간으로 움직이게 하고, `GunGripPad`에 `onRequestStartGame` 콜백을 전달해 사용자가 직접 `'🚀 전투 시작!'` 버튼을 누를 때 `START_GAME_REQUEST`를 전송합니다.

### I04. 센서 및 웹소켓 프로토콜 유닛 테스트 보강

- Related Files:
  - `tests/controller-sensors.test.ts` — `beta` 기반 상하 피치 인식, 2단계 가동 범위 캘리브레이션, 감도 배율 검증 추가; modify
  - `tests/server-session.test.ts` — `START_GAME_REQUEST` -> `GAME_START_RELAY` 중계 검증 추가; modify

## Acceptance Criteria
- [ ] 폰을 위아래로 기울여 `beta`가 변할 때 `aimY`와 `pitchDeg`가 양방향(`+`/`-`)으로 정확히 비례하여 움직인다.
- [ ] 기존 측면 파지 `gamma` 변화 테스트 및 스냅 사격 테스트가 모두 회귀 없이 통과한다.
- [ ] 2단계 가동 범위 측정(`startRangeMeasurement` -> `recordRangeSample` -> `finishRangeMeasurement`)을 수행하면 측정된 사용자 손목 각도 폭에 맞춰 `aimX`, `aimY`가 `[-1, 1]`로 스케일링된다.
- [ ] 모바일에서 `START_GAME_REQUEST` 전송 시 PC로 `GAME_START_RELAY`가 정상 중계된다.

## Validation
- `npx vitest run tests/controller-sensors.test.ts tests/server-session.test.ts` — 모든 테스트 케이스 통과

## Commit Message
```text
feat(controller): fix pitch/yaw gyro extraction and add 2-step range calibration

Plan: 2026-11-02-zeroing-calibration-and-test-lab
Phase: P01-zeroing-and-test-lab
Task: T01-gyro-pitch-yaw-and-range-calibration

- Extract vertical pitch from W3C beta angle with 360-degree wrap-safe yaw delta
- Add 2-step custom range measurement and sensitivity scaling to GunGripTracker
- Add START_GAME_REQUEST and GAME_START_RELAY messages to decouple zeroing from game start
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: completed
