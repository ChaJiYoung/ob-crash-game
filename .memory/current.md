# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P04 실배포 검증과 가이드](./phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/phase.md)

## Active Task
[T01 실제 Azure 배포 검증](./phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/T01-live-deploy-verification.md)

## Status
- P01~P03 완료(스크립트 전부 dry-run·테스트 검증, `node -e` require/백업 무결성은 로컬에서 확인). Azure 리소스는 아직 만들지 않음.
- 사용자 지시: 모든 Task 진행, 막히면 질문, **배포 스크립트(provision/build-push/deploy) 실행 전에 Opus 5.5 검토를 받을 것.** GHCR 공개 전환·폰 실기기 확인은 사용자 조작 필요.

## Next Step (IMPORTANT)
P04-T01: (1) Opus 5.5 에이전트에게 provision.sh/build-push.sh/deploy.sh/cloud-init.yml/compose 검토 요청 → 지적 반영 → (2) `provision.sh --yes` → (3) build-push → 사용자가 GHCR 패키지 Public 전환 → (4) deploy → 스모크 → 사용자 폰 확인 → (5) stop/start/백업 검증 → VM 중지 상태로 마무리.
