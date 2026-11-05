# Task: T03 재연결 뒤 PC 화면 동기화

## Status: pending

## Goal
PC를 새로고침해 PAIRING으로 돌아온 상태에서 폰이 재연결되면, 폰이 이미 조준 완료 상태(`step === 'PAD'`)이므로 PC가 ZEROING으로 넘어가 '중앙을 쏘면 시작'이 동작한다. 게임 도중 폰만 재연결되면 PC의 영점 오프셋과 게임 상태는 건드리지 않는다.

## Decision Summary
- 현재 PC `case 'ZERO_CALIBRATED'`는 항상 `zeroOffsetRef`를 0으로 리셋하고 PAIRING이면 ZEROING으로 보낸다. 폰 재연결 때 이 메시지를 그대로 쓰면 **게임 중 조준이 튄다**. 그래서 `resume` 플래그로 구분한다.
- 폰 페이지가 완전히 새로 열린 경우는 `step`이 `LOGIN_GATE`로 시작해 기존 흐름(권한·영점)을 그대로 탄다. 이 Task는 소켓만 다시 붙은 경우를 다룬다.

## Implementation

### I01. 프로토콜
- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`의 `CALIBRATE_ZERO`, `ServerToClientMessage`의 `ZERO_CALIBRATED`; modify
  - `server/wsServer.ts` :: `case 'CALIBRATE_ZERO'`; modify

#### Details
- **Signatures & Types**:
  ```ts
  | { type: 'CALIBRATE_ZERO'; roomId: string; deviceId: string; resume?: boolean }
  | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string; resume?: boolean }
  ```
- **Logic**: 서버는 `resume: msg.resume === true`일 때만 `resume: true`를 중계 메시지에 포함한다(미포함 시 필드 생략으로 기존 JSON과 동일).

### I02. 폰: 재연결 시 resume 전송
- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `case 'AUTH_RESULT'`; modify (T02의 `hasConnectedBeforeRef`, `connectionState` 사용)

#### Details
- **Logic**: `AUTH_RESULT`를 받을 때 `hasConnectedBeforeRef.current`가 이미 true이고(재연결), 현재 `step`이 `'PAD'`이며 `msg.player`가 있으면 `CALIBRATE_ZERO`를 `resume: true`로 전송한다. 그 다음 `hasConnectedBeforeRef.current = true`. `step`은 클로저가 낡을 수 있으니 `stepRef`(`useRef`, 렌더마다 `stepRef.current = step`)를 쓴다. 폰의 `tracker.calibrateZero`는 호출하지 않는다(폰의 영점은 그대로).

### I03. PC: resume 처리
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `case 'ZERO_CALIBRATED'`; modify

#### Details
- **Logic**:
  ```ts
  case 'ZERO_CALIBRATED':
    if (msg.resume) {
      // 폰이 소켓만 다시 붙임: 영점 오프셋은 유지하고, 로비에 있을 때만 영점 단계로 넘긴다.
      setIsZeroCalibrated(true);
      if (gamePhaseRef.current === 'PAIRING') setGamePhase('ZEROING');
      break;
    }
    // 기존 동작 그대로
  ```

### I04. 테스트
- Related Files:
  - `tests/room-persistence.test.ts` :: 추가 케이스; modify (T01에서 생성)

#### Details
- 서버: 폰 소켓이 `CALIBRATE_ZERO { resume: true }`를 보내면 PC 소켓이 `ZERO_CALIBRATED`에 `resume: true`를 받는다. `resume`을 보내지 않으면 PC가 받은 메시지에 `resume` 키가 없다.
- `tests/shared-protocol.test.ts`가 메시지 타입을 열거하면 새 필드로 깨지지 않는지 확인한다.

## Acceptance Criteria
- [ ] PC 새로고침 후 폰이 재연결되면 PC가 ZEROING이 된다.
- [ ] 게임 중 폰이 재연결돼도 PC `zeroOffsetRef`가 바뀌지 않는다(코드상 `resume` 분기에 오프셋 대입이 없다).
- [ ] 일반 영점 보정(`resume` 없음)은 기존과 같다.

## Validation
- `npx vitest run tests/room-persistence.test.ts tests/shared-protocol.test.ts tests/server-session.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(pairing): resume the PC screen when the controller reconnects

Plan: 2026-11-06-controller-persistence-and-pause
Phase: P01-connection-persistence
Task: T03-resume-sync

- add an optional resume flag to CALIBRATE_ZERO / ZERO_CALIBRATED
- send it from a reconnected controller that is already on the pad
- move the PC from PAIRING to ZEROING without touching the zero offset
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
