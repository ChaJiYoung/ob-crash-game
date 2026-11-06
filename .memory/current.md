# Current Context

## Active Plan
[보스 체력 상향 · 병 조각 속도 · 보스전 일반 몬스터 병행](./plans/2026-11-06-boss-hp-and-bottle-speed.md)

## Active Phase
[P02 보스전 일반 몬스터 병행](./phases/2026-11-06-boss-hp-and-bottle-speed/P02-boss-concurrent-spawns/phase.md)

## Active Task
[T03 문서·가이드 문구 동기화](./phases/2026-11-06-boss-hp-and-bottle-speed/P02-boss-concurrent-spawns/T03-docs-sync.md)

## Status
- P01-T01 완료(보스 체력 100/120/150/250, 작은 병 속도 3.0). P02-T01 완료(보스 50% 등장·보충 스폰). P02-T02 완료(보스전 카드 24/40/44, HUD). P02-T03 시작 준비.
- 이전 계획 `2026-11-06-boss-drop-and-passive-cards`는 구현·자동 검증 완료, 사람 플레이만 남음(열린 Task 없음).

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다. 그래도 쉬우면 보스 12m를 검토한다.

## Next Step (IMPORTANT)
P02-T03 청사진을 읽고 GuideModal·README·docs의 보스 체력, 등장 시점, 카드 목표 문구를 고치고 docs-sync 테스트를 갱신한다.
