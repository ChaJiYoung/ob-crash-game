# Current Context

## Active Plan
[2인팟 (Two-Player Co-op)](./plans/2026-11-07-two-player-coop.md)

## Active Phase
[P01 1인 기반 정리](./phases/2026-11-07-two-player-coop/P01-solo-foundation/phase.md)

## Active Task
[T01 개인 상태를 PlayerCombatState로 분리](./phases/2026-11-07-two-player-coop/P01-solo-foundation/T01-extract-player-state.md)

## Status
- T01 구현 시작 준비 완료
- 계획: 5 Phase / 29 Task (P01 1인 기반 정리 6, P02 엔진 2인 5, P03 서버 4, P04 PC 로비·연결 6, P05 화면·문서 8)
- 설계 원칙 D24: 1인·2인은 `playerCountRules`·`getPlayerPresentation`의 값만 다르고 로직은 하나. 각 Task 완료 시 계획 문서의 "설계 원칙" 리뷰 체크를 돌린다.
- 결정 문서에 계획 단계 추가 결정 D17~D40(아이템 버프 주인, 프로필 coopBests, 이탈 후 난이도 유지, 이탈자 표시·복귀, 총 두 자루, 로비 개인/팀 랭킹 탭, 카드 종류색+주인색 테두리, 인원수·모드 데이터화, 입력 어댑터/처리부, 판정 통일, TutorialDirector) 기록됨

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/pc/engine/PlayerCombatState.ts` 새로 만들기부터 시작. 기존 테스트는 고치지 않고 통과해야 한다(위임 getter/setter).

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
