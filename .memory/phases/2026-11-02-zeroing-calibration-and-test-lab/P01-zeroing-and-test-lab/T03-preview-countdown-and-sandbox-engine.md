# Task: T03 영점 후 실시간 조준 프리뷰 대기, 3초 카운트다운 시작 흐름 및 엔진 샌드박스(모듈 테스트) 모드 구현

## Status: pending

## Goal
영점 완료(`ZERO_CALIBRATED`) 시 즉시 본게임이 시작되어 대응하기 힘들었던 문제를 해결하기 위해, 로비/대기 화면에서 실시간 조준선(`CrosshairOverlay`) 프리뷰를 먼저 보여주고 모바일 또는 PC에서 '게임 시작' 요청 시 3초 카운트다운(`3 -> 2 -> 1 -> START!`) 후 Wave 1을 시작하며, `BeerCrusherEngine`에 몬스터 6종·아이템 4종·피버·무한탄창을 자유롭게 시험할 수 있는 샌드박스(`SANDBOX`) 모드를 추가합니다.

## Decision Summary
- **D03**: `ZERO_CALIBRATED` 수신 시 PC 화면은 `ZEROING`(영점 완료 & 조준 프리뷰 대기) 상태로 전환하여 실시간 조준선을 렌더링하고, `GAME_START_RELAY` 또는 PC 시작 버튼 클릭 시 3초 카운트다운 후 `startGame()`을 호출합니다.
- **D04**: `BeerCrusherEngine`에 `SANDBOX` 모드를 도입하여 정지/이동 몬스터 6종 소환, 상하좌우 5점 영점 과녁 배치, 아이템 4종 즉시 스폰/발동, 피버 100% 충전·발동, 무한 탄창 토글 메서드를 제공합니다.

## Implementation

### I01. `BeerCrusherEngine` 샌드박스(모듈 테스트) 모드 API 구현

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine`, `ActiveTargetEntity` — `SANDBOX` 모드 상태 관리, 정지/이동 몬스터 소환, 5점 영점 과녁 세트 배치, 무한 탄창 및 피버 즉시 제어 메서드 추가; modify
  - `src/pc/engine/WeaponSystem.ts` :: `WeaponSystem` — 샌드박스용 무한 탄창(`infiniteAmmo`) 플래그 지원; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/engine/BeerCrusherEngine.ts
  export interface ActiveTargetEntity {
    // ...기존 필드에 아래 선택적 필드 추가
    customNormY?: number; // 상하좌우 영점 과녁 등 특정 화면 높이에 배치된 표적용 정규화 Y 좌표
    customBaseY?: number; // 3D 월드 Y 좌표 오버라이드 (상단/하단 공중 과녁용)
  }

  export interface SandboxSpawnOptions {
    stationary?: boolean;
    thetaRad?: number;
    radiusM?: number;
    customNormY?: number;
    customBaseY?: number;
  }

  // BeerCrusherEngine 추가 프로퍼티 및 메서드
  public isSandboxMode = false;
  public infiniteAmmo = false;

  public startSandboxMode(): void;
  public exitSandboxMode(): void;
  public spawnSandboxTarget(kind: TargetKind, options?: SandboxSpawnOptions): ActiveTargetEntity;
  public spawnCalibrationFiveTargets(): ActiveTargetEntity[];
  public clearSandboxTargets(): void;
  public setInfiniteAmmo(enabled: boolean): void;
  public triggerSandboxFever(nowMs: number): boolean;
  ```
- **Execution Flow / Logic**:
  1. `startSandboxMode()`:
     - `this.gamePhase = 'SANDBOX'`, `this.isSandboxMode = true`, `this.isTutorialMode = false`, `this.lives = STAGE_CONSTANTS.PLAYER_MAX_LIVES`, `this.activeTargets = []`, `this.scoreManager.reset()`, `this.weaponSystem.reset()`.
     - 기본으로 정중앙 및 좌/우/상/하 연습 표적(`spawnCalibrationFiveTargets()`)을 배치합니다.
  2. `spawnCalibrationFiveTargets()`:
     - 화면 정중앙(`thetaRad: 0, customNormY: 0, customBaseY: 1.18`), 좌측(`thetaRad: -0.42, customNormY: 0, customBaseY: 1.18`), 우측(`thetaRad: 0.42, customNormY: 0, customBaseY: 1.18`), 상단(`thetaRad: 0, customNormY: 0.55, customBaseY: 2.35`), 하단(`thetaRad: 0, customNormY: -0.55, customBaseY: 0.35`)에 정지(`speedMps: 0`, `radiusM: 9.0`) 표적 5개를 생성하여 상하좌우 조준 정확도를 즉시 시험할 수 있게 합니다.
  3. `spawnSandboxTarget(kind, options)`:
     - `stationary: true`이면 `speedMps = 0, radiusM = options?.radiusM ?? 9.5`에 스폰하고, `stationary: false`이면 해당 몬스터의 원래 `spec.speedMps`와 `radiusM = 16.0`에서 다가오게 스폰합니다.
  4. `update(nowMs, dtSec)` 및 `shootAt(aimX, aimY, nowMs)`:
     - `this.gamePhase === 'SANDBOX'`일 때도 `PLAYING`/`TUTORIAL`과 동일하게 타겟 이동, 버프 타이머, 무기 재장전, 사격 판정을 수행합니다.
     - 단, `isSandboxMode`에서 이동 표적이 방어선(`breached`)에 도달하면 체력을 깎지 않고 원래 스폰 거리(`16.0m`)로 재배치하여 반복 테스트가 가능하게 합니다.
     - `infiniteAmmo === true`일 때는 `weaponSystem.consumeShot(nowMs, true)`처럼 탄창 소모 없이 즉시 발사됩니다.
  5. `GameCanvas3D.tsx`에서 타겟의 3D Y 좌표를 설정할 때 `const baseY = target.customBaseY ?? getTargetBaseY(target.kind, target.isItem);`를 사용하여 상단/하단 영점 과녁이 실제 3D 공간의 상/하단 높이에 렌더링되도록 합니다.

