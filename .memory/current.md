# Current Context

## Active Plan
[피버 대미지 배율과 보스 배율 정리](./plans/2026-11-07-fever-damage-multiplier.md)

## Active Phase
[P01 피버 대미지와 보스 배율](./phases/2026-11-07-fever-damage-multiplier/P01-fever-and-boss-scale/phase.md)

## Active Task
[T02 보스 무기별 배율 1.0](./phases/2026-11-07-fever-damage-multiplier/P01-fever-and-boss-scale/T02-boss-scale.md)

## Status
- T01 완료. T02 구현 시작 준비 완료

## Next Step (IMPORTANT)
T02 청사진을 읽고 `src/shared/gameTuning.ts`의 `boss.damageScaleByWeapon` 변경

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 플레이 후 `/edu-plan flawless-bonus-boxes`로 계획을 세운다(랭킹 규칙 버전 6 상향은 그 기능의 마지막 Task).

## 사용자 결정 대기
- 무기 카드 보장(샷건 클리어율 +25%p 측정), 피버 중 발사 속도 상향(+27%p), 스킬 쿨다운·피해 조정
- 보스 웨이브 `parTimeSec`와 `bossWaveWeight`(현재 par 34/38/45초는 봇 측정 43/77/59초보다 짧아 시간 보너스를 받기 어렵다)
- 샷건 공략 팁을 인게임 가이드에 넣을지

## Next Step (IMPORTANT)
사용자가 플레이한 뒤 위 "사용자 결정 대기" 항목을 정한다. 랭킹 규칙 버전(5)은 올리지 않는다.
