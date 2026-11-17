# Task: T02 EX 진입과 테마 러시 스폰

## Status: done

## Goal
W7 보스 클리어 연출이 끝나면 `VICTORY`로 끝내지 않고, 승리 보너스를 지급하고 플레이어 강화를 MAX로 맞춘 뒤 EX 무한 러시를 시작한다. EX에서는 10초마다 테마 러시가 바뀌고, 30초마다 DANGER가 올라 HP·속도·할당량이 커진다. 목숨이 0이 되면 기록은 `outcome: 'VICTORY'`, `waveReached: 7 + DANGER`가 된다. 이 Task만으로 엔진에서 EX가 끝까지 돌아가야 한다(보스 난입은 T03).

## Decision Summary
- 결정 D02·D04·D05·D06·D07 (D05는 2026-11-17 시뮬레이션 후 수치 확정본)(decisions/2026-11-17-ex-endless-waves.md). EX는 웨이브 표를 늘리지 않고 별도 상태로 돈다. `currentWave`는 7에 머문다(`startWave`가 1~7로 자르기 때문).
- 시계는 EX 전용 게임 시계(`exElapsedMs`, update의 dtSec 누적)를 쓴다. 일시정지/카드 정지 중에는 update가 일찍 return하므로 자동으로 멈춘다.

## Implementation

### I01. EX 튜닝 상수

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.exRush` — EX 전용 계수 묶음; modify(`waves` 뒤, `breachRespawnRadiusM` 앞에 추가)

#### Details
- **Data & Schema Fields** (모두 `as const` 객체 안, 주석은 한국어로 한 줄씩):
  ```ts
  exRush: {
    /** 러시 하나의 길이. 할당량을 이 시간 안에 고르게 다 내보낸다(D05). */
    rushDurationMs: 10000,
    /** 한 DANGER = 러시 3개(30초). */
    rushesPerDanger: 3,
    /** 1인 러시 할당량: base + perDanger × (danger - 1). */
    quota: { base: 20, perDanger: 8 },
    /** 2인 할당량·필드 상한 배율. playerCountRules.spawnCountMult(×2)를 쓰지 않는다(공유 목숨 보정, D05). */
    coopQuotaMult: 1.5,
    /** 일반 몬스터(보스 제외) 필드 상한. 1인 값, 2인은 ceil(× coopQuotaMult) = 23. */
    fieldCap: 15,
    /** 이동속도: 기본 speedMps 대비 절대 배율. speedPerWave는 EX에서 쓰지 않는다. */
    speed: { start: 1.5, perDangerMult: 1.12, max: 2.3 },
    /** 몬스터 HP 배율(한맥 폭발 피해도 같은 배율): start × perDangerMult^(danger-1). */
    hp: { start: 1.5, perDangerMult: 1.3 },
    /** 테마 위주 몬스터 비율, 잠수가 아닌 테마에 섞는 찰랑 비율. */
    themeShare: 0.5,
    chalangShare: 0.1,
    /** 첫 러시는 잠수(찰랑) 고정(D06). */
    firstTheme: 'dive',
    /** 테마 → 위주 몬스터 종류. 문자열 리터럴(이 파일은 다른 파일을 import하지 않는다). */
    themes: {
      charge: { kind: 'pilgood', labelKo: '돌진' },
      air: { kind: 'caslight', labelKo: '공습' },
      shield: { kind: 'obi', labelKo: '방패' },
      dive: { kind: 'chalang', labelKo: '잠수' },
      blast: { kind: 'hanmac', labelKo: '연쇄폭발' },
      split: { kind: 'bottle', labelKo: '분열' },
    },
  },
  ```
- 파일 아래 export 타입 추가: `export type ExRushTheme = keyof typeof GAME_TUNING.exRush.themes;`
- `RANKING_RULESET_VERSION`은 **올리지 않는다**(D09: 시즌 초기화 안 함. 올리면 기존 랭킹이 사라진 것처럼 보인다).

### I02. EX 순수 헬퍼 모듈

- Related Files:
  - `src/pc/engine/exRush.ts` :: 아래 함수들 — 계수 계산과 러시 구성(엔진 상태 없음, 테스트 쉬움); new

#### Details
- **Signatures & Types**:
  ```ts
  import { GAME_TUNING, ExRushTheme } from '../../shared/gameTuning';
  import type { TargetKind } from '../../shared/types';

  /** EX 경과 시간(ms) → DANGER(1부터). floor(elapsed / (rushDurationMs × rushesPerDanger)) + 1 */
  export function getExDanger(elapsedMs: number): number;
  /** EX 경과 시간(ms) → 러시 번호(0부터). floor(elapsed / rushDurationMs) */
  export function getExRushIndex(elapsedMs: number): number;
  /** 러시 할당량. 1인: base + perDanger×(d-1). 2인: ceil(1인 × coopQuotaMult). */
  export function getExRushQuota(danger: number, playerCount: 1 | 2): number;
  /** 필드 상한. 1인 fieldCap, 2인 ceil(fieldCap × coopQuotaMult). */
  export function getExFieldCap(playerCount: 1 | 2): number;
  /** min(max, start × perDangerMult^(d-1)) */
  export function getExSpeedMult(danger: number): number;
  /** start × perDangerMult^(d-1), 소수 3자리 반올림(Number(x.toFixed(3))) */
  export function getExHpMult(danger: number): number;
  /** rushIndex 0이면 firstTheme. 아니면 prev를 뺀 나머지 5개 중 rng로 균등 선택. */
  export function pickExTheme(rushIndex: number, prev: ExRushTheme | null, rng: () => number): ExRushTheme;
  /**
   * 러시 스폰 순서(길이 = quota).
   * themeCount = round(quota × themeShare)
   * chalangCount = theme === 'dive' ? 0 : round(quota × chalangShare)
   * 나머지는 "테마 종류와 chalang을 뺀" 일반 종류 중 rng 균등 선택.
   * 일반 종류 목록: ['pilgood','caslight','obi','hanmac','bottle','chalang'] (exRush.themes의 kind 값 6개)
   * 마지막에 Fisher–Yates로 rng 셔플.
   */
  export function buildExRushQueue(theme: ExRushTheme, quota: number, rng: () => number): TargetKind[];
  ```
- **Execution Flow / Logic**: 모든 입력은 정수 danger ≥ 1, elapsedMs ≥ 0 가정. 음수 elapsedMs는 0으로 취급(Math.max(0, …)).

### I03. 엔진 EX 상태·진입·러시 스폰

- Related Files:
  - `src/pc/engine/engineEvents.ts` :: `EngineEvent` — exStarted/exRushStarted 이벤트 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` — EX 상태 필드, `enterExRush`, `applyExMaxUpgrades`, `updateExRush`, `spawnMonsterOfKind`, `declareVictory` 분리, `advanceBossClear`, `update`, `processHanmacBlasts`, `startGame`, `getPlayRunStats`; modify

