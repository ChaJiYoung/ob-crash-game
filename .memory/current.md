# Current Context

## Active Plan
[피버 대미지 배율과 보스 배율 정리](./plans/2026-11-07-fever-damage-multiplier.md)

## Active Phase
[P01 피버 대미지와 보스 배율](./phases/2026-11-07-fever-damage-multiplier/P01-fever-and-boss-scale/phase.md)

## Active Task
없음 (모든 Task 구현·자동 검증 완료, 사람 플레이 대기)

## Status
- 완료: `2026-11-07-fever-damage-multiplier` (피버 판정 배율 2.0, 보스 무기별 배율 전부 1). 서버 재시작과 페이지 새로고침 필요.
- 플레이 후 확인: 피버 중 체감 대미지, 보스전 난이도(특히 개틀링은 2.2에서 1로 약해짐, 샷건·리볼버는 강해짐). 약하면 `judgment.feverDamage`를 올리거나 무기별 값(D04)을 도입한다. 보스 체력·스킬 보스 대미지는 손대지 않았다.

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
사용자가 플레이한 뒤 피버·보스 체감을 알려 주면 조정한다. 그리고 위 "사용자 결정 대기" 항목을 정한다. 랭킹 규칙 버전(5)은 올리지 않는다.
