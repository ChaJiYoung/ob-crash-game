# Current Context

## Active Plan
[2인팟 (Two-Player Co-op)](./plans/2026-11-07-two-player-coop.md)

## Active Phase
[P03 서버·프로토콜](./phases/2026-11-07-two-player-coop/P03-server-protocol/phase.md)

## Active Task
[T01 메시지에 slot, RoomManager 컨트롤러 슬롯 2개, 슬롯별 중계·끊김 알림](./phases/2026-11-07-two-player-coop/P03-server-protocol/T01-slot-protocol.md)

## Status
- P01-solo-foundation (T01~T06) 완료 (6/6 Tasks) + 리뷰 피드백 수정 커밋 완료
- P02-engine-players (T01~T05) 완료 (5/5 Tasks) + 리뷰 피드백 수정 커밋 완료 (2a834ae)
- P03 서버·프로토콜 시작 (0/4 Tasks 완료)
- 계획: 5 Phase / 29 Task (P01 6 완료, P02 5 완료, P03 4 진행 중)

## Next Step (IMPORTANT)
P03-T01 청사진을 읽고 메시지에 slot, RoomManager 컨트롤러 슬롯 2개, 슬롯별 중계·끊김 알림 구현 및 검증.

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