#### Details
- **새 public/private 필드** (클래스 필드 영역, `lastWaveClear` 근처):
  ```ts
  /** 본편 7웨이브를 클리어했다. EX에서 죽어도 기록은 VICTORY(D02). */
  public mainCleared = false;
  /** EX 무한 러시 진행 중. */
  public isExActive = false;
  /** EX 게임 시계(ms). update의 dtSec만 누적하므로 일시정지·카드 정지 중에는 멈춘다. */
  public exElapsedMs = 0;
  public exDanger = 1;
  public exRushIndex = -1;
  public exRushTheme: ExRushTheme | null = null;
  private exRushQueue: TargetKind[] = [];
  private exRushSpawned = 0;
  /** 테스트에서 고정할 수 있는 EX 난수. */
  public exRng: () => number = () => Math.random();
  ```
- **startGame()**: 위 필드를 모두 초기값으로 되돌린다(`mainCleared=false, isExActive=false, exElapsedMs=0, exDanger=1, exRushIndex=-1, exRushTheme=null, exRushQueue=[], exRushSpawned=0`). `exRng`는 건드리지 않는다.
- **declareVictory 분리**:
  ```ts
  /** 정밀·무기 레벨 승리 보너스를 한 번 지급한다(EX 진입과 VICTORY가 같이 쓴다). */
  private applyVictoryBonuses(): void  // 기존 declareVictory의 `if (this.modeRules.victoryBonus) {...}` 블록을 그대로 옮김
  private declareVictory(): void      // gamePhase='VICTORY'; clearSkillProjectiles(); applyVictoryBonuses();
  ```
  반드시 **강화 MAX 전에** 보너스를 계산한다(`weaponLevelBonusMult`가 실제 W7 시점 무기 레벨을 써야 함; MAX 후 계산하면 Lv.4 배율 1로 바뀌어 보너스가 줄어든다).
