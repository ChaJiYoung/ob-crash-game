---
id: T01-shared-specs-and-weapon-archetype-system
phase: P01-roguelike-engine-weapons-and-gimmicks
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Shared Types, Nerfed Weapon Level Balance Constants, Monster HP Rebalance & WeaponSystem Expansion
status: done
---

# Goal

공유 프로토콜과 상수 파일(`src/shared/types.ts`, `src/shared/constants.ts`)에 3종 무기 아키타입(`shotgun`, `revolver`, `gatling`), 4단계 레벨(`1 | 2 | 3 | 4`), 사격형 웨이브 보상 카드(`RewardCardKind`), 상향된 몬스터 체력(`hanmac: 3`, `bottle: 4`, `boss: 60`), 4초 초고밀도 피버 상수(`DURATION_MS = 4000`, `FEVER_AUTO_FIRE_INTERVAL_MS = 80`), 그리고 모바일 '휙!(Snap)' 스킬 발동 페이로드(`skillSnapTriggered`)를 정의한다. 이어서 `src/pc/engine/WeaponSystem.ts`를 확장하여 무기 종류·레벨별 탄창/발사 간격/재장전 시간과 액티브 스킬 쿨타임 및 최대 스택(Lv.4 MAX 시 2스택)을 관리하게 한다.

# Target Files & Symbols

1. `src/shared/types.ts`
   - **추가할 타입 심볼**:
     - `export type WeaponKind = 'shotgun' | 'revolver' | 'gatling';`
     - `export type WeaponLevel = 1 | 2 | 3 | 4;`
     - `export type RewardCardKind = 'weapon_level_up' | 'rapid_reload' | 'bar_repair' | 'fever_boost';`
     - `export interface WeaponLevelSpec`:
       - `level: WeaponLevel`
       - `damagePerHit: number` (펠릿 1개당 또는 단발 데미지)
       - `pelletCount: number` (샷건: 3/4/5/6, 리볼버·개틀링: 1)
       - `spreadRad: number` (샷건 산탄 각도 라디안, 리볼버·개틀링: 0)
       - `pierceCount: number` (리볼버: 추가 관통 타겟 수 1/1/2/2, 샷건·개틀링: 0)
       - `pierceDamageRatio: number` (리볼버 관통 타겟 데미지 비율: Lv.1 `0.467`(0.35/0.75), Lv.2 `0.5`, Lv.3 `0.5`, Lv.4 `1.0`)
       - `knockbackM: number` (샷건 Lv.2+ 피격 시 넉백 거리 `0.3`m)
       - `slowDurationMs: number` (샷건 Lv.4 기본탄 둔화 `1000`ms)
       - `maxAmmo: number`
       - `reloadDurationMs: number`
       - `fireIntervalMs: number` (단발 최소 발사 간격 또는 개틀링 연사 간격)
       - `skillNameKo: string`
       - `skillDamage: number` (일반 몬스터 스킬 데미지)
       - `skillBossDamage: number` (보스 대상 스킬 데미지)
       - `skillStunMs: number` (샷건 사방 뚫어뻥 폭풍 기절 시간: `1000` / `1200` / `1500` / `2000`)
       - `skillSlowRatio: number` (리볼버·개틀링 둔화율: 리볼버 `0.4`~`0.6`, 개틀링 `0.3`~`0.5`)
       - `skillSlowMs: number` (리볼버 `3500`~`5000`, 개틀링 `2000`~`3000`)
       - `skillKnockbackM: number` (개틀링 거품 해일 넉백 `1.0`~`1.4`m)
       - `skillArcDeg: number` (개틀링 거품 해일 부채꼴 각도 `90` / `110` / `130` / `160`)
       - `skillPlungerCount: number` (샷건 뚫어뻥 폭풍 발사 개수 `12` / `15` / `18` / `22`)
       - `skillCooldownMs: number` (`25000` / `22000` / `19000` / `16000`)
       - `maxSkillStock: number` (Lv.1~3: `1`, Lv.4 MAX: `2`)
     - `export interface WeaponArchetypeSpec`:
       - `kind: WeaponKind`
       - `nameKo: string`
       - `badgeIcon: string` (`'🪠' | '🍾' | '🍺'`)
       - `accentColorHex: string`
       - `descriptionKo: string`
       - `levels: Record<WeaponLevel, WeaponLevelSpec>`
     - `export interface RewardCardSpec`:
       - `kind: RewardCardKind`
       - `nameKo: string`
       - `badgeText: string`
       - `colorHex: string`
       - `descriptionKo: string`
   - **기존 인터페이스 확장**:
     - `SensorFramePayload`: `skillSnapTriggered?: boolean;` 필드 추가 (D02: '휙!' 가속도 제스처를 액티브 스킬 트리거로 전용)
     - `ServerToClientMessage`: `SKILL_STATE_SYNC` 메시지 유니온 추가:
       ```ts
       | {
           type: 'SKILL_STATE_SYNC';
           weaponKind: WeaponKind;
           weaponLevel: WeaponLevel;
           skillStock: number;
           maxSkillStock: number;
           skillCooldownRemainingMs: number;
           skillCooldownTotalMs: number;
         }
       ```

