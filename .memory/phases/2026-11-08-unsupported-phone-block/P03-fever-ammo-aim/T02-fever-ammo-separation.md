# Task: T02 피버·탄창 분리

## Status: pending

## Goal
피버를 켜도 탄창이 충전되지 않게 한다. 피버 중에는 총알을 소모하지 않지만(무한 탄창 유지) 탄창 수와 장전 상태는 그대로 두고, 장전이 진행 중이면 피버 중에도 계속 진행된다. 스킬이 피버·탄창과 독립임을 테스트로 고정한다.

## Decision Summary
- 결정 문서 [2026-11-08-fever-ammo-and-aim-source](../../../decisions/2026-11-08-fever-ammo-and-aim-source.md) D01(탄창 분리, 장전은 피버 중에도 진행: 사용자가 "그대로 맞다"고 재확인), D02(스킬은 별개, 코드 변경 없이 테스트로 고정).
- 현재 충전이 일어나는 곳은 두 군데다: (1) `BeerCrusherEngine.activateFever`가 `weaponSystem.refillAmmoOnFever()`를 부른다(약 1003행). (2) `WeaponSystem.update()`의 `if (isFeverActive) { this.isReloading = false; this.ammo = this.getMaxAmmo(); return ... }` 분기가 피버 중 매 프레임 탄창을 최대로 맞춘다(약 227~231행). 둘 다 없앤다.
- 유지할 것: 피버 중 총알 소모 면제는 `canFire`(`this.infiniteAmmo || isFeverActive`이면 `true`)와 `consumeShot`이 이미 맡는다. 연사 간격(`fireInterval`)도 그대로 둔다.
- 함정: `consumeShot`의 피버 분기는 `{ fired: true, ammo: this.getMaxAmmo(), isReloading: false }`를 돌려주는데, 이제 실제 상태와 어긋나는 가짜 값이다. 실제 `this.ammo`/`this.isReloading`을 돌려줘야 하고, 이 반환값을 읽는 곳(`BeerCrusherEngine.shootAtInner`와 호출자)이 가짜 "가득 참"에 의존하지 않는지 확인해야 한다.

## Implementation

### I01. 무기 시스템에서 피버 충전 제거
- Related Files:
  - `src/pc/engine/WeaponSystem.ts` :: `refillAmmoOnFever`(삭제), `update`(피버 분기 삭제, `isFeverActive` 인자 삭제), `consumeShot`(피버 분기 반환값 수정); modify

#### Details
- **Signatures & Types**:
  ```typescript
  // refillAmmoOnFever() 메서드 전체 삭제

  public update(nowMs: number, deltaMs?: number): { reloadedJustNow: boolean }

  public consumeShot(...): { fired: boolean; ammo: number; isReloading: boolean }
  // 피버/무한 탄창 분기:
  if (this.infiniteAmmo || isFeverActive) {
    // 총알은 줄지 않는다. 탄창 수와 장전 상태는 그대로 돌려준다.
    return { fired: true, ammo: this.ammo, isReloading: this.isReloading };
  }
  ```
- **Execution Flow / Logic**:
  1. `update`에서 `if (isFeverActive) { ... return { reloadedJustNow: false }; }` 블록을 삭제한다. 그러면 피버 중에도 `if (this.isReloading && nowMs >= this.reloadEndTimeMs)`가 실행돼 장전이 끝나면 `ammo = max`, `reloadedJustNow: true`가 된다. 스킬 쿨다운 갱신은 이 블록 앞에 있어 그대로다.
  2. `update`의 두 번째 인자 `isFeverActive`를 삭제해 `update(nowMs, deltaMs?)`로 바꾼다. 호출부는 `BeerCrusherEngine.ts`(약 1307행 `p.weaponSystem.update(nowMs, feverState.isFeverActive, dtSec * 1000)`, 약 2545행 `advanceBossClear`)와 테스트들이다. `npx tsc --noEmit`이 알려 주는 호출부를 모두 `update(nowMs, dtSec * 1000)`로 고친다.
  3. `consumeShot` 피버 분기에서 `this.lastFireTimeMs = nowMs;`는 그 앞줄에서 이미 갱신된다. 반환값만 실제 상태로 바꾼다. `infiniteAmmo`(샌드박스) 경우도 같은 분기이므로 샌드박스에서도 탄창 값은 실제 값이 돌려진다(샌드박스는 `ammo`가 줄지 않으므로 항상 `max`일 것이다).
  4. 함정: `canFire`는 `isFeverActive`면 `isReloading` 검사 전에 `true`를 돌려준다(장전 중에도 피버 중에는 쏠 수 있다). 이 동작을 유지한다.