- **advanceBossClear()**: `if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) this.declareVictory();` 를 다음으로 교체:
  ```ts
  if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) {
    if (this.mode === 'game') this.enterExRush(nowMs); else this.declareVictory();
  }
  ```
- **finishSelectRound()**의 `this.currentWave >= TOTAL_WAVES → declareVictory()` 분기: W7은 보스 웨이브라 이 경로로 오지 않지만, 같은 규칙으로 `this.mode === 'game' ? this.enterExRush(nowMs) : this.declareVictory()`로 맞춘다.
- **enterExRush(nowMs)**:
  1. 이미 `isExActive`면 return.
  2. `this.applyVictoryBonuses()`
  3. `this.mainCleared = true; this.isExActive = true; this.exElapsedMs = 0; this.exDanger = 1; this.exRushIndex = -1; this.exRushTheme = null; this.exRushQueue = []; this.exRushSpawned = 0;`
  4. `this.activeTargets = []`(클리어 연출이 이미 비웠지만 아이템·황금캔 잔여 제거), `this.isBossEncounterActive = false`, `this.isRewardCardPending = false`, `this.pendingWaveAdvance = false`, `this.midCardGranted = true`(중간 카드가 절대 안 나오게).
  5. `for (const p of this.players) this.applyExMaxUpgrades(p.index)`
  6. `this.emit({ type: 'exStarted', nowMs })` — `src/pc/engine/engineEvents.ts`의 `EngineEvent` 유니온에 `{ type: 'exStarted'; nowMs: number }`를 추가한다.
- **applyExMaxUpgrades(playerIndex)**: 기존 `applyRewardCard`를 반복 호출해 상한까지 채운다(효과 적용 로직 중복 금지).
  ```ts
  const p = this.getPlayer(playerIndex); const c = GAME_TUNING.cards;
  while (p.weaponSystem.getState().weaponLevel < 4) this.applyRewardCard('weapon_level_up', nowMs, playerIndex);
  while (p.weaponSystem.getRapidReloadStacks() < c.rapidReloadMaxStacks) this.applyRewardCard('rapid_reload', nowMs, playerIndex);
  while (p.luckyDropStacks < c.luckyDropMaxStacks) this.applyRewardCard('lucky_drop', nowMs, playerIndex);
  while (p.cardStacks.damage_up < c.damageUp.maxStacks) this.applyRewardCard('damage_up', ...);
  while (p.cardStacks.skill_cooldown < c.skillCooldown.maxStacks) this.applyRewardCard('skill_cooldown', ...);
  while (p.cardStacks.fever_extend < c.feverExtend.maxStacks) this.applyRewardCard('fever_extend', ...);
  while (p.cardStacks.hit_zone_up < c.hitZoneUp.maxStacks) this.applyRewardCard('hit_zone_up', ...);
  ```
  `cardPicks`(선택 기록)에는 넣지 않는다. `applyRewardCard`는 기록하지 않고, 기록은 `applySelection`(`player.cardPicks.push`, BeerCrusherEngine.ts 약 2060행)에서만 한다. 서버 검증 `MAX_CARD_PICKS = 60`을 넘지 않게 하려는 것이기도 하다. 각 while에는 안전장치로 최대 10회 카운터를 둔다(무한 루프 방지).
