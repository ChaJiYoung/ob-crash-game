# Task: T01 Engine Invincible and Debug Start

## Status: pending

## Goal
엔진이 디버그 설정을 받으면 (1) 목숨이 줄지 않고 GAMEOVER가 나지 않지만 피격 수는 센다, (2) 무기 선택 직후 시작 조건(W6/EX, 레벨, 카드)을 적용한다, (3) EX에서 DANGER별 피격을 집계해 `PlayRunStats.exDangers`로 내보낸다.

## Decision Summary
- D02: 무적이지만 `damageTaken`·`waveDamageTaken`은 평소처럼 증가. 보스 돌파는 평소처럼 `PLAYER_MAX_LIVES`만큼 센다.
- D05: 무기 종류는 기존 인게임 무기 선택(사격으로 고름)을 그대로 쓰고, 그 라운드가 끝나는 순간 시작 조건을 적용한다. EX 시작은 `enterExRush`가 EX D04 MAX를 강제한다.

## Implementation

### I01. 디버그 필드와 무적

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `debugInvincible`, `debugStart`(new public fields), `update`의 `case 'damageLives'`(1569~1583행); modify

#### Details
- 필드(`mainCleared` 331행 근처):
  ```typescript
  /** 디버그 판: 목숨이 줄지 않는다(피격 수는 센다). startGame이 지우지 않는다 — PCGamePage가 판마다 설정한다. */
  public debugInvincible = false;
  /** 디버그 판 시작 조건. 무기 선택 라운드가 끝날 때 한 번 적용된다. null이면 일반 판. */
  public debugStart: DebugStartConfig | null = null;
  private debugStartApplied = false;
  /** EX DANGER별 피격(인덱스 = danger). */
  private exDangerDamage: number[] = [];
  ```
- `startGame`: `this.debugStartApplied = false; this.exDangerDamage = [];` 추가(`resetExState()` 근처). `debugInvincible`·`debugStart`는 건드리지 않는다.
- `damageLives` 분기 교체:
  ```typescript
  const damage = ...; // 기존 그대로
  const invincible = this.debugInvincible && this.mode === 'game';
  const dealt = invincible ? Math.min(this.maxLives, damage) : Math.min(this.lives, damage);
  this.damageTaken += dealt;
  this.waveDamageTaken += dealt;
  if (this.isExActive) this.exDangerDamage[this.exDanger] = (this.exDangerDamage[this.exDanger] ?? 0) + dealt;
  if (!invincible) {
    this.lives = Math.max(0, this.lives - damage);
    if (this.lives <= 0) { this.gamePhase = 'GAMEOVER'; return { ... }; } // 기존 return 그대로
  }
  break;
  ```
- **함정**: 튜토리얼·샌드박스(`mode !== 'game'`)에는 무적을 적용하지 않는다(디버그 URL로 튜토리얼에 들어가도 기존 동작 유지).

### I02. 디버그 시작 적용

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `finishSelectRound`(2205행), `applyDebugStart`(new private); modify

#### Details
- `finishSelectRound` 맨 끝(`if (isRewardRound) {...}` 다음)에:
  ```typescript
  if (!isRewardRound && this.mode === 'game' && this.debugStart && !this.debugStartApplied) {
    this.debugStartApplied = true;
    this.applyDebugStart(this.debugStart, nowMs);
  }
  ```
- `applyDebugStart(cfg: DebugStartConfig, nowMs: number): void`:
  1. `cfg.startAt === 'EX'`: `this.currentWave = STAGE_CONSTANTS.TOTAL_WAVES; this.enterExRush(nowMs); return;` (MAX 강화·체크포인트 조건 `mainCleared = true` 모두 기존 경로로 처리)
  2. 그 외 모든 플레이어 `p`에 대해 `applyExMaxUpgrades`와 같은 `step` 패턴으로 `applyRewardCard(kind, nowMs, p.index)`를 반복:
     - `weapon_level_up`: `weaponLevel < cfg.weaponLevel`
     - `rapid_reload`: `getRapidReloadStacks() < cfg.cards.rapid_reload`
     - `lucky_drop`: `luckyDropStacks < cfg.cards.lucky_drop`
     - `damage_up` / `skill_cooldown` / `fever_extend` / `hit_zone_up`: `cardStacks[k] < cfg.cards[k]`
     - `applyRewardCard`는 `cardPicks`에 기록하지 않으므로 카드 선택 기록은 오염되지 않는다.
  3. `cfg.startAt === 'W6'`: `this.startWave(6); this.waveStartMs = null;`(웨이브 시간 보너스가 W1 시작 시각 기준으로 계산되지 않게. `waveStartMs`가 다음 update에서 설정되는 기존 흐름을 확인 후 동일하게 맞춤) 
