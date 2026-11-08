# Task: T02 Docker·Caddy 컨테이너 인프라와 로컬 스모크 테스트

## Status: done

## Goal
`docker compose up -d --build` 한 줄로 Caddy(자동 HTTPS·SPA fallback·`/ws`·`/health` 프록시·압축·noindex·robots.txt)와 Node 백엔드(SQLite 볼륨·접속 가드 환경변수)가 뜨고, `node scripts/deploy-smoke.mjs`가 health·SPA·noindex·WS 방 생성·Origin 거절을 자동 검증하며, 백엔드 재시작 후에도 DB 파일이 유지됨을 로컬에서 확인한다. 로컬 개발 DB(`./data`)와 배포 대상 이미지는 서로 섞이지 않는다.

## Decision Summary
- D03/D04/D05: Docker Compose, Caddy가 `dist` 서빙 + `/ws`·`/health` → `backend:8787`, SQLite는 호스트 디렉터리 바인드 마운트.
- D10: `node:24-bookworm-slim`(glibc, better-sqlite3 프리빌드). 프론트 빌드는 `npm ci --ignore-scripts`. D19: 백엔드는 `node_modules/.bin/tsx server/index.ts` 실행.
- D09: `data/` 전체를 이미지에서 제외(빈 DB 시작). D12: 로그 순환. D13: `encode zstd gzip`. D14/D15: `ALLOWED_ORIGIN=https://${DOMAIN}`, `TRUST_PROXY=1`. D17: `X-Robots-Tag` + robots.txt. D08: 로컬 런타임 스모크 검증.

## Implementation

### I01. 백엔드·프론트 Dockerfile

- Related Files:
  - `Dockerfile.backend` :: — Node 24 + better-sqlite3 + tsx 런타임; new
  - `Dockerfile.frontend` :: — Vite 빌드 → Caddy 이미지; new

#### Details
- **`Dockerfile.backend`**:
  ```dockerfile
  # syntax=docker/dockerfile:1
  FROM node:24-bookworm-slim AS deps
  WORKDIR /app
  RUN apt-get update \
   && apt-get install -y --no-install-recommends python3 make g++ \
   && rm -rf /var/lib/apt/lists/*
  ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  COPY package.json package-lock.json ./
  RUN npm ci

  FROM node:24-bookworm-slim AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=8787
  COPY --from=deps /app/node_modules ./node_modules
  COPY package.json tsconfig.json ./
  COPY server ./server
  COPY src/shared ./src/shared
  EXPOSE 8787
  CMD ["node_modules/.bin/tsx", "server/index.ts"]
  ```
- **`Dockerfile.frontend`**:
  ```dockerfile
  # syntax=docker/dockerfile:1
  FROM node:24-bookworm-slim AS builder
  WORKDIR /app
  ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  COPY package.json package-lock.json ./
  RUN npm ci --ignore-scripts
  COPY . .
  RUN npm run build

  FROM caddy:2-alpine
  COPY --from=builder /app/dist /srv/dist
  COPY Caddyfile /etc/caddy/Caddyfile
  EXPOSE 80 443 443/udp
  ```

---

### I02. Caddyfile

- Related Files:
  - `Caddyfile` :: — 자동 HTTPS, 압축, noindex, robots.txt, `/ws`·`/health` 프록시, SPA fallback, 캐시 헤더; new

#### Details
- Caddyfile 작성:
  ```caddy
  {$DOMAIN:localhost} {
  	encode zstd gzip

  	# 검색 엔진 색인 차단 (D17). 접속 자체는 막지 않는다.
  	header X-Robots-Tag "noindex, nofollow"

  	handle /robots.txt {
  		respond <<TXT
  			User-agent: *
  			Disallow: /
  			TXT 200
  	}

  	handle /ws {
  		reverse_proxy backend:8787
  	}

  	handle /health {
  		reverse_proxy backend:8787
  	}

  	handle {
  		root * /srv/dist
  		@assets path /assets/*
  		header @assets Cache-Control "public, max-age=31536000, immutable"
  		@html path / /index.html /controller /sensor-test
  		header @html Cache-Control "no-cache"
  		try_files {path} /index.html
  		file_server
  	}
  }
  ```

---

### I03. docker-compose.yml · .env.example · .dockerignore · .gitignore

- Related Files:
  - `docker-compose.yml` :: — backend/web 서비스, 볼륨, 헬스체크, 로그 순환, 보안 env; new
  - `.env.example` :: — 배포 환경변수 템플릿; new
  - `.dockerignore` :: — 빌드 컨텍스트에서 비밀·로컬 데이터 제외; new
  - `.gitignore` :: — `.env`, `.smoke-data/` 추가; modify

