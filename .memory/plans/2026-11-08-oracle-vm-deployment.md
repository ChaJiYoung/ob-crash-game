# Plan: Oracle Cloud Free VM 배포 (oracle-vm-deployment)

## Goal
오라클 클라우드(OCI) Always Free VM 환경에서 스마트폰 체감형 3D 아케이드 슈팅 게임을 누구나 비용 0원으로 영구 운영할 수 있도록, Docker 기반 멀티 컨테이너 인프라(Caddy + Node.js)를 구성하고 완전한 단계별 배포 가이드 문서를 구축한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 도커 컨테이너화 및 Caddy 자동 SSL/리버스 프록시 인프라 구축 | [P01](../phases/2026-11-08-oracle-vm-deployment/P01-container-infra/phase.md) |
| P02 | `pending` | 오라클 Always Free 인스턴스 생성부터 운영까지의 실전 배포 가이드 문서화 | [P02](../phases/2026-11-08-oracle-vm-deployment/P02-deployment-guide/phase.md) |
