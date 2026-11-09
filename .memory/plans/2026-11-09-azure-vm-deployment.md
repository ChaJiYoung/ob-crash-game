# Plan: Azure VM 배포 (azure-vm-deployment)

## Goal
오라클용으로 만든 Docker·Caddy 배포물을 Azure VM(`<RESOURCE_GROUP>` 리소스그룹, Korea Central)으로 옮겨 비어 크러셔를 공개 운영한다.
- VM에서는 빌드하지 않는다. 로컬(amd64)에서 이미지를 만들어 GHCR(공개)에 올리고, VM은 `docker compose pull && up -d`만 한다.
- 인프라(VM·고정 공용 IP·NSG·자동 종료)는 `az` CLI 스크립트(`scripts/azure/`)로 재현 가능하게 만든다. 실제 리소스 생성은 사용자 확인 후에만 한다.
- `deploy.sh` 한 줄이 빌드 → push → VM 시작 → 갱신 → 스모크 점검을 수행하고, `vm.sh stop`(deallocate)으로 안 쓸 때 과금을 멈춘다.
- 초보자가 계정 확인부터 배포·중지·백업·트러블슈팅까지 따라 할 수 있는 Azure 가이드를 제공한다.

Decisions: [2026-11-09-azure-vm-deployment](../decisions/2026-11-09-azure-vm-deployment.md) (D01~D12, 오라클 D01~D19 승계)

## 선행 완료 사항
- `feature/deployment` → `feature/azure-deployment` 병합(fast-forward) 완료: 접속 상한·Origin 검사·Docker·Caddy·스모크·WebGL 대응이 포함됨. 병합 후 `tsc` 오류 0, `vitest` 113 파일 899 테스트 통과(2026-11-09).
- `Standard_B2ats_v2`가 Korea Central에서 SKU 제한 없이 조회됨(vCPU 쿼터는 미확인 → P02/P04에서 확인).

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 오라클 파일을 `deploy/oracle`로 이동(레거시 표시) + 운영용 compose(image 참조)와 로컬 amd64 빌드·GHCR push 스크립트 | [P01](../phases/2026-11-09-azure-vm-deployment/P01-image-pipeline/phase.md) |
| P02 | `done ✅` | Azure 인프라 스크립트(프로비저닝·cloud-init·VM 시작/중지·내 IP 허용) | [P02](../phases/2026-11-09-azure-vm-deployment/P02-azure-infra-scripts/phase.md) |
| P03 | `done ✅` | 배포 스크립트(deploy.sh)와 SQLite 백업 스크립트(backup.sh) | [P03](../phases/2026-11-09-azure-vm-deployment/P03-deploy-and-backup/phase.md) |
| P04 | `done ✅` | 실제 Azure 배포 검증(사용자 확인 게이트)과 Azure 가이드·README | [P04](../phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/phase.md) |
