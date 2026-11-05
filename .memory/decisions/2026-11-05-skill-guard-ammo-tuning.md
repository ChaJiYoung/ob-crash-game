# Decisions: 스킬 충전·오비 방패·탄창 조정 + 장전 게이지 링

- Date: 2026-11-05
- Status: Confirmed

## D01. 스킬 쿨타임 약 40% 단축
- **Chosen**: `GAME_TUNING.skillCooldownMsByLevel`을 35/31/27/23초 → 21/19/16/14초로 변경
- **Rationale**: 스킬이 너무 느리게 찬다는 피드백. 한 웨이브(17~60초) 안에 1~3회 사용 가능하게. 실제 적용 값은 gameTuning.ts이며 constants.ts의 무기별 skillCooldownMs는 덮어써져 무시됨.

## D02. 오비 방패 내림 시간 확대
- **Chosen**: `monsters.obi` guardUpMs 1500→800, guardDownMs 1500→2400 (방패 내려간 비율 50%→75%)
- **Rationale**: 방패가 올라간 시점이 너무 많아 맞히기 어렵다는 피드백. 가이드 문구(GuideModal)는 값을 참조하므로 자동 반영.

## D03. 장전 시간 단축
- **Chosen**: `fire.reloadScale` 2.0 → 1.2 (샷건·리볼버 Lv.1 약 1.7초, Lv.4 약 1.2초)
- **Rationale**: 탄창이 커지는 만큼 장전 대기도 줄여 "갑자기 안 눌림" 체감을 줄이되 페널티는 남김.

## D04. 탄수 조정 (딱 떨어지는 수)
- **Chosen**: 샷건·리볼버 Lv.1~4 = 10/10/12/12발, 개틀링(`gatlingMaxAmmoByLevel`) = 20/25/30/35발
- **Rationale**: 5발 시작이 빡빡하다는 피드백. 시작 10발. 샷건·리볼버 탄수는 현재 constants.ts 기본값에서 오므로 gameTuning.ts로 옮겨 한 곳(예: `shootingAmmoByLevel`)에서 조정하는 구조로 바꾼다. rapid_reload 카드(+2발/장)는 유지.

## D05. 장전 게이지 링 (PC 조준점만)
- **Chosen**: PC 조준점 주변에 장전 진행 게이지 링 표시. 모바일은 변경 없음(프로토콜 변경 불필요). 피버 무한 탄약 중에는 표시 안 함.
- **Rationale**: 시선이 가는 조준점에 두는 것이 가장 직관적. 모바일 변경은 범위 밖.

## D06. 범위 확장 (사용자 승인: "4번 다 포함")
- **Chosen**: 아래 네 가지를 이 계획에 포함한다.
  1. 모바일 `GunGripPad.tsx`의 하드코딩 문구 수정(이미 포함), 모바일 `MobileControllerPage.tsx`의 쿨타임 초기값 25000을 튜닝 값 참조로 교체
  2. `RANKING_RULESET_VERSION` 3 → 4 (난이도가 바뀌어 이전 점수와 직접 비교가 어려움)
  3. `CrosshairOverlay`의 죽은 `spin` 애니메이션(keyframes 없음)을 실제로 동작하게 수정
  4. 장전 도중 rapid_reload 카드를 받아도 링이 실제 장전과 맞게 이어지도록 처리
- **Rationale**: 모두 이번 변경(장전 링·수치)과 같은 파일·같은 주제의 인접 문제라 한 번에 정리하는 편이 낫다. 단 랭킹 버전 상승은 서버가 기존 랭킹을 `.bak`으로 백업한 뒤 점수를 초기화하므로(닉네임 유지) 되돌릴 수 없는 동작이다. 실제 상승 커밋 전에 한 번 더 알린다.
