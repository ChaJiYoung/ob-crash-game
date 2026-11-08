# Task: T01 엔진 웨이브별 피격 집계와 무기 선택 훅

## Status: done

## Goal
엔진이 (1) 웨이브를 클리어할 때 그 웨이브에서 입은 피해를 `waveClears[].damageTaken`으로 남기고, (2) 플레이어가 무기를 고르는 순간 외부에 알릴 콜백 `onWeaponChosen`을 부른다. (1)은 `PlayRunStats.waves[].damageTaken`으로 서버에 가서 `game_waves.damage_taken`이 되고(D06), (2)는 P02-T02에서 `WEAPON_CHOSEN` 전송에 쓰인다(D03).

## Decision Summary
- D06: 웨이브별 피격 수는 판 단위다. 엔진의 `damageTaken`은 플레이어별이 아니라 엔진 전역 값이므로, 같은 웨이브 값이 모든 플레이어의 `waveClears`에 똑같이 들어간다.
- D03: 무기 선택은 직접 쏴서 고르는 경우와 이탈자 자동 선택(`autoPickFor`) 둘 다 알려야 한다. 그래서 두 경로가 공통으로 지나는 `applySelection`에서 콜백을 부른다.
- `onWeaponChosen`은 이 Task에서 선언만 하고 호출부(PC)는 P02-T02에서 연결한다. 엔진 단위 테스트가 콜백 호출을 직접 검증하므로 이 Task만으로 검증 가치가 있다.

## Implementation

