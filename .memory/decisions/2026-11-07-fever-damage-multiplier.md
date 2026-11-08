# Decisions: Fever Damage Multiplier

- Date: 2026-11-07
- Status: Confirmed

## D01. 문제 원인 진단
- **Chosen**: 피버 중 공격력 하락은 `HitJudgment.ts`의 피버 분기가 모든 명중을 GREAT(×1.0)로 고정하기 때문이다. 평소 PERFECT(×2.0)를 치던 플레이어는 피버에서 대미지가 절반이 된다. 무기별 피버 보정은 없다.
- **Rationale**: 코드 확인 결과 피버 관련 대미지 분기는 판정 배율뿐이다. 무기별 차이는 개틀링 피버 충전 ×0.33과 보스 대미지 스케일뿐이다.

## D02. 피버 중 대미지 배율
- **Chosen**: 피버 중 판정 배율을 GREAT의 1.0 대신 **2.0으로 교체**한다. (초안 1.5에서 사용자가 2.0으로 상향. 평소 PERFECT와 같은 대미지) 모든 무기 공통이다.
- **Rationale**: 피버 중 조준이 흔들려도 평소 PERFECT 수준 대미지가 나와 피버가 보상으로 느껴진다. 단일 값이라 튜닝이 쉽다. 파워샷(×2.0)과 곱해지는 방식은 보스 밸런스 위험이 있어 제외했다.

## D03. 구현 위치
- **Chosen**: `GAME_TUNING.judgment`에 `feverDamage: 2.0`를 추가하고, `HitJudgment.ts`의 피버 분기에서 `damageMultiplier`로 사용한다. 판정 등급 표시(GREAT)·점수·피버 충전(0)은 현재 그대로 둔다.
- **Rationale**: 변경 범위를 대미지 배율 하나로 한정한다.

## D04. 무기별 값은 보류
- **Chosen**: 이번에는 무기별 값(`feverDamageByWeapon`)을 만들지 않는다. 사용자가 플레이 후 약하다고 느끼면 후속 작업으로 무기별 값(안 2)을 도입한다.
- **Rationale**: 먼저 단일 값으로 체감을 확인하고, 필요할 때만 복잡도를 올린다.

## D05. 보스 대미지 배율을 전 무기 1.0으로
- **Chosen**: `GAME_TUNING.boss.damageScaleByWeapon`을 `{ shotgun: 1, revolver: 1, gatling: 1 }`로 바꾼다. 필드와 코드 경로(`bossScale`)는 유지하고 값만 바꾼다. 보스 체력·스킬 보스 대미지(`skillBossDamage`)는 이번에 건드리지 않는다.
- **Rationale**: 피버 배율과 보스 배율이 곱해져 개틀링이 3배 넘게 나오는 복잡함을 없애기 위해서다. 값만 바꾸므로 나중에 무기별로 다시 조정할 수 있다.
