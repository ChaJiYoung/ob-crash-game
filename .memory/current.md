# Current Context

## Active Plan
[카드 파밍 차단과 보스 포탄 압박](./plans/2026-11-06-card-farming-fix.md)

## Active Phase
[P01 보상 규칙 되돌리기](./phases/2026-11-06-card-farming-fix/P01-reward-rules/phase.md)

## Active Task
[T02 보스 웨이브 시간 보너스 상향](./phases/2026-11-06-card-farming-fix/P01-reward-rules/T02-boss-time-bonus.md)

## Status
- 이전 계획 `2026-11-06-boss-hp-and-bottle-speed`, `2026-11-06-heal-nerf`는 구현·자동 검증 완료(사람 플레이 중).
- 카드 파밍 차단 계획(P01 T01·T02, P02 T03·T04) 청사진 작성 완료. P01-T01 완료(중간 카드 삭제, 수리 +2). T02 시작 준비.

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 이 계획을 끝낸 뒤 `/edu-plan flawless-bonus-boxes`로 계획을 세운다(랭킹 규칙 버전 6 상향은 그 기능의 마지막 Task).

## Next Step (IMPORTANT)
T02 청사진을 읽고 `timeBonus.bossWaveWeight`를 4로 바꾸고 문서·테스트를 맞춘다. 랭킹 규칙 버전(5)은 올리지 않는다.
