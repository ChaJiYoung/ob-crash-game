# Task: T01 Docker 컨테이너 및 Caddy 리버스 프록시 인프라 구성

## Status: pending

## Goal
오라클 클라우드 VM 및 로컬 도커 환경에서 스마트폰 체감형 게임의 프론트엔드(Vite SPA + Three.js)와 백엔드(Node.js + WebSocket + better-sqlite3)를 `docker compose up -d --build` 한 줄로 즉시 빌드 및 실행할 수 있도록 컨테이너 인프라를 구축한다.

## Decision Summary
- Caddy를 통한 정적 파일 서빙(`dist/`) 및 SPA 라우팅 Fallback(`try_files {path} /index.html`) 구성.
- Caddy의 자동 Let's Encrypt를 통해 DuckDNS 도메인 기반 무료 HTTPS/WSS 적용.
- 백엔드 WebSocket(포트 8787)으로의 투명한 리버스 프록시(`/ws`, `/health`).
- 게임 랭킹 DB(`data/game.db`) 유실 방지를 위한 Docker 볼륨 마운트(`./data:/app/data`).

## Implementation

### I01. 백엔드/프론트엔드 Dockerfile 및 .dockerignore 작성

- Related Files:
  - `Dockerfile.backend` :: `[Backend Image]` — Node.js + C++ 빌드도구 + better-sqlite3 + TS 런타임; new
  - `Dockerfile.frontend` :: `[Frontend Image]` — 멀티 스테이지 Vite 번들링 + Caddy 웹서버; new
  - `.dockerignore` :: `[Docker Ignore]` — 빌드 컨텍스트 최적화; new

#### Details
- **`Dockerfile.backend`**:
  ```dockerfile
  # Stage 1: Build & Dependencies
  FROM node:20-alpine AS builder
  WORKDIR /app
  RUN apk add --no-cache python3 make g++
  COPY package*.json ./
  RUN npm ci
  COPY tsconfig.json ./
  COPY server ./server
  COPY src/shared ./src/shared

  # Stage 2: Production Runner
  FROM node:20-alpine AS runner
  WORKDIR /app
  RUN apk add --no-cache dumb-init
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./package.json
  COPY --from=builder /app/tsconfig.json ./tsconfig.json
  COPY --from=builder /app/server ./server
  COPY --from=builder /app/src/shared ./src/shared

  ENV NODE_ENV=production
  ENV PORT=8787
  EXPOSE 8787

  ENTRYPOINT ["dumb-init", "--"]
  CMD ["npx", "tsx", "server/index.ts"]
  ```
- **`Dockerfile.frontend`**:
  ```dockerfile
  # Stage 1: Build Vite Frontend
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  # Stage 2: Caddy Web Server
  FROM caddy:2-alpine
  COPY --from=builder /app/dist /srv/dist
  COPY Caddyfile /etc/caddy/Caddyfile
  EXPOSE 80 443
  ```
- **`.dockerignore`**:
  ```text
  node_modules
  dist
  .git
  .memory
  .agents
  .serena
  data/*.db*
  .DS_Store
  coverage
  *.log
  ```

---

### I02. Caddyfile 리버스 프록시 및 자동 SSL 설정 작성

- Related Files:
  - `Caddyfile` :: `[Caddy Config]` — DuckDNS 자동 HTTPS, SPA 라우팅, WebSocket 프록시; new

#### Details
- **Caddy 설정 내용**:
  ```caddy
  {
      # Caddy 글로벌 옵션
  }

  {$DOMAIN:localhost} {
      # 1. 백엔드 웹소켓 연결 리버스 프록시 (Caddy v2는 WS upgrade 헤더를 자동 전달)
      handle /ws {
          reverse_proxy backend:8787
      }

      # 2. 서버 헬스체크 프록시
      handle /health {
          reverse_proxy backend:8787
      }

      # 3. 프론트엔드 정적 파일 및 SPA Fallback 라우팅 (/controller, /sensor-test 지원)
      handle {
          root * /srv/dist
          file_server
          try_files {path} /index.html
      }
  }
  ```

---

### I03. docker-compose.yml 및 .env.example 작성

- Related Files:
  - `docker-compose.yml` :: `[Compose Services]` — backend, web 서비스 및 볼륨 바인딩; new
  - `.env.example` :: `[Environment Sample]` — 배포 도메인 환경 변수 템플릿; new

#### Details
- **`docker-compose.yml`**:
  ```yaml
  services:
    backend:
      build:
        context: .
        dockerfile: Dockerfile.backend
      restart: unless-stopped
      environment:
        - NODE_ENV=production
        - PORT=8787
      volumes:
        - ./data:/app/data
      networks:
        - game-network

    web:
      build:
        context: .
        dockerfile: Dockerfile.frontend
      restart: unless-stopped
      ports:
        - "80:80"
        - "443:443"
      environment:
        - DOMAIN=${DOMAIN:-localhost}
      volumes:
        - caddy_data:/data
        - caddy_config:/config
      depends_on:
        - backend
      networks:
        - game-network

  volumes:
    caddy_data:
    caddy_config:

  networks:
    game-network:
      driver: bridge
  ```
- **`.env.example`**:
  ```env
  # DuckDNS에서 발급받은 도메인 (예: ob-crash.duckdns.org)
  # 로컬 테스트 시에는 localhost로 두면 자체 서명 인증서로 동작합니다.
  DOMAIN=your-game.duckdns.org
  ```

## Acceptance Criteria
- [ ] `Dockerfile.backend` 빌드 시 `better-sqlite3` 네이티브 모듈 컴파일이 정상 완료되어야 함.
- [ ] `Dockerfile.frontend` 빌드 시 Vite 프로젝트가 빌드되어 `/srv/dist`에 에셋이 배치되어야 함.
- [ ] `Caddyfile`에 `/ws`, `/health`, SPA fallback `try_files`가 정확히 기술되어야 함.
- [ ] `docker-compose.yml`에서 `./data:/app/data` 및 `caddy_data` 볼륨이 영속화되도록 설정되어야 함.
- [ ] `docker compose config` 문법 검사가 에러 없이 통과해야 함.

## Validation
- `docker compose config` — YAML 문법 및 의존성 검증
- `docker compose build` — 프론트엔드 및 백엔드 이미지 정상 빌드 검증

## Commit Message
```text
feat(deploy): Docker 및 Caddy 컨테이너 인프라 구성

Plan: 2026-11-08-oracle-vm-deployment
Phase: P01-container-infra
Task: T01-docker-and-caddy-setup

- I01: Dockerfile.backend, Dockerfile.frontend, .dockerignore 작성
- I02: Caddyfile 작성 (자동 SSL, SPA fallback, /ws 리버스 프록시)
- I03: docker-compose.yml 및 .env.example 작성
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
