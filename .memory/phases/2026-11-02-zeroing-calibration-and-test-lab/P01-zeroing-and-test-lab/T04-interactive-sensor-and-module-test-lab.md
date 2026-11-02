# Task: T04 올인원 센서·영점 & 게임 모듈 테스트장(Sandbox Test Lab) UI 및 `/sensor-test` 라우팅 통합

## Status: done

## Goal
사용자가 스마트폰 조준 움직임·인식 정도(상하/좌우 각도, 감도, 영점)를 실시간 게이지로 점검하고, 동시에 피버 발동·총 쏘는 반동 모션·몬스터 6종 피격 및 처치 모습·아이템 4종 효과를 한 화면에서 마음껏 테스트할 수 있는 `SensorAndModuleTestLabOverlay` 컴포넌트와 `/sensor-test` 진입 경로를 구현합니다.

## Decision Summary
- **D04**: PC 로비(`QRPairingModal`)의 `'🎯 영점·센서 & 모듈 테스트장'` 버튼 또는 `/sensor-test`(`?mode=test`) URL로 즉시 진입 가능한 올인원 샌드박스 제어판 UI를 구축합니다.

## Implementation

### I01. `SensorAndModuleTestLabOverlay` 올인원 제어판 UI 구현

- Related Files:
  - `src/pc/components/SensorAndModuleTestLabOverlay.tsx` :: `SensorAndModuleTestLabOverlay`, `SensorDiagnosticsState` — 센서/영점 실시간 진단 패널 + 몬스터 6종 소환 제어판 + 무기/피버/아이템 모듈 테스트 패널; new

#### Details
- **Signatures & Types**:
  ```typescript
  import React from 'react';
  import { ActiveBuffState, ItemBuffKind, JudgmentGrade, PlayerProfile, TargetKind } from '../../shared/types';

  export interface SensorDiagnosticsState {
    aimX: number;
    aimY: number;
    yawDeg: number;
    pitchDeg: number;
    rollDeg: number;
    sensitivityX: number;
    sensitivityY: number;
    invertY: boolean;
    lastSnapFireAt?: number;
    rapidFireHold: boolean;
    packetHz: number;
  }

  export interface SensorAndModuleTestLabOverlayProps {
    roomId: string;
    lanIp?: string;
    pairedPlayer?: PlayerProfile;
    diagnostics: SensorDiagnosticsState;
    targetsCount: number;
    stationarySpawn: boolean;
    infiniteAmmo: boolean;
    ammo: number;
    maxAmmo: number;
    isReloading: boolean;
    feverGauge: number;
    isFeverReady: boolean;
    isFeverActive: boolean;
    activeBuffs: ActiveBuffState[];
    lastJudgment?: { grade: JudgmentGrade; key: number };
    onToggleStationarySpawn: (stationary: boolean) => void;
    onSpawnTarget: (kind: TargetKind) => void;
    onSpawnFivePointTargets: () => void;
    onClearTargets: () => void;
    onSpawnItem: (itemKind: ItemBuffKind) => void;
    onActivateBuffImmediate: (itemKind: ItemBuffKind) => void;
    onTriggerFeverImmediate: () => void;
    onToggleInfiniteAmmo: (infinite: boolean) => void;
    onTestFireShot: () => void;
    onSensitivityChange: (sensX: number, sensY: number, invertY: boolean) => void;
    onResetZeroCenter: () => void;
    onStartRealGame: () => void;
    onExitToLobby: () => void;
  }
  ```
- **UI 레이아웃 (3D 캔버스 시야를 가리지 않는 좌·우·하단 도킹 아케이드 테스트 콘솔)**:
  1. **상단 헤더 바**:
     - `🧪 SENSOR & MODULE TEST LAB` 배지, 방 코드(`ROOM CODE: {roomId}`) 및 연결된 컨트롤러 상태 표시
     - 우측 액션 버튼: `🎯 5점 영점 과녁 재배치`, `🚀 실전 배틀 시작!`, `🔙 로비로 돌아가기`
  2. **좌측 패널 — 실시간 센서 & 영점 인식 진단기 (Sensor & Zeroing Diagnostics)**:
     - **2D 미니 레이더 & 십자선 트래커**: 현재 `(aimX, aimY)` 위치와 상·하·좌·우 끝점 도달 여부를 실시간 점으로 표시
     - **상하(Pitch) / 좌우(Yaw) 각도 바 게이지**: `yawDeg (°)`, `pitchDeg (°)`, `rollDeg (°)`, 수신 주기(`Hz`), 연사 홀드/스냅 격발 감지 인디케이터 표시
     - **감도(Sensitivity) & 축 보정 컨트롤**:
       - 좌우 감도 배율 슬라이더 (`0.5x ~ 2.0x`)
       - 상하 감도 배율 슬라이더 (`0.5x ~ 2.0x`)
       - 상하(Y축) 반전 체크박스 & `🎯 현재 조준점을 정중앙(0,0)으로 영점 보정` 버튼
  3. **우측 패널 — 몬스터 6종 & 아이템/피버/총기 모듈 제어판 (Module Sandbox Controls)**:
     - **소환 모드 토글**: `[📌 정지 표적 (영점/조준 연습)]` vs `[🏃 이동 표적 (접근/처치 모션)]`
     - **몬스터 6종 즉시 소환 버튼 그리드**:
       - `필굿 (공중 1HP)`, `카스 라이트 (공중 1HP)`, `오비 라거 (지상 2HP)`, `한맥 (지상 2HP)`, `카스 병맥주 (3HP 병깨짐)`, `생맥주 냉각기 보스 (40HP)` + `🧹 표적 전체 삭제`
     - **무기·피버·아이템 4종 즉시 발동 그리드**:
       - `🔥 피버 100% 충전 & 즉시 발동`, `♾️ 무한 탄창 ON/OFF`, `🔫 현재 조준점 테스트 격발`
       - 아이템 4종(`💥 파워 샷 2X`, `🎯 빅 스코프 1.6X`, `🧊 아이스 프리즈`, `🍺 바 수리`) **[아이템 표적 스폰]** 및 **[버프 즉시 발동]** 버튼

