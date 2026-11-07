# Task: T02 모드 규칙 표

## Status: pending

## Goal
엔진 안에서 "튜토리얼이야? 샌드박스야?"를 물어 규칙을 켜고 끄는 분기를 모드 규칙 표 하나로 옮긴다(D31-1). 엔진은 `this.mode`('game' | 'tutorial' | 'sandbox')에 해당하는 행(`this.modeRules`)의 값만 읽는다. 동작은 바뀌지 않는다(판정 범위 통일은 T04). 튜토리얼 단계 진행 코드는 이 Task에서 건드리지 않는다(T03).

## Decision Summary
- D31: 심판(엔진)은 표의 값만 본다. 2인 인원수 표(P02-T02)와 같은 원칙(D24).
- `isTutorialMode`/`isSandboxMode` 불리언은 `mode` 하나로 바꾼다. 화면·테스트가 읽는 곳이 많으므로 이 Task에서는 읽기 전용 getter(`get isTutorialMode() { return this.mode === 'tutorial'; }`)로 남기고, **엔진 내부 로직에서는 쓰지 않는다**. 대입하는 테스트(`grep -rn "isTutorialMode =\|isSandboxMode =" tests scripts`)는 `mode` 대입으로 고친다.

## Implementation

### I01. 표

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.modeRules`; modify

#### Details
- **Data & Schema Fields** (현재 엔진 분기를 그대로 옮긴 값):
  ```typescript
  /** 모드별 규칙(D31). 엔진은 모드를 묻지 않고 이 값만 읽는다. */
  modeRules: {
    game: {
      waveSpawning: true,          // 웨이브 스폰·웨이브 완료·카드 라운드 진행 (엔진 1398행 분기)
      breachEffect: 'damageLives', // 'damageLives' | 'respawnFar' | 'remove' (1354~1375행)
      pilgoodCharge: true,         // 1304행 isRegularPlay
      hanmacBlast: true,           // 1726행
      killEffects: true,           // 병 분열·아이템 드롭·킬 게이지 (1731행)
      bossEncounter: true,         // 보스 처치 → 보스 클리어 연출·승리 (1712행)
      freezeOnSelect: true,        // 선택 라운드 중 게임 시계 정지 (1214행)
      waveTimeBonus: true,         // 1899행
      victoryBonus: true,          // 1973행
      holdDamagePenalty: true,     // 2119행
    },
    tutorial: { waveSpawning: false, breachEffect: 'remove', pilgoodCharge: false, hanmacBlast: false, killEffects: false, bossEncounter: false, freezeOnSelect: false, waveTimeBonus: false, victoryBonus: false, holdDamagePenalty: false },
    sandbox:  { waveSpawning: false, breachEffect: 'respawnFar', pilgoodCharge: false, hanmacBlast: false, killEffects: false, bossEncounter: false, freezeOnSelect: false, waveTimeBonus: false, victoryBonus: false, holdDamagePenalty: false },
  },
  ```
  `respawnFar` 거리 16.0m는 지금 코드 값이므로 `breachRespawnRadiusM: 16` 상수를 `modeRules` 옆에 둔다.
- 판정 범위 분기(1697·2034행)는 이 표에 넣지 않는다 — T04에서 분기 자체를 없앤다(D30).

### I02. 엔진

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `mode`, `modeRules`, `setMode`(private), `update`, `handleMonsterKilled`, `awardWaveTimeBonus`, `declareVictory`, `shootAtInner`, `startGame`, `startTutorialMode`, `exitTutorialMode`, `startSandboxMode`, `exitSandboxMode`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type EngineMode = 'game' | 'tutorial' | 'sandbox';
  public mode: EngineMode = 'game';
  public get modeRules(): ModeRules { return GAME_TUNING.modeRules[this.mode]; }
  public get isTutorialMode(): boolean; // 읽기 전용 호환
  public get isSandboxMode(): boolean;  // 읽기 전용 호환
  ```
- **Execution Flow / Logic** (각 분기 → 표 값, 의미 그대로):
  1. 1214행: `!isTutorialMode && !isSandboxMode && isCardSelectPending` → `modeRules.freezeOnSelect && isCardSelectPending`.
  2. 1304행: `isRegularPlay` → `modeRules.pilgoodCharge`.
  3. 1354~1375행 돌파: `switch (modeRules.breachEffect)`: `'respawnFar'` → 지금 샌드박스 코드(반지름 16 재배치, continue). `'remove'` → 표적 제거 후 continue(튜토리얼 단계별 재배치·완료 판정은 **이 Task에서는 기존 코드 그대로 이 case 안에 둔다** — T03이 밖으로 옮긴다). `'damageLives'` → 지금 실전 코드.
  4. 1398행: `if (isTutorialMode || isSandboxMode) return` → `if (!modeRules.waveSpawning) return`.
  5. 1712행: 보스 처치 시 `(isSandboxMode || isTutorialMode)` → `!modeRules.bossEncounter`.
  6. 1726행: 한맥 → `modeRules.hanmacBlast`.
  7. 1731행: → `modeRules.killEffects`.
  8. 1899행: → `!modeRules.waveTimeBonus`면 return.
  9. 1973행: → `modeRules.victoryBonus`.
  10. 2119행: → `modeRules.holdDamagePenalty`.
  11. 모드 진입·이탈: `startGame` → `mode = 'game'`, `startTutorialMode` → `'tutorial'`, `startSandboxMode` → `'sandbox'`, `exitTutorialMode`/`exitSandboxMode` → `'game'`.
  - 1246·2210~2224·2515행(튜토리얼 단계 진행)은 이 Task에서 `this.mode === 'tutorial'`로만 바꿔 두고 T03에서 엔진 밖으로 옮긴다.

### I03. 테스트

- Related Files:
  - `tests/mode-rules.test.ts`; new

#### Details
- 표 고정: 세 행의 키가 같고, `game` 행이 모두 실전 값.
- 샌드박스에서 표적이 방어선을 넘으면 반지름 16으로 돌아가고 목숨 변화 없음. 실전에서는 목숨 감소.
- 튜토리얼에서 한맥 처치 시 폭발 없음, 실전에서는 있음.
- 엔진 내부 분기 제거 확인: `grep -c "isTutorialMode\|isSandboxMode" src/pc/engine/BeerCrusherEngine.ts`가 getter 정의 2곳만(1246·2210·2515행 튜토리얼 진행은 `mode === 'tutorial'`로 바뀌어 있어야 함).

## Acceptance Criteria
- [ ] 엔진이 규칙을 켜고 끌 때 모드를 묻지 않고 `modeRules` 값만 읽는다.
- [ ] 기존 테스트가 동작 변화 없이 통과한다(대입 문법만 고친 테스트 제외).

## Validation
- `npx vitest run tests/mode-rules.test.ts` — 통과
- `grep -c "isTutorialMode\|isSandboxMode" src/pc/engine/BeerCrusherEngine.ts` — getter 정의만(2)
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
refactor(engine): mode rules table replaces tutorial/sandbox branches

Plan: 2026-11-07-two-player-coop
Phase: P01-solo-foundation
Task: T02-mode-rules

- GAME_TUNING.modeRules[game|tutorial|sandbox] holds the rules that used to be if-branches
- Engine keeps one mode field and reads modeRules; isTutorialMode/isSandboxMode stay as read-only getters
- No behavior change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
