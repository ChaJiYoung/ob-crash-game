# Current Context

## Active Plan
[2인팟 (Two-Player Co-op)](./plans/2026-11-07-two-player-coop.md)

## Active Phase
[P01 1인 기반 정리](./phases/2026-11-07-two-player-coop/P01-solo-foundation/phase.md) (완료됨)

## Active Task
None (P01 완료, P02 시작 대기)

## Status
- T01 완료 (commit d98ce2a: 개인 상태를 PlayerCombatState로 분리)
- T02 완료 (commit 9833070: 모드 규칙 표 modeRules로 엔진 분기 데이터화)
- T03 완료 (commit 7d07e19: TutorialDirector 도입으로 튜토리얼 단계를 엔진 밖으로 분리)
- T04 완료 (commit df89093: findBestTarget으로 명중 판정 통합, selectRound로 선택 라운드 통합)
- T05 완료 (commit cda12ae: 장치 어댑터와 PlayerActionProcessor 분리, 쏴서 누르는 버튼 및 피버/연사 캡슐화)
- T06 완료 (엔진의 1인 전용 alias 제거 및 getPlayer(0) 일원화, no-solo-aliases guard test)
- P01-solo-foundation (T01~T06) 6개 Task 전체 완료
- 계획: 5 Phase / 29 Task (P01 1인 기반 정리 6 완료, P02 엔진 2인 5 대기)

## Next Step (IMPORTANT)
P01이 완료되었으므로 P02는 시작하지 않고 멈춥니다. 사용자 지시에 따라 P02 진행 여부 결정.

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
