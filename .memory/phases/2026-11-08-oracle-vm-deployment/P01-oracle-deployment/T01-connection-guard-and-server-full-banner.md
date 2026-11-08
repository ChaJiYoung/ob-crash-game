# Task: T01 WebSocket 접속 가드와 SERVER_FULL 안내 배너

## Status: done

## Goal
공개 인터넷에 노출된 WebSocket 서버가 (1) 64KB 초과 메시지, (2) 허용되지 않은 Origin, (3) IP당 60·전체 300을 넘는 동시 접속을 거절하고, 접속 상한에 걸린 PC·폰은 "접속자가 많아요. 자리가 나면 자동으로 연결됩니다" 배너를 보며 기존 재연결 루프로 자동 재시도하게 만든다. 로컬 개발(Vite 프록시, 환경변수 없음)에서는 동작이 지금과 같아야 한다.

## Decision Summary
- D14: `maxPayload` 64KB, `WS_MAX_CONN_PER_IP`(기본 60), `WS_MAX_CONN_TOTAL`(기본 300), `ALLOWED_ORIGIN` 설정 시에만 Origin 검사. 방 수 상한·메시지 종류별 rate limit 없음.
- D15: `TRUST_PROXY=1`일 때만 `X-Forwarded-For` 첫 값을 클라이언트 IP로 사용.
- D16: 상한 초과는 연결 수락 → `ERROR/SERVER_FULL` 전송 → `close(1013)`. Origin 불일치는 핸드셰이크에서 401 거절(안내 없음).

## Implementation

### I01. 순수 로직 모듈 `server/ConnectionGuard.ts`

- Related Files:
  - `server/ConnectionGuard.ts` :: `ConnectionGuard`, `resolveClientIp`, `isOriginAllowed`, `readConnectionGuardEnv`, `CONNECTION_GUARD_DEFAULTS` — 접속 판정 로직(소켓·서버와 무관하게 단위 테스트 가능); new

#### Details
- **Signatures & Types**:
  ```typescript
  import type { IncomingMessage } from 'node:http';

  export const CONNECTION_GUARD_DEFAULTS = {
    maxPerIp: 60,
    maxTotal: 300,
    maxPayloadBytes: 64 * 1024,
  } as const;

  export interface ConnectionGuardOptions {
    /** IP 하나가 동시에 가질 수 있는 소켓 수. */
    maxPerIp: number;
    /** 서버 전체 동시 소켓 수. */
    maxTotal: number;
  }

  /** compose/env에서 받은 서버 보안 설정. 없는 값은 undefined (createBeerCrusherServer가 기본값 적용). */
  export interface ConnectionGuardEnv {
    maxPerIp?: number;
    maxTotal?: number;
    allowedOrigin?: string;
    trustProxy: boolean;
  }

  /** 요청을 보낸 실제 클라이언트 IP. trustProxy면 X-Forwarded-For의 첫 값, 아니면 소켓 주소. */
  export function resolveClientIp(req: IncomingMessage, trustProxy: boolean): string;

  /** allowedOrigin이 비어 있으면 항상 true. 있으면 origin과 정확히 일치(끝 '/' 제거, 소문자 비교)할 때만 true. */
  export function isOriginAllowed(origin: string | undefined, allowedOrigin: string | undefined): boolean;

  /** process.env 형태에서 설정을 읽는다. 숫자가 아니거나 1 미만이면 undefined. */
  export function readConnectionGuardEnv(env: Record<string, string | undefined>): ConnectionGuardEnv;

  export class ConnectionGuard {
    constructor(options: ConnectionGuardOptions);
    /** 자리가 있으면 카운트를 올리고 true. 없으면 아무것도 바꾸지 않고 false. */
    tryAcquire(ip: string): boolean;
    /** tryAcquire가 true였던 소켓이 닫힐 때 정확히 한 번 호출. 0이 되면 Map에서 키 삭제. */
    release(ip: string): void;
    get total(): number;
    countFor(ip: string): number;
  }
  ```
- **Data & Schema Fields**:
  - `ConnectionGuard` 내부: `private perIp = new Map<string, number>()`, `private totalCount = 0`.
