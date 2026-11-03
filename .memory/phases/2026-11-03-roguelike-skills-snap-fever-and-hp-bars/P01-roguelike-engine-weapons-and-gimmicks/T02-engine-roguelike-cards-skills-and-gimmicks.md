---
id: T02-engine-roguelike-cards-skills-and-gimmicks
phase: P01-roguelike-engine-weapons-and-gimmicks
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: BeerCrusherEngine Shoot-to-Select Cards, 3-Weapon Ballistics, Active Skills, Golden Can & Projectile Interception
status: done
---

# Goal

`src/pc/engine/BeerCrusherEngine.ts`에서 웨이브 도중 무작위로 스폰되던 필드 아이템 드롭을 제거하고, **게임 시작 시 3종 무기 선택 타겟** 및 **웨이브 클리어 시 3종 보상 카드 타겟을 총으로 쏴서 고르는(Shoot-to-Select) 시스템**을 구현한다. 또한 무기별 고유 탄도(샷건 다중 산탄/넉백, 리볼버 일직선 관통탄, 개틀링 속사탄), **'휙!(Snap)' 전용 액티브 스킬 3종(뚫어뻥 폭풍 기절 / 오프너 불릿 타임 둔화 / 거품 해일 광역 넉백)**, **웨이브당 1회 황금 캔 보너스 타겟**, **한맥·보스의 맥주 거품 투사체 요격 기믹**을 엔진에 구현한다.

# Target Files & Symbols

