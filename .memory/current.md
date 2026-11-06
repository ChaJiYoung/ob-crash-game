# Current Context

## Active Plan
[무기 간 균형](./plans/2026-11-07-weapon-balance.md)

## Active Phase
[P01 무기 수치](./phases/2026-11-07-weapon-balance/P01-numbers/phase.md)

## Active Task
없음 (모든 Task 구현·자동 검증 완료, 사람 플레이 대기)

## Status
- 완료: `2026-11-06-boss-hp-and-bottle-speed`, `2026-11-06-heal-nerf`, `2026-11-06-card-farming-fix`(T05 포함), `2026-11-07-weapon-balance`. 서버 재시작과 페이지 새로고침 필요.
- 현재 구성의 봇 클리어율(정석 전략, 80판): 샷건 68%, 리볼버 64%, 개틀링 70%. 사용자가 이 상태로 플레이해 보기로 했다(스킬 조정은 보류).

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
