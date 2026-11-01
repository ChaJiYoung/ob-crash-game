# Task: T02 휴대폰 고유번호(deviceId) 로그인·닉네임·TOP 5 랭킹 저장소 및 WebSocket 세션 서버 구현

## Status: pending

## Goal
QR 스캔으로 접속한 스마트폰의 고유번호(`deviceId`)를 조회하여 기존 회원은 즉시 자동 로그인하고 신규 회원은 닉네임(`2~10자`)을 등록하는 영속 저장소(`PlayerStore`)와, PC 디스플레이와 스마트폰 컨트롤러 간 60Hz 센서 프레임 및 인증/점수 이벤트를 중계하는 WebSocket 서버(`RoomManager`, `wsServer`)를 구현합니다.

## Decision Summary
- **D08**: 스마트폰 `deviceId` 기반 로그인/닉네임 등록 및 `data/players.json` 영속화, 최고 점수 기준 TOP 5 랭킹 산출
- **D09**: 4자리 Room ID 기반 PC ↔ 모바일 컨트롤러 1:1 페어링 및 60Hz `SENSOR_FRAME` 저지연 브로드캐스트

## Implementation

### I01. `PlayerStore` (JSON 영속 저장소) 및 `RoomManager` / `wsServer` 구현
- Related Files:
  - `server/PlayerStore.ts` :: `PlayerStore` — `data/players.json` 기반 회원 조회, 닉네임 등록, 최고 점수 갱신, TOP 5 조회 클래스; new
  - `server/RoomManager.ts` :: `RoomManager`, `RoomSession` — 4자리 Room ID 세션 관리 및 PC/컨트롤러 소켓 매핑 클래스; new
  - `server/wsServer.ts` :: `createBeerCrusherServer`, `BeerCrusherServerInstance` — HTTP + `ws` WebSocket 서버 팩토리; new
  - `server/index.ts` :: `startServer` — 단독 실행 엔트리포인트 (`PORT = 8787`); new

#### Details
- **Signatures & Types**:
  ```typescript
  export class PlayerStore {
    constructor(filePath?: string);
    findByDeviceId(deviceId: string): PlayerProfile | undefined;
    registerOrUpdateNickname(deviceId: string, nickname: string): PlayerProfile;
    recordGameScore(deviceId: string, score: number): { profile: PlayerProfile; isNewRecord: boolean; rankings: PlayerProfile[] };
    getTopRankings(limit?: number): PlayerProfile[];
  }

  export class RoomManager {
    createRoom(requestedRoomId?: string): RoomSession;
    getRoom(roomId: string): RoomSession | undefined;
    attachPcSocket(roomId: string, socket: WebSocket): RoomSession;
    attachControllerSocket(roomId: string, socket: WebSocket, deviceId: string): RoomSession | undefined;
  }

  export function createBeerCrusherServer(options?: { port?: number; storePath?: string }): Promise<{
    port: number;
    playerStore: PlayerStore;
    roomManager: RoomManager;
    close: () => Promise<void>;
  }>;
  ```
- **Data & Schema Fields**:
  - `data/players.json`: `{ "players": Record<string, PlayerProfile> }`
  - 닉네임 검증 규칙: 앞뒤 공백 제거(`trim()`) 후 길이 `2 ~ 10자` (한글/영문/숫자/공백 허용, 범위 위반 시 `INVALID_NICKNAME` 에러 반환)
- **Execution Flow / Logic**:
  1. **Precondition & Validation**:
     - `DEVICE_CHECK`: `deviceId` 비어 있는지 확인, `roomId` 존재 여부 확인.
     - `REGISTER_NICKNAME`: `nickname.trim()` 길이가 `2~10자`인지 검증.
  2. **Core Processing**:
     - `CREATE_ROOM`: 4자리 영숫자 코드 생성 후 PC 소켓에 `{ type: 'ROOM_CREATED', roomId, rankings: playerStore.getTopRankings(5) }` 응답.
     - `DEVICE_CHECK`: `playerStore.findByDeviceId(deviceId)` 조회.
       - 기존 유저면 `{ type: 'AUTH_RESULT', roomId, isNewUser: false, player, rankings }`를 모바일로 보내고, PC 소켓에도 즉시 `{ type: 'CONTROLLER_PAIRED', roomId, player }` 브로드캐스트.
       - 신규 유저면 `{ type: 'AUTH_RESULT', roomId, isNewUser: true, rankings }`를 모바일로 전송.
     - `REGISTER_NICKNAME`: `playerStore.registerOrUpdateNickname(deviceId, nickname)` 저장 후 모바일에 `AUTH_RESULT(isNewUser: false)`, PC에 `CONTROLLER_PAIRED` 전송.
     - `CALIBRATE_ZERO`: 해당 방의 PC 소켓에 `{ type: 'ZERO_CALIBRATED', roomId, deviceId }` 전달.
     - `SENSOR_FRAME`: 해당 방의 PC 소켓에 `{ type: 'SENSOR_RELAY', roomId, deviceId, payload }` 즉시 중계.
     - `GAME_SCORE_SUBMIT`: `playerStore.recordGameScore(deviceId, score)` 호출 후 PC와 모바일 양쪽에 `{ type: 'RANKING_UPDATED', rankings, updatedPlayer }` 브로드캐스트.
  3. **Error & Exception Handling**:
     - 잘못된 JSON 또는 유효하지 않은 닉네임/룸 코드 수신 시 `{ type: 'ERROR', code, message }` 응답 후 연결 유지.

### I02. `PlayerStore` 및 WebSocket 서버 통합 테스트
- Related Files:
  - `tests/server-session.test.ts` :: `describe('PlayerStore & WebSocket Server')` — 신규/기존 `deviceId` 분기, TOP 5 정렬, WebSocket 룸 중계 검증; new

#### Details
- 임시 JSON 파일 경로를 주입하여:
  1. 미등록 `deviceId` 조회 시 `undefined` 반환 -> 닉네임 등록 후 재조회 시 동일 프로필 반환 검증.
  2. 6명의 점수를 기록했을 때 `getTopRankings(5)`가 내림차순 상위 5명만 반환하고, 더 낮은 점수 기록 시 기존 `bestScore`가 보존되는지 검증.
  3. 실제 `createBeerCrusherServer({ port: 0 })`를 띄워 PC 클라이언트와 모바일 클라이언트가 `CREATE_ROOM` -> `DEVICE_CHECK` -> `REGISTER_NICKNAME` -> `SENSOR_FRAME` -> `GAME_SCORE_SUBMIT` 전체 플로우를 주고받는지 검증.

## Acceptance Criteria
- [ ] `PlayerStore`가 `deviceId` 기준 신규/기존 회원 분기 및 TOP 5 내림차순 랭킹을 정확히 저장/조회함
- [ ] `wsServer`가 PC와 모바일 간 `CONTROLLER_PAIRED`, `ZERO_CALIBRATED`, `SENSOR_RELAY`, `RANKING_UPDATED`를 정상 중계함
- [ ] `npx vitest run tests/server-session.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/server-session.test.ts` — `PlayerStore` 영속화 및 WebSocket 실시간 세션 통합 테스트 통과

## Commit Message
```text
feat(server): implement deviceId player store and WebSocket room relay server

Plan: 2026-11-01-beer-crusher
Phase: P01-backend-and-protocol
Task: T02-player-store-and-ws-server

- Implement PlayerStore with JSON persistence and TOP 5 leaderboard sorting
- Implement RoomManager and wsServer for QR room pairing, deviceId login, and 60Hz sensor relay
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
