# Task: T01 Seven Waves and Boss Encounters

## Status: done

## Goal
게임을 7웨이브로 늘리고 3·5·7웨이브에서 미니웨이브 뒤 보스전이 열리게 한다. 중간 보스를 잡으면 카드 후 다음 웨이브로, 마지막 보스전을 모두 잡으면 승리한다.

## Decision Summary
- D11: 웨이브 표대로 몬스터를 짧고 빽빽하게 구성한다. 웨이브당 몬스터 속도 +4%, 체력은 웨이브별로 올리지 않는다.
- D12: 보스 구성은 냉각기 1대 → 2대 → 2대 + 대왕. 지금은 보스를 잡으면 즉시 승리이고(`:1183`), 5웨이브가 코드에 고정되어 있다(`:1023`, `:1032`, `:997`, `:1324`).
- 넉백 면역: 샷건 넉백이 보스를 밀면 소환 거리에 못 들어와 판이 끝나지 않는다.

## Implementation

### I01. 웨이브 데이터

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves`, `GAME_TUNING.speedPerWave`, `GAME_TUNING.boss` — 웨이브 표; modify
  - `src/shared/constants.ts` :: `STAGE_CONSTANTS.TOTAL_WAVES` — 7로 변경; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `WaveDefinition`, `waveDefinitions`, `waveCardKillTargets`, `getCardKillTarget`, `WaveProgressInfo`, `getWaveProgress` — 표 사용; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  speedPerWave: 0.04,
  boss: {
    startRadiusM: 16,
    stopRadiusM: 10,
    summonRadiusM: 12.5,
    hitZoneScale: 0.6,
    kingScale: 1.5,
    coolerSpreadRad: 0.34,
  },
  waves: [
    { waveIndex: 1, totalSpawns: 20, maxSimultaneous: 5, spawnIntervalMs: 700, kinds: ['pilgood', 'caslight'], cardKillTarget: null, boss: null },
    { waveIndex: 2, totalSpawns: 26, maxSimultaneous: 6, spawnIntervalMs: 650, kinds: ['pilgood', 'obi'], cardKillTarget: null, boss: null },
    { waveIndex: 3, totalSpawns: 15, maxSimultaneous: 6, spawnIntervalMs: 700, kinds: ['obi', 'caslight', 'hanmac'], cardKillTarget: null, boss: { coolerHp: [40], kingHp: null, summonKinds: ['obi', 'caslight', 'hanmac'] } },
    { waveIndex: 4, totalSpawns: 34, maxSimultaneous: 6, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'bottle'], cardKillTarget: 22, boss: null },
    { waveIndex: 5, totalSpawns: 20, maxSimultaneous: 7, spawnIntervalMs: 600, kinds: ['obi', 'hanmac', 'bottle'], cardKillTarget: null, boss: { coolerHp: [35, 35], kingHp: null, summonKinds: ['pilgood', 'obi', 'hanmac', 'bottle'] } },
    { waveIndex: 6, totalSpawns: 40, maxSimultaneous: 7, spawnIntervalMs: 550, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'], cardKillTarget: 26, boss: null },
    { waveIndex: 7, totalSpawns: 25, maxSimultaneous: 8, spawnIntervalMs: 600, kinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'hanmac', 'bottle', 'bottle'], cardKillTarget: null, boss: { coolerHp: [45, 45], kingHp: 110, summonKinds: ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle'] } },
  ],
  ```
  `gameTuning.ts`는 다른 파일을 import하지 않으므로 `kinds`와 `summonKinds`는 문자열 리터럴로 두고, 엔진에서 `TargetKind[]`로 캐스팅한다. `spawnNextTarget`은 배열에서 균등하게 뽑으므로, 7웨이브의 중복 항목(`hanmac`, `bottle`)은 등장 비중 2배를 뜻한다. 첫 보스 3종, 두 번째 4종, 세 번째 5종은 사용자가 정한 규칙이다.