2. `src/shared/constants.ts`
   - **`TARGET_SPECS` 체력 상향 (D03)**:
     - `pilgood`: `maxHp: 1` (유지)
     - `caslight`: `maxHp: 1` (유지)
     - `obi`: `maxHp: 2` (유지)
     - `hanmac`: `maxHp: 3` (기존 2 ➔ **3** 상향)
     - `bottle`: `maxHp: 4` (기존 3 ➔ **4** 상향)
     - `boss`: `maxHp: 60` (기존 50 ➔ **60** 상향)
   - **`FEVER_CONSTANTS` 및 `WEAPON_CONSTANTS` (D04)**:
     - `FEVER_CONSTANTS.DURATION_MS`: 기존 `10000` ➔ **`4000`** (4초 초고밀도 버스트)
     - `WEAPON_CONSTANTS.FEVER_AUTO_FIRE_INTERVAL_MS`: 기존 `95` ➔ **`80`** (0.08초당 1발 초고속 난사)
   - **`WEAPON_ARCHETYPE_SPECS: Record<WeaponKind, WeaponArchetypeSpec>` 신규 추가 (D07, D08, D09, D11 너프 밸런스 패치)**:
     - **1. `shotgun` (🪠 맥주관 뚫어뻥 샷건)**:
       - Lv.1: `damagePerHit: 0.35`, `pelletCount: 3` (전탄 1.05 DMG), `spreadRad: 0.14`, `knockbackM: 0`, `maxAmmo: 5`, `reloadDurationMs: 1400`, `fireIntervalMs: 320`, `skillPlungerCount: 12`, `skillDamage: 0.5`, `skillBossDamage: 4`, `skillStunMs: 1000`, `skillCooldownMs: 25000`, `maxSkillStock: 1`
       - Lv.2: `damagePerHit: 0.40`, `pelletCount: 4` (전탄 1.60 DMG), `spreadRad: 0.16`, `knockbackM: 0.3`, `maxAmmo: 5`, `reloadDurationMs: 1300`, `fireIntervalMs: 300`, `skillPlungerCount: 15`, `skillDamage: 0.7`, `skillBossDamage: 5`, `skillStunMs: 1200`, `skillCooldownMs: 22000`, `maxSkillStock: 1`
       - Lv.3: `damagePerHit: 0.50`, `pelletCount: 5` (전탄 2.50 DMG), `spreadRad: 0.18`, `knockbackM: 0.3`, `maxAmmo: 6`, `reloadDurationMs: 1200`, `fireIntervalMs: 280`, `skillPlungerCount: 18`, `skillDamage: 0.9`, `skillBossDamage: 6`, `skillStunMs: 1500`, `skillCooldownMs: 19000`, `maxSkillStock: 1`
       - Lv.4 (MAX): `damagePerHit: 0.60`, `pelletCount: 6` (전탄 3.60 DMG), `spreadRad: 0.20`, `knockbackM: 0.4`, `slowDurationMs: 1000`, `maxAmmo: 7`, `reloadDurationMs: 1100`, `fireIntervalMs: 260`, `skillPlungerCount: 22`, `skillDamage: 1.2`, `skillBossDamage: 6`, `skillStunMs: 2000`, `skillCooldownMs: 16000`, `maxSkillStock: 2`
     - **2. `revolver` (🍾 황금 병따개 리볼버)**:
       - Lv.1: `damagePerHit: 0.75`, `pelletCount: 1`, `pierceCount: 1`, `pierceDamageRatio: 0.467` (후열 0.35 DMG), `maxAmmo: 5`, `reloadDurationMs: 1400`, `fireIntervalMs: 280`, `skillDamage: 0.6`, `skillBossDamage: 4`, `skillSlowRatio: 0.40`, `skillSlowMs: 3500`, `skillCooldownMs: 25000`, `maxSkillStock: 1`
       - Lv.2: `damagePerHit: 1.00`, `pelletCount: 1`, `pierceCount: 1`, `pierceDamageRatio: 0.50` (후열 0.50 DMG), `maxAmmo: 6`, `reloadDurationMs: 1200`, `fireIntervalMs: 250`, `skillDamage: 0.8`, `skillBossDamage: 5`, `skillSlowRatio: 0.45`, `skillSlowMs: 4000`, `skillCooldownMs: 22000`, `maxSkillStock: 1`
       - Lv.3: `damagePerHit: 1.35`, `pelletCount: 1`, `pierceCount: 2`, `pierceDamageRatio: 0.50`, `maxAmmo: 6`, `reloadDurationMs: 1100`, `fireIntervalMs: 230`, `skillDamage: 1.1`, `skillBossDamage: 6`, `skillSlowRatio: 0.50`, `skillSlowMs: 4500`, `skillCooldownMs: 19000`, `maxSkillStock: 1`
       - Lv.4 (MAX): `damagePerHit: 1.75`, `pelletCount: 1`, `pierceCount: 2`, `pierceDamageRatio: 1.00`, `maxAmmo: 7`, `reloadDurationMs: 1000`, `fireIntervalMs: 210`, `skillDamage: 1.4`, `skillBossDamage: 7`, `skillSlowRatio: 0.60`, `skillSlowMs: 5000`, `skillCooldownMs: 16000`, `maxSkillStock: 2`
     - **3. `gatling` (🍺 탄산 탭 개틀링)**:
       - Lv.1: `damagePerHit: 0.15`, `pelletCount: 1`, `maxAmmo: 18`, `reloadDurationMs: 1400`, `fireIntervalMs: 150`, `skillArcDeg: 90`, `skillDamage: 0.4`, `skillBossDamage: 4`, `skillKnockbackM: 1.0`, `skillSlowRatio: 0.30`, `skillSlowMs: 2000`, `skillCooldownMs: 25000`, `maxSkillStock: 1`
       - Lv.2: `damagePerHit: 0.20`, `pelletCount: 1`, `maxAmmo: 22`, `reloadDurationMs: 1300`, `fireIntervalMs: 125`, `skillArcDeg: 110`, `skillDamage: 0.6`, `skillBossDamage: 5`, `skillKnockbackM: 1.0`, `skillSlowRatio: 0.35`, `skillSlowMs: 2300`, `skillCooldownMs: 22000`, `maxSkillStock: 1`
       - Lv.3: `damagePerHit: 0.25`, `pelletCount: 1`, `maxAmmo: 28`, `reloadDurationMs: 1200`, `fireIntervalMs: 100`, `skillArcDeg: 130`, `skillDamage: 0.8`, `skillBossDamage: 6`, `skillKnockbackM: 1.2`, `skillSlowRatio: 0.40`, `skillSlowMs: 2600`, `skillCooldownMs: 19000`, `maxSkillStock: 1`
       - Lv.4 (MAX): `damagePerHit: 0.35`, `pelletCount: 1`, `maxAmmo: 35`, `reloadDurationMs: 1000`, `fireIntervalMs: 83`, `skillArcDeg: 160`, `skillDamage: 1.0`, `skillBossDamage: 7`, `skillKnockbackM: 1.4`, `skillSlowRatio: 0.50`, `skillSlowMs: 3000`, `skillCooldownMs: 16000`, `maxSkillStock: 2`
   - **`REWARD_CARD_SPECS: Record<RewardCardKind, RewardCardSpec>` 신규 추가 (D01, D06)**:
     - `'weapon_level_up'`: 무기 레벨업 (`Lv.+1`, MAX 도달 시 스킬 쿨타임 즉시 완료 + 보너스 점수)
     - `'rapid_reload'`: 고속 장전 & 탄창 보강 (재장전 시간 `-20%`, 최대 탄창 `+2`)
     - `'bar_repair'`: 바리케이드 보수 (바 체력 `lives +1` 회복, 최대 6)
     - `'fever_boost'`: 피버 부스터 (피버 게이지 즉시 `+50%` 충전)

