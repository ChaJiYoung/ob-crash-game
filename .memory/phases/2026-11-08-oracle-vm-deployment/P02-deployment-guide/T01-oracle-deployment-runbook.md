# Task: T01 오라클 Always Free 배포 가이드 문서화 및 README 갱신

## Status: pending

## Goal
오라클 클라우드 가입부터 Always Free 인스턴스 생성, 2중 방화벽 해제, DuckDNS 무료 도메인 연결, Docker 빌드/실행, 모바일 자이로 센서 HTTPS 검증 및 운영/트러블슈팅까지 초보자도 한 단계씩 따라 할 수 있는 완결된 배포 가이드 문서를 작성하고 README 문서 맵에 등록한다.

## Decision Summary
- ARM Ampere A1 1순위 추천 및 AMD Micro 4GB Swap 생성 명령어 포함.
- OCI VCN 보안 목록과 리눅스 내부 iptables를 모두 해제하는 2중 방화벽 해제 가이드 제공.
- DuckDNS + Caddy를 활용한 0원 영구 고정 HTTPS 도메인 설정 방법 상세화.
- 모바일 브라우저(iOS/Android)의 자이로 센서 권한 승인 및 QR 페어링 검증 체크리스트 수록.
- 안정화 후 전환할 수 있는 GitHub Actions CI/CD 자동 배포 템플릿 부록 수록.

## Implementation

### I01. 오라클 클라우드 무료 배포 가이드 작성

- Related Files:
  - `docs/오라클_클라우드_무료_배포_가이드.md` :: `[Deployment Guide]` — OCI 가입부터 운영까지의 실전 가이드; new

#### Details
- **문서 구조**:
  1. **개요 및 시스템 구성도 (Architecture Diagram)**:
     - 사용자(PC / 모바일) ➔ DuckDNS ➔ OCI VM (Caddy :80/:443 ➔ 백엔드 :8787 WS & 정적 파일).
  2. **1단계: 오라클 클라우드 Always Free 인스턴스 생성**:
     - OCI 가입 및 홈 리전(춘천/서울 등) 선택 팁.
     - 인스턴스 사양 선택:
       - **1순위 (추천)**: `VM.Standard.A1.Flex` (ARM Ampere, 2~4 OCPU, 12~24GB RAM).
       - **2순위 (ARM 품절 시)**: `VM.Standard.E2.1.Micro` (AMD, 1 OCPU, 1GB RAM) + **4GB Swap 생성 필수 스크립트**:
         ```bash
         sudo fallocate -l 4G /swapfile
         sudo chmod 600 /swapfile
         sudo mkswap /swapfile
         sudo swapon /swapfile
         echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
         ```
     - SSH 키페어 다운로드 및 접속 방법 (`ssh -i <key.pem> ubuntu@<공인IP>`).
  3. **2단계: 2중 방화벽(VCN 보안 목록 + OS iptables) 포트 개방**:
     - **오라클 클라우드 콘솔**: VCN ➔ 보안 목록(Default Security List) ➔ 수신 규칙(Ingress Rules) 추가 (소스: `0.0.0.0/0`, 프로토콜: `TCP`, 대상 포트: `80,443`).
     - **우분투 OS 내부 iptables 영구 개방 명령어**:
       ```bash
       sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
       sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
       sudo netfilter-persistent save
       ```
  4. **3단계: DuckDNS 무료 도메인 발급 및 공인 IP 연동**:
     - `duckdns.org` 로그인 후 원하는 서브도메인(예: `ob-crash`) 생성.
     - OCI VM의 공인 IP를 DuckDNS IP 필드에 등록.
     - (선택) IP 자동 갱신 크론탭 설정.
  5. **4단계: Docker 및 Docker Compose 원클릭 설치**:
     ```bash
     curl -fsSL https://get.docker.com -o get-docker.sh
     sudo sh get-docker.sh
     sudo usermod -aG docker $USER
     newgrp docker
     ```
  6. **5단계: 소스코드 클론 및 컨테이너 배포 실행**:
     ```bash
     git clone https://github.com/your-repo/ob-crash-game.git
     cd ob-crash-game
     cp .env.example .env
     # .env에서 DOMAIN=ob-crash.duckdns.org 설정
     docker compose up -d --build
     ```
  7. **6단계: 모바일 자이로 센서 및 게임 플레이 검증**:
     - PC 브라우저로 `https://ob-crash.duckdns.org` 접속.
     - 대기실 QR 코드를 모바일 폰으로 스캔.
     - 스마트폰 화면에서 모션 센서 권한 허용 후 3D 조준 및 사격 동작 확인.
  8. **7단계: 유지보수 및 운영 매뉴얼**:
     - 실시간 로그: `docker compose logs -f`
     - 코드 업데이트: `git pull && docker compose up -d --build`
     - 랭킹 DB 백업: `./data/game.db`
  9. **8단계: 자주 묻는 질문(FAQ) 및 트러블슈팅**:
     - OCI ARM 생성 시 "Out of Capacity" 발생 시 해결법.
     - 웹페이지 접속 지연 및 타임아웃 발생 시 iptables 확인법.
     - Caddy Let's Encrypt 인증서 발급 실패 시 로그 확인법.
  10. **부록: GitHub Actions CI/CD 무중단 자동 배포 워크플로우**:
      - `.github/workflows/deploy.yml` 예제 코드.

---

### I02. README.md 공식 문서 맵 및 실행 가이드 갱신

- Related Files:
  - `README.md` :: `[Documentation Map]` — 공식 문서 맵 테이블에 배포 가이드 링크 추가; modify

#### Details
- 공식 문서 맵 테이블에 다음 항목 추가:
  ```markdown
  | [**☁️ 오라클 클라우드 배포 가이드**](./docs/오라클_클라우드_무료_배포_가이드.md) | OCI Always Free VM + DuckDNS + Caddy 자동 SSL 도커 배포 절차 | 엔지니어·운영자 |
  ```
- 실행 방법 안내 섹션에 Docker Compose 실행 방법 추가.

## Acceptance Criteria
- [ ] `docs/오라클_클라우드_무료_배포_가이드.md`가 생성되고 인스턴스 생성, 방화벽, 도메인, 도커 실행 전 과정이 누락 없이 설명되어야 함.
- [ ] 우분투 기본 iptables 개방 명령어 및 AMD 4GB 스왑 메모리 생성 스크립트가 정확한 문법으로 수록되어야 함.
- [ ] 모바일 자이로 센서의 HTTPS 필수성 및 권한 승인 안내가 기술되어야 함.
- [ ] `README.md`의 공식 문서 맵에 해당 가이드가 링크되어야 함.

## Validation
- 가이드 문서 마크다운 렌더링 및 링크 경로(`docs/오라클_클라우드_무료_배포_가이드.md`) 유효성 검증

## Commit Message
```text
docs(deploy): 오라클 클라우드 Always Free 배포 가이드 작성 및 README 갱신

Plan: 2026-11-08-oracle-vm-deployment
Phase: P02-deployment-guide
Task: T01-oracle-deployment-runbook

- I01: docs/오라클_클라우드_무료_배포_가이드.md 작성 (인스턴스 생성, 2중 방화벽, DuckDNS, Docker, 트러블슈팅)
- I02: README.md 공식 문서 맵에 오라클 클라우드 배포 가이드 링크 추가
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
