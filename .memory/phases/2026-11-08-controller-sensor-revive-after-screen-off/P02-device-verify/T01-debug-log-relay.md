# Task: T01 임시 디버그 로그 릴레이

## Status: pending

## Goal
폰에서 센서 이벤트 정지·재등록 시점을 서버 파일 `data/sensor-debug.log`에 남겨서, 사용자가 폰으로 테스트한 뒤 로그를 읽고 가설(화면 꺼짐 → 센서 이벤트 정지)을 확인할 수 있게 한다. **임시 코드**이며 P02-T03에서 제거한다.

## Decision Summary
- D07: 실기기 로그로 가설 확인 후 제거.
- 폰 브라우저 콘솔은 읽을 수 없으므로 기존 WebSocket으로 서버에 보내 파일에 남긴다. `data/`는 `.gitignore`에 있어 커밋되지 않는다.
- 폰이 재연결 중일 때 발생한 로그는 소켓이 닫혀 있어 유실되므로, 큐에 모았다가 소켓이 열리면 보낸다.
- 모든 임시 코드에 `TEMP(sensor-debug)` 주석을 붙여 T03에서 한 번에 찾아 지운다.

## Implementation

### I01. 메시지 타입과 서버 핸들러

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage` — `DEBUG_LOG` 유니온 멤버 추가; modify
  - `server/wsServer.ts` :: `ws.on('message')`의 `switch (msg.type)` — `case 'DEBUG_LOG'` 추가 (`default:` 위); modify

#### Details
- **Signatures & Types**:
  ```typescript
  // TEMP(sensor-debug)
  | { type: 'DEBUG_LOG'; roomId: string; deviceId: string; tag: string; data?: Record<string, unknown>; ts: number }
  ```
- **Execution Flow / Logic**:
  1. 서버: `console.log('[sensor-debug]', msg.deviceId, msg.tag, JSON.stringify(msg.data ?? {}))`.
  2. 같은 내용을 `data/sensor-debug.log`에 한 줄씩 append한다 (`fs.mkdirSync('data', { recursive: true })` 후 `fs.appendFileSync`). 줄 형식: `${new Date(msg.ts).toISOString()} ${msg.deviceId} ${msg.tag} ${JSON.stringify(msg.data ?? {})}\n`.
  3. 파일 쓰기 실패는 try/catch로 삼키고 `console.log`만 남긴다 (게임 동작에 영향 금지).
  4. 응답 메시지는 보내지 않는다.
  5. 서버는 `npm run server`로 띄우며 재시작해야 반영된다 (T02 안내에 명시).

### I02. 폰 쪽 로그 큐와 호출 지점

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: 센서 effect, 화면 복귀·워치독 effect — 로그 호출 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // TEMP(sensor-debug)
  const debugQueueRef = useRef<Array<{ tag: string; data?: Record<string, unknown>; ts: number }>>([]);
  const sendDebug = useCallback((tag: string, data?: Record<string, unknown>) => { /* 큐에 push 후 flush */ }, [roomId, deviceId]);
  ```
- **Execution Flow / Logic**:
  1. `sendDebug`는 큐에 `{tag, data, ts: Date.now()}`를 넣고, `wsRef.current?.readyState === WebSocket.OPEN`이면 큐 전체를 `DEBUG_LOG`로 보내고 비운다. 큐 최대 100개(초과 시 오래된 것 버림).
  2. 워치독 `setInterval`(500ms) 안에서도 큐 flush를 시도한다 (소켓 재연결 후 유실 방지).
  3. 호출 지점과 `data`:
     - `visibility`: `visibilitychange` 이벤트마다 `{ state: document.visibilityState }`
     - `reregister`: `bump()` 호출 직전 `{ reason: 'visible' | 'watchdog', sinceLastEventMs: sensorLivenessRef.current.elapsedMs(performance.now()) }`
     - `orientation-first`: 센서 effect가 (재)등록된 뒤 첫 `deviceorientation` 이벤트에서 `{ afterRegisterMs }` (등록 시각 기록 필요)
     - `orientation-gap`: `onOrientation`에서 직전 이벤트와 간격이 1000ms 넘으면 `{ gapMs }`
     - `ws-open`: 소켓 `onopen` 시점은 건드리지 않는다(기존 effect 수정 금지). 대신 큐 flush 시 `ts`로 순서 확인.
  4. 센서 이벤트마다 로그를 보내면 안 된다(60Hz). 위 4종만 보낸다.

## Acceptance Criteria
- [ ] `DEBUG_LOG` 메시지를 서버가 받으면 콘솔과 `data/sensor-debug.log`에 한 줄이 남는다.
- [ ] 폰에서 화면을 껐다 켜면 `visibility`, `reregister`, (`orientation-first` 또는 `orientation-gap`) 로그가 순서대로 남는다.
- [ ] 모든 임시 코드에 `TEMP(sensor-debug)` 주석이 있다.
- [ ] 기존 테스트가 모두 통과한다.

## Validation
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과
- `grep -rn "TEMP(sensor-debug)" src server` — 추가한 임시 코드 위치 확인 (T03에서 0건이 되어야 함)

## Commit Message
```text
chore(debug): 센서 정지 진단용 임시 로그 릴레이 추가

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P02-device-verify
Task: T01-debug-log-relay

- DEBUG_LOG 메시지 타입과 서버 핸들러 (data/sensor-debug.log)
- 폰 쪽 로그 큐와 4종 호출 지점 (visibility, reregister, orientation-first, orientation-gap)
- 임시 코드: P02-T03에서 제거 예정
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
