# Task: T02 운영용 compose와 amd64 이미지 빌드·push 스크립트

## Status: done

## Goal
VM이 소스 없이 이미지만으로 기동할 수 있도록 `image:`만 참조하는 운영용 compose(`deploy/azure/docker-compose.yml`)를 만들고, 로컬에서 `linux/amd64` 이미지 2개(`ob-crash-backend`, `ob-crash-web`)를 빌드해 GHCR에 push하는 `scripts/azure/build-push.sh`를 만든다. 로컬에서 같은 compose로 기동해 `deploy-smoke.mjs` 6개 항목이 통과해야 한다. 오라클용 compose(`deploy/oracle/docker-compose.yml`, T01에서 이동)는 건드리지 않는다.

## Decision Summary
- D05: VM 빌드 폐기, 로컬 빌드 + GHCR 공개 패키지. 태그는 git 단축 해시 + `latest`.
- D06: 빌드·push와 VM 갱신을 분리, 이미지 이름·태그 규칙은 `config.sh` 한 곳에서만 정의(이후 GitHub Actions 전환 대비).
- 오라클 compose(`deploy/oracle/docker-compose.yml`)는 `build:` 기반이라 유지. 운영용은 별도 파일(`deploy/azure/`)이며 환경변수 키가 어긋나지 않도록 테스트로 지킨다.

## Implementation

### I00. (사전) 결정·계획 문서 커밋 — P01-T01 시작 시 이미 수행했으면 생략
- Related Files:
  - `.memory/decisions/2026-11-09-azure-vm-deployment.md`, `.memory/plans/2026-11-09-azure-vm-deployment.md`, `.memory/phases/2026-11-09-azure-vm-deployment/**`, `.memory/current.md` :: 계획 산출물; new/modify

#### Details
- 코드 작업 전에 위 문서들만 `git add .memory` 후 별도 커밋: `docs(memory): Azure VM 배포 결정과 계획`. 이 커밋은 T01 커밋과 분리한다(과거 이력 관례: `2a96f77 docs(memory): ...`).

### I01. 공통 설정 `scripts/azure/config.sh` (이미지 부분)
- Related Files:
  - `scripts/azure/config.sh` :: 이미지·원격 경로 변수; new
  - `.gitignore` :: `scripts/azure/config.local.sh` 추가; modify

#### Details
- **셸 호환**: macOS 기본 bash 3.2에서도 동작해야 한다. 연관 배열, `mapfile`, `${var,,}` 사용 금지. 첫 줄 `#!/usr/bin/env bash`는 실행 스크립트만, `config.sh`는 source 전용(셰뱅·실행 권한 없음).
- **정의할 변수** (`config.local.sh`가 있으면 마지막에 `source`해서 덮어쓸 수 있게):
  ```bash
  IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/chajiyoung}"   # GHCR은 소문자 필수
  IMAGE_BACKEND_NAME="ob-crash-backend"
  IMAGE_WEB_NAME="ob-crash-web"
  GHCR_USER="${GHCR_USER:-ChaJiYoung}"
  REMOTE_DIR="/opt/ob-crash"
  # config.local.sh (gitignored) 가 있으면 source
  ```
- 이미지 전체 이름은 `"${IMAGE_PREFIX}/${IMAGE_BACKEND_NAME}"`처럼 조합하는 헬퍼 변수 `IMAGE_BACKEND`, `IMAGE_WEB`로 노출한다. **이 두 변수 외의 곳에서 이미지 이름 문자열을 하드코딩하지 않는다.** (P02에서 Azure 변수가 이 파일에 추가된다.)

### I02. 운영용 compose `deploy/azure/docker-compose.yml`
- Related Files:
  - `deploy/azure/docker-compose.yml` :: 이미지 기반 운영 스택; new
  - `deploy/azure/.env.example` :: VM의 `.env` 형식 예시; new
  - `deploy/oracle/docker-compose.yml` :: 환경변수 키 기준(read-only 비교 대상); read-only

