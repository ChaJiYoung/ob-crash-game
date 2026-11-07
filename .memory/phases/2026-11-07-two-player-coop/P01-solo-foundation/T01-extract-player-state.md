# Task: T01 개인 상태를 PlayerCombatState로 분리

## Status: done

## Goal
`BeerCrusherEngine`이 직접 들고 있던 "한 플레이어의 것"(점수·피버, 무기, 카드 스택, 행운 스택, 사격 통계, 처치 수, 아이템 수, 보너스, 버프)을 새 클래스 `PlayerCombatState`로 옮기고, 엔진은 `players: PlayerCombatState[]`(길이 1)를 가진다. 동작은 1비트도 바뀌지 않는다. 다음 Task들이 `players[i]`만 바꿔 끼우면 2인이 되도록 하는 토대다.

## Decision Summary
- D03: 무기·레벨·스킬·피버·패시브 카드·보상 카드는 개인. D17: 파워샷·와이드는 개인, 아이스 프리즈는 공용. 목숨·웨이브·킬 게이지(`cardKillCount`)·보스·`damageTaken`·`healedLives`·`playTimeSec`·`waveStartMs`·`lastWaveClear`는 팀(엔진에 남김).
- 순수 리팩터다. 기존 테스트가 `(engine as any).shotStats = ...`, `engine.luckyDropStacks`, `(engine as any).activeBuffUntilMs.set(...)`, `engine.scoreManager`, `engine.weaponSystem`처럼 엔진 필드를 직접 읽고 쓰므로, 엔진에 같은 이름의 getter/setter를 두어 `players[0]`로 위임한다(테스트 수정 0건이 목표).

## Implementation

### I01. PlayerCombatState 클래스

- Related Files:
  - `src/pc/engine/PlayerCombatState.ts` :: `PlayerCombatState`, `PlayerIndex`, `CardStackKind`, `ShotGradeCounts` — 개인 상태 묶음; new
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager` — 그대로 사용; read-only
  - `src/pc/engine/WeaponSystem.ts` :: `WeaponSystem` — 그대로 사용; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  import { ItemBuffKind } from '../../shared/types';
  import { ScoreAndFeverManager } from './ScoreAndFeverManager';
  import { WeaponSystem } from './WeaponSystem';

  export type PlayerIndex = 0 | 1;
  export type CardStackKind = 'damage_up' | 'skill_cooldown' | 'fever_extend' | 'hit_zone_up';
  export type ShotGradeCounts = Record<'PERFECT' | 'GREAT' | 'GOOD' | 'MISS', number>;

  export class PlayerCombatState {
    public readonly index: PlayerIndex;
    public readonly scoreManager = new ScoreAndFeverManager();
    public readonly weaponSystem = new WeaponSystem();
    public cardStacks: Record<CardStackKind, number> = { damage_up: 0, skill_cooldown: 0, fever_extend: 0, hit_zone_up: 0 };
    public luckyDropStacks = 0;
    public shotStats: ShotGradeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    public totalKills = 0;
    public itemsCollected = 0;
    public precisionBonusApplied = 0;
    public levelBonusApplied = 0;
    public waveTimeBonusTotal = 0;
    public waveClears: { wave: number; seconds: number; bonus: number }[] = [];
    /** 이 플레이어에게 걸린 버프 만료 시각. 아이스 프리즈는 팀 효과라 모든 플레이어 맵에 같은 값으로 들어간다(P02-T01). */
    public buffUntilMs: Map<ItemBuffKind, number> = new Map();

    constructor(index: PlayerIndex) { this.index = index; }

    /** startGame에서 부르는 전체 초기화. 엔진 startGame이 하던 개인 초기화와 정확히 같은 순서. */
    public reset(): void;          // scoreManager.reset(); shotStats/totalKills/itemsCollected/precisionBonusApplied/levelBonusApplied/waveTimeBonusTotal/waveClears 초기화; weaponSystem.reset(); resetCardStacks(); buffUntilMs.clear(); luckyDropStacks = 0
    /** 카드 스택 초기화 + 무기 쿨다운 배율 1.0 + 피버 연장 0. 엔진의 기존 private resetCardStacks와 같은 내용. */
    public resetCardStacks(): void;
    /** 개인 타이머를 deltaMs만큼 미룬다: 버프 만료, 피버 타이머(shiftFeverTimer), 장전 타이머(shiftReloadTimer). */
    public freezeTimers(deltaMs: number): void;
  }
  ```
- **Execution Flow / Logic**:
  1. `freezeTimers`: `deltaMs <= 0`이면 return. `buffUntilMs`의 모든 값 += deltaMs, `scoreManager.shiftFeverTimer(deltaMs)`, `weaponSystem.shiftReloadTimer(deltaMs)`.
  2. 이 파일은 엔진을 import하지 않는다(순환 참조 방지).

