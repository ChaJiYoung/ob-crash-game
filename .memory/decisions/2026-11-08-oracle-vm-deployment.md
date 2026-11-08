# Decisions: Oracle Cloud Free VM 배포 가이드

- Date: 2026-11-08
- Status: Confirmed

## D01. VM 인스턴스 사양 및 OS 선정
- **Chosen**: ARM Ampere A1 (Ubuntu 22.04 or 24.04 LTS, 2~4 OCPU, 12~24GB RAM) 우선 추천 + AMD Micro (1 OCPU, 1GB RAM) + 4GB Swap 대안 가이드 병기
- **Rationale**:
  - 오라클 클라우드 Always Free(평생 무료)는 ARM Ampere 인스턴스에 최대 4 OCPU, 24GB RAM을 무료 제공함.
  - 리액트/Three.js 프론트엔드 빌드(`vite build`) 및 `better-sqlite3` C++ 네이티브 모듈 컴파일 시 1GB 메모리는 OOM(메모리 부족 중단) 위험이 큼.
  - 리전별 ARM 용량 품절(Out of Capacity) 시를 대비해, AMD Micro에서 4GB 스왑 메모리를 설정하여 빌드하는 방법도 함께 가이드에 포함함.

## D02. 외부 접속 및 도메인/SSL 방식
- **Chosen**: DuckDNS 무료 DDNS 도메인 + Caddy 웹서버 자동 Let's Encrypt HTTPS
- **Rationale**:
  - 스마트폰의 자이로 센서/가속도 센서(`DeviceOrientationEvent`)는 브라우저 보안 정책상 **HTTPS(보안 연결)**가 필수임.
  - Azure(PaaS)와 달리 오라클 Compute VM(IaaS)은 기본 도메인이 제공되지 않음.
  - DuckDNS(`*.duckdns.org`)를 사용하면 도메인 구매 비용 0원으로 영구 고정 주소를 확보할 수 있음.
  - Caddy 웹서버를 사용하면 복잡한 certbot 설정 없이 도메인 이름만 적어두면 Let's Encrypt 인증서 발급/자동 갱신/HTTPS 강제 리다이렉트가 100% 자동 처리됨.

## D03. 실행 및 컨테이너 환경
- **Chosen**: Docker & Docker Compose
- **Rationale**:
  - 호스트 OS의 Node 버전 충돌이나 네이티브 빌드 도구(`python3`, `make`, `g++`) 의존성을 격리.
  - `docker-compose.yml` 하나로 백엔드(Node.js), 웹서버(Caddy), 볼륨 마운트(SQLite DB)를 통합 관리하고, VM 재부팅 시 자동 시작(`restart: unless-stopped`) 가능.

## D04. 프론트엔드 및 백엔드 라우팅 아키텍처
- **Chosen**: Caddy가 `dist/` 정적 파일(SPA Fallback 포함) 서빙 + `/ws` 경로를 Node.js 백엔드(`backend:8787`)로 웹소켓 리버스 프록시
- **Rationale**:
  - 현재 프로젝트의 `server/wsServer.ts`는 정적 파일을 서빙하지 않고 `/ws`와 `/health`만 처리함.
  - 클라이언트 라우팅(`App.tsx`의 `/controller`, `/sensor-test`)이 SPA(단일 페이지 앱) 방식이므로, Caddy에서 `try_files {path} /index.html` 처리가 필수적임.
  - Caddy v2는 `reverse_proxy` 지시어 하나로 웹소켓 업그레이드 헤더(`Upgrade`, `Connection`)를 자동 처리함.
  - PC 화면의 QR 코드는 접속한 도메인(`https://*.duckdns.org/controller?room=...`)을 그대로 인식하여 모바일이 즉시 연결됨.

## D05. 데이터 영속성 (Persistence)
- **Chosen**: 호스트 디렉터리 바인드 마운트 (`./data:/app/data`)
- **Rationale**:
  - 게임 랭킹 및 세션 기록을 저장하는 SQLite 파일(`data/game.db`)이 컨테이너를 재빌드하거나 재시작해도 안전하게 보존되도록 보장함.

