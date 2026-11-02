# Task: T02 모바일-PC 양방향 카운트다운 동기화, 0초 자동 영점화 및 햅틱 피드백

## Status: done

## Goal
게임 시작 요청 시 서버를 통해 모바일과 PC 양쪽에 3초 카운트다운(`GAME_COUNTDOWN_START`)을 동시에 브로드캐스트하고, 폰 화면에도 3, 2, 1 대형 숫자와 초당 햅틱 진동("모니터 정중앙을 겨누세요!")을 표시하며, 0초가 되는 순간 현재 총구 방향을 정면 영점으로 자동 고정(Auto Zeroing)하고 전투 컨트롤러 화면으로 즉시 전환하여 시작 먹통 혼란을 원천 해소한다.

## Decision Summary
- [D03](../../decisions/2026-11-02-snap-fever-zeroing-ux-sync.md): 3초 카운트다운 종료(0초) 시점 자동 영점(`calibrateZero`) 동기화.
- [D04](../../decisions/2026-11-02-snap-fever-zeroing-ux-sync.md): 웹소켓 `GAME_COUNTDOWN_START` 양방향 브로드캐스트 + 모바일 카운트다운 오버레이 & 햅틱.
- [D05](../../decisions/2026-11-02-snap-fever-zeroing-ux-sync.md): PC QR 모달 오디오 언락 인터랙션 가이드 표시.

## Implementation

### I01. WebSocket 프로토콜 확장 및 서버 브로드캐스트

- Related Files:
  - `src/shared/types.ts` :: `ServerToClientMessage` — `GAME_COUNTDOWN_START` 및 `GAME_STARTED` 메시지 타입 추가; modify
  - `server/wsServer.ts` :: `wsServer` — `START_GAME_REQUEST` 수신 시 양쪽 소켓(PC & Mobile)에 동시 중계; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/types.ts
  export type ServerToClientMessage =
    | ...
    | { type: 'GAME_COUNTDOWN_START'; roomId: string; sec: number }
    | { type: 'GAME_STARTED'; roomId: string };
  ```
- **Execution Flow / Logic (`server/wsServer.ts`)**:
  1. `case 'START_GAME_REQUEST'`:
     - `session = roomManager.getRoom(roomId)`
     - `sendJson(session.pcSocket, { type: 'GAME_COUNTDOWN_START', roomId, sec: 3 })`
     - `sendJson(session.controllerSocket, { type: 'GAME_COUNTDOWN_START', roomId, sec: 3 })`

### I02. 모바일 컨트롤러 카운트다운 오버레이 및 0초 자동 영점화

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 카운트다운 수신, 햅틱 루프 및 0초 자동 영점화; modify
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 상단 원터치 영점 버튼 가시성 강화 및 복잡 텍스트 정리; modify
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModal` — 오디오 언락 클릭 안내 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // MobileControllerPage.tsx
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  ```
- **Execution Flow / Logic**:
  1. WebSocket 수신 `case 'GAME_COUNTDOWN_START'`:
     - `setCountdownSec(msg.sec);`
     - `setStep('PAD');` // 영점 가이드 모달 즉시 닫고 패드 모드로 전환
     - 1초 주기 타이머 가동:
       - 매 초마다 `triggerHaptic(60)`
       - `sec === 0` 시:
         - `handleCalibrateZero()` 즉시 호출! (자동 영점 고정)
         - `triggerHaptic([100, 50, 150])` 전투 시작 햅틱
         - `setCountdownSec(null);`
         - `setIsGameWaiting(false);`
  2. UI Overlay (`countdownSec !== null`):
     - Z-Index 200의 전체 화면 반투명 블러 오버레이
     - 거대한 금빛 숫자 `{countdownSec}` 애니메이션
     - 하단 안내: "폰을 PC 모니터 정중앙으로 겨누세요!"

## Acceptance Criteria
- [ ] 폰에서 '게임 시작'을 누르면 폰과 PC 양쪽 모두에 3, 2, 1 카운트다운이 동시에 뜬다.
- [ ] 폰 화면에서 카운트다운 동안 1초마다 햅틱 진동이 울린다.
- [ ] 카운트다운이 0이 되는 순간 모바일에서 자동으로 정면 영점이 잡히고 게임 화면으로 진입한다.
- [ ] 게임 도중 폰 상단의 `🎯 정면 영점` 버튼을 누르면 언제든 즉시 재영점이 된다.
- [ ] `tests/server-session.test.ts` 및 전체 회귀 테스트 통과.

## Validation
- `npx vitest run tests/server-session.test.ts` — 카운트다운 브로드캐스트 검증
- `npx vitest run tests/controller-sensors.test.ts` — 컨트롤러 센서 검증
- `npx vitest run` — 전체 40여 개 테스트 통과
- `npm run build` — 빌드 컴파일 성공

## Commit Message
```text
feat(sync): implement 2-way game countdown, auto-zeroing at zero sec, and audio unlock

Plan: 2026-11-02-snap-fever-zeroing-ux-sync
Phase: P01-snap-fever-zeroing-sync
Task: T02-countdown-sync-and-auto-zeroing

- Broadcast GAME_COUNTDOWN_START to both PC and mobile sockets
- Display 3-2-1 countdown overlay with per-second haptics on mobile
- Trigger auto-zero calibration automatically when countdown reaches zero
- Add audio unlock guidance and polish top-bar zeroing button
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
