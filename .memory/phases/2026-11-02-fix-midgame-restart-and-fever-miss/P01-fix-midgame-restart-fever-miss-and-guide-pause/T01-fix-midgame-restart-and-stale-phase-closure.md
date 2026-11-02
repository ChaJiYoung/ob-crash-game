# Task: T01 `gamePhaseRef` 도입을 통한 인게임 중 3-2-1 카운트다운 재시작(Stale Closure) 버그 원천 차단

## Status: done

## Goal
`PCGamePage.tsx`의 웹소켓 수신 핸들러(`socket.onmessage`)가 초기 마운트 시점의 `gamePhase === 'PAIRING'`을 클로저로 붙잡고 있어 인게임(`PLAYING`, `TUTORIAL`, `SANDBOX`) 중에도 중앙 스냅 사격 시 3, 2, 1 카운트다운과 함께 게임을 처음부터 리셋시키던 버그를 `gamePhaseRef`로 완전히 해결하고, `ZERO_CALIBRATED` 패킷이 인게임 상태를 덮어쓰지 않도록 보호한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-fix-midgame-restart-and-fever-miss.md): `gamePhaseRef`로 실시간 페이즈를 참조하여 `PAIRING`/`ZEROING` 대기 상태에서만 새 게임 카운트다운이 동작하게 하고, 인게임 중 `ZERO_CALIBRATED`가 상태를 덮어쓰지 못하도록 차단.

## Implementation

### I01. PCGamePage 실시간 `gamePhaseRef` 동기화 및 인게임 리셋 방어

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `gamePhaseRef` 추가 및 `socket.onmessage`, `startCountdownAndGame` 수정; modify
  - `tests/pc-modals-and-pairing.test.ts` :: `PC QR Pairing URL & Leaderboard Modal Helpers` — 인게임 중 사격 시 시작 과녁 판정 무시 검증 테스트 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/PCGamePage.tsx
  const [gamePhase, setGamePhase] = useState<GamePhase>(initialPhase ?? 'PAIRING');
  const gamePhaseRef = useRef<GamePhase>(gamePhase);
  gamePhaseRef.current = gamePhase;
  ```
- **Execution Flow / Logic**:
  1. `socket.onmessage` 내부의 `ZERO_CALIBRATED` 처리:
     - `setIsZeroCalibrated(true);`
     - `if (gamePhaseRef.current === 'PAIRING') { setGamePhase('ZEROING'); }` (인게임 중 영점 재조정 시 절대 `'ZEROING'`으로 상태를 되돌리지 않음!)
  2. `socket.onmessage` 내부의 `GAME_COUNTDOWN_START` / `GAME_START_RELAY` 처리:
     - `if (gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING') { startCountdownAndGameRef.current(); }`
  3. `socket.onmessage` 내부의 `SENSOR_RELAY` -> `if (p.snapFire)` 분기:
     - `const curPhase = gamePhaseRef.current;`
     - `if (curPhase === 'PAIRING' || curPhase === 'ZEROING')` 일 때만 [SHOOT TO START] 과녁 판정 및 `startCountdownAndGameRef.current()` 실행.
     - 그 외(`PLAYING`, `TUTORIAL`, `SANDBOX`)에는 100% `engine.shootAt(effectiveAimX, effectiveAimY, performance.now())` 및 `handleShootEvent(res)` 실행!
  4. `startCountdownAndGame` 내부 가드:
     - `if (gamePhaseRef.current !== 'PAIRING' && gamePhaseRef.current !== 'ZEROING') return;` 추가하여 인게임 중 어떤 경로로도 새 게임 카운트다운이 실행되지 못하도록 이중 잠금.

## Acceptance Criteria
- [x] 게임 시작(`PLAYING`) 후 화면 정중앙을 조준하고 위로 채어 쏴도 절대로 3, 2, 1 카운트다운이 뜨거나 게임이 리셋되지 않는다.
- [x] 게임 도중 폰 상단의 `[🎯 정면 영점 맞추기]`를 눌러도 로비 화면으로 튕기지 않고 영점만 즉시 보정된다.
- [x] 로비 대기 화면(`PAIRING`)에서는 기존처럼 `[SHOOT TO START]` 과녁을 쏴서 정상적으로 게임을 시작할 수 있다.
- [x] `tests/pc-modals-and-pairing.test.ts` 통과.

## Validation
- `npx vitest run tests/pc-modals-and-pairing.test.ts` — 페이즈별 시작 과녁 격발/무시 검증 통과

## Commit Message
```text
fix(pc): prevent mid-game 3-2-1 countdown restart caused by stale gamePhase closure

Plan: 2026-11-02-fix-midgame-restart-and-fever-miss
Phase: P01-fix-midgame-restart-fever-miss-and-guide-pause
Task: T01-fix-midgame-restart-and-stale-phase-closure

- Introduce gamePhaseRef to track live gamePhase inside WebSocket message handler
- Guard shoot-to-start and startCountdownAndGame to only run in PAIRING or ZEROING phase
- Prevent ZERO_CALIBRATED message from overwriting active PLAYING/TUTORIAL/SANDBOX phases
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
