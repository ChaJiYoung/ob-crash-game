# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)

## Active Phase
[P01 샷건 평타 퍼짐](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P01-shotgun-spread/phase.md)

## Active Task
[T01 샷건 평타 추가 명중 엔진·튜닝](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P01-shotgun-spread/T01-extra-hit-engine.md)

## Status
- 계획 수립 완료(7 Phase, 11 Task). 결정 문서: [2026-11-09-playtest-feedback-guide-lobby-shotgun](./decisions/2026-11-09-playtest-feedback-guide-lobby-shotgun.md)
- T01 구현 시작 준비 완료

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/shared/gameTuning.ts`(`shotgunSpread` 추가, `weaponDamageScale.shotgun` 1.0)와 `src/pc/engine/BeerCrusherEngine.ts`(`shootAt`의 샷건 분기, 새 `collectShotgunSpreadTargets`) 구현 시작

## 보류 중인 이전 작업 (Azure VM 배포 계획, 완료 처리됨 — 이 계획과 별개)
- 미확인: 폰에서 한 판 완료·랭킹 저장, 자동 종료(KST 24:00) 실동작, 가이드의 리소스 삭제 절차(실행해 본 적 없음).
- 폰으로 한 판 완료·랭킹 저장 확인: `scripts/azure/vm.sh start` → 플레이 → `backup.sh`로 기록 확인 → `vm.sh stop`. 다음날 `vm.sh status`로 자동 종료 확인. 팀 그룹 월 비용 증가(약 $6~15) 공유.
