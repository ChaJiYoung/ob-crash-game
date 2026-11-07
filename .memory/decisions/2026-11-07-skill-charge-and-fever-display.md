# Decisions: Skill Charge Timer, Double Skill Fix, Fever Display

- Date: 2026-11-07
- Status: Confirmed

## D01. 다음 스킬 충전 남은 시간 표시
- **Chosen**: 폰 컨트롤러와 PC HUD 둘 다 표시한다. 스톡이 1개 이상이고 최대치 미만일 때 다음 충전까지 남은 초를 붙인다. 폰은 `GunGripPad.tsx`의 READY 문구 뒤에 `(1/2 · 다음 충전 4.2s)`를 붙이고, PC는 `ArcadeOverlayHUD.tsx`의 `[★1/2]` 배지 옆에 초를 붙인다.
- **Rationale**: 엔진(`WeaponSystem.update`)은 이미 1개가 찬 뒤에도 다음 충전을 계산해 `skillCooldownRemainingMs`로 보낸다. 화면이 스톡 0일 때만 남은 시간을 보여 주는 것이 문제라서 표시 부분만 고치면 된다. 플레이 중 시선은 PC에 있고 폰은 손에 쥐고 있으므로 두 곳 모두에 표시한다.

## D02. 한 번 젖혔는데 스킬 두 번 발동하는 문제
- **Chosen**: 두 곳을 같이 막는다.
  - 폰: `GunGripTracker.detectSnapFire`의 재감지 대기 시간을 110ms에서 약 400ms로 늘린다.
  - PC: 스킬을 쓴 뒤 약 500ms 동안 다음 스킬을 받지 않는다. `PCGamePage.executeSkill`이나 `BeerCrusherEngine.triggerWeaponSkill`에 넣는다.
- **Rationale**: 원인은 한 번 젖힐 때 가속도 값이 튕기면서 110ms보다 오래 기준치를 넘어 여러 번 감지되는 것이다. PC 쪽에는 연속 발동을 막는 장치가 없다. 폰 값만 바꾸면 센서 상태에 따라 다시 생길 수 있으므로, PC 쪽 잠금으로 어떤 입력이 와도 한 번만 나가게 한다. 정확한 ms 값은 튜닝 상수로 둔다.

## D03. 피버 대미지 2배가 1배로 보이는 문제
- **Chosen**: 실제 대미지는 이미 2.0이다(`HitJudgment.ts`가 `GAME_TUNING.judgment.feverDamage` 사용). 피버 중 명중은 판정 배너를 `FEVER!` 제목으로 바꾸고 `${feverDamage}x 데미지 (+점수)`를 보여 준다. 배율 값은 튜닝 값에서 읽는다.
- **Rationale**: 피버 판정이 GREAT로 고정되어 있어서 `JudgmentBanner`가 GREAT 기본 배율인 1.0x를 보여 준다. 화면 표시만 잘못된 것이다. 튜닝 값을 바꿔도 화면이 자동으로 맞춰지게 한다.

## D04. 튜토리얼 피버 안내 문구
- **Chosen**: `TutorialGuideOverlay.tsx`의 피버 문구에 대미지 배율을 추가한다(예: "명중 점수 1.5배 & 대미지 2배!"). 배율은 튜닝 값에서 읽는다.
- **Rationale**: 이번 작업 목적인 "피버 2배가 화면에 보이게 하기"와 같은 범위이다.
