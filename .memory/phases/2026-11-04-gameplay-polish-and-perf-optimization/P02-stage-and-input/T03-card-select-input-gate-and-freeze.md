# Task: T03 Card Select Input Gate and Freeze

## Status: pending

## Goal
카드 선택 중에는 연사와 피버 자동 발사가 카드를 고르지 못하게 하고, 게임 시간 전체를 멈춘다.

## Decision Summary
- D07: 뗐다가 새로 누른 한 발로만 선택한다. 0.8초 입력 잠금을 유지하고, 카드 밖 사격은 탄약을 쓰지 않는다.
- 자동 발사 경로가 3개(모바일 연타, 피버, 마우스 홀드)이므로 모든 발사가 지나는 `engine.shootAt`에서 막는다.
- 카드 선택 중 피버, 버프, 스킬 쿨다운, 재장전, 스폰 시간을 멈춘다. PC 키의 스킬·피버 발동도 막는다.

## Implementation

### I01. 입력 종류

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ShotSource`, `isCardSelectPending`, `shootAt` — 입력 게이트; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type ShotSource = 'press' | 'hold' | 'fever';

  public get isCardSelectPending(): boolean {
    return this.isWeaponSelectPending || this.isRewardCardPending;
  }

  public shootAt(aimX: number, aimY: number, nowMs: number, source: ShotSource = 'press'): EngineShootResult;
  private shootCardSelect(aimX: number, aimY: number, nowMs: number): EngineShootResult;
  ```
- **Execution Flow / Logic**:
  1. `shootAt`에서 일시정지·게임 단계 검사 뒤, `consumeShot` **앞**에 넣는다.
     ```typescript
     if (this.isCardSelectPending) {
       if (source !== 'press') return { fired: false, grade: 'MISS' };
       return this.shootCardSelect(aimX, aimY, nowMs);
     }
     ```
  2. `shootCardSelect`:
     - `weaponSelectKind` 또는 `rewardCardKind`가 있는 대상만 검사한다. 판정 계산은 일반 사격과 같다.
     - 맞은 카드가 없거나 `rewardCardsSpawnTimeMs > 0 && nowMs - rewardCardsSpawnTimeMs < 800`이면 `{ fired: false, grade: 'MISS' }`를 반환한다. 탄약을 쓰지 않고 이펙트도 없다.
     - 맞으면 기존 `// 1. Shoot-to-Select Weapon Target`과 `// 2. Shoot-to-Select Reward Card Target` 코드를 이쪽으로 옮겨 처리한다.
  3. 기존 카드 선택의 시간 보정 블록(`// Compensate fever & buff timers`, `:1309-1318`)을 지운다. I02가 대체한다.
  4. 튜토리얼과 샌드박스의 기존 동작은 바꾸지 않는다. 카드가 없으면 게이트를 지나지 않는다.

### I02. 전체 정지

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `update`, `freezeTimers`, `activateFever`, `triggerWeaponSkill` — 시간 정지; modify

#### Details
- **Signatures & Types**:
  ```typescript
  private freezeTimers(deltaMs: number): void;
  ```
- **Execution Flow / Logic**:
  1. `update`에서 일시정지·단계 검사 직후, 버프 만료 정리와 `weaponSystem.update` **앞**에 넣는다.
     ```typescript
     if (!this.isTutorialMode && !this.isSandboxMode && this.isCardSelectPending) {
       this.freezeTimers(dtSec * 1000);
       return { breaches: [], phaseChanged: false, reloadedJustNow: false };
     }
     ```
  2. `freezeTimers`는 아래 값을 `deltaMs`만큼 뒤로 민다.
     - `activeBuffUntilMs`의 모든 값
     - `scoreManager.shiftFeverTimer(deltaMs)`
     - `weaponSystem.shiftReloadTimer(deltaMs)`
     - `lastSpawnTimeMs`, `lastProjectileSpawnTimeMs`, `lastBossSummonTimeMs` (0이면 그대로)
  3. 기존 `// Freeze active monsters...` 블록(`:869-872`)은 중복이므로 지운다.
  4. 스킬 쿨다운은 `weaponSystem.update`를 호출하지 않으면 멈춘다. 호출부가 `deltaMs`를 넘기므로 복귀 뒤 한꺼번에 줄지 않는다.
  5. `activateFever`: 대기 중이면 `false` 반환. `triggerWeaponSkill`: 대기 중이면 `activated: false` 반환.
  6. `updateFeverTimer`는 정지 중 호출되지 않으므로 고르는 동안 피버가 꺼지지 않는다.

