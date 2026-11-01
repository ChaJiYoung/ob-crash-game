# Task: T01 체력 5개·스폰 18m·5단계 웨이브·아이템 4종 코어 엔진 구현

## Status: done

## Goal
바 방어선 체력을 5개(`🍺x5`)로 확장하고, 스폰 거리를 18m로 당기며, 몬스터 히트박스를 1.8배 확대하고, 5단계 아케이드 테마 웨이브(총 114마리 + HP 40 보스) 및 사격 획득형 8초 기간제 아이템 4종(`power_shot`, `wide_scope`, `ice_freeze`, `bar_repair`) 로직을 `BeerCrusherEngine`과 `HitJudgment`에 구현한다.

## Decision Summary
- `2026-11-01-visual-enhancement.md` (D01): 스폰 거리 `18.0m`, 몬스터 스케일 `1.8~2.0x` 확대, 지상(`y=0.35m`)/공중(`y=1.35m`) 고도 분리.
- `2026-11-01-gameplay-systems.md` (D01, D02, D03): 방어선 목숨 `5개`, 탄창 `10발` 유지, 8초 지속 드롭 아이템 4종(파워 샷, 빅 스코프, 아이스 프리즈, 바 수리), 5단계 웨이브 곡선(16+22+26+32+18 = 114마리 + HP 40 보스).

## Implementation

### I01. 공통 타입 및 상수 스키마 확장

- Related Files:
  - `src/shared/types.ts` :: `ItemBuffKind`, `ItemBuffSpec`, `ActiveBuffState`, `TargetSpec` — 아이템 4종 타입과 타겟 고도/스케일 필드 추가; modify
  - `src/shared/constants.ts` :: `TARGET_SPECS`, `ITEM_BUFF_SPECS`, `STAGE_CONSTANTS` — 18m 스폰, 5목숨, 보스 HP 40, 히트박스 확장, 아이템 4종 스펙 상수 정의; modify

#### Details
- **Signatures & Types (`src/shared/types.ts`)**:
  ```typescript
  export type TargetKind = 'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'mug' | 'boss';
  export type ItemBuffKind = 'power_shot' | 'wide_scope' | 'ice_freeze' | 'bar_repair';
  export type JudgmentGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
  export type GamePhase = 'PAIRING' | 'ZEROING' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';

  export interface TargetSpec {
    kind: TargetKind;
    displayName: string;
    maxHp: number;
    speedMps: number;
    hitRadiusM: number;
    killBonusScore: number;
    brandColorHex: string;
    accentColorHex: string;
    isAirborne?: boolean; // true: caslight, pilgood (공중 활공), false: 지상 접지
    modelScale?: number;  // 아케이드 체감 스케일 배율 (기본 1.85)
  }

  export interface ItemBuffSpec {
    kind: ItemBuffKind;
    displayName: string;
    shortLabel: string;
    icon: string;
    durationMs: number; // 기간제 버프 지속시간 (8000ms, bar_repair는 즉시 발동 0ms)
    auraColorHex: string;
    description: string;
  }

  export interface ActiveBuffState {
    kind: ItemBuffKind;
    remainingMs: number;
    totalDurationMs: number;
  }
  ```
- **Data & Schema Fields (`src/shared/constants.ts`)**:
  - `STAGE_CONSTANTS`:
    - `SPAWN_RADIUS_M: 18.0` (기존 28.0에서 단축)
    - `DEFENSE_LINE_RADIUS_M: 1.8`
    - `CAMERA_FOV_DEG: 52`
    - `FAN_MARGIN_RATIO: 0.92`
    - `PLAYER_MAX_LIVES: 5` (기존 3에서 5로 확장)
    - `TOTAL_WAVES: 5` (신규 상수)
    - `ITEM_DURATION_MS: 8000` (신규 상수)
  - `TARGET_SPECS` (1.8배 스케일에 맞춘 `hitRadiusM` 비례 상향 및 `boss.maxHp = 40`):
    - `pilgood`: `maxHp: 1`, `speedMps: 4.2`, `hitRadiusM: 0.85`, `killBonusScore: 30`, `isAirborne: true`, `modelScale: 1.85`
    - `caslight`: `maxHp: 1`, `speedMps: 3.6`, `hitRadiusM: 0.90`, `killBonusScore: 40`, `isAirborne: true`, `modelScale: 1.85`
    - `obi`: `maxHp: 2`, `speedMps: 3.0`, `hitRadiusM: 0.95`, `killBonusScore: 70`, `isAirborne: false`, `modelScale: 1.9`
    - `hanmac`: `maxHp: 2`, `speedMps: 3.2`, `hitRadiusM: 0.95`, `killBonusScore: 90`, `isAirborne: false`, `modelScale: 1.9`
    - `mug`: `maxHp: 3`, `speedMps: 2.3`, `hitRadiusM: 1.15`, `killBonusScore: 160`, `isAirborne: false`, `modelScale: 1.95`
    - `boss`: `maxHp: 40`, `speedMps: 1.10`, `hitRadiusM: 2.10`, `killBonusScore: 1500`, `isAirborne: false`, `modelScale: 1.65`
  - `ITEM_BUFF_SPECS: Record<ItemBuffKind, ItemBuffSpec>`:
    - `power_shot`: `{ kind: 'power_shot', displayName: '파워 샷 (황금 병따개)', shortLabel: 'POWER 2X', icon: '💥', durationMs: 8000, auraColorHex: '#ef4444', description: '8초간 사격 데미지 2배 증폭' }`
    - `wide_scope`: `{ kind: 'wide_scope', displayName: '빅 스코프 (맥주 코스터)', shortLabel: 'WIDE 1.6X', icon: '🎯', durationMs: 8000, auraColorHex: '#38bdf8', description: '8초간 조준경 및 명중 반경 1.6배 확대' }`
    - `ice_freeze`: `{ kind: 'ice_freeze', displayName: '아이스 프리즈 (얼음 버킷)', shortLabel: 'FREEZE 50%', icon: '🧊', durationMs: 8000, auraColorHex: '#60a5fa', description: '8초간 모든 몬스터 이동 속도 50% 감속' }`
    - `bar_repair`: `{ kind: 'bar_repair', displayName: '바 수리 (홉 열매 다발)', shortLabel: 'LIFE +1', icon: '🍺', durationMs: 0, auraColorHex: '#10b981', description: '바 방어선 체력 즉시 +1 회복 (최대 5)' }`

