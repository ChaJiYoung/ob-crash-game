# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P03 배포·백업 스크립트](./phases/2026-11-09-azure-vm-deployment/P03-deploy-and-backup/phase.md)

## Active Task
[T01 배포·백업 스크립트](./phases/2026-11-09-azure-vm-deployment/P03-deploy-and-backup/T01-deploy-and-backup-scripts.md)

## Status
- P01(T01 오라클 이동, T02 이미지 파이프라인), P02(T01 프로비저닝·VM 운영 스크립트) 완료. dry-run 검증, Azure 리소스는 아직 만들지 않음. tsc 0 오류, vitest 115 파일 915 테스트 통과.
- 사용자 지시: 모든 Task 진행, 막히면 질문, **배포 스크립트(provision/build-push/deploy) 실행 전에 Opus 5.5 검토를 받을 것.** GHCR 공개 전환·폰 실기기 확인은 사용자 조작 필요.

## Next Step (IMPORTANT)
P03-T01 청사진을 읽고 `scripts/azure/deploy.sh`, `backup.sh`, 테스트 확장 구현(dry-run만). 그다음 P04-T01 실배포 전에 provision/build-push/deploy 스크립트를 Opus 5.5 에이전트에게 검토받을 것.