#### Details
- `deploy/oracle/docker-compose.yml`의 구성을 그대로 따르되 아래만 다르다.
  - `backend.build`·`web.build` 제거, 대신
    ```yaml
    backend:
      image: ${IMAGE_PREFIX:-ghcr.io/chajiyoung}/ob-crash-backend:${IMAGE_TAG:-latest}
    web:
      image: ${IMAGE_PREFIX:-ghcr.io/chajiyoung}/ob-crash-web:${IMAGE_TAG:-latest}
    ```
  - `DOMAIN`은 필수: `ALLOWED_ORIGIN: "https://${DOMAIN:?DOMAIN is required}"`, web `environment.DOMAIN: "${DOMAIN:?DOMAIN is required}"`. (오라클 파일은 `localhost` 기본값이라 로컬용, 운영은 누락 시 즉시 실패)
  - **`pull_policy`는 지정하지 않는다.** 로컬 검증에서 `IMAGE_PREFIX=local`로 만든 이미지는 레지스트리에 없어 `always`면 기동이 실패한다. VM에서의 갱신은 `deploy.sh`가 명시적으로 `docker compose pull`을 한다.
- 그대로 유지: `x-logging`(json-file 10m×3), backend `restart: unless-stopped`·`init: true`·`TRUST_PROXY: "1"`·`WS_MAX_CONN_PER_IP`·`WS_MAX_CONN_TOTAL`·healthcheck, web `ports: 80:80, 443:443, 443:443/udp`·`depends_on: backend: condition: service_healthy`, volumes `caddy_data`·`caddy_config`, backend `${DATA_DIR:-./data}:/app/data` (VM에서는 compose 파일이 `/opt/ob-crash/`에 있으므로 `./data`가 `/opt/ob-crash/data`; **로컬 검증 시 `deploy/azure/` 기준으로 해석되므로 `DATA_DIR`을 절대경로로 지정**).
- `deploy/azure/.env.example` 내용: `DOMAIN=`, `IMAGE_PREFIX=ghcr.io/chajiyoung`, `IMAGE_TAG=latest`를 주석과 함께. (VM의 `.env`는 `deploy.sh`가 만들어 주므로 사람이 편집하지 않는다는 주석.)

### I03. 빌드·push 스크립트 `scripts/azure/build-push.sh`
- Related Files:
  - `scripts/azure/build-push.sh` :: amd64 빌드·GHCR push; new (chmod +x)
  - `Dockerfile.backend`, `Dockerfile.frontend` :: 빌드 대상; read-only

#### Details
- **Signatures**: `build-push.sh [--tag TAG] [--no-push] [--allow-dirty]`
  - `--tag` 기본값: `git rev-parse --short HEAD`.
- **Execution Flow**:
  1. `source "$(dirname "$0")/config.sh"`, `cd`를 저장소 루트로 이동.
  2. 작업 트리가 더러우면(`git status --porcelain` 비어 있지 않음) `--allow-dirty` 없이는 종료(exit 2). 허용 시 태그에 `-dirty`를 붙이고 **`latest` 태그는 만들지도 push하지도 않는다**(재현 불가한 이미지가 latest가 되는 것을 막음).
  3. 빌드(두 이미지 각각):
     ```bash
     docker build --platform linux/amd64 -f Dockerfile.backend -t "$IMAGE_BACKEND:$TAG" [-t "$IMAGE_BACKEND:latest"] .
     docker build --platform linux/amd64 -f Dockerfile.frontend -t "$IMAGE_WEB:$TAG" [-t "$IMAGE_WEB:latest"] .
     ```
     `buildx --push` 대신 `docker build` + `docker push`를 쓴다(기본 builder에서 동작, 별도 builder 생성 불필요).
  4. 빌드 후 `docker image inspect --format '{{.Architecture}}'`로 `amd64` 확인, 아니면 종료.
  5. `--no-push`면 여기서 종료. 아니면 로그인 확인 후 push:
     - 이미 로그인됐는지 판단하기 어려우므로 `gh auth token | docker login ghcr.io -u "$GHCR_USER" --password-stdin`을 시도. 실패하면(`gh` 없음/권한 부족) 안내 출력 후 exit 3: "`gh auth refresh -s write:packages`를 실행하세요(터미널에서 `! gh auth refresh -s write:packages`)".
     - `docker push` 두 이미지 × (`$TAG`, 해당 시 `latest`).
  6. push 성공 후 **GHCR 공개 전환 안내**를 반드시 출력: 두 패키지(`ob-crash-backend`, `ob-crash-web`) 모두 GitHub → 프로필 → Packages → 패키지 → Package settings → Change visibility → Public으로 바꿔야 VM이 로그인 없이 pull 가능. (최초 push 한 번만 필요.)