- **spawnMonsterOfKind 추출**: 기존 `spawnNextTarget`의 엔티티 생성부를 다음 private 함수로 빼고, `spawnNextTarget`은 kind를 뽑아 이 함수를 부른 뒤 `spawnedInWave += 1`만 한다(기존 동작 동일).
  ```ts
  private spawnMonsterOfKind(kind: TargetKind, nowMs: number, hpMult: number, speedMult: number): ActiveTargetEntity
  // maxHp = Number((spec.maxHp * hpMult).toFixed(3)); speedMps = spec.speedMps * speedMult;
  // applyMonsterTraits, activeTargets.push, lastSpawnTimeMs = nowMs, return entity
  ```
  `spawnNextTarget`은 `this.spawnMonsterOfKind(kind, nowMs, this.rules.monsterHpMult, this.getWaveSpeedMultiplier())`.
- **update() 분기**: `if (!this.modeRules.waveSpawning) return ...` 바로 다음, 카드 대기 체크 다음에 삽입:
  ```ts
  if (this.isExActive) {
    this.updateExRush(nowMs, dtSec);
    return { breaches, phaseChanged: false, reloadedJustNow, reloadedByPlayer };
  }
  ```
  (목숨 0 → GAMEOVER는 위쪽 breach 처리에서 이미 return하므로 EX에서도 그대로 동작.)
- **updateExRush(nowMs, dtSec)**:
  1. `this.exElapsedMs += dtSec * 1000`
  2. `const danger = getExDanger(this.exElapsedMs); const rushIndex = getExRushIndex(this.exElapsedMs);`
  3. 러시가 바뀌었으면(`rushIndex !== this.exRushIndex`):
     - 이전 러시에서 못 나온 몬스터 `leftover = this.exRushQueue.slice(this.exRushSpawned)`를 보관한다(상한 때문에 남은 것; D05 "다음 러시 대기열 앞에 붙는다").
     - `this.exDanger = danger; this.exRushIndex = rushIndex; this.exRushTheme = pickExTheme(rushIndex, this.exRushTheme, this.exRng);`
     - `this.exRushQueue = [...leftover, ...buildExRushQueue(this.exRushTheme, getExRushQuota(danger, this.players.length as 1 | 2), this.exRng)]; this.exRushSpawned = 0;`
     - `this.emit({ type: 'exRushStarted', theme: this.exRushTheme, danger, rushIndex, nowMs })` — `engineEvents.ts`의 `EngineEvent`에 `{ type: 'exRushStarted'; theme: ExRushTheme; danger: number; rushIndex: number; nowMs: number }` 추가.
  4. 러시 안 경과 `rushElapsed = this.exElapsedMs - rushIndex * rushDurationMs`, `interval = rushDurationMs / this.exRushQueue.length`.
     `while (this.exRushSpawned < queue.length && rushElapsed >= this.exRushSpawned * interval && this.countFieldMonsters() < getExFieldCap(this.players.length as 1 | 2))` → `this.spawnMonsterOfKind(queue[this.exRushSpawned], nowMs, this.rules.monsterHpMult * getExHpMult(this.exDanger), getExSpeedMult(this.exDanger)); this.exRushSpawned += 1;`
     (`countFieldMonsters`는 기존 함수: 보스·소환 부하·투사체·아이템·황금캔·카드를 세지 않는다. 병이 깨져 생긴 작은 병은 세므로 필드가 상한을 1~3마리 넘을 수 있고, 그건 정상.)
  5. 대기열이 계속 쌓이는 상황(처치가 밀림)은 그대로 둔다. 필드는 상한을 유지하고 결국 방어선이 뚫려 판이 끝난다.
  6. 황금캔·중간 카드·웨이브 완료 체크는 하지 않는다. (아이템 드롭은 handleMonsterKilled의 기존 로직 그대로)
- **processHanmacBlasts()**: `blastDamage`를 `const dmg = this.isExActive ? blastDamage * getExHpMult(this.exDanger) : blastDamage;`로 바꿔 적용.
- **getPlayRunStats()**:
  - `outcome: this.mainCleared ? 'VICTORY' : this.gamePhase`
  - `waveReached: this.isExActive ? STAGE_CONSTANTS.TOTAL_WAVES + this.exDanger : this.currentWave`
  - 진입 조건 `if (this.gamePhase !== 'GAMEOVER' && this.gamePhase !== 'VICTORY') return null;` 는 그대로(EX 중 GAMEOVER에서만 통계가 나온다).
