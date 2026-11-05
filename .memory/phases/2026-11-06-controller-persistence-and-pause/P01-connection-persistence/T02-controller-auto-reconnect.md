# Task: T02 폰 자동 재연결

## Status: done

## Goal
폰이 방 코드를 기억하고, 소켓이 끊기면(화면 꺼짐·네트워크 순단·PC 재시작) 사람 손 없이 같은 방으로 다시 접속한다. 재연결 동안 '재연결 중' 배너를 보여 준다.

## Decision Summary
- D03. `src/controller/MobileControllerPage.tsx`는 지금 소켓 `onclose`가 없고 `room`을 URL에서만 읽는다. `PC_DISCONNECTED`는 `alert()`로만 처리돼 화면이 막힌다.
- 서버는 `ROOM_NOT_FOUND` 때 소켓을 닫지 않는다. 폰이 스스로 닫고 재시도한다.
- 서버는 PC가 돌아와도 폰에게 알리지 않는다. 그래서 `PC_DISCONNECTED`를 받은 폰도 소켓을 스스로 닫고 재시도 루프로 들어간다.

## Implementation

### I01. 재연결 정책 헬퍼
- Related Files:
  - `src/controller/sensors/ReconnectPolicy.ts` :: `getReconnectDelayMs`, `loadSavedControllerRoomId`, `saveControllerRoomId`, `CONTROLLER_ROOM_STORAGE_KEY`; new

#### Details
- **Signatures & Types**:
  ```ts
  export const CONTROLLER_ROOM_STORAGE_KEY = 'beer_crusher_controller_room_id';
  export function getReconnectDelayMs(attempt: number): number; // min(500 * 2 ** attempt, 5000), attempt<0 은 0 취급
  export function loadSavedControllerRoomId(storage?: Pick<Storage,'getItem'>): string | undefined;
  export function saveControllerRoomId(roomId: string, storage?: Pick<Storage,'setItem'>): void;
  ```
- **Logic**: 방 코드 검증은 `/^[A-Z0-9]{3,8}$/`(대문자화 후). storage 접근은 try/catch. `DeviceIdentity.ts`와 같은 스타일.

### I02. 컨트롤러 페이지 재연결 루프
- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `// 1. Parse Room ID from URL` effect, `// 2. Connect to WebSocket` effect, 신규 `connectionState`; modify

#### Details
- **Signatures & Types**:
  ```ts
  type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const hasConnectedBeforeRef = useRef(false); // T03에서 사용
  ```
- **Execution Flow / Logic**:
  1. 방 코드 결정(첫 effect): URL `room`이 있으면 사용하고 `saveControllerRoomId`로 저장. 없으면 `loadSavedControllerRoomId()`. 둘 다 없으면 기존의 '방 번호가 없습니다' 화면.
  2. 두 번째 effect를 `connect()` 함수 + `disposed` 플래그 + `attemptRef` 구조로 바꾼다. `connect()`가 `new WebSocket(...)`(기존 wsUrl 폴백 포함)을 만들고 `wsRef.current`에 넣는다.
  3. `onopen`: `attemptRef.current = 0`, `setConnectionState('CONNECTED')`, `DEVICE_CHECK` 전송(기존과 동일).
  4. `onclose`: `disposed`면 무시. 아니면 `setConnectionState('RECONNECTING')`, `setTimeout(connect, getReconnectDelayMs(attemptRef.current++))`. 타이머 id는 ref에 두고 정리 때 `clearTimeout`.
  5. `onerror`: 아무것도 하지 않는다(`onclose`가 따라온다).
  6. 메시지 처리: `ERROR`의 `ROOM_NOT_FOUND` 또는 `PC_DISCONNECTED`를 받으면 `socket.close()`만 호출한다(재시도는 `onclose`가 맡는다). 기존 `alert('PC 호스트와의 연결이 끊어졌습니다.')`는 제거.
  7. 오래된 소켓의 이벤트가 새 소켓 상태를 덮지 않도록 각 핸들러 첫 줄에서 `if (wsRef.current !== socket) return;`(onclose는 정리 뒤 재시도 중복 방지용으로 `socket`을 닫을 때 핸들러를 먼저 null 처리).
  8. 되살리기 트리거: `document`의 `visibilitychange`(visible 상태)와 `window`의 `online` 이벤트에서, `wsRef.current`가 없거나 `readyState`가 OPEN/CONNECTING이 아니면 대기 중인 타이머를 취소하고 즉시 `connect()`. effect 정리에서 리스너 제거, `disposed = true`, 타이머 정리, `socket.close()`.
  9. 배너: `connectionState !== 'CONNECTED'`일 때 화면 상단 고정 배너 `📡 PC와 다시 연결하는 중...`(`pointerEvents: 'none'`, `position: 'fixed'`, 높은 `zIndex`)를 모든 step에서 렌더. 방 코드 없음 분기보다 아래, 정상 렌더 경로에 넣는다.
- **함정**: `flushSensorFrame`·각종 전송은 이미 `readyState === OPEN`을 검사하므로 끊긴 동안 조용히 무시된다. 이 검사를 지우지 않는다. `useEffect` 의존성 `[roomId, deviceId]`는 유지.

### I03. 테스트
- Related Files:
  - `tests/controller-reconnect.test.ts` :: new

#### Details
- `getReconnectDelayMs`: 0→500, 1→1000, 2→2000, 3→4000, 4→5000, 10→5000, -1→500.
- 저장/로드: 메모리 스토리지 목으로 왕복, 소문자 입력 대문자화, 잘못된 값 `undefined`, `getItem`이 throw해도 `undefined`.
- 소스 가드: `fs.readFileSync('src/controller/MobileControllerPage.tsx')`에 `alert(`가 `PC 호스트`와 함께 남아 있지 않고 `visibilitychange`가 있는지 확인(회귀 방지).

## Acceptance Criteria
- [ ] `?room=` 없이 `/controller`를 열어도 마지막 방에 접속한다.
- [ ] 소켓이 끊기면 배너가 뜨고 자동으로 다시 접속하면 사라진다.
- [ ] PC가 없는 동안 폰은 계속 재시도하고, PC가 같은 코드로 돌아오면 접속된다.
- [ ] `PC_DISCONNECTED` 때 `alert`가 뜨지 않는다.

## Validation
- `npx vitest run tests/controller-reconnect.test.ts tests/controller-ui-and-routing.test.ts tests/controller-sensors.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(controller): reconnect to the saved room automatically

Plan: 2026-11-06-controller-persistence-and-pause
Phase: P01-connection-persistence
Task: T02-controller-auto-reconnect

- remember the last room code and fall back to it when the URL has none
- retry the socket with exponential backoff and on visibilitychange/online
- replace the PC-disconnected alert with a reconnecting banner
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: (this commit)