- **Signatures & Types**:
  ```typescript
  export interface WaveDefinition {
    waveIndex: number;
    totalSpawns: number;
    maxSimultaneous: number;
    spawnIntervalMs: number;
    kinds: TargetKind[];
    allowedItems: ItemBuffKind[]; // 기존 유지, 빈 배열
    boss: { coolerHp: readonly number[]; kingHp: number | null; summonKinds: readonly TargetKind[] } | null; // includesBoss 대체
  }
  // WaveProgressInfo.cardKillTarget: number | null
  public getCardKillTarget(waveIndex: number = this.currentWave): number | null;
  ```
- **Execution Flow / Logic**:
  1. `waveDefinitions`와 `waveCardKillTargets`를 `GAME_TUNING.waves`로 만든다. `this.waveDefinitions[this.currentWave] || this.waveDefinitions[5]`의 `[5]`를 `[STAGE_CONSTANTS.TOTAL_WAVES]`로 바꾼다.
  2. `handleMonsterKilled`: 목표가 `null`이면 중간 카드를 내지 않는다.
  3. `spawnNextTarget`, `spawnBossMinionWave`: 일반 몬스터 속도에 `1 + speedPerWave * (currentWave - 1)`을 곱한다. 보스, 아이템, 금색 캔, 투사체는 제외한다.
  4. `spawnBossMinionWave`: 고정된 `kinds` 배열 대신 현재 웨이브의 `boss.summonKinds`에서 뽑는다. 보스 웨이브가 아니면(샌드박스, 테스트) 5종 전부를 쓴다. 테스트로 웨이브별 소환 종류를 확인한다.

### I02. 보스전 진행

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`, `update`, `spawnBoss`, `spawnBossEncounter`, `handleMonsterKilled`, `getBossEntities` — 보스 흐름; modify
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: 카드 게이지 문구 — 목표 없을 때 숨김; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity 추가 필드
  bossRole?: 'cooler' | 'king';
  bossBaseThetaRad?: number;

  private spawnBossEncounter(nowMs: number): void;
  public getBossEntities(): ActiveTargetEntity[];
  public isBossEncounterActive = false; // startWave와 startGame에서 false
  ```
- **Execution Flow / Logic**:
  1. `update`의 기존 보스 스폰 블록(`:1022-1030`)을 지운다.
  2. 웨이브 완료 판정을 바꾼다.
     ```typescript
     const bossAlive = monsterTargets.some((t) => t.kind === 'boss');
     const miniWaveDone = this.spawnedInWave >= waveDef.totalSpawns && monsterTargets.length === 0 && !bossAlive;
     if (miniWaveDone) {
       if (waveDef.boss && !this.bossSpawned) {
         this.spawnBossEncounter(nowMs);
         return { breaches, phaseChanged: false, reloadedJustNow };
       }
       this.activeTargets = [];
       this.spawnWaveRewardCards(nowMs, true);
       return { breaches, phaseChanged: true, reloadedJustNow };
     }
     ```
     기존의 `TOTAL_WAVES`에서 바로 `VICTORY` 처리하는 분기는 지운다. 마지막 웨이브는 항상 보스전으로 끝난다.
  3. `spawnBossEncounter`: `bossSpawned = true`, `isBossEncounterActive = true`. `coolerHp` 항목마다 보스를 만든다.
     - 1대: `theta = 0`
     - 2대: `theta = ±coolerSpreadRad`
     - 대왕이 있으면 추가: `theta = 0`, `bossRole = 'king'`, `hitRadiusM = spec.hitRadiusM * kingScale`
     - 공통: `radiusM = startRadiusM`, `x`, `z`를 theta로 계산, `bossBaseThetaRad = theta`
  4. 기존 `spawnBoss`는 `spawnBossEncounter`로 대체한다. 샌드박스의 `spawnSandboxTarget('boss')` 동작은 유지한다.
  5. `handleMonsterKilled`:
     ```typescript
     if (target.kind === 'boss') {
       if (this.getBossEntities().length > 0) return; // 다른 보스가 남음
       this.isBossEncounterActive = false;
       this.activeTargets = [];
       this.isRewardCardPending = false;
       if (this.currentWave >= STAGE_CONSTANTS.TOTAL_WAVES) this.gamePhase = 'VICTORY';
       return; // 중간 보스는 다음 update의 완료 판정에서 카드로 넘어간다
     }
     ```
     호출 시점에 처치한 보스가 이미 `activeTargets`에서 빠져 있는지 확인한다. 스킬 처치 경로도 같은 순서인지 확인한다.
  6. `getBossEntity`는 `getBossEntities()[0]`을 반환하도록 유지한다(HUD는 P04-T05에서 바꾼다).
  7. `:1023`, `:1032`의 `currentWave === 5` 소환 블록은 `this.isBossEncounterActive`로 조건을 바꾼다. 소환 규칙 변경은 P04-T04에서 한다.
  8. 정지 거리 `:925-936`의 `10.0`을 `GAME_TUNING.boss.stopRadiusM`으로 바꾼다.
  9. HUD 카드 게이지: `cardKillTarget`이 `null`이면 `🃏 카드` 문구를 표시하지 않는다.