### I02. 엔진에서 피버 시작 충전 호출 제거
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `activateFever`(약 998~1008행) — `player.weaponSystem.refillAmmoOnFever();` 한 줄 삭제; `update` 호출부 2곳 인자 정리; modify

#### Details
- `activateFever`의 나머지(`prevFeverActive`, `feverStarted` 이벤트)는 그대로다. `TutorialDirector`가 `feverStarted`를 받아 4단계 몬스터를 소환하는 흐름(`src/pc/tutorial/TutorialDirector.ts` 약 164행)은 탄창과 무관해 영향이 없다.
- `consumeShot`의 반환값을 쓰는 곳을 `grep -n "consumeShot" src/pc/engine/BeerCrusherEngine.ts`로 찾아, 반환된 `ammo`/`isReloading`으로 "장전 시작" 판단·효과음을 내는 코드가 있으면 피버 중 가짜 값에 의존하지 않는지 확인한다(이제 실제 값이므로 오히려 맞아진다).

### I03. 테스트
- Related Files:
  - `tests/fever-ammo-separation.test.ts` :: new
  - 기존 테스트 중 `weaponSystem.update(` 호출과 "피버 시작 시 탄창 가득"을 기대하던 단언; modify (`grep -rn "weaponSystem.update\|\.update(.*true\|refill" tests`로 찾는다)

#### Details
엔진 생성·피버 활성화 방식은 `tests/weapon-rules.test.ts`의 `damageOf` 헬퍼(`new BeerCrusherEngine`, `getPlayer(0).scoreManager.forceSetFeverGauge(100)` 후 `engine.activateFever(nowMs)`)를 따라 만든다.
1. **피버가 탄창을 채우지 않는다**: 탄창을 일부 소모(예: 최대 30 중 12 남김)한 뒤 `activateFever` → `weaponSystem.getState().ammo`가 12 그대로. 피버 중 3발 발사 → 여전히 12. 피버가 끝난 뒤(`updateFeverTimer`로 만료) → 12.
2. **빈 탄창 + 장전 중 피버**: 탄창을 0까지 소모해 `isReloading === true`. `activateFever` 직후 `isReloading`이 그대로 `true`, `ammo`가 0. 피버 중에도 `canFire`는 `true`(쏠 수 있음)이고 발사해도 `ammo`는 0 그대로.
3. **피버 중 장전 진행/완료**: 위 상태에서 `update`를 `reloadEndTimeMs` 이후로 진행 → `reloadedJustNow === true`, `ammo === max`, `isReloading === false`(피버가 켜져 있어도). 장전 도중 피버가 끝나도 장전이 이어져 완료된다.
4. **피버 중 `consumeShot` 반환값**: `{ fired: true, ammo: <실제 값>, isReloading: <실제 값> }`.
5. **스킬 독립(D02)**: (a) 피버 켜기 전후 `skillStock`/`skillCooldownRemainingMs`가 같은 속도로 진행(피버가 충전·정지하지 않는다) (b) 탄창 0·장전 중에도 `triggerWeaponSkill`이 스택이 있으면 발동 (c) 피버 중에도 발동·스택 소모가 평소와 같다 (d) `activateFever`가 `skillStock`을 바꾸지 않는다.
6. 기존 테스트가 `update(nowMs, true, dt)` 형태나 "피버 시작 시 탄창 가득"을 기대하면 새 규칙으로 고친다.

## Acceptance Criteria
- [ ] 피버를 켜도 탄창 수가 변하지 않고, 피버가 끝나도 켜기 전 값에서 이어진다.
- [ ] 장전 중 피버를 켜도 장전이 취소되지 않고 끝까지 진행되어 탄창이 찬다.
- [ ] 피버 중에는 쏴도 탄창이 줄지 않는다(무한 탄창 유지).
- [ ] 스킬 충전·발동이 피버·탄창 상태와 무관하다는 테스트가 있다.

## Validation
- `npx vitest run tests/fever-ammo-separation.test.ts tests/weapon-rules.test.ts tests/tutorial-director.test.ts tests/score-fever-multiplier.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
fix(weapon): 피버가 탄창을 충전하던 문제 수정, 피버와 탄창 분리

Plan: 2026-11-08-unsupported-phone-block
Phase: P03-fever-ammo-aim
Task: T02-fever-ammo-separation

- I01: refillAmmoOnFever와 update()의 피버 충전 분기 삭제, consumeShot이 실제 탄창 상태 반환
- I02: activateFever의 시작 충전 호출 제거, update 호출 인자 정리
- I03: 탄창 보존·장전 진행·스킬 독립 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