### I03. 호출부

- Related Files:
  - `src/pc/PCGamePage.tsx` :: 스냅 발사, 연사 타이머, 피버 타이머, 테스트 사격 — 입력 종류 전달; modify
  - `src/pc/components/GameCanvas3D.tsx` :: `executeShot`, `handleMouseDown` — 입력 종류 전달; modify

#### Details
- `PCGamePage.tsx`:
  - 스냅 발사(`:405`): `'press'`
  - 연사 타이머(`:415`): `'hold'`
  - 피버 타이머(`:526`): `'fever'`
  - `onTestFireShot`(`:1024`): `'press'`
- 피버 타이머 조건에 `&& !engine.isCardSelectPending`을 추가해 대기 중에는 타이머를 지운다. 카드 선택 뒤 피버가 남아 있으면 HUD Tick이 다시 시작한다.
- 스냅 스킬(`p.skillSnapTriggered`)의 기존 대기 검사는 유지한다.
- `GameCanvas3D.tsx`:
  ```typescript
  const executeShot = (source: ShotSource) => { /* ... engine.shootAt(curAim.aimX, curAim.aimY, now, source) ... */ };
  // handleMouseDown: executeShot('press'), 인터벌 안은 executeShot('hold')
  ```
- **테스트 영향**: 기존 테스트의 3인자 `shootAt`은 기본값 `'press'`로 동작한다.

### I04. 테스트

- Related Files:
  - `tests/card-select-gate.test.ts` :: 입력 게이트와 정지 검증; new
  - `tests/engine-judgment-and-spawn.test.ts` :: 조기 사격 검사 갱신; modify

#### Details
- **새 테스트 시나리오**:
  - 카드 대기 중 `'hold'`, `'fever'`로 카드를 정확히 쏴도 `fired === false`이고 대기가 유지된다.
  - 0.8초가 지난 뒤 `'press'`로 카드를 쏘면 선택된다.
  - 0.8초 안의 `'press'`는 `fired === false`이고 탄약이 그대로다.
  - 카드 밖 `'press'`는 탄약이 줄지 않는다.
  - 대기 중 `update`를 10초 돌려도 스킬 쿨다운, 피버 남은 시간, 버프 남은 시간이 그대로이고, 카드 선택 뒤 이어서 줄어든다.
  - 피버 남은 시간이 1초일 때 10초 대기해도 피버가 꺼지지 않는다.
  - 대기 중 `activateFever`, `triggerWeaponSkill`이 동작하지 않는다.
- `tests/engine-judgment-and-spawn.test.ts`의 `earlyShot.fired`를 `false`로 바꾼다.

## Acceptance Criteria
- [ ] 마우스나 폰을 누른 채 카드가 떠도 저절로 선택되지 않는다.
- [ ] 피버 중 카드가 떠도 자동 발사로 선택되지 않고, 고른 뒤 남은 피버가 이어진다.
- [ ] 뗐다가 다시 누르면 선택된다.
- [ ] 카드를 고르는 동안 쿨다운과 버프가 줄지 않는다.

## Validation
- `npx vitest run tests/card-select-gate.test.ts tests/gameplay-polish.test.ts tests/engine-judgment-and-spawn.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
fix(engine): gate card selection to fresh presses and freeze all timers

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P02-stage-and-input
Task: T03-card-select-input-gate-and-freeze

- Add ShotSource and block hold and fever shots while cards are pending
- Keep ammo on card selection shots
- Freeze fever, buff, skill, reload, and spawn timers during selection
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