- **함정**: `applyRewardCard('weapon_level_up')`이 `weaponLevelCapByWave`를 검사한다면 W1 시점 cap에 막힐 수 있다 → 구현 시 `applyRewardCard` 본문을 확인하고, cap 검사가 있으면 `player.weaponSystem.upgradeWeaponLevel()`을 직접 호출하도록 분기.
- **함정**: 2인 판은 두 플레이어 모두 `selectionDone`일 때만 `finishSelectRound`가 불리므로, 적용 시점에 둘 다 무기가 정해져 있다.

### I03. `exDangers` 통계

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `getPlayRunStats`(2353행); modify

#### Details
- `mainCleared`이면 `stats.exDangers = this.exDangerDamage.map((d, danger) => ({ danger, damageTaken: d ?? 0 })).filter((e) => e.danger >= 1 && e.danger <= this.exDanger)` — 피격 0인 DANGER도 `this.exDanger`까지 0으로 채운다(`for (let n = 1; n <= this.exDanger; n++)`로 구현).
- 새 public getter(결과 화면용): `public getExDangerDamage(): { danger: number; damageTaken: number }[]` — 위와 같은 배열.

### I04. 테스트

- Related Files:
  - `tests/debug-engine.test.ts` — new

#### Details
- 기존 엔진 테스트(`tests/ex-rush.test.ts`, `tests/engine-wave-damage-and-weapon-hook.test.ts`)의 몬스터 돌파 유발 방식을 그대로 재사용.
- 무적: `debugInvincible = true`, 몬스터 5마리 돌파 → `lives === maxLives`, `damageTaken === 5`, `gamePhase === 'PLAYING'`. 보스 돌파 → `damageTaken += PLAYER_MAX_LIVES`, GAMEOVER 아님.
- 무적 끔: 기존처럼 GAMEOVER(회귀).
- W6 시작: `debugStart = { startAt:'W6', weaponLevel:3, cards:{damage_up:2,...,hit_zone_up:2} }`, `startGame({withWeaponSelect:true})` → 무기 선택 사격 → `currentWave === 6`, weaponLevel 3, cardStacks 일치, `cardPicks` 비어 있음.
- EX 시작: `isExActive === true`, `mainCleared === true`, weaponLevel 4, `getPlayRunStats(0, {allowExCheckpoint:true}).waveReached === 8`.
- 2인 W6: 두 플레이어 모두 레벨·카드 적용.
- EX DANGER 피격: EX 중 돌파 2회(DANGER 1) → `getExDangerDamage()`에 `{danger:1, damageTaken:2}`.

## Acceptance Criteria
- [ ] 디버그 판에서 목숨이 줄지 않고 GAMEOVER가 없으며 `damageTaken`·웨이브별·DANGER별 피격은 쌓인다.
- [ ] W6/EX 시작과 레벨·카드가 무기 선택 직후 적용된다(1인·2인).
- [ ] 일반 판 동작은 기존 테스트 전체 통과로 유지된다.

## Validation
- `npx vitest run tests/debug-engine.test.ts tests/ex-rush.test.ts tests/engine-wave-damage-and-weapon-hook.test.ts tests/play-run-stats.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 에러 0

## Commit Message
```text
feat(engine): add debug invincibility, debug start presets and EX danger damage stats

Plan: 2026-11-17-debug-mode
Phase: P02-engine-debug-play
Task: T01-engine-invincible-and-debug-start

- I01: keep lives on breach in debug games while still counting damage
- I02: apply debug start point, weapon level and card stacks after weapon select
- I03: export per-danger EX damage as PlayRunStats.exDangers
- I04: test invincibility, W6/EX debug starts and danger damage
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
