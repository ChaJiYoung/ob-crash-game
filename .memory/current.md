# Current Context

## Active Plan
[카드 파밍 차단과 보스 포탄 압박](./plans/2026-11-06-card-farming-fix.md)

## Active Phase
[P02 보스 포탄 압박과 측정](./phases/2026-11-06-card-farming-fix/P02-shell-pressure/phase.md)

## Active Task
[T04 파밍 시간 측정과 기준 시간 재측정](./phases/2026-11-06-card-farming-fix/P02-shell-pressure/T04-measure.md)

## Status
- 이전 계획 `2026-11-06-boss-hp-and-bottle-speed`, `2026-11-06-heal-nerf`는 구현·자동 검증 완료(사람 플레이 중).
- 카드 파밍 차단 계획(P01 T01·T02, P02 T03·T04) 청사진 작성 완료. P01-T01 완료(중간 카드 삭제, 수리 +2). P01-T02 완료(보스 웨이브 보너스 2,800). P02-T03 완료(포탄 간격 단축, 압박 전 기준은 references에 기록). P02-T04 시작 준비.

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 이 계획을 끝낸 뒤 `/edu-plan flawless-bonus-boxes`로 계획을 세운다(랭킹 규칙 버전 6 상향은 그 기능의 마지막 Task).

## Next Step (IMPORTANT)
T04 청사진을 읽고 스톨 봇을 다시 돌려 압박 후 수치를 기록하고, `measure-wave-times.ts`로 3~7웨이브 `parTimeSec`를 재측정한다. 랭킹 규칙 버전(5)은 올리지 않는다.
