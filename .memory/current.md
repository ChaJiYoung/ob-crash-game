# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P01 이미지 파이프라인](./phases/2026-11-09-azure-vm-deployment/P01-image-pipeline/phase.md)

## Active Task
[T02 운영용 compose와 amd64 이미지 빌드·push 스크립트](./phases/2026-11-09-azure-vm-deployment/P01-image-pipeline/T02-prod-compose-and-image-build.md)

## Status
- P01-T01 완료(오라클 파일 `deploy/oracle/`로 이동·레거시 표시). tsc 0 오류, vitest 113 파일 899 테스트 통과.
- 사용자 지시: 모든 Task 진행, 막히면 질문, **배포 스크립트(provision/build-push/deploy) 실행 전에 Opus 5.5 검토를 받을 것.** GHCR 공개 전환·폰 실기기 확인은 사용자 조작 필요.

## Next Step (IMPORTANT)
T02 청사진을 읽고 `scripts/azure/config.sh`, `deploy/azure/docker-compose.yml`·`.env.example`, `scripts/azure/build-push.sh`, `tests/azure-deploy-files.test.ts` 구현. 로컬 검증은 `DATA_DIR=$PWD/.smoke-data`(절대경로)로.