### I02. 판정 엔진(`HitJudgment.ts`) 및 5웨이브·아이템 매니저(`BeerCrusherEngine.ts`) 구현

- Related Files:
  - `src/pc/engine/HitJudgment.ts` :: `evaluateHitJudgment`, `HitJudgmentOptions` — `power_shot` 데미지 2배 및 `wide_scope` 판정 반경 1.6배 옵션 지원; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine`, `ActiveTargetEntity`, `WaveDefinition` — 5웨이브 정의, 아이템 스폰/피격/타이머 관리, 슬로우/회복 적용; modify
  - `tests/engine-judgment-and-spawn.test.ts` — 18m 스폰, 5목숨, 5웨이브, 아이템 4종 발동/만료 테스트; modify

#### Details
- **Signatures & Logic (`src/pc/engine/HitJudgment.ts`)**:
  ```typescript
  export interface HitJudgmentOptions {
    isFeverActive?: boolean;
    isPowerShotActive?: boolean;
    isWideScopeActive?: boolean;
  }

  export function evaluateHitJudgment(
    distanceToCenterM: number,
    hitRadiusM: number,
    optionsOrFever: boolean | HitJudgmentOptions = false
  ): HitJudgmentResult
  ```
  - 하위 호환성 유지: 3번째 인자가 `boolean`이면 `{ isFeverActive: optionsOrFever }`로 처리.
  - `effectiveHitRadius = isWideScopeActive ? hitRadiusM * 1.6 : hitRadiusM`.
  - `errorRatio = distanceToCenterM / effectiveHitRadius`.
  - `baseDamage = (isFeverActive || isPowerShotActive) ? 2 : 1`.
- **Data & Logic (`src/pc/engine/BeerCrusherEngine.ts`)**:
  - `ActiveTargetEntity` 확장:
    ```typescript
    export interface ActiveTargetEntity {
      id: string;
      kind: TargetKind;
      hp: number;
      maxHp: number;
      radiusM: number;
      thetaRad: number;
      x: number;
      z: number;
      speedMps: number;
      hitRadiusM: number;
      killBonusScore: number;
      breached: boolean;
      isItem?: boolean;
      itemKind?: ItemBuffKind;
    }
    ```
  - `EngineShootResult` 확장:
    - `activatedItem?: ItemBuffKind;` 필드 추가.
  - `WaveDefinition` 확장:
    - `spawnIntervalMs: number;` (웨이브별 스폰 템포 조절)
    - `allowedItems: ItemBuffKind[];`
  - **5단계 웨이브 테이블 (`waveDefinitions`)**:
    1. Wave 1 (워밍업): `totalSpawns: 16`, `maxSimultaneous: 4`, `spawnIntervalMs: 950`, `kinds: ['pilgood', 'caslight']`, `allowedItems: ['wide_scope']`, `includesBoss: false`
    2. Wave 2 (라거 더블탭): `totalSpawns: 22`, `maxSimultaneous: 5`, `spawnIntervalMs: 850`, `kinds: ['obi', 'hanmac', 'pilgood']`, `allowedItems: ['power_shot', 'bar_repair']`, `includesBoss: false`
    3. Wave 3 (생맥주잔 러시): `totalSpawns: 26`, `maxSimultaneous: 6`, `spawnIntervalMs: 800`, `kinds: ['mug', 'caslight', 'obi', 'hanmac']`, `allowedItems: ['wide_scope', 'ice_freeze', 'bar_repair']`, `includesBoss: false`
    4. Wave 4 (피버 아수라장): `totalSpawns: 32`, `maxSimultaneous: 7`, `spawnIntervalMs: 700`, `kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'mug']`, `allowedItems: ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair']`, `includesBoss: false`
    5. Wave 5 (보스 레이드): `totalSpawns: 18`, `maxSimultaneous: 5`, `spawnIntervalMs: 850`, `kinds: ['hanmac', 'mug', 'pilgood', 'caslight']`, `allowedItems: ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair']`, `includesBoss: true`
  - **아이템 버프 상태 및 메서드**:
    - `private activeBuffUntilMs: Map<ItemBuffKind, number> = new Map();`
    - `public activateItemBuff(kind: ItemBuffKind, nowMs: number): void`:
      - `kind === 'bar_repair'`이면 `this.lives = Math.min(STAGE_CONSTANTS.PLAYER_MAX_LIVES, this.lives + 1)`.
      - 그 외(`power_shot`, `wide_scope`, `ice_freeze`)는 `this.activeBuffUntilMs.set(kind, nowMs + ITEM_BUFF_SPECS[kind].durationMs)`.
    - `public isBuffActive(kind: ItemBuffKind, nowMs?: number): boolean`
    - `public getActiveBuffs(nowMs?: number): ActiveBuffState[]`: 만료되지 않은 버프 목록과 `remainingMs` 반환.
    - `public spawnItemTarget(itemKind: ItemBuffKind, nowMs: number): ActiveTargetEntity`: 테스트 및 인게임 드롭 스폰용 메서드 (`hp: 1`, `maxHp: 1`, `speedMps: 2.6`, `hitRadiusM: 1.05`, `killBonusScore: 100`, `isItem: true`, `itemKind`).
  - **Execution Flow (`update` & `shootAt`)**:
    1. 만료된 버프 정리 (`nowMs >= untilMs` 제거).
    2. 타겟 전진 시 `this.isBuffActive('ice_freeze', nowMs)`가 `true`이면 `effectiveSpeed = target.speedMps * 0.5`로 감속 전진.
    3. 방어선 도달(`target.breached`) 시:
       - `target.isItem === true`인 경우: 라이프를 깎지 않고 조용히 `activeTargets`에서 제거.
       - 일반 몬스터는 `1`, 보스는 `STAGE_CONSTANTS.PLAYER_MAX_LIVES`(`5`)만큼 라이프 차감.
    4. 몬스터 스폰 시: 웨이브 내 5번째 스폰마다(예: `this.spawnedInWave % 5 === 0`) 현재 화면에 아이템 타겟이 없으면 `waveDef.allowedItems` 중 하나를 함께 스폰.
    5. 보스 스폰 조건: `this.currentWave === 5 && waveDef.includesBoss && !this.bossSpawned && (this.spawnedInWave >= 6 || this.activeTargets.length <= 1)`.
    6. 웨이브 클리어 조건: 몬스터(`!t.isItem`) 전멸 및 `spawnedInWave >= waveDef.totalSpawns` 달성 시 `currentWave >= 5`이면 `VICTORY`, 아니면 `currentWave += 1` 전진 (남아있는 미획득 아이템 타겟도 정리).
    7. `shootAt(aimX, aimY, nowMs)`:
       - `wideScopeMult = this.isBuffActive('wide_scope', nowMs) ? 1.6 : 1.0`.
       - `apparentHitRadius = Math.max(0.09, (target.hitRadiusM * 2.8 * wideScopeMult) / target.radiusM)`.
       - 타겟 처치 시 `target.isItem && target.itemKind`이면 `this.activateItemBuff(target.itemKind, nowMs)`를 호출하고 `activatedItem: target.itemKind`를 반환.