#### Details
- **`docker-compose.yml`**:
  ```yaml
  x-logging: &default-logging
    driver: json-file
    options:
      max-size: "10m"
      max-file: "3"

  services:
    backend:
      build:
        context: .
        dockerfile: Dockerfile.backend
      restart: unless-stopped
      init: true
      environment:
        NODE_ENV: production
        PORT: "8787"
        TRUST_PROXY: "1"
        ALLOWED_ORIGIN: "https://${DOMAIN:-localhost}"
        WS_MAX_CONN_PER_IP: "${WS_MAX_CONN_PER_IP:-60}"
        WS_MAX_CONN_TOTAL: "${WS_MAX_CONN_TOTAL:-300}"
      volumes:
        - ${DATA_DIR:-./data}:/app/data
      healthcheck:
        test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
        interval: 15s
        timeout: 5s
        retries: 3
        start_period: 20s
      logging: *default-logging

    web:
      build:
        context: .
        dockerfile: Dockerfile.frontend
      restart: unless-stopped
      ports:
        - "80:80"
        - "443:443"
        - "443:443/udp"
      environment:
        DOMAIN: "${DOMAIN:-localhost}"
      volumes:
        - caddy_data:/data
        - caddy_config:/config
      depends_on:
        backend:
          condition: service_healthy
      logging: *default-logging

  volumes:
    caddy_data:
    caddy_config:
  ```
- **`.env.example`**:
  ```env
  DOMAIN=your-game.duckdns.org
  # WS_MAX_CONN_PER_IP=60
  # WS_MAX_CONN_TOTAL=300
  # DATA_DIR=./data
  ```
- **`.dockerignore`**: `data` 전체 디렉터리, `node_modules`, `dist`, `.smoke-data`, `.git`, `.env` 등 제외.
- **`.gitignore`**: `.env`, `.smoke-data/` 추가.

---

### I04. 로컬 스모크 테스트 스크립트

- Related Files:
  - `scripts/deploy-smoke.mjs` :: `main` — 배포된(또는 로컬 compose) 서버를 HTTP/WSS로 점검; new

#### Details
- 6개 항목 자동 검증:
  1. `GET /health` ➔ 200 ok
  2. `GET /controller` ➔ 200, `<div id="root"` 포함
  3. `GET /` ➔ 헤더 `x-robots-tag: noindex, nofollow`
  4. `GET /robots.txt` ➔ `Disallow: /`
  5. WSS 정상 Origin ➔ `CREATE_ROOM` ➔ `ROOM_CREATED`
  6. WSS 비정상 Origin (`https://evil.example`) ➔ 401 또는 error 발생 확인

## Acceptance Criteria
- [ ] `docker compose config`가 오류 없이 통과한다.
- [ ] `DATA_DIR=./.smoke-data DOMAIN=localhost docker compose up -d --build`로 두 컨테이너가 정상 실행되고 backend가 healthy가 된다.
- [ ] `node scripts/deploy-smoke.mjs`의 6개 체크가 모두 통과한다.
- [ ] 백엔드 재시작 후에도 `.smoke-data/game.db`가 유지된다.
- [ ] 로컬 개발 DB `./data/game.db`는 이미지에 포함되지 않고 보존된다.

## Validation
- `docker compose config`
- `DATA_DIR=./.smoke-data DOMAIN=localhost docker compose up -d --build && docker compose ps`
- `node scripts/deploy-smoke.mjs`
- `docker compose restart backend && sleep 10 && ls -la .smoke-data/game.db && node scripts/deploy-smoke.mjs`
- `DATA_DIR=./.smoke-data docker compose down && rm -rf .smoke-data`

## Commit Message
```text
feat(deploy): Docker·Caddy 컨테이너 인프라와 배포 스모크 테스트 스크립트

Plan: 2026-11-08-oracle-vm-deployment
Phase: P01-oracle-deployment
Task: T02-docker-caddy-and-smoke-test

- I01: Dockerfile.backend(node24 + tsx), Dockerfile.frontend(Vite 빌드 → Caddy) 작성
- I02: Caddyfile 작성 (자동 HTTPS, 압축, noindex·robots.txt, /ws·/health 프록시, SPA fallback, 캐시 헤더)
- I03: docker-compose.yml(헬스체크·로그 순환·접속 가드 env·DATA_DIR), .env.example, .dockerignore 작성, .gitignore에 .env·.smoke-data 추가
- I04: scripts/deploy-smoke.mjs 추가 (health·SPA·noindex·robots·WS 방 생성·Origin 거절 점검)
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
