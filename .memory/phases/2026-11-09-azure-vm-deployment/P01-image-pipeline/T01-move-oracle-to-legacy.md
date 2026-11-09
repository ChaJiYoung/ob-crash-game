# Task: T01 오라클 전용 파일을 deploy/oracle로 이동(레거시 표시)

## Status: pending

## Goal
오라클 전용 파일(루트 `docker-compose.yml`, `.env.example`, 오라클 가이드)을 `deploy/oracle/`로 옮겨 `deploy/azure/`와 짝을 맞추고, 현재 운영 경로는 Azure임을 문서에 표시한다. Docker·Caddy 공유 파일은 옮기지 않는다. 이동 후에도 오라클 compose가 **저장소 루트를 빌드 컨텍스트로** 정상 해석되고, `./data`·`.env` 경로가 조용히 바뀌지 않아야 한다.

## Decision Summary
- D12 변경: 오라클 가이드를 `docs/`에 두지 않고 `deploy/oracle/`로 이동, 레거시 배너 추가. (사용자 결정 2026-11-09)
- 공유 파일은 이동 금지: `Dockerfile.backend`, `Dockerfile.frontend`, `Caddyfile`, `.dockerignore`는 Azure 이미지 빌드(`COPY Caddyfile`, `-f Dockerfile.*`, 컨텍스트 `.`)가 그대로 사용한다.
- 코드·테스트는 이 파일들을 참조하지 않는다(확인: `tests/`에 참조 없음). 참조는 README, 오라클 가이드, 과거 `.memory` 문서뿐. 과거 `.memory` 문서는 이력이므로 수정하지 않는다.

## Implementation

### I01. 파일 이동과 compose 경로 보정
- Related Files:
  - `docker-compose.yml` → `deploy/oracle/docker-compose.yml` :: `git mv`; modify
  - `.env.example` → `deploy/oracle/.env.example` :: `git mv`; modify (DuckDNS 설명 유지, 경로 안내 추가)
  - `Dockerfile.backend`, `Dockerfile.frontend`, `Caddyfile`, `.dockerignore` :: 루트 유지; read-only

#### Details
- `git mv`로 이동해 이력을 보존한다.
- **빌드 컨텍스트**: compose 파일 기준 상대 경로가 되므로 `backend.build`·`web.build`의 `context: .`를 `context: ../..`로 바꾼다. `dockerfile: Dockerfile.backend` / `Dockerfile.frontend`는 **컨텍스트 기준**이라 그대로 둔다.
- **데이터 경로 함정**: `${DATA_DIR:-./data}`의 `./data`는 이제 `deploy/oracle/data`로 해석된다. 기본값을 `${DATA_DIR:-../../data}`로 바꿔 기존과 같은 저장소 루트 `data/`를 가리키게 한다(루트 `.gitignore`의 `data/`가 계속 적용됨).
- **`.env` 함정**: compose는 `.env`를 compose 파일이 있는 폴더(= `deploy/oracle/.env`)에서 찾는다. 가이드 명령에서 `cp deploy/oracle/.env.example deploy/oracle/.env`로 안내한다. 루트 `.gitignore`의 `.env` 패턴은 하위 경로에도 적용되는지 확인한다(`git check-ignore deploy/oracle/.env`).
- 주석: 파일 맨 위에 "레거시(오라클 VM에서 소스 빌드용). 현재 운영 경로는 deploy/azure"를 한 줄 남긴다.

### I02. 오라클 가이드 이동과 명령 갱신
- Related Files:
  - `docs/오라클_클라우드_무료_배포_가이드.md` → `deploy/oracle/오라클_클라우드_무료_배포_가이드.md` :: `git mv` 후 명령·링크 수정; modify
  - `README.md` :: 링크·명령 갱신; modify

#### Details
- 가이드 최상단에 인용 블록 배너: `> [!WARNING] 레거시 문서입니다. 현재 운영은 Azure(deploy/azure, docs/Azure_VM_배포_가이드.md)입니다. 오라클 Always Free로 되돌아갈 때 참고하세요.` (Azure 가이드 링크는 P04-T02에서 파일이 생기므로 이 시점에는 경로 텍스트만 쓰고 링크는 걸지 않는다.)
- 가이드 안의 명령을 새 경로로 바꾼다. 예:
  - `cp .env.example .env` → `cp deploy/oracle/.env.example deploy/oracle/.env`
  - `docker compose up -d --build` → `docker compose -f deploy/oracle/docker-compose.yml up -d --build`
  - `docker compose ps|logs|exec|restart` → 모두 `-f deploy/oracle/docker-compose.yml` 추가 (백업 `docker compose exec backend node -e …` 포함)
  - 업데이트 절 `git pull && docker compose up -d --build` 동일하게 갱신
  - 가이드 내 상대 링크(`../README.md`, 스크린샷 등)가 있으면 새 위치 기준으로 보정
- README: 문서 표의 오라클 행 링크를 새 경로로 바꾸고 이름에 "(레거시)"를 붙인다. "Docker Compose 실행(운영/배포 환경)" 절의 오라클용 명령을 `-f deploy/oracle/docker-compose.yml` 형태로 바꾸고 `.env` 안내도 새 경로로 갱신, 해당 절에 "현재 운영은 Azure" 한 줄 추가.
- **docs-sync 영향**: 가이드가 `docs/`를 벗어나므로 `tests/docs-sync.test.ts`의 `collect()`(docs/*.md + README + 컴포넌트) 대상에서 빠진다. 허용된 변화이며 가이드에 게임 규칙 문구는 없다.

## Acceptance Criteria
- [ ] 루트에 `docker-compose.yml`, `.env.example`이 남아 있지 않고 `deploy/oracle/`에 있다.
- [ ] `docker compose -f deploy/oracle/docker-compose.yml config`에서 `backend`·`web`의 build `context`가 저장소 루트 절대경로로, 데이터 볼륨 source가 저장소 루트의 `data`로 해석된다.
- [ ] `Dockerfile.backend`, `Dockerfile.frontend`, `Caddyfile`, `.dockerignore`는 루트에 그대로이고 내용이 변하지 않았다.
- [ ] 오라클 가이드와 README에 남은 `docker compose` 명령이 모두 새 경로 형식이다(`grep`으로 `docker compose up -d --build`가 `-f` 없이 남아 있지 않음).
- [ ] 가이드 상단에 레거시 배너가 있다.
- [ ] `git check-ignore deploy/oracle/.env`가 경로를 출력한다.

## Validation
- `DOMAIN=localhost docker compose -f deploy/oracle/docker-compose.yml config | grep -nE "context:|source:|ALLOWED_ORIGIN"` — context가 저장소 루트, source가 `<repo>/data`
- `git status --short` — rename(R)로 표시, 공유 파일 변경 없음
- `grep -rn "docker compose" README.md deploy/oracle/*.md | grep -v -- "-f deploy/oracle"` — 의도한 예외만 남음
- `git check-ignore deploy/oracle/.env` — 경로 출력
- `npx tsc --noEmit && npm test` — 전체 통과

## Commit Message
```text
refactor(deploy): 오라클 전용 파일을 deploy/oracle로 옮기고 레거시로 표시

Plan: 2026-11-09-azure-vm-deployment
Phase: P01-image-pipeline
Task: T01-move-oracle-to-legacy

- I01: docker-compose.yml·.env.example을 deploy/oracle로 이동, build context와 data 경로 보정
- I02: 오라클 가이드 이동·레거시 배너·명령 경로 갱신, README 링크 갱신
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