1. `src/pc/engine/BeerCrusherEngine.ts`
   - **`ActiveTargetEntity` 인터페이스 확장**:
     - `hp: number` (소수점 데미지 계산 지원, 예: `0.35`, `0.15` 등)
     - `stunUntilMs?: number` (샷건 사방 뚫어뻥 폭풍 피격 시 이동 정지 및 뚫어뻥 부착 상태 시각)
     - `slowUntilMs?: number` (리볼버/개틀링 스킬 또는 샷건 MAX 탄 피격 시 둔화 종료 시각)
     - `slowRatio?: number` (둔화 비율 `0.3` ~ `0.6`)
     - `stuckPlungerCount?: number` (몬스터 몸체에 꽂힌 3D 뚫어뻥 개수 — `P02` 3D 렌더러에서 참조)
     - `isGoldenCan?: boolean` (D05: 웨이브당 1회 고속 황금 캔 여부)
     - `isProjectile?: boolean` (D05: 한맥/보스가 발사한 요격 가능 거품탄/병뚜껑 투사체 여부)
     - `weaponSelectKind?: WeaponKind` (게임 시작 시 무기 선택 타겟인 경우)
     - `rewardCardKind?: RewardCardKind` (웨이브 클리어 시 보상 카드 타겟인 경우)
   - **`ShootResult` 및 신규 `SkillExecuteResult` 인터페이스**:
     - `ShootResult` 확장:
       - `weaponKind: WeaponKind`
       - `weaponLevel: WeaponLevel`
       - `hitTargets: ActiveTargetEntity[]` (산탄/관통으로 동시 피격된 모든 타겟 목록)
       - `selectedWeapon?: WeaponKind`
       - `selectedCard?: RewardCardKind`
       - `interceptedProjectile?: boolean`
       - `goldenCanKilled?: boolean`
     - `export interface SkillExecuteResult`:
       - `activated: boolean`
       - `weaponKind: WeaponKind`
       - `weaponLevel: WeaponLevel`
       - `affectedTargets: ActiveTargetEntity[]`
       - `plungerCount?: number`
       - `arcDeg?: number`
   - **웨이브 필드 아이템 자동 스폰 제거 & 사격형 선택(Shoot-to-Select) 도입 (D01, D06)**:
     - `update()` 내부의 기존 웨이브 중 아이템 자동 스폰 블록(`this.itemsSpawnedInWave < waveSpec.itemSpawnCount` 조건문) 제거. (단위 테스트 하위 호환을 위해 `spawnItemTarget()` 메서드 자체는 유지)
     - `spawnWeaponSelectTargets()`: 좌(`x = -2.2`, `'shotgun'`), 중(`x = 0`, `'revolver'`), 우(`x = 2.2`, `'gatling'`) 위치(`radiusM = 7.5`, `customNormY = 0.05`, `hp = 1`, `speedMps = 0`)에 무기 선택 타겟 3개 스폰 지원.
     - `spawnWaveRewardCards()`: 웨이브 클리어 직후 다음 웨이브 시작 전 좌/중/우 3개 보상 카드 타겟(`'weapon_level_up'`, `'rapid_reload'`, `'bar_repair'` 또는 `'fever_boost'`)을 스폰하고, 플레이어가 카드 1개를 사격하면 즉시 효과를 적용(`applyRewardCard(cardKind, nowMs)`)한 뒤 나머지 카드 2개를 제거하고 다음 웨이브 시작.
   - **3종 무기별 `shootAt(aimX, aimY, nowMs)` 탄도 판정 구현 (D07, D08, D11)**:
     - `shotgun`: `levelSpec.pelletCount`(3~6발)만큼 `spreadRad` 범위 내의 탄착점들을 검사하여 범위 내 몬스터에게 펠릿당 `damagePerHit`(`0.35`~`0.60`) 합산 적용. Lv.2 이상 피격 시 `target.radiusM = Math.min(16, target.radiusM + levelSpec.knockbackM)` 넉백 적용. Lv.4 MAX 시 `slowUntilMs = nowMs + 1000` 적용.
     - `revolver`: 조준점에 가장 가까운 1차 타겟에 `damagePerHit`(`0.75`~`1.75`) 적용 후, 반경 `0.38` 이내에 정렬된 후열 타겟 최대 `pierceCount`(1~2마리)에게 `damagePerHit * pierceDamageRatio` 관통 데미지 동시 적용.
     - `gatling`: 빠른 연사 간격(`150ms`~`83ms`)으로 조준 타겟에 `damagePerHit`(`0.15`~`0.35`) 적용.
     - 소수점 체력 처리: `target.hp = Number(Math.max(0, target.hp - totalDamage).toFixed(3))`로 부동소수점 오차 방지.
   - **전용 액티브 스킬 `triggerWeaponSkill(nowMs: number): SkillExecuteResult` 구현 (D02, D08)**:
     - `this.weaponSystem.consumeSkill(nowMs)`가 `true`일 때 발동:
     - `shotgun` (`사방 뚫어뻥 폭풍`): 화면 내 모든 활성 몬스터(카드/아이템 제외)에게 `skillDamage`(`0.5`~`1.2`, 보스는 `skillBossDamage` `4`~`6`)를 입히고, `stunUntilMs = nowMs + skillStunMs`(`1000`~`2000`ms), `stuckPlungerCount = 2` 부여.
     - `revolver` (`오프너 불릿 타임 & 참격`): 화면 내 모든 활성 몬스터에게 `skillDamage`(`0.6`~`1.4`, 보스는 `4`~`7`)를 입히고, `slowUntilMs = nowMs + skillSlowMs`(`3500`~`5000`ms), `slowRatio = skillSlowRatio`(`0.4`~`0.6`) 부여.
     - `gatling` (`거품 해일 160도 오버히트`): 부채꼴 범위 내 모든 활성 몬스터에게 `skillDamage`(`0.4`~`1.0`, 보스는 `4`~`7`)를 입히고, `radiusM = Math.min(16, target.radiusM + skillKnockbackM)`(`1.0`~`1.4`m 후퇴) 및 `slowUntilMs = nowMs + skillSlowMs` 부여.
   - **황금 캔(`spawnGoldenCanTarget`) & 투사체 요격(`spawnMonsterProjectile`) 기믹 (D05)**:
     - 황금 캔: 각 웨이브 중반에 1회 스폰(`isGoldenCan: true`, `hp: 1`, 횡이동 고속 타겟). 사격 적중 시 점수 `+500`, `weaponSystem.refillSkillInstant()`, `scoreManager.chargeFeverToMax()` 즉시 발동!
     - 몬스터 투사체: `hanmac` 또는 `boss`가 필드에 있을 때 주기적으로 거품탄/병뚜껑 투사체(`isProjectile: true`, `hp: 1`, `speedMps: 3.2`, `hitRadiusM: 0.9`)를 발사. 플레이어가 사격하여 격추하면 `+80`점 획득; 방어선(`DEFENSE_LINE_RADIUS_M`) 도달 시 바 체력 `lives - 1` 감소.
   - **`update()` 이동 루프에서 기절(`stunUntilMs`) 및 둔화(`slowUntilMs`) 반영**:
     - `nowMs < (target.stunUntilMs ?? 0)`인 몬스터는 이동 속도 `0` (제자리 정지). 기절 해제 시 `stuckPlungerCount = 0`.
     - `nowMs < (target.slowUntilMs ?? 0)`인 몬스터는 `speedMultiplier *= (1 - (target.slowRatio ?? 0.4))`.

2. `tests/engine-judgment-and-spawn.test.ts` 및 `tests/tutorial-and-guide.test.ts`
   - `tests/engine-judgment-and-spawn.test.ts`:
     - `bottle` 체력 기대값 `3` ➔ `4`, `hanmac` 체력 `2` ➔ `3` 반영
     - 3종 무기(`shotgun` 산탄/넉백, `revolver` 관통, `gatling` 속사) 사격 판정 테스트 추가
     - `triggerWeaponSkill()` 3종 액티브 스킬(기절, 둔화, 광역 넉백) 테스트 추가
     - 보상 카드 사격 선택(`spawnWaveRewardCards`), 황금 캔 처치 보상, 투사체 요격 테스트 추가
   - `tests/tutorial-and-guide.test.ts`:
     - Step 2 `bottleTarget.hp` 기대값을 `3` ➔ `4`로 업데이트

# Verification Command

```bash
npx vitest run tests/engine-judgment-and-spawn.test.ts tests/tutorial-and-guide.test.ts
```

# Commit Message

```text
feat(engine): implement 3-weapon ballistics, snap active skills, shoot-to-select wave cards, and golden can/projectile gimmicks

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P01-roguelike-engine-weapons-and-gimmicks
Task: T02-engine-roguelike-cards-skills-and-gimmicks
```
