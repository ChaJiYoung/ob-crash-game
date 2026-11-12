# Task: T03 급발진과 체력 규칙

## Status: done

## Goal
찰랑이 3번째 등장(`rushAfterAppearances`)부터 방어선까지 평소 속도의 3배로 달려오며, 그 동안에는 다시 잠수하지 않는다. 수면 위 피격은 기존 몬스터와 같은 무기 피해 규칙으로 체력을 줄이고, 물속에서는 체력이 회복되지 않는다.

## Decision Summary
- D05: 3번 등장하면 급발진, 방어선에 닿을 때까지 속도 유지(한 번만 발동).
- D06(수정): 체력 3. 피해는 기존 몬스터와 같은 무기 피해 규칙을 그대로 쓴다(사용자 선택). 물속 회복 없음(D10 가정).
- D07: 급발진 속도는 평소의 3배.
- A5(수정): 찰랑 전용 피해 오버라이드를 두지 않는다. `shootAtInner`와 `applySkillDamage`의 기존 피해 계산을 그대로 쓴다.
- A6/A7: 스킬 피해도 기존 경로를 쓴다. 급발진 중에는 잠수하지 않는다.
- 급발진은 기존 `pilgood` 돌진(거리 기반, `effectiveSpeed *= chargeSpeedMult`)과 같은 자리에서 배율을 곱한다. 트리거만 다르다(등장 횟수).

## Implementation

### I01. 등장 3회 급발진 트리거

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `updateChalangSubmerge`(T02 I02 신규 메서드) — 순간이동 직후 급발진 판정 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: 이동 루프 속도 배율 블록(`pilgood` 돌진 `if` 블록, line 1386 부근) — `chalang` 급발진 배율 추가; modify

#### Details
- **Execution Flow / Logic**:
  1. `updateChalangSubmerge`의 순간이동 분기(T02 I02 3-b, 물속 시간 종료 시점)에서, `appearanceCount`를 올린 직후 다음을 추가한다:
     ```ts
     if ((t.appearanceCount ?? 1) >= GAME_TUNING.monsters.chalang.rushAfterAppearances) {
       t.isRushing = true;
       t.submergedUntilMs = undefined;
       t.surfacedUntilMs = undefined;
       return false; // 바로 수면 위에서 급발진 시작
     }
     ```
     즉 3번째 등장(스폰 1회 + 순간이동 2회)에서 급발진이 켜진다(A3).
  2. 속도 배율 블록: 기존 `pilgood` 블록(`if (target.kind === 'pilgood' && isPlainMonster && isRegularPlay && !isStunned && …) effectiveSpeed *= …`) 바로 아래에 추가한다:
     ```ts
     if (target.kind === 'chalang' && target.isRushing && isPlainMonster && !isStunned) {
       effectiveSpeed *= GAME_TUNING.monsters.chalang.rushSpeedMult;
     }
     ```
     `isPlainMonster`, `isStunned` 변수는 같은 루프 안에 이미 있으므로 재계산하지 않는다.
  3. 급발진 중 `isRushing`이 true이면 T02의 `updateChalangSubmerge` 첫 분기(a)에서 `false`가 되어 계속 전진한다.
- **Error & Exception Handling**: 스턴(`isStunned`)일 때는 배율을 곱하지 않는다(`effectiveSpeed`가 0이므로 곱해도 0이지만, 조건을 명시해 의도를 드러낸다).

### I02. 피해 경로 확인 (코드 변경 없음)

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAtInner` 표준 피해 계산(`let damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));`, line 2318 부근) — 변경 없음; read-only
  - `src/pc/engine/BeerCrusherEngine.ts` :: `applySkillDamage`(line 2513) — 변경 없음; read-only

#### Details
- 찰랑은 `kind === 'chalang'`에 대한 별도 분기를 두지 않는다. 기존 피해 계산이 모든 몬스터에 같은 방식으로 적용된다.
- 이 Task는 피해 코드를 건드리지 않는다. 대신 I03 테스트가 찰랑도 기존 `hanmac`/`bottle`과 같은 피해 공식을 따르는지 확인한다.
- 물속 상태에서는 명중 후보가 아니므로(T02) 피해 경로가 실행되지 않는다.

### I03. 급발진·피해 경로·회복 없음 테스트

- Related Files:
  - `tests/chalang-monster.test.ts` :: 새 describe 블록 `chalang rush and hp`; modify

#### Details
- 케이스:
  1. 등장 3회째(`appearanceCount` 2에서 순간이동 발생)에 `isRushing === true`가 된다. 이후 `submergedUntilMs`는 `undefined`로 유지된다(다시 잠수하지 않음).
  2. 급발진 중 1틱 이동량은 같은 `speedMps`의 수면 위 이동량의 3배다(`Δradius` 비교, 허용 오차 1e-6).
  3. 스턴 상태(`stunUntilMs > now`)에서는 급발진해도 `radiusM`이 변하지 않는다.
  4. 피해 경로 동일: 수면 위 찰랑에 맞힌 피해량이 같은 조건의 `hanmac`과 같은 공식(`levelSpec.damagePerHit × totalMult`)을 따른다. 무기 배율을 키우면 찰랑 `hp` 감소량도 함께 커진다.
  5. 스킬 피해 경로 동일: `applySkillDamage(t, 99, now, 0)`에서 찰랑 `hp`가 기존 몬스터와 같은 규칙(`max(0, hp - damage)`, 소수 셋째 자리 반올림)으로 줄어든다.
  6. 회복 없음: 물속/수면 시간을 여러 번 지나도 `hp`가 증가하지 않는다.

## Acceptance Criteria
- [ ] 3번째 등장부터 `isRushing`이 되고 그 뒤 다시 잠수하지 않는다.
- [ ] 급발진 속도가 수면 위 이동의 정확히 3배다.
- [ ] 찰랑의 수면 위 피해는 기존 몬스터와 같은 무기 피해 공식을 따른다.
- [ ] 스킬 피해도 기존 몬스터와 같은 규칙을 따른다.
- [ ] 체력이 회복되는 경로가 없음을 테스트가 보장한다.
- [ ] 기존 몬스터의 피해 계산(`hanmac`, `bottle` 등)이 바뀌지 않는다(코드 변경 없음).

## Validation
- `npx vitest run tests/chalang-monster.test.ts` — rush/hp 케이스 6개 통과
- `npx vitest run tests/engine-wave-damage-and-weapon-hook.test.ts tests/shotgun-pellet-targets.test.ts` — 기존 피해 테스트 통과
- `npx tsc --noEmit` — 오류 0개

## Commit Message
```text
feat(chalang): 3회 등장 급발진과 찰랑 체력 규칙을 구현

Plan: 2026-11-12-chalang-monster
Phase: P02-submerge-engine
Task: T03-rush-and-hp

- I01: 등장 3회째 급발진 트리거와 3배 속도 배율
- I02: 피해 경로는 기존 규칙을 그대로 사용(코드 변경 없음)
- I03: 급발진·피해 경로·회복 없음 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