### I02. `App.tsx` 라우팅(`/sensor-test`, `?mode=test`) 및 `PCGamePage.tsx` 통합

- Related Files:
  - `src/App.tsx` :: `resolveRouteMode`, `App` — `/sensor-test` 또는 `?mode=test` 진입 시 `PCGamePage`를 `initialMode="SANDBOX"`로 마운트; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `SANDBOX` 페이즈 렌더링, PC 측 소프트웨어 영점 오프셋/감도 배율 보정 및 모듈 테스트 핸들러 연결; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/App.tsx
  export function resolveRouteMode(
    pathname: string,
    search: string
  ): 'PC' | 'CONTROLLER' | 'SANDBOX' {
    const params = new URLSearchParams(search);
    if (pathname.startsWith('/controller') || params.has('room')) {
      return 'CONTROLLER';
    }
    if (pathname.startsWith('/sensor-test') || params.get('mode') === 'test') {
      return 'SANDBOX';
    }
    return 'PC';
  }
  ```
- `PCGamePage`는 `initialPhase?: GamePhase` prop을 받아 `initialPhase === 'SANDBOX'`이면 마운트 시 `engine.startSandboxMode()`로 바로 테스트장을 엽니다.
- 또한 `PCGamePage`에서 수신된 `SENSOR_RELAY`의 `yawDeg`, `pitchDeg`, `rollDeg`를 `diagnostics` 상태로 업데이트하고, 테스트장에서 조절한 `sensitivityX`, `sensitivityY`, `invertY` 및 PC 측 영점 오프셋을 실시간 조준 좌표에 반영합니다.

### I03. 라우팅 및 테스트장 통합 유닛 테스트

- Related Files:
  - `tests/controller-ui-and-routing.test.ts` — `/sensor-test` 및 `?mode=test` 라우트 해석 테스트 추가; modify
  - `tests/tutorial-and-guide.test.ts` — 테스트장 제어판 헬퍼 및 시나리오 검증; modify

## Acceptance Criteria
- [ ] 로비의 `'🎯 영점·센서 & 모듈 테스트장'` 버튼 클릭 시 또는 `/sensor-test` 접속 시 3D 테스트장이 즉시 열린다.
- [ ] 테스트장 좌측 패널에서 상하(`pitchDeg`)·좌우(`yawDeg`) 각도와 `(aimX, aimY)` 2D 레이더가 실시간으로 표시되며, 감도 슬라이더 및 영점 리셋이 즉시 조준선에 반영된다.
- [ ] 테스트장 우측 패널에서 몬스터 6종(보스·병맥주 포함)을 정지/이동 상태로 소환해 총기 발사 모션과 처치 이펙트(병 깨짐 등)를 테스트할 수 있다.
- [ ] 피버 즉시 발동, 무한 탄창 토글, 아이템 4종 스폰/즉시 발동 버튼이 모두 정상 작동한다.
- [ ] 전체 테스트 스위트(`npx vitest run`) 및 프로덕션 빌드(`npm run build`)가 에러 없이 성공한다.

## Validation
- `npx vitest run` — 전체 테스트 스위트 통과
- `npm run build` — TypeScript 컴파일 및 Vite 번들링 성공

## Commit Message
```text
feat(pc): build interactive sensor and module test lab page

Plan: 2026-11-02-zeroing-calibration-and-test-lab
Phase: P01-zeroing-and-test-lab
Task: T04-interactive-sensor-and-module-test-lab

- Create SensorAndModuleTestLabOverlay with live gyro gauges, 2D radar, and sensitivity sliders
- Add 6-monster spawner (stationary/moving), 5-point calibration targets, and 4-item/fever triggers
- Support /sensor-test route and lobby button entry into SANDBOX mode
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: completed
