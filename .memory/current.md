# Current Context

## Active Plan
[Azure VM 배포](./plans/2026-11-09-azure-vm-deployment.md)

## Active Phase
[P04 실배포 검증과 가이드](./phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/phase.md)

## Active Task
없음 (계획 전체 완료) — 마지막: [T02 Azure 배포 가이드와 README](./phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/T02-azure-guide-and-readme.md)

## Status
- 계획 전체 완료(P01~P04). Azure VM 실배포·스모크 6/6·롤백·백업·중지/재시작(29초 복구) 검증, 가이드 `docs/Azure_VM_배포_가이드.md` 작성. VM은 `deallocated`(월 약 $6.05).
- 미확인: 폰에서 한 판 완료·랭킹 저장, 자동 종료(KST 24:00) 실동작, 가이드의 리소스 삭제 절차(실행해 본 적 없음).

## Next Step (IMPORTANT)
폰으로 한 판 완료·랭킹 저장 확인(`scripts/azure/vm.sh start` → 플레이 → `backup.sh`로 기록 확인 → `vm.sh stop`). 다음날 `vm.sh status`로 자동 종료 실동작 확인. 팀 그룹의 월 비용 증가(약 $6~15) 공유. 필요 시 PR 생성(설명에 WebGL 대응 커밋 포함 사실 명시).