## Acceptance Criteria
- [ ] `STAGE_CONSTANTS.PLAYER_MAX_LIVES`가 `5`, `SPAWN_RADIUS_M`이 `18.0`, `TARGET_SPECS.boss.maxHp`가 `40`으로 설정된다.
- [ ] Wave 1~5까지 총 114마리 일반 스폰 및 Wave 5 보스 스폰·클리어 시 `VICTORY` 전환이 동작한다.
- [ ] 4종 아이템(`power_shot`, `wide_scope`, `ice_freeze`, `bar_repair`) 획득 시 각각 데미지 2배, 판정 반경 1.6배, 이동속도 50% 감속, 체력 +1 회복(최대 5)이 정확히 작동하며, 미획득 아이템이 방어선에 도달해도 체력이 깎이지 않는다.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts && npx tsc --noEmit` — 모든 테스트 통과 및 타입 에러 0건.

## Commit Message
```text
feat(engine): implement 5 lives, 18m spawn, 5-wave progression, and 4 arcade item buffs

Plan: 2026-11-01-arcade-v2-upgrade
Phase: P01-arcade-v2-upgrade
Task: T01-gameplay-waves-and-item-engine

- Update PLAYER_MAX_LIVES to 5, SPAWN_RADIUS_M to 18m, and boss HP to 40
- Add 4 item buff specs (power_shot, wide_scope, ice_freeze, bar_repair) with 8s timers
- Expand wave definitions to 5 themed waves (114 spawns + boss raid)
- Add unit tests for item buffs and 5-wave lifecycle
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