- **Execution Flow / Logic**:
  1. `resolveClientIp`:
     - `trustProxy && typeof req.headers['x-forwarded-for'] === 'string'`이면 `split(',')[0].trim()`; 빈 문자열이면 다음 단계로.
     - 헤더가 배열(string[])이면 `[0]`에 같은 처리.
     - 아니면 `req.socket.remoteAddress ?? 'unknown'`.
     - 결과에서 IPv4-mapped 접두사 `::ffff:` 제거(`ip.startsWith('::ffff:') ? ip.slice(7) : ip`).
  2. `isOriginAllowed`: `normalize = (s) => s.trim().replace(/\/+$/, '').toLowerCase()`. `!allowedOrigin` → true. `!origin` → false (운영에서 Origin 없는 비브라우저 클라이언트 차단). 그 외 `normalize(origin) === normalize(allowedOrigin)`.
  3. `readConnectionGuardEnv`:
     - `WS_MAX_CONN_PER_IP`, `WS_MAX_CONN_TOTAL`: `Number.parseInt(v, 10)`; `Number.isFinite(n) && n >= 1`이면 사용, 아니면 undefined.
     - `ALLOWED_ORIGIN`: trim 후 빈 문자열이면 undefined.
     - `TRUST_PROXY`: `'1' | 'true'`(대소문자 무시)일 때만 true.
  4. `tryAcquire`: `if (this.totalCount >= maxTotal) return false; const n = perIp.get(ip) ?? 0; if (n >= maxPerIp) return false; perIp.set(ip, n + 1); totalCount++; return true;`
  5. `release`: `const n = perIp.get(ip) ?? 0; if (n <= 0) return;`(이중 해제 방어) `n === 1 ? perIp.delete(ip) : perIp.set(ip, n - 1); totalCount = Math.max(0, totalCount - 1);`

---

### I02. `createBeerCrusherServer` / `server/index.ts` 연결

- Related Files:
  - `server/wsServer.ts` :: `createBeerCrusherServer` — 옵션 추가, `WebSocketServer` 생성 옵션, `connection` 핸들러 진입부; modify
  - `server/index.ts` :: `start` — env를 읽어 옵션으로 전달; modify

#### Details
- **Signatures & Types** (`createBeerCrusherServer` options에 추가, 기존 필드 유지):
  ```typescript
  /** IP당 동시 소켓 상한. 기본 CONNECTION_GUARD_DEFAULTS.maxPerIp(60) */
  maxConnPerIp?: number;
  /** 전체 동시 소켓 상한. 기본 CONNECTION_GUARD_DEFAULTS.maxTotal(300) */
  maxConnTotal?: number;
  /** 설정 시 이 Origin의 업그레이드만 허용. 미설정이면 검사 안 함(로컬 dev). */
  allowedOrigin?: string;
  /** true면 X-Forwarded-For로 클라이언트 IP 판별(Caddy 뒤에서만). 기본 false */
  trustProxy?: boolean;
  ```
- **Execution Flow / Logic** (`wsServer.ts`):
  1. import 추가: `import { ConnectionGuard, CONNECTION_GUARD_DEFAULTS, isOriginAllowed, resolveClientIp } from './ConnectionGuard';` 및 `http` 타입 사용(`http.IncomingMessage`).
  2. `const roomManager = ...` 근처에서:
     ```typescript
     const guard = new ConnectionGuard({
       maxPerIp: options?.maxConnPerIp ?? CONNECTION_GUARD_DEFAULTS.maxPerIp,
       maxTotal: options?.maxConnTotal ?? CONNECTION_GUARD_DEFAULTS.maxTotal,
     });
     const trustProxy = options?.trustProxy ?? false;
     ```
  3. 기존 `const wss = new WebSocketServer({ server });`를 교체:
     ```typescript
     const wss = new WebSocketServer({
       server,
       maxPayload: CONNECTION_GUARD_DEFAULTS.maxPayloadBytes,
       verifyClient: (info: { origin: string; req: http.IncomingMessage }) =>
         isOriginAllowed(info.origin || undefined, options?.allowedOrigin),
     });
     ```
  4. `wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {` 진입부에 다음 코드 삽입:
     ```typescript
     const clientIp = resolveClientIp(req, trustProxy);
     if (!guard.tryAcquire(clientIp)) {
       sendJson(ws, { type: 'ERROR', code: 'SERVER_FULL', message: 'Too many connections. Retrying automatically.' });
       ws.close(1013, 'SERVER_FULL');
       return;
     }
     ws.once('close', () => guard.release(clientIp));
     ```