### I02. `PCGamePage` & `QRPairingModal` 영점 프리뷰 대기 및 3초 카운트다운 시작 연동

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `ZERO_CALIBRATED` 시 조준 프리뷰 활성화, `GAME_START_RELAY` 또는 시작 버튼 클릭 시 3초 카운트다운 후 게임 시작; modify
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModal` — 영점 완료 배지 표시, 실시간 조준선 움직임 확인 안내, '🎯 영점·센서 & 모듈 테스트장' 진입 버튼 추가; modify

#### Details
- `PCGamePage.tsx`:
  - 상태 추가: `isZeroCalibrated: boolean`, `countdownSec: number | null` (`3 -> 2 -> 1 -> null`).
  - `ZERO_CALIBRATED` 수신 시: `setIsZeroCalibrated(true)`, `setGamePhase('ZEROING')`만 수행하고 `handleStartGame()`을 즉시 호출하지 않습니다!
  - `PAIRING` 또는 `ZEROING` 상태에서도 스마트폰이 연결되었거나 영점이 완료되면 화면 위에 `<CrosshairOverlay />`를 `zIndex: 120`으로 렌더링하여, 사용자가 로비 모달 위에서 내 조준선이 상하좌우로 잘 움직이는지 즉시 눈으로 확인할 수 있게 합니다.
  - `GAME_START_RELAY` 수신 시 또는 PC의 `onStartWithController` 클릭 시 `startCountdownAndGame()`을 호출하여 3초 카운트다운 오버레이(`3... 2... 1... GAME START!`)를 표시한 뒤 `handleStartGame()`을 실행합니다.

### I03. 샌드박스 엔진 모드 유닛 테스트 작성

- Related Files:
  - `tests/tutorial-and-guide.test.ts` — `startSandboxMode`, `spawnCalibrationFiveTargets`(상하좌우+중앙 5점 과녁 명중 판정), `spawnSandboxTarget`(6종 몬스터 정지/이동 소환), `setInfiniteAmmo`, `triggerSandboxFever` 검증 추가; modify

## Acceptance Criteria
- [ ] 모바일에서 `CALIBRATE_ZERO`를 보내도 Wave 1이 즉시 시작되지 않고, PC 화면에서 실시간 조준선 프리뷰가 표시된다.
- [ ] 모바일에서 `START_GAME_REQUEST`를 보내거나 PC에서 시작 버튼을 누르면 카운트다운 후 본게임이 시작된다.
- [ ] `engine.startSandboxMode()` 호출 시 상·하·좌·우·중앙 5개 정지 과녁이 생성되며, 상단(`aimY = 0.55`) 및 하단(`aimY = -0.55`) 조준 사격으로 각각의 과녁을 정확히 맞힐 수 있다.
- [ ] 샌드박스 모드에서 몬스터 6종 소환, 아이템 4종 발동, 피버 즉시 발동, 무한 탄창이 정상 작동하고 방어선 돌파 시 체력이 감소하지 않는다.

## Validation
- `npx vitest run tests/tutorial-and-guide.test.ts tests/server-session.test.ts` — 모든 테스트 통과

## Commit Message
```text
feat(engine): add sandbox test mode and decouple zero calibration from game start

Plan: 2026-11-02-zeroing-calibration-and-test-lab
Phase: P01-zeroing-and-test-lab
Task: T03-preview-countdown-and-sandbox-engine

- Keep PC in ZEROING preview state with live crosshair on ZERO_CALIBRATED
- Start Wave 1 after 3-second countdown upon GAME_START_RELAY or manual start
- Implement SANDBOX mode in BeerCrusherEngine with 5-point calibration targets and module controls
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