## D06. 배포 파이프라인 전략
- **Chosen**: 1단계 VM 내부 직접 빌드 (`git clone` + `docker compose up -d --build`) -> 안정화 후 2단계 GitHub Actions CI/CD로 확장할 수 있도록 부록 제공
- **Rationale**:
  - 초기 설정 시 추가적인 시크릿 키 관리나 복잡한 CI/CD 설정 없이 최소한의 단계로 즉시 배포 성공을 확인하기 위함.
  - 이후 자동 배포가 필요할 때 사용할 수 있는 GitHub Actions 워크플로우 예시를 가이드 후반부에 보너스로 제공함.

---

> 아래 D07~D13은 2차 검토(2026-11-08, 기존 plan과 코드 대조)에서 추가·정정된 결정이다. D03/D05/D06과 충돌하면 아래가 우선한다.

## D07. Always Free 유휴 회수(Idle Reclamation) 대응
- **Chosen**: PAYG 업그레이드를 강제하지 않고, 가이드에 회수 위험 경고 + FAQ + "재시작 체크리스트"만 수록
  - 재시작 체크리스트: 콘솔에서 인스턴스 Start → `sudo systemctl enable docker` 확인(부팅 시 Docker 자동 시작) → 컨테이너 `restart: unless-stopped`로 자동 복구 → `https://<도메인>/health` 200 확인
  - DuckDNS IP 자동 갱신 크론을 **선택 → 필수** 단계로 승격 (재시작 후 공인 IP 변경 대비)
  - FAQ: ARM(A1) 재시작 시 "Out of capacity" 발생 가능 → 시간 두고 재시도
- **Rationale**: 회수는 삭제가 아닌 정지(stop)라 부트 볼륨의 코드·DB·Caddy 인증서·iptables 저장분은 유지됨. 방은 메모리 상태지만 PC 클라이언트가 재연결 시 저장된 방 코드로 `CREATE_ROOM`을 다시 보내므로(기존 `PCGamePage` 재연결 로직) 복구됨. 사용자가 "정지되면 다시 켜면 된다"를 선택.

## D08. T01 검증 범위 — 로컬 런타임 스모크 테스트 추가
- **Chosen**: `docker compose config` / `build`에 더해 로컬에서 실제 기동 검증
  1. `DOMAIN=localhost docker compose up -d --build`
  2. `curl -k https://localhost/health` → 200, `{"status":"ok"}`
  3. `curl -k https://localhost/controller` → `index.html` 반환 (SPA fallback)
  4. `wss://localhost/ws`로 `CREATE_ROOM` 전송 → `ROOM_CREATED` 수신 (스크래치 스크립트, `ws` 패키지 + `rejectUnauthorized:false`)
  5. `docker compose restart backend` 후 `data/game.db` 유지 확인
  6. `docker compose down`으로 정리
- **Rationale**: config/build만으로는 Caddy 라우팅·WS 업그레이드·볼륨 영속성을 확인할 수 없음. 로컬에 Docker 29 설치되어 있음. ARM64 크로스 빌드 검증은 범위에서 제외.

## D09. 배포 DB 초기 상태 — 빈 DB로 시작, 빌드에서 완전 제외
- **Chosen**: 서버는 빈 `data/game.db`로 시작(서버가 기동 시 스키마 자동 생성). 로컬 `data/`(game.db, -wal, -shm, players.json)는 이미지·배포 대상에서 제외
  - `.gitignore`에 이미 `data/` 포함 → VM `git clone`에 포함되지 않음
  - `.dockerignore`는 `data/*.db*`가 아닌 **`data` 디렉터리 전체** 제외
  - 가이드에 로컬 DB 이관 절차는 넣지 않음
