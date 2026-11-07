# Current Context

## Active Plan
[2인팟 (Two-Player Co-op)](./plans/2026-11-07-two-player-coop.md)

## Active Phase
[P02 엔진 2인](./phases/2026-11-07-two-player-coop/P02-engine-players/phase.md)

## Active Task
[T04 이탈 상태 setPlayerAway: 개인 타이머 정지, 입력 무시, 선택 즉시 자동](./phases/2026-11-07-two-player-coop/P02-engine-players/T04-player-away.md)

## Status
- P01-solo-foundation (T01~T06) 완료 (6/6 Tasks) + 리뷰 피드백 수정 커밋 완료
- P02 엔진 2인 진행 중 (3/5 Tasks 완료)
  - T01 완료 (8439c48)
  - T02 완료 (f4f6598)
  - T03 완료 (a43c958)
- D24 설계 원칙: 인원수는 값만 다르고 로직은 하나, isCoop 분기 금지
- 계획: 5 Phase / 29 Task (P01 6 완료, P02 5 진행 중)

## Next Step (IMPORTANT)
P02-T04 청사진을 읽고 이탈 상태 setPlayerAway: 개인 타이머 정지, 입력 무시, 선택 즉시 자동 구현 및 검증.

## Paused Plan (이전 current에서 이어짐)
- `2026-11-07-weapon-balance`: 완료, 사람 플레이 대기(샷건 68%, 리볼버 64%, 개틀링 70%).
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 플레이 후 `/edu-plan flawless-bonus-boxes`로 계획을 세운다(랭킹 규칙 버전 6 상향은 그 기능의 마지막 Task).

## 사용자 결정 대기 (이전 current에서 이어짐)
- 무기 카드 보장(샷건 클리어율 +25%p 측정), 피버 중 발사 속도 상향(+27%p), 스킬 쿨다운·피해 조정
- 보스 웨이브 `parTimeSec`와 `bossWaveWeight`
- 샷건 공략 팁을 인게임 가이드에 넣을지
- 랭킹 규칙 버전(5)은 올리지 않는다.