### I01. 웨이브별 피격 집계
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` (`damageTaken` 필드 근처 376행, `startGame` 525행 리셋, `damageLives` 처리 1445행, `awardWaveTimeBonus` 2074행 근처); modify
  - `src/pc/engine/PlayerCombatState.ts` :: `PlayerCombatState.waveClears` (21행); modify
#### Details
- **Signatures & Types**:
  ```typescript
  // PlayerCombatState
  public waveClears: { wave: number; seconds: number; bonus: number; damageTaken: number }[] = [];

  // BeerCrusherEngine
  /** 현재 웨이브에서 입은 피해. 웨이브 클리어 기록에 넣은 뒤 0으로 돌린다. */
  private waveDamageTaken = 0;
  ```
- **Execution Flow / Logic**:
  1. 피해 처리(현재 `this.damageTaken += Math.min(this.lives, damage);`)를 다음으로 바꾼다:
     ```typescript
     const dealt = Math.min(this.lives, damage);
     this.damageTaken += dealt;
     this.waveDamageTaken += dealt;
     ```
     `this.lives` 감소보다 **앞에서** 계산해야 한다(기존 순서 유지).
  2. `awardWaveTimeBonus`의 `p.waveClears.push({ wave: this.currentWave, seconds, bonus: paid })`를 `{ wave: this.currentWave, seconds, bonus: paid, damageTaken: this.waveDamageTaken }`로 바꾸고, `for` 루프가 끝난 뒤 `this.waveDamageTaken = 0;`. 루프 안에서 0으로 만들면 2인 판의 두 번째 플레이어 기록이 0이 된다.
  3. 리셋: 파일 안에서 `this.damageTaken = 0`이 있는 모든 곳(현재 `startGame` 525행)에 `this.waveDamageTaken = 0;`을 함께 넣는다. `grep -n "damageTaken = 0" src/pc/engine/BeerCrusherEngine.ts`로 빠짐없이 확인한다.
  4. `getPlayRunStats`(2129행)의 `waves: player.waveClears.map((w) => ({ ...w, seconds: Number(w.seconds.toFixed(2)) }))`는 스프레드로 `damageTaken`이 함께 나가므로 수정할 필요가 없다. 타입은 P01-T02에서 `damageTaken?: number`로 넓혀 두었다.
- 함정: 웨이브 도중 GAMEOVER가 나면 그 웨이브는 `awardWaveTimeBonus`를 지나지 않아 `waveClears`에 없다. 마지막 웨이브의 피해는 웨이브 기록에 남지 않고 판 전체 `damageTaken`에만 남는다. 이것은 기존 `waves` 의미(클리어한 웨이브만)와 같으므로 고치지 않는다.

### I02. 무기 선택 훅
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `onWeaponChosen`(new 필드), `applySelection`(1938행); modify
#### Details
- **Signatures & Types**:
  ```typescript
  /** 플레이어가 무기를 고른 순간(직접 선택·이탈자 자동 선택 모두) 불린다. PC가 서버에 WEAPON_CHOSEN을 보내는 데 쓴다. */
  public onWeaponChosen: ((playerIndex: PlayerIndex, weaponKind: WeaponKind) => void) | null = null;
  ```
- `applySelection`의 무기 분기:
  ```typescript
  if (target.weaponSelectKind) {
    player.weaponSystem.selectWeapon(target.weaponSelectKind, 1);
    player.lastPick = { weapon: target.weaponSelectKind, auto };
    this.onWeaponChosen?.(playerIndex, target.weaponSelectKind);
  }
  ```
- 콜백 예외가 엔진 루프를 깨지 않도록 `try { ... } catch (err) { console.error('onWeaponChosen failed', err); }`로 감싼다.
- 공개 메서드 `selectWeapon(kind, level, playerIndex)`(1934행, 테스트·샌드박스용 직접 지정)에서는 부르지 **않는다**. 실제 판의 선택 라운드를 거친 선택만 서버에 알린다.

### I03. 테스트
- Related Files:
  - `tests/engine-wave-damage-and-weapon-hook.test.ts`; new
#### Details
- 웨이브 진행은 `tests/wave-time-bonus.test.ts`의 `finishEmptyWave(engine, startMs, endMs)` 패턴을 복사해 쓴다(`engine.update(start)`로 웨이브 시계 시작 → `spawnedInWave = totalSpawns`, `activeTargets = []`, `bossSpawned = true` → `engine.update(end)`).
- 피해 발생은 `tests/play-run-stats.test.ts`의 "counts real damage" 패턴을 쓴다(바닥선을 넘는 `pilgood` 타깃 하나를 `activeTargets`에 넣고 `update`).
- 케이스:
  1. `startGame({ withWeaponSelect: false })` → 웨이브 1에서 피해 1 → 웨이브 1 클리어 → `waveClears[0].damageTaken === 1`. 이어서 웨이브 2를 피해 없이 클리어 → `waveClears[1].damageTaken === 0`.
  2. 2인 판(`startGame({ withWeaponSelect: false, playerCount: 2 })`)에서 웨이브 1 피해 1 → 두 플레이어의 `waveClears[0].damageTaken`이 모두 1.
  3. `startGame` 재호출 뒤 첫 웨이브 기록의 `damageTaken`이 0부터 시작(이전 판 잔여값 없음).
  4. `getPlayRunStats().waves[0].damageTaken`이 `waveClears` 값과 같다.
  5. `onWeaponChosen` 직접 선택: `startGame({ withWeaponSelect: true })` 후 `tests/select-round-players.test.ts` 173~175행처럼 무기 타깃을 조준해 `shootCardSelect` → 콜백이 `(0, 그 타깃의 weaponSelectKind)`로 1번 불린다.
  6. `onWeaponChosen` 자동 선택: 2인 판 무기 라운드에서 `engine.autoPickFor(1, nowMs)` → 콜백이 `(1, kind)`로 불린다.
  7. 카드 선택(`rewardCardKind`)에서는 불리지 않는다. 콜백이 던져도 `shootCardSelect`가 정상 반환한다.

## Acceptance Criteria
- [ ] 클리어한 각 웨이브 기록에 그 웨이브의 피해 수가 들어가고, 다음 웨이브는 0부터 센다.
- [ ] 직접·자동 무기 선택 모두 `onWeaponChosen`이 정확히 1번 불린다.
- [ ] 기존 엔진 테스트(`play-run-stats`, `wave-time-bonus`, `select-round-players` 등)가 그대로 통과한다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/engine-wave-damage-and-weapon-hook.test.ts tests/play-run-stats.test.ts tests/wave-time-bonus.test.ts tests/select-round-players.test.ts` — 전부 통과
- `npm test` — 전부 통과

## Commit Message
```text
feat(engine): 웨이브별 피격 수 집계와 무기 선택 알림 훅 추가

Plan: 2026-11-08-sqlite-db-design
Phase: P02-client-integration
Task: T01-engine-wave-damage-and-weapon-hook

- 웨이브 클리어 기록(waveClears)에 그 웨이브의 피격 수 damageTaken을 남기고 웨이브마다 초기화
- applySelection에서 무기를 고르면 onWeaponChosen(playerIndex, weaponKind) 호출(직접·자동 선택 공통)
- 웨이브 피격 집계·2인 판·재시작 초기화·무기 훅 호출 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `c1dfec4`