- **Error handling**: `set -euo pipefail`. Docker 데몬이 없으면 `docker info` 실패를 감지해 명확한 메시지로 종료.
- 이미지 이름은 `config.sh`의 `IMAGE_BACKEND`/`IMAGE_WEB`만 사용한다.

### I04. 정합성 테스트 `tests/azure-deploy-files.test.ts`
- Related Files:
  - `tests/azure-deploy-files.test.ts` :: 운영 compose·스크립트 정합성; new

#### Details
- 테스트 케이스:
  1. `deploy/azure/docker-compose.yml`에 `build:` 줄이 **없고**, `ob-crash-backend`·`ob-crash-web`을 가리키는 `image:`가 `${IMAGE_PREFIX`와 `${IMAGE_TAG`를 포함한다.
  2. **환경변수 키 정합성**: `deploy/oracle/docker-compose.yml`과 운영 compose의 `backend.environment` 키 집합이 같다(정규식 `^\s{6}([A-Z_]+):`로 `environment:` 블록 안만 추출). 한쪽에만 키가 추가되면 실패 → 두 파일이 어긋나는 것을 막는 장치.
  3. `scripts/azure/*.sh`에 대해 `bash -n`(문법 검사)이 통과한다(`spawnSync('bash', ['-n', file])`, 파일이 없으면 케이스 통과 처리하지 말고 목록이 비면 실패).
  4. `scripts/azure/config.sh`를 `bash -c 'source ...; echo "$IMAGE_BACKEND"'`로 실행했을 때 출력이 소문자이며 `ghcr.io/chajiyoung/ob-crash-backend`와 같다.

## Acceptance Criteria
- [ ] `deploy/azure/docker-compose.yml`이 `image:`만 참조하고 `DOMAIN` 미지정 시 `docker compose config`가 오류로 종료된다.
- [ ] `IMAGE_PREFIX=local scripts/azure/build-push.sh --no-push --tag test`로 두 이미지가 `amd64`로 만들어진다.
- [ ] 위 이미지와 운영 compose로 로컬 기동 시 `node scripts/deploy-smoke.mjs https://localhost`의 6개 항목이 모두 OK다.
- [ ] 백엔드 재시작 후 `.smoke-data/game.db`가 유지된다.
- [ ] `build-push.sh`가 더러운 작업 트리에서 `--allow-dirty` 없이 실패하고, 허용 시 `latest`를 만들지 않는다.
- [ ] `deploy/oracle/docker-compose.yml`·`Caddyfile`·Dockerfile은 변경되지 않았다.
- [ ] 이 Task에서는 **GHCR에 실제 push하지 않는다**(push는 P04에서 사용자 확인 후).

## Validation
- `npx vitest run tests/azure-deploy-files.test.ts` — 통과
- `DOMAIN=localhost docker compose -f deploy/azure/docker-compose.yml config` — 오류 없이 출력, 인자 없이 실행 시 `DOMAIN is required` 오류
- `IMAGE_PREFIX=local scripts/azure/build-push.sh --no-push --tag test --allow-dirty`
- `DOMAIN=localhost IMAGE_PREFIX=local IMAGE_TAG=test-dirty DATA_DIR=$PWD/.smoke-data docker compose -f deploy/azure/docker-compose.yml up -d` (태그는 스크립트가 출력한 값 사용; 호스트의 80/443 포트가 비어 있어야 함)
- `node scripts/deploy-smoke.mjs https://localhost` — 6개 OK
- `docker compose -f deploy/azure/docker-compose.yml restart backend && sleep 10 && ls -la .smoke-data/game.db`
- 정리: `docker compose -f deploy/azure/docker-compose.yml down` 후 `rm -rf .smoke-data`
- `npx tsc --noEmit && npm test` — 전체 통과(기존 899개 + 신규)

## Commit Message
```text
feat(deploy): Azure용 이미지 기반 compose와 amd64 빌드·GHCR push 스크립트

Plan: 2026-11-09-azure-vm-deployment
Phase: P01-image-pipeline
Task: T02-prod-compose-and-image-build

- I01: scripts/azure/config.sh에 이미지 이름·원격 경로 단일 정의
- I02: deploy/azure/docker-compose.yml(image 참조, DOMAIN 필수)과 .env.example
- I03: build-push.sh(amd64 빌드, dirty 방지, GHCR 공개 전환 안내)
- I04: compose 환경변수 키 정합성·스크립트 문법 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
