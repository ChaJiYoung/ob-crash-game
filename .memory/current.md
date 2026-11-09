# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P01 이미지 파이프라인](./phases/2026-11-09-azure-vm-deployment/P01-image-pipeline/phase.md)

## Active Task
[T01 오라클 전용 파일을 deploy/oracle로 이동(레거시 표시)](./phases/2026-11-09-azure-vm-deployment/P01-image-pipeline/T01-move-oracle-to-legacy.md)

## Status
- 결정 문서(D01~D12)와 계획 작성 완료. `feature/deployment` 병합(fast-forward) 완료, 병합 후 tsc 오류 0·vitest 113 파일 899 테스트 통과.
- 코드 작업 전에 결정·계획 문서를 `docs(memory)` 커밋으로 먼저 커밋(T01 착수 전, T02 I00은 그때 수행했으면 생략).

## Next Step (IMPORTANT)
`docs(memory)` 커밋 → T01(`git mv`로 compose·.env.example·오라클 가이드를 deploy/oracle로 이동, build context `../..`·`DATA_DIR ../../data`·`.env` 경로 보정) → T02(`config.sh`, `deploy/azure/docker-compose.yml`, `build-push.sh`, 테스트).
주의: P04에서만 Azure 리소스 생성·GHCR push를 한다(사용자 확인 게이트 G0~G3).