- **Rationale**: 로컬 기록은 개발·플레이테스트 데이터라 실서비스 랭킹에 섞이면 안 됨. `GameDatabase`가 `mkdirSync` + `SCHEMA_SQL`로 빈 DB를 자동 초기화하므로 별도 준비 불필요.

## D10. 베이스 이미지 정정 (코드 확인으로 자동 확정)
- **Chosen**: `node:20-alpine` → **`node:24-bookworm-slim`** (백엔드·프론트 빌드 단계 공통). 프론트 빌드 단계는 `npm ci --ignore-scripts`(네이티브 모듈 컴파일 생략), 백엔드는 일반 `npm ci`
- **Rationale**: Node 20은 2026-04 EOL이며 로컬 개발 환경은 Node 24. alpine(musl)에서는 `better-sqlite3` 프리빌드 부재 시 C++ 컴파일이 필요해 빌드 도구 없는 프론트 단계 `npm ci`가 실패할 위험이 있음. glibc(bookworm) 이미지는 x64/arm64 프리빌드가 있어 빌드 도구가 불필요. 백엔드 런타임은 기존대로 `tsx`(devDependency) 사용, 실행은 `npx` 대신 `node_modules/.bin/tsx` 직접 호출(시그널 전달 단순화).

## D11. SQLite 백업 방식 정정 (코드 확인으로 자동 확정)
- **Chosen**: 가이드의 백업 명령을 파일 복사가 아닌 SQLite 온라인 백업으로 안내
  - 예: `docker compose exec backend node -e "require('better-sqlite3')('data/game.db').backup('data/backup-'+Date.now()+'.db').then(()=>console.log('ok'))"` (ESM 프로젝트이므로 실행 시 `--input-type=commonjs` 등 동작 확인 후 확정)
- **Rationale**: `GameDatabase`가 `journal_mode = WAL`을 켜므로 `game.db`만 복사하면 `-wal`에 남은 최신 기록이 누락되거나 손상될 수 있음.

## D12. Docker 로그 순환 (자동 확정)
- **Chosen**: `docker-compose.yml`의 backend/web 서비스에 `logging: driver json-file, options: max-size 10m, max-file 3`
- **Rationale**: Always Free 부트 볼륨 용량이 한정적이고 장기 무인 운영이 목표이므로 로그 무한 증가 방지.

## D13. Caddy 응답 압축 (자동 확정)
- **Chosen**: Caddyfile 사이트 블록에 `encode zstd gzip` 추가
- **Rationale**: `dist/` 약 3.9MB(Three.js 번들 포함)를 모바일 회선으로 내려받으므로 압축으로 초기 로딩 단축.

---

> 아래 D14~D19는 3차 인터뷰(2026-11-09, 2차 검토에서 보고된 "요청 밖 항목")에서 범위에 편입된 결정이다.

## D14. 공개 배포용 경량 남용 방지 (서버) — 범위 편입
- **Chosen**: 이번 배포 계획에 서버 방어 Phase를 추가한다 (메시지 종류별 빈도 제한은 제외)
  - `WebSocketServer`에 `maxPayload: 64 * 1024`
  - IP당 동시 접속 상한 `WS_MAX_CONN_PER_IP` 기본 **60**
  - 전체 동시 접속 상한 `WS_MAX_CONN_TOTAL` 기본 **300**
  - 운영 환경 Origin 검사: `ALLOWED_ORIGIN` 설정 시에만 Origin 헤더 불일치 업그레이드 거절, 미설정(로컬 dev/Vite 프록시)이면 검사 안 함. compose에서 `ALLOWED_ORIGIN=https://${DOMAIN}` 주입
  - 별도 방 수 상한은 두지 않음
