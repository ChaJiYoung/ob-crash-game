# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P02 Azure 인프라 스크립트](./phases/2026-11-09-azure-vm-deployment/P02-azure-infra-scripts/phase.md)

## Active Task
[T01 Azure 프로비저닝·VM 운영 스크립트](./phases/2026-11-09-azure-vm-deployment/P02-azure-infra-scripts/T01-provision-and-vm-ops.md)

## Status
- P01 완료(T01 ad61d47 오라클 이동, T02 이미지 파이프라인). 로컬 amd64 빌드·운영 compose 기동·스모크 6/6·재시작 후 DB 유지 확인. tsc 0 오류, vitest 전체 통과.
- 사용자 지시: 모든 Task 진행, 막히면 질문, **배포 스크립트(provision/build-push/deploy) 실행 전에 Opus 5.5 검토를 받을 것.** GHCR 공개 전환·폰 실기기 확인은 사용자 조작 필요.

## Next Step (IMPORTANT)
P02-T01 청사진을 읽고 `scripts/azure/config.sh`(Azure 변수 추가), `lib.sh`, `cloud-init.yml`, `provision.sh`, `vm.sh`, `nsg-myip.sh`, `tests/azure-scripts.test.ts` 구현. Azure 리소스는 만들지 않는다(dry-run만).