3. `src/pc/engine/WeaponSystem.ts`
   - `WeaponState` 인터페이스 확장:
     - `weaponKind: WeaponKind` (기본값 `'shotgun'`)
     - `weaponLevel: WeaponLevel` (기본값 `1`)
     - `skillStock: number` (현재 사용 가능한 스킬 횟수, 게임 시작 시 `1`로 완충)
     - `maxSkillStock: number` (Lv.1~3: `1`, Lv.4: `2`)
     - `skillCooldownRemainingMs: number`
     - `skillCooldownTotalMs: number`
   - 메서드 추가:
     - `selectWeapon(kind: WeaponKind, level?: WeaponLevel): void`
     - `upgradeWeaponLevel(): WeaponLevel`
     - `applyRapidReloadBuff(): void`
     - `getCurrentLevelSpec(): WeaponLevelSpec`
     - `consumeSkill(nowMs: number): boolean`
     - `refillSkillInstant(): void`
     - `update(nowMs: number, deltaMs?: number)` 확장 (스킬 쿨타임 자동 충전)

4. `tests/shared-protocol.test.ts`
   - 변경된 `TARGET_SPECS` (`bottle.maxHp === 4`, `hanmac.maxHp === 3`, `boss.maxHp === 60`), `FEVER_CONSTANTS.DURATION_MS === 4000`, `WEAPON_CONSTANTS.FEVER_AUTO_FIRE_INTERVAL_MS === 80` 검증으로 업데이트
   - `WEAPON_ARCHETYPE_SPECS` 3종 무기 × Lv.1~4 스펙 및 `WeaponSystem` 무기 변경/레벨업/스킬 쿨타임 충전 단위 테스트 추가

# Verification Command

```bash
npx vitest run tests/shared-protocol.test.ts
```

# Commit Message

```text
feat(shared): define 3 weapon archetypes, nerfed Lv1-4 specs, 4s fever, and skill stock in WeaponSystem

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P01-roguelike-engine-weapons-and-gimmicks
Task: T01-shared-specs-and-weapon-archetype-system
```
