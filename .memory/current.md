# Current Context

## Active Plan
[플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)](./plans/2026-11-09-playtest-feedback-guide-lobby-shotgun.md) — **전체 완료**

## Active Phase
없음 (P01~P07 완료)

## Active Task
없음 — 마지막: [P07-T01 문서 캡처 재촬영과 참조 점검](./phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P07-docs-captures/T01-recapture-docs-screens.md)

## Status
- 계획 완료. P01~P03 샷건(평타 퍼짐·스킬 재설계·봇 측정), P04 로비(1P 기억·배너), P05 가이드 카드화·`public/guide` 이미지, P06 튜토리얼 3라운드, P07 캡처 재촬영.
- Opus 5.5 리뷰 2회 반영(P1~P3: `35569bc`, P4~P6: `e7b85b4`). P03(Claude Haiku via Orca), P07(agy gemini-3.8-flash-high via Orca 터미널) 위임 수행.
- 전체 테스트 1005개, `tsc` 통과.

## Next Step (IMPORTANT)
사람이 직접 플레이해 확인: 샷건 평타 퍼짐 체감, 스킬 박힘·폭발, 로비 배너, 가이드 카드, 튜토리얼 3라운드. 봇 측정은 샷건 90% / 리볼버 90% / 게틀링 56%(`.memory/references/playtest-2026-11-09-shotgun-spread-and-plunger.md`)이므로 샷건이 리볼버와 같아 사람 플레이 후 비율 조정 필요할 수 있음. 필요 시 PR 생성.

## 보류 중인 이전 작업 (Azure VM 배포 계획, 완료 처리됨 — 이 계획과 별개)
- 미확인: 폰에서 한 판 완료·랭킹 저장, 자동 종료(KST 24:00) 실동작, 가이드의 리소스 삭제 절차(실행해 본 적 없음).
- 폰으로 한 판 완료·랭킹 저장 확인: `scripts/azure/vm.sh start` → 플레이 → `backup.sh`로 기록 확인 → `vm.sh stop`. 다음날 `vm.sh status`로 자동 종료 확인. 팀 그룹 월 비용 증가(약 $6~15) 공유.