### I03. 넉백 면역과 판정

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAt` 샷건 분기, `triggerWeaponSkill` 개틀링 분기, `computeTargetAimCoords` — 보스 예외; modify

#### Details
- 샷건 넉백(`:1400`): `if (levelSpec.knockbackM > 0 && target.kind !== 'boss')`
- 개틀링 스킬 넉백: `if (monster.kind !== 'boss') monster.radiusM = ...`
- `computeTargetAimCoords`: `target.kind === 'boss'`이면 범위에 `GAME_TUNING.boss.hitZoneScale`을 추가로 곱한다.

### I04. 테스트

- Related Files:
  - `tests/boss-encounters.test.ts` :: 보스전 흐름 검증; new
  - `tests/gameplay-polish.test.ts` :: 킬 게이지 카드와 보스 테스트 — 새 구조 반영; modify
  - `tests/shared-protocol.test.ts` :: `:76` — `TOTAL_WAVES` 7; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: 웨이브 전환 관련 — 필요 시 수정; modify

#### Details
- `tests/gameplay-polish.test.ts`:
  - 킬 게이지 테스트(`:107-`): `engine.startWave(4)`로 시작해 22회 처치로 바꾼다. `describe`와 주석의 "Wave 1 target is 10"을 고친다.
  - `T02: Wave 5...` 테스트: `engine.startWave(7)`로 바꾸고 `isBossEncounterActive = true`, 대상에 `bossRole: 'cooler'`를 넣는다. 마지막 보스 처치 → `VICTORY`, 필드 비움 검사는 유지한다.
  - 소환 테스트의 `bossSpawned` 설정은 `isBossEncounterActive`로 바꾼다.
- **새 테스트 시나리오**:
  - 3웨이브 미니웨이브를 끝내면 보스 1대가 체력 40으로 나온다.
  - 그 보스를 잡으면 `VICTORY`가 아니고 다음 `update`에서 카드가 나오며, 카드 선택 뒤 4웨이브로 간다.
  - 5웨이브 보스 2대는 서로 다른 theta에 나오고, 1대를 잡아도 다음으로 넘어가지 않는다.
  - 7웨이브 보스 3대(냉각기 2, 대왕 1)를 모두 잡아야 `VICTORY`다.
  - 샷건 Lv.2 사격과 개틀링 스킬로 보스 `radiusM`이 늘지 않는다.
  - 4웨이브 몬스터 속도는 기본값의 1.12배, 보스는 기본값이다.
  - 1웨이브는 킬 수와 관계없이 중간 카드가 없다.

## Acceptance Criteria
- [x] 7웨이브까지 진행되고 HUD에 `WAVE n / 7`로 표시된다.
- [x] 3·5·7웨이브에서 미니웨이브를 깨면 보스가 나온다.
- [x] 중간 보스를 잡아도 승리가 아니고 다음 웨이브로 간다.
- [x] 샷건으로 쏴도 보스가 밀리지 않는다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts tests/gameplay-polish.test.ts tests/shared-protocol.test.ts tests/engine-judgment-and-spawn.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(waves): add seven waves with mini-wave boss encounters

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P04-waves-and-bosses
Task: T01-seven-waves-and-boss-encounters

- Drive waves from GAME_TUNING with denser spawns and speed scaling
- Spawn bosses after mini-waves on waves 3, 5, and 7
- Require all bosses for victory and advance after mid bosses
- Make bosses immune to knockback
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: feat(waves): add seven waves with mini-wave boss encounters