### I02. 엔진을 players[0] 위임으로 전환

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` — 개인 필드 제거 후 위임 접근자; modify

#### Details
- **Data & Schema Fields** (엔진에서 삭제하고 위임으로 바꾸는 필드):
  - `public readonly scoreManager`, `public readonly weaponSystem` → `public get scoreManager()` / `public get weaponSystem()` = `this.players[0].…`
  - `public luckyDropStacks` → get/set `players[0].luckyDropStacks`
  - `private shotStats`, `private totalKills`, `private itemsCollected`, `private precisionBonusApplied`, `private levelBonusApplied`, `public waveTimeBonusTotal`, `private waveClears`, `private cardStacks`, `private activeBuffUntilMs` → 같은 이름의 get/set(가시성은 기존과 같게: private였던 것은 `private get/set`로 두어도 `(engine as any)` 접근은 런타임에 동작한다). `activeBuffUntilMs` getter는 `players[0].buffUntilMs`를 돌려준다.
  - 새 필드: `public players: PlayerCombatState[] = [new PlayerCombatState(0)];`
  - 새 헬퍼: `public getPlayer(index: PlayerIndex = 0): PlayerCombatState { return this.players[index] ?? this.players[0]; }`
- **Execution Flow / Logic**:
  1. `startGame()`: 개인 초기화 줄들(`scoreManager.reset()`, `shotStats=…`, `totalKills=0`, `itemsCollected=0`, `waveClears=[]`, `precisionBonusApplied=0`, `levelBonusApplied=0`, `waveTimeBonusTotal=0`, `weaponSystem.reset()`, `resetCardStacks()`×2, `activeBuffUntilMs.clear()`, `luckyDropStacks=0`)을 `for (const p of this.players) p.reset();` 한 줄로 바꾼다. 팀 필드(`damageTaken`, `healedLives`, `playTimeSec`, `waveStartMs`, `lastWaveClear` 등)는 그대로 엔진에서 초기화.
  2. 엔진의 `private resetCardStacks()`는 삭제하고 호출부를 `players[0].resetCardStacks()`(startTutorialMode·startSandboxMode 등 다른 호출부가 있으면 모두 `for p of players`)로 바꾼다. `grep -n "resetCardStacks\|scoreManager.reset\|weaponSystem.reset\|activeBuffUntilMs.clear" src/pc/engine/BeerCrusherEngine.ts`로 전부 찾는다.
  3. `freezeTimers(deltaMs)`: 기존 버프/피버/장전 3줄을 `for (const p of this.players) p.freezeTimers(deltaMs);`로 바꾼다. 나머지(웨이브·스폰·보스·타깃 스턴) 그대로.
  4. `update()`의 "Clean expired buffs" 루프와 `weaponSystem.update`/`scoreManager.updateFeverTimer`는 이 Task에서는 `players[0]` 그대로(위임 getter 덕분에 코드 변경 최소). 플레이어 루프로 바꾸는 것은 P02-T01.
- **Error & Exception Handling**: 없음(런타임 예외 경로 추가 없음).

### I03. 리팩터 안전망 테스트

- Related Files:
  - `tests/coop-player-state.test.ts` :: `describe('PlayerCombatState')` — 새 클래스 단위 테스트; new

#### Details
- `reset()` 후 모든 카운터 0, `buffUntilMs.size === 0`, `weaponSystem.getState().skillStock === 0`(현재 기본값; `tests/weapon-rules.test.ts`가 고정한 값과 같아야 함).
- `freezeTimers(500)`이 `buffUntilMs` 값과 피버 종료 시각을 500ms 미루는지(`scoreManager.activateFever(1000)` 후 `freezeTimers(500)` → `updateFeverTimer(1000 + 기본 피버 시간 + 499)`에서 아직 활성).
- 엔진 위임: `new BeerCrusherEngine()`의 `engine.scoreManager === engine.players[0].scoreManager`, `(engine as any).shotStats = {…}` 대입이 `players[0].shotStats`에 반영.

## Acceptance Criteria
- [x] `BeerCrusherEngine.ts`에 `new ScoreAndFeverManager()` / `new WeaponSystem()`가 더 이상 없다(`PlayerCombatState`에만 있다).
- [x] 기존 테스트 파일은 한 줄도 고치지 않고 전부 통과한다.

## Validation
- `npx vitest run tests/coop-player-state.test.ts` — 새 테스트 통과
- `npm test && npx tsc --noEmit` — 전체 통과(기존 테스트 수정 없이)

## Commit Message
```text
refactor(engine): move per-player state into PlayerCombatState

Plan: 2026-11-07-two-player-coop
Phase: P01-solo-foundation
Task: T01-extract-player-state

- New PlayerCombatState holds score/fever, weapon, card stacks, lucky stacks, shot stats, kills, bonuses and buffs
- BeerCrusherEngine keeps players[] (length 1) and delegates the old fields to players[0]
- No behavior change; existing tests pass untouched

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
