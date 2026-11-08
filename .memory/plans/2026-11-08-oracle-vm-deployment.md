# Plan: Oracle Cloud Free VM 배포 (oracle-vm-deployment)

## Goal
오라클 클라우드(OCI) Always Free VM에서 비어 크러셔를 비용 0원으로 공개 운영한다.
- 공개 인터넷 노출에 대비해 WebSocket 서버에 경량 남용 방지(메시지 크기·IP당/전체 동시 접속 상한·Origin 검사)를 넣고, 상한 초과 시 PC·폰에 안내 배너를 띄운다.
- `docker compose up -d --build` 한 줄로 Caddy(자동 HTTPS·SPA·`/ws` 프록시·압축·noindex) + Node 백엔드(SQLite 볼륨)가 뜨고, 로컬 스모크 스크립트로 health/SPA/WS/Origin/DB 유지가 검증된다.
- 초보자가 인스턴스 생성부터 재시작·백업·트러블슈팅까지 따라 할 수 있는 배포 가이드를 제공한다.

Decisions: [2026-11-08-oracle-vm-deployment](../decisions/2026-11-08-oracle-vm-deployment.md) (D01~D19)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 오라클 Always Free VM 배포 구축 (서버 방어 + 컨테이너 인프라 + 배포 가이드) | [P01](../phases/2026-11-08-oracle-vm-deployment/P01-oracle-deployment/phase.md) |