- **Error & Edge**: tutorial/sandbox는 W7까지 가지 않지만 `this.mode === 'game'` 검사로 EX 진입을 막는다. `exRng`는 테스트에서 고정 함수로 교체 가능해야 한다.

### I04. 테스트

- Related Files:
  - `tests/ex-rush.test.ts` — EX 헬퍼·엔진 동작; new
  - `tests/boss-encounters.test.ts:113`, `tests/boss-clear-sequence.test.ts:125`, `tests/boss-concurrent-spawns.test.ts:174,226`, `tests/precision-bonus.test.ts:53`, `tests/wave-time-bonus.test.ts:114`, `tests/gameplay-polish.test.ts:339`, `tests/skill-blade.test.ts:212` — W7 클리어 후 `gamePhase === 'VICTORY'`를 기대; modify

#### Details
- 기존 8곳: `expect(engine.gamePhase).toBe('VICTORY')`를 `expect(engine.mainCleared).toBe(true); expect(engine.isExActive).toBe(true); expect(engine.gamePhase).toBe('PLAYING');`로 바꾼다. 승리 보너스를 검사하는 테스트(precision-bonus, wave-time-bonus)는 보너스 값 기대치는 그대로 두고 단언만 바꾼다. 각 파일을 열어 그 테스트가 VICTORY 이후 무엇을 더 확인하는지 읽고 같은 의미로 고친다.
- `tests/ex-rush.test.ts` 케이스:
  1. `getExDanger`: 0→1, 29999→1, 30000→2, 90000→4. `getExRushIndex`: 0→0, 9999→0, 10000→1.
  2. `getExRushQuota`: (1,1)=20, (3,1)=36, (1,2)=30, (2,2)=ceil(28×1.5)=42. `getExFieldCap`: 1→15, 2→23.
  3. `getExSpeedMult`: d1=1.5, d2=1.68, 큰 d → 2.3. `getExHpMult`: d1=1.5, d3=2.535.
  4. `pickExTheme(0, null, rng)`='dive'; 1000회 반복해 prev와 같은 테마가 나오지 않음.
  5. `buildExRushQueue('charge', 20, seededRng)`: 길이 20, pilgood 10, chalang 2, 나머지 8은 pilgood·chalang이 아님. `'dive'`, 20: chalang 10, 나머지에 chalang 없음.
  6. 엔진: W7 보스 클리어 흐름(기존 boss-encounters 테스트의 killBoss + finishBossSequence 헬퍼 패턴 재사용) 후 `isExActive`, `mainCleared`, 플레이어 무기 Lv.4, `cardStacks` = {damage_up:3, skill_cooldown:3, fever_extend:3, hit_zone_up:2}, `getRapidReloadStacks()`=3, `luckyDropStacks`=3.
  7. 엔진 스폰: EX 진입 후 `update(t, 0.05)`를 10초 분량(200회) 돌리면(몬스터가 방어선에 닿지 않게 매 틱 `engine.lives = 5`로 유지하거나 스폰된 몬스터를 제거) 누적 스폰 수가 정확히 20, 테마는 'dive', 스폰된 몬스터 HP = spec.maxHp × 1.5, 속도 = spec.speedMps × 1.5.
  8. 엔진 2인(`startGame({ playerCount: 2 })`): 첫 러시 스폰 수 30.
  8-1. 필드 상한: 몬스터를 제거하지 않고(방어선에 닿지 않게 `radiusM`을 매 틱 20으로 되돌림) 10초 돌리면 일반 몬스터 수가 15를 넘지 않고, 10초 경계 직후 `exRushQueue.length === (첫 러시에서 못 나온 수) + 20`(두 번째 러시도 DANGER 1이라 할당량 20)이고 큐 앞부분이 첫 러시의 남은 몬스터 순서와 같은지 확인.
  9. 기록: EX 중 `engine.lives = 1` 후 몬스터 1마리 breach → `gamePhase === 'GAMEOVER'`, `getPlayRunStats().outcome === 'VICTORY'`, `waveReached === 8`(DANGER 1).
  10. 일시정지: `setPaused(true)` 중 update를 여러 번 불러도 `exElapsedMs`가 변하지 않음.