- **Rationale**: 기존 서버엔 닉네임 길이·점수 통계 구조 검증·랭킹 규칙 버전·`requireHost`는 있으나 Origin/크기/접속 수 제한이 없음. 방은 모든 소켓이 끊기면 `RoomManager.removeSocket`에서 즉시 삭제되므로 방 수는 접속 수로 상한됨. 행사·교실처럼 한 공인 IP(공유 Wi-Fi/NAT)에서 여러 판(판당 PC1+폰2, 재연결 겹침)을 동시에 돌리는 사용 시나리오를 기준으로 IP당 60(약 15~20판)으로 넉넉히 설정. 모든 값은 환경변수로 조정 가능. 상한은 새 접속에만 적용되어 진행 중 판은 끊기지 않음.
- **Out of scope**: 점수 조작 방지(클라이언트 계산 점수를 서버가 검증하려면 엔진 서버 이관 필요), 메시지 종류별 rate limit.

## D15. 클라이언트 IP 판별 (자동 확정)
- **Chosen**: `TRUST_PROXY=1`일 때만 `X-Forwarded-For`의 클라이언트 IP를 사용, 아니면 `req.socket.remoteAddress`. compose backend에 `TRUST_PROXY=1` 설정
- **Rationale**: 백엔드는 Caddy 뒤에 있어 소켓 주소가 전부 Caddy 컨테이너 IP로 보임. Caddy v2는 `trusted_proxies` 미설정 시 외부에서 보낸 XFF를 신뢰하지 않고 실제 IP로 덮어써 전달하므로 위조 불가. 백엔드 포트는 외부에 노출하지 않음(compose `ports` 없음).

## D16. 상한 초과 시 UX — SERVER_FULL 안내 + 자동 재시도
- **Chosen**: 접속 상한 초과 시 서버가 연결을 수락한 뒤 `{ type: 'ERROR', code: 'SERVER_FULL' }` 전송 후 close. PC(`PCGamePage`)와 폰(`MobileControllerPage`)은 `ERROR` 처리에서 "접속자가 많아요. 자리가 나면 자동으로 연결됩니다" 배너를 표시하고 기존 재연결 루프(`getReconnectDelayMs`, 최대 5초)를 그대로 유지, 연결 성공 시 배너 해제. `src/shared/types.ts`의 에러 코드에 `SERVER_FULL` 추가
  - Origin 불일치는 정상 사용자가 겪지 않으므로 업그레이드 단계에서 단순 거절(안내 없음)
- **Rationale**: 업그레이드 단계에서 거절하면 브라우저는 이유를 알 수 없어 "연결 중…"으로 멈춘 것처럼 보임. 사용자 선택.

## D17. 검색 엔진 노출 차단 (접속 제한은 하지 않음)
- **Chosen**: Caddyfile에서 모든 응답에 `header X-Robots-Tag "noindex, nofollow"`, `/robots.txt`는 `respond "User-agent: *\nDisallow: /"`로 직접 응답. 입장 비밀번호·Basic Auth는 도입하지 않음
- **Rationale**: 코드 변경 없이 Caddy 설정만으로 검색 색인 차단 가능. QR 즉시 입장 흐름 유지. 한계(가이드에 명시): Let's Encrypt 인증서는 CT 로그에 공개되어 도메인 이름 자체는 조회 가능하며, noindex는 접속 자체를 막지 않음 → 비정상 접속은 D14 상한으로 대응.

## D18. P02 검증에 전체 테스트 포함 (자동 확정)
- **Chosen**: P02 배포 가이드 Task 검증 커맨드에 `npm test` 추가
- **Rationale**: `tests/docs-sync.test.ts`가 `docs/*.md`와 `README.md` 전체에서 금지 문구를 검사하므로 새 가이드도 대상이 됨.

## D19. 백엔드 런타임은 tsx 유지
- **Chosen**: 백엔드 이미지는 `npm ci`(devDependency 포함) + `node_modules/.bin/tsx server/index.ts` 실행 유지. esbuild 번들/`--omit=dev`는 도입하지 않음
- **Rationale**: 이미지가 수백 MB 커지지만 Always Free 부트 볼륨 용량에는 무리가 없고, 빌드 단계·검증 항목을 늘리지 않아 단순. 사용자 선택.
