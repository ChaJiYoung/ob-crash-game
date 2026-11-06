# Current Context

## Active Plan
[카드 파밍 차단과 보스 포탄 압박](./plans/2026-11-06-card-farming-fix.md)

## Active Phase
[P02 보스 포탄 압박과 측정](./phases/2026-11-06-card-farming-fix/P02-shell-pressure/phase.md)

## Active Task
없음 (모든 Task 구현·자동 검증 완료, 카드 구성 결정과 사람 플레이 대기)

## Status
- 카드 파밍 차단 계획 P01(T01·T02), P02(T03·T04) 완료. 서버 재시작과 페이지 새로고침 필요.
- 중간 카드 전부 삭제는 클리어율을 크게 낮춰(샷건 8%) T05에서 4·6웨이브 중간 카드를 복구했다(샷건 50%, 리볼버 93%, 개틀링 95%). `parTimeSec`는 보스 웨이브 보너스 기울기 검증과 충돌해 갱신 보류.

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 이 계획을 끝낸 뒤 `/edu-plan flawless-bonus-boxes`로 계획을 세운다(랭킹 규칙 버전 6 상향은 그 기능의 마지막 Task).

## Next Step (IMPORTANT)
사용자가 플레이해 본 뒤 `parTimeSec`(보스 웨이브 par와 `bossWaveWeight`)와 샷건 보스 피해 배율을 정한다. 랭킹 규칙 버전(5)은 올리지 않는다.
