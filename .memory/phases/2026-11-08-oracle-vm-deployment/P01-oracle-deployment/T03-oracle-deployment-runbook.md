# Task: T03 오라클 Always Free 배포 가이드 문서화 및 README 갱신

## Status: done

## Goal
오라클 클라우드 Always Free 인스턴스 생성부터 2중 방화벽 해제, DuckDNS DDNS 및 IP 자동 갱신 크론 설정, Docker Compose 배포, `scripts/deploy-smoke.mjs` 검증, 유휴 회수 시 재시작 체크리스트, WAL 안전 온라인 DB 백업, 트러블슈팅, GitHub Actions CI/CD 부록까지 포괄하는 실전 배포 가이드를 작성하고, `README.md` 공식 문서 맵과 실행 가이드를 갱신한다. `tests/docs-sync.test.ts` 금지어 검사를 통과해야 한다.

## Decision Summary
- D01: ARM Ampere A1 1순위 추천(2~4 OCPU, 12~24GB RAM) + AMD Micro(1 OCPU, 1GB RAM) 4GB Swap 생성 스크립트 병기.
- D02/D17: DuckDNS 무료 도메인 + Caddy 자동 Let's Encrypt HTTPS. 검색엔진 noindex/robots.txt 차단 및 CT 로그 한계 명시.
- D07: 유휴 회수 대응 가이드(인스턴스 재시작 체크리스트, `systemctl enable docker`, DuckDNS IP 자동 갱신 크론 필수화, ARM Out of capacity 대기).
- D09/D11: 서버는 빈 DB로 시작. 백업은 파일 단순 복사가 아닌 SQLite WAL 안전 온라인 백업 명령 안내.
- D14/D15: compose 환경변수(`DOMAIN`, `TRUST_PROXY=1`, `ALLOWED_ORIGIN`, `WS_MAX_CONN_*`) 설명.
- D18: 검증 단계에 `npm test`를 포함하여 `docs-sync.test.ts` 무결성 검증.

## Implementation

### I01. 오라클 클라우드 무료 배포 가이드 작성

- Related Files:
  - `docs/오라클_클라우드_무료_배포_가이드.md` :: `[Deployment Guide]` — OCI 가입부터 운영·재시작·백업까지의 완결 가이드; new

#### Details
- **문서 구조 및 필수 수록 내용**:
  1. **개요 및 아키텍처 다이어그램**:
     - 사용자(PC / 모바일) ➔ DuckDNS ➔ OCI VM (Caddy :80/:443 ➔ 백엔드 :8787 WS & 정적 파일).
  2. **1단계: 오라클 Always Free 인스턴스 생성**:
     - ARM Ampere A1 (2~4 OCPU, 12~24GB RAM) 추천 + AMD Micro 4GB Swap 생성 스크립트.
  3. **2단계: 2중 방화벽(VCN 보안 목록 + OS iptables) 해제**:
     - VCN Ingress Rules (TCP 80, 443, UDP 443) + iptables 영구 저장 명령어.
  4. **3단계: DuckDNS 무료 도메인 및 IP 자동 갱신 크론 설정 (필수, D07)**:
     - `duck.sh` 스크립트 및 5분 주기 crontab 설정.
  5. **4단계: Docker 및 Docker Compose 원클릭 설치**:
     - `systemctl enable docker` 포함.
  6. **5단계: 소스코드 클론 및 환경설정**:
     - `git clone`, `.env` 작성. 빈 DB 자동 시작.
  7. **6단계: 빌드 및 실행**:
     - `docker compose up -d --build`.
  8. **7단계: 서비스 검증 및 스모크 테스트 (D08)**:
     - `node scripts/deploy-smoke.mjs https://<도메인>` 검증.
     - PC 브라우저 로비 및 모바일 QR 페어링, 자이로 센서 사격 테스트.
  9. **8단계: 운영 매뉴얼 (재시작, 백업, 로그)**:
     - 유휴 회수(인스턴스 정지) 시 재시작 체크리스트 (Start ➔ docker ps ➔ duckdns 갱신 ➔ health 확인).
     - SQLite WAL 안전 온라인 백업 명령 (D11).
  10. **9단계: 검색엔진 차단 주의사항 (D17)**:
      - noindex/robots.txt 및 CT 로그 한계 안내.
  11. **10단계: 트러블슈팅 (FAQ)**.
  12. **부록: GitHub Actions CI/CD 무중단 자동 배포 워크플로우**.
- **금지어 회귀 방지**: `tests/docs-sync.test.ts`의 FORBIDDEN 목록 준수.

---

### I02. README.md 공식 문서 맵 및 실행 안내 갱신

- Related Files:
  - `README.md` :: `[Documentation Map]` — 공식 문서 맵 및 실행 안내 갱신; modify

#### Details
- 공식 문서 맵에 `[☁️ 오라클 클라우드 배포 가이드](./docs/오라클_클라우드_무료_배포_가이드.md)` 추가.
- 빠른 시작 섹션에 Docker Compose 실행 안내 추가.

## Acceptance Criteria
- [ ] `docs/오라클_클라우드_무료_배포_가이드.md`가 생성되고 인스턴스 생성부터 운영·백업·재시작까지 누락 없이 기술된다.
- [ ] `README.md` 공식 문서 맵 및 빠른 시작에 반영된다.
- [ ] `npm test`의 `tests/docs-sync.test.ts`를 포함한 전체 테스트가 통과한다.

## Validation
- `npm test` — 전체 테스트 통과
- 문서 링크 유효성 확인

## Commit Message
```text
docs(deploy): 오라클 클라우드 Always Free 배포 가이드 작성 및 README 갱신

Plan: 2026-11-08-oracle-vm-deployment
Phase: P01-oracle-deployment
Task: T03-oracle-deployment-runbook

- I01: docs/오라클_클라우드_무료_배포_가이드.md 작성 (인스턴스 생성, 2중 방화벽, DuckDNS 크론, Docker, 스모크 테스트, 유휴 재시작, WAL 백업, 트러블슈팅)
- I02: README.md 공식 문서 맵 및 Docker Compose 빠른 시작 안내 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
