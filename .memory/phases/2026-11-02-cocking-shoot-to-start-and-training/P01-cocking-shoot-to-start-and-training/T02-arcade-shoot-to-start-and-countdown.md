# Task: T02 PC 대기 화면 [SHOOT TO START] 과녁 피격 판정 및 3-2-1 카운트다운 영점화 연동

## Status: pending

## Goal
PC 대기 화면(`PAIRING` 모달) 중앙에 아케이드 스타일의 대형 `[🎯 SHOOT TO START] 과녁`을 배치하고, 폰을 겨눈 상태에서 모니터의 과녁을 조준하여 "철컥 탕!" 사격(위로 스냅)을 명중시켰을 때 피격 효과음과 함께 3, 2, 1 카운트다운이 시작되고 0초에 정면 영점을 자동 고정하며 게임이 시작되도록 구현한다.

## Decision Summary
- [D03](../../decisions/2026-11-02-cocking-shoot-to-start-flow.md): PC 대기 화면 중앙에 [SHOOT TO START] 과녁 배치 및 조준 사격 명중 시 3-2-1 카운트다운 후 0초 자동 영점화.

## Implementation

### I01. QRPairingModal 아케이드 [SHOOT TO START] 과녁 UI

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModal` — 컨트롤러 연결 시 모달 하단에 아케이드 조준 타겟 렌더링; modify

#### Details
- **UI Elements**:
  - 컨트롤러 페어링 완료(`pairedPlayer` 존재) 시:
    - 모니터 중앙 하단에 펄스 애니메이션이 적용된 골드/에메랄드 과녁:
      ```tsx
      <div id="shoot-to-start-target" style={{ ... }}>
        🎯 SHOOT TO START! (화면 터치 장전 ➔ 위로 채서 과녁을 쏘세요)
      </div>
      ```
    - PC 마우스 사용자를 위해 과녁 직접 클릭 시에도 `onStartWithController()`가 동작하도록 지원.

### I02. PCGamePage 대기 화면 과녁 피격 판정 및 카운트다운 연동

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 대기 중 `p.snapFire` 수신 시 [SHOOT TO START] 과녁 충돌 검사 및 카운트다운 실행; modify

#### Details
- **Execution Flow / Logic**:
  1. `gamePhase === 'PAIRING' || gamePhase === 'ZEROING'` 상태에서:
     - `p.snapFire === true` 수신 시:
       - 사격 효과음 `soundSynth.playShoot()` 및 피격음 `soundSynth.playHit('PERFECT')` 재생.
       - 조준선 좌표(`effectiveAimX`, `effectiveAimY`)가 중앙 과녁 영역(예: `Math.abs(effectiveAimX) < 0.45 && Math.abs(effectiveAimY) < 0.45`)에 부합하거나, 화면을 겨누고 쐈을 때:
       - `startCountdownAndGame()` 호출!
  2. `startCountdownAndGame`:
     - PC 화면 및 폰에 `GAME_COUNTDOWN_START` 3초 카운트다운 전송.
     - 0초 도달 시: 현재 수신된 조준 각도를 기준으로 정면 영점 자동 캘리브레이션(`zeroOffsetRef` 또는 `handleCalibrateZero`).
     - `engine.startGame()` 호출 및 `setGamePhase('PLAYING')` 전이.

## Acceptance Criteria
- [ ] 스마트폰이 연결되면 PC 화면 중앙에 눈에 띄는 아케이드 [SHOOT TO START] 과녁이 나타난다.
- [ ] 폰으로 모니터의 [SHOOT TO START] 과녁을 겨누고 "철컥 탕!" 쏘면 타겟이 반응하며 3, 2, 1 카운트다운이 시작된다.
- [ ] 3초 동안 모니터를 겨누고 대기하면 0초에 정면 영점이 자동으로 잡히며 게임이 시작된다.
- [ ] `tests/pc-modals-and-pairing.test.ts` 통과.

## Validation
- `npx vitest run tests/pc-modals-and-pairing.test.ts` — 대기 화면 과녁 렌더링 및 사격 시작 검증
- `npx vitest run tests/server-session.test.ts` — 카운트다운 웹소켓 릴레이 검증

## Commit Message
```text
feat(flow): implement arcade shoot-to-start target with 3-2-1 countdown zeroing

Plan: 2026-11-02-cocking-shoot-to-start-and-training
Phase: P01-cocking-shoot-to-start-and-training
Task: T02-arcade-shoot-to-start-and-countdown

- Add arcade-style [SHOOT TO START] target to QRPairingModal when controller is paired
- Trigger hit sound and 3-2-1 countdown upon shooting the start target
- Automatically calibrate zero orientation at 0s and start the game
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