- **Execution Flow / Logic** (`server/index.ts`):
  1. `import { readConnectionGuardEnv } from './ConnectionGuard';`
  2. `start()`에서 `readConnectionGuardEnv(process.env)`를 읽어 `createBeerCrusherServer`에 전달.
  3. 기동 로그에 가드 설정 요약 1줄 출력.

---

### I03. PC·폰 SERVER_FULL 배너

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `isServerFull` state, WS `handleMessage`의 `ROOM_CREATED`/`ERROR` 분기, 루트 JSX 배너; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — `isServerFull` state, `AUTH_RESULT`/`ERROR` 분기, 기존 연결 배너 문구 분기; modify

#### Details
- **PC (`PCGamePage.tsx`)**:
  1. `const [isServerFull, setIsServerFull] = useState(false);`
  2. `ROOM_CREATED` 수신 시 `setIsServerFull(false);`
  3. `case 'ERROR':`에서 `msg.code === 'SERVER_FULL'`이면 `setIsServerFull(true); break;`
  4. JSX 상단에 `server-full-banner` 안내 div 렌더링.
- **폰 (`MobileControllerPage.tsx`)**:
  1. `const [isServerFull, setIsServerFull] = useState(false);`
  2. `AUTH_RESULT` 수신 시 `setIsServerFull(false);`
  3. `case 'ERROR':`에서 `msg.code === 'SERVER_FULL'`이면 `setIsServerFull(true); setConnectionState('RECONNECTING'); break;`
  4. 기존 배너 텍스트를 `isServerFull ? '👥 접속자가 많아요. 자리가 나면 자동으로 연결됩니다.' : '📡 PC와 다시 연결하는 중...'`로 분기.

---

### I04. 테스트

- Related Files:
  - `tests/connection-guard.test.ts` :: 단위 테스트; new
  - `tests/server-connection-limits.test.ts` :: 통합 테스트; new
  - `tests/helpers/wsHarness.ts` :: read-only

#### Details
- 단위: `tryAcquire`, `release`, `resolveClientIp`, `isOriginAllowed`, `readConnectionGuardEnv`의 모든 분기 검증.
- 통합: IP당 상한 초과, 전체 상한 초과, Origin 거절(401), maxPayload(70KB 초과 1009), trustProxy 헤더 처리 검증.

## Acceptance Criteria
- [ ] `server/ConnectionGuard.ts`가 생성되고 `wsServer.ts`에서 maxPayload 64KB, verifyClient Origin 검사, connection 상한 검사가 동작한다.
- [ ] 환경변수 없이 `npm run server`로 띄우면 기존과 동일하게 동작한다.
- [ ] 상한 초과 소켓은 `ERROR/SERVER_FULL` 수신 후 1013으로 닫히고, 방·DB에 기록을 남기지 않는다.
- [ ] PC·폰 화면에 안내 배너가 정상 표시되고, 기존 재연결 루프로 자동 복구된다.
- [ ] 신규 테스트 및 기존 전체 테스트가 통과한다.

## Validation
- `npx vitest run tests/connection-guard.test.ts tests/server-connection-limits.test.ts` — 신규 테스트 통과
- `npx tsc --noEmit` — 타입 오류 0
- `npm test` — 전체 테스트 통과

## Commit Message
```text
feat(server): WebSocket 접속 상한·Origin 검사와 접속자 초과 안내 배너

Plan: 2026-11-08-oracle-vm-deployment
Phase: P01-oracle-deployment
Task: T01-connection-guard-and-server-full-banner

- I01: ConnectionGuard 추가 (IP 판별·Origin 검사·IP당/전체 동시 접속 상한·env 파싱)
- I02: wsServer에 maxPayload 64KB·verifyClient·접속 상한 연결, index.ts가 env로 설정 주입
- I03: PC·폰에 SERVER_FULL 안내 배너, 기존 재연결 루프 유지
- I04: 가드 단위 테스트와 서버 접속 상한 통합 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