### I05. 본편 찰랑 배치: W3 임시 배치 제거, W6·W7 등장 (D07)

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves[2].kinds`, `waves[5].kinds`, `waves[6].kinds`(약 225~229행); modify
  - `tests/boss-distance-and-mix.test.ts:23-24` — W3 오비 비율 기대값; modify
  - `.memory/decisions/2026-11-12-chalang-monster.md` :: D09; modify

#### Details
- W3 `kinds` → `['obi', 'caslight', 'caslight', 'hanmac']`(`main`과 같은 값; 커밋 af656ba의 임시 배치 제거).
- W6 `kinds` → `['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'chalang', 'chalang']`.
- W7 `kinds` → `['pilgood', 'caslight', 'obi', 'hanmac', 'hanmac', 'bottle', 'bottle', 'chalang', 'chalang']`. `summonKinds`(보스 소환 목록)는 바꾸지 않는다.
- `waves` 주석에 "찰랑은 W6·W7과 EX에 등장(2026-11-17 D07)" 한 줄 추가.
- 찰랑 물속 좌우 헤엄 속도 `GAME_TUNING.monsters.chalang.swimSpeedMps` 1.2 → 2.4(사용자 샌드박스 피드백 2026-11-17: 물속에서 좌우로 더 빨리). 이 값을 직접 단언하는 테스트(`grep -rn "swimSpeedMps\|1\.2" tests/chalang-monster.test.ts`)가 있으면 갱신. 가이드 `speedText`는 상수를 읽으므로 자동 반영.
- 테스트: `boss-distance-and-mix` 23행 주석 삭제, `expect(share(3)).toBe(0.25);`. W5 기대값 0.2는 그대로.
- 찰랑 결정 D09 갱신: "**Chosen**: 본편 W6·W7(목록 2칸씩)과 EX 무한 러시. W3 임시 배치는 제거. **Rationale**: 2026-11-17 EX 결정 D07 참고(시뮬레이션상 난이도 영향 오차 범위)." 상태 줄의 "D09 테스트 후 조정 가능" 표기 정리.

## Acceptance Criteria
- [x] W7 보스 클리어 후 `gamePhase`는 `PLAYING`, `isExActive`·`mainCleared`가 true이고 승리 보너스가 한 번만 지급된다.
- [x] 두 플레이어 모두 강화가 MAX가 된다.
- [x] 필드가 상한 미만이면 러시 할당량이 그 10초 안에 모두 스폰되고, 상한에 걸려 남은 몬스터는 다음 러시 앞에 붙는다. 첫 러시는 잠수, 연속 같은 테마가 없다.
- [x] EX에서 죽으면 `outcome: 'VICTORY'`, `waveReached: 7 + DANGER`.
- [x] 본편 W3에는 찰랑이 없고 W6·W7·EX에 등장한다.
- [x] 기존 테스트 전부 통과(수정한 곳 포함).

## Validation
- `npx vitest run tests/ex-rush.test.ts tests/boss-distance-and-mix.test.ts tests/chalang-monster.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
feat(ex-rush): W7 클리어 후 EX 무한 러시 진입과 테마 러시 스폰

Plan: 2026-11-17-ex-endless-waves
Phase: P01-engine-ex-rush
Task: T02-ex-entry-and-rush-spawn

- GAME_TUNING.exRush 계수(러시 10초, 할당량 20+8n·2인 ×1.5, 필드 상한 15/23, 속도 1.5×1.12^n 상한 2.3, HP 1.5×1.3^n, 테마 6종)
- exRush.ts 순수 헬퍼(DANGER·러시 번호·할당량·필드 상한·배율·테마 선택·스폰 큐)
- 엔진: W7 클리어 시 승리 보너스 지급 후 강화 MAX로 EX 진입, 러시 스폰, 한맥 폭발 배율, 기록 outcome/waveReached
- W7 클리어 VICTORY 기대 테스트를 EX 진입 기대로 갱신, ex-rush 테스트 추가
- 찰랑 배치: W3 임시 배치 제거, W6·W7 등장, 물속 헤엄 속도 2.4, 찰랑 결정 D09 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
