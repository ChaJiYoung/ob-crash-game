# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P04 실배포 검증과 가이드](./phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/phase.md)

## Active Task
[T02 Azure 배포 가이드와 README](./phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/T02-azure-guide-and-readme.md)

## Status
- P01~P03 완료, P04-T01(실배포) 완료: Azure에 실제 배포·스모크 6/6·롤백·백업·중지/재시작(29초 복구) 검증. VM은 `deallocated`로 마무리.
- 미확인: 폰에서 한 판 완료·랭킹 저장, 자동 종료(KST 24:00) 실동작.
- 사용자 지시: 모든 Task 진행, 막히면 질문, 배포 스크립트 실행 전 Opus 5.5 검토(완료).

## Next Step (IMPORTANT)
P04-T02: `docs/Azure_VM_배포_가이드.md` 작성(phase.md의 실배포 결과·발견한 문제 반영), README 표·배포 절 갱신, 오라클 가이드 배너에 Azure 가이드 링크 추가. `npm test`(docs-sync 포함) 통과 확인 후 계획 전체 완료 처리.
