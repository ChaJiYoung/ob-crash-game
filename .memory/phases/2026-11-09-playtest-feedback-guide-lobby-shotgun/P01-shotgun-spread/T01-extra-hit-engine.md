# Task: T01 샷건 평타 추가 명중 엔진·튜닝

## Status: done

## Goal
샷건 평타 한 발이 십자선 주변 몬스터에게도 낮은 피해를 주도록 엔진에 추가 명중을 넣고, 샷건 피해 스케일을 1.2에서 1.0으로 낮춘다. 퍼짐 수치는 `GAME_TUNING.shotgunSpread`에 둔다. 퍼짐 없이 강했던 평타를 "한 마리엔 약간 약하고 뭉친 무리엔 더 강한" 무기로 바꾸기 위한 것이다(D05~D07, D17).

## Decision Summary
- 추가 대상: 십자선 중심 **화면 거리**(`findBestTarget`과 같은 측정: 가로 `(aimX - targetNormX) * this.aspect`, 세로 `(aimY - targetNormY) * 0.85`) `<= radiusNorm`(0.30, 조준 좌표 단위로 1.0 = 화면 높이의 절반). 마릿수 2/2/3/3, 피해 비율 10/15/20/25%.
- 추가 명중은 보스·아이템·황금 캔·투사체·선택 카드·착지 전 몬스터·방패 올린 오비를 제외하고, 주 대상도 제외한다. 넉백·둔화는 주 대상만 받는다.
- 평타 스케일 1.2 → **1.0**: 한 발 피해(GREAT, 탄 수 곱 포함) 1.26/1.92/3.00/4.32 → **1.05/1.60/2.50/3.60**. Lv1은 1.05라 체력 1 몬스터를 한 방에 죽이는 규칙이 유지된다(Lv1을 더 낮추면 안 된다).

## Implementation

### I01. 튜닝 값 추가와 스케일 변경
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.weaponDamageScale`, `GAME_TUNING.shotgunSpread` — modify
#### Details
- **Signatures & Types**: 이 파일은 다른 파일을 import하지 않는다(순환 참조 방지, 파일 머리 주석). `as const` 객체이므로 레벨 키는 숫자 리터럴이다.
  ```ts
  // weaponDamageScale 안: shotgun 1.2 -> 1.0 (revolver 1.05, gatling 1.5는 그대로)
  weaponDamageScale: { shotgun: 1.0, revolver: 1.05, gatling: 1.5 },

  // fire 다음, weaponDamageScale 앞(또는 skills 앞)에 추가
  /**
   * 샷건 평타 퍼짐(2026-11-09 D05~D07, D17). 십자선 주변 몬스터도 낮은 피해를 받는다.
   * radiusNorm은 조준 좌표 단위(1.0 = 화면 높이의 절반)이고, 거리는 findBestTarget과 같은 방식(가로 x aspect, 세로 x 0.85)으로 잰다.
   * 비율은 주 대상 피해(판정·피버·파워샷·누르고 쏘기 배율 포함)에 곱한다.
   */
  shotgunSpread: {
    extraTargetsByLevel: { 1: 2, 2: 2, 3: 3, 4: 3 },
    damageRatioByLevel: { 1: 0.10, 2: 0.15, 3: 0.20, 4: 0.25 },
    radiusNorm: 0.30,
  },
  ```
- **Execution Flow / Logic**: `src/shared/constants.ts`의 `applyWeaponTuning`이 import 시점에 `damagePerHit = base.damagePerHit * weaponDamageScale[kind]`를 계산한다. 샷건 기본값은 0.35/0.40/0.50/0.60이므로 스케일 1.0이면 `WEAPON_ARCHETYPE_SPECS.shotgun.levels[l].damagePerHit`이 0.35/0.40/0.50/0.60이 되고 `pelletCount`(3/4/5/6)를 곱한 한 발 피해가 1.05/1.60/2.50/3.60이다. `constants.ts`는 건드리지 않는다.

### I02. 엔진: 추가 명중 대상 고르기와 피해 적용
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAt` (2058행 부근, 샷건 분기는 2308행 부근 `if (weaponKind === 'shotgun')`), 새 private `collectShotgunSpreadTargets` — modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `findBestTarget` (1838행), `computeTargetAimCoords` (1739행), `isTargetLanded` (1156행), `handleMonsterKilled` (1782행) — read-only
#### Details
- **Signatures & Types**:
  ```ts
  /** 샷건 평타 퍼짐: 십자선 주변에서 가까운 순서로 추가 명중 대상을 고른다(주 대상 제외, 최대 extraTargetsByLevel[level]마리). */
  private collectShotgunSpreadTargets(
    primary: ActiveTargetEntity,
    aimX: number,
    aimY: number,
    nowMs: number,
    level: WeaponLevel,
    playerIndex: PlayerIndex
  ): ActiveTargetEntity[]
  ```
- **Data & Schema Fields**: 새 필드 없음. 결과는 기존 `EngineShootResult.hitTargets`(주 대상 + 추가 대상 순서, `src/pc/engine/BeerCrusherEngine.ts:96` 근처 타입)에 넣는다. 리볼버 관통이 이미 같은 배열을 쓰므로 화면(`getPiercedTargets`)은 추가 대상에도 피격 플래시와 파편을 자동으로 그린다.
- **Execution Flow / Logic**:
  1. `collectShotgunSpreadTargets`: `GAME_TUNING.shotgunSpread.extraTargetsByLevel[level]`이 0이거나 `primary.isItem`이면 빈 배열. 후보는 `this.activeTargets` 중 `t !== primary && !t.isItem && !t.isProjectile && !t.isGoldenCan && !t.weaponSelectKind && !t.rewardCardKind && t.kind !== 'boss' && !t.isGuarding && this.isTargetLanded(t, nowMs)`. 각 후보의 `proj = this.computeTargetAimCoords(t, 1.0, playerIndex)`(와이드 스코프 배율은 퍼짐 반경에 적용하지 않으므로 1.0), `dx = (aimX - proj.targetNormX) * this.aspect`, `dy = (aimY - proj.targetNormY) * 0.85`(커스텀 `customNormY`가 있는 표적도 `findBestTarget`처럼 처리: `t.customNormY !== undefined`이면 `dy = aimY - proj.targetNormY`), `dist = Math.hypot(dx, dy)`. `dist <= GAME_TUNING.shotgunSpread.radiusNorm`만 남겨 `dist` 오름차순으로 정렬하고 앞에서 N개를 자른다.
  2. `shootAt`의 샷건 분기에서(주 대상 피해를 깎기 **전에**) `spreadTargets = this.collectShotgunSpreadTargets(target, aimX, aimY, nowMs, weaponLevel, playerIndex)`를 구해 둔다. 주 대상이 죽으면 `handleMonsterKilled`가 큰 병 분열(`splitBottle`)로 `activeTargets`에 새 병을 넣기 때문에, 목록을 먼저 확정해 새로 생긴 병이 맞지 않게 한다. 선언은 `let spreadTargets: ActiveTargetEntity[] = [];`를 `if (weaponKind === 'shotgun')` 위쪽 스코프에 둔다.
  3. 추가 대상 한 마리당 피해: `const spreadBase = levelSpec.pelletCount * levelSpec.damagePerHit * powerMult * judgmentMult * weaponBonusMult * holdMult;` (**`bossScale`은 곱하지 않는다**: 추가 대상은 보스가 아니다), `const extraDamage = Number((spreadBase * GAME_TUNING.shotgunSpread.damageRatioByLevel[weaponLevel]).toFixed(3));`. `powerMult`, `judgmentMult`, `weaponBonusMult`, `holdMult`는 2295~2303행에 이미 계산돼 있다.
  4. 주 대상 피해·처치 처리(`Apply damage to primary target` ~ `emit targetKilled`)가 끝난 뒤, `return` 직전에 `spreadTargets`를 순회한다. 각 `rear`에 대해 `if (!this.activeTargets.includes(rear)) continue;`(한맥 폭발 등으로 이미 사라졌을 수 있음). `rear.hp = Number(Math.max(0, rear.hp - extraDamage).toFixed(3)); hitTargets.push(rear);`. `rear.hp <= 0`이면 리볼버 관통 코드(2336~2349행)와 똑같이 처리한다: `this.activeTargets.splice(idx,1); this.killedInWave += 1; player.totalKills += 1; player.scoreManager.registerHit('PERFECT', rear.killBonusScore, true); this.handleMonsterKilled(rear, nowMs, playerIndex); this.emit({ type: 'targetKilled', target: rear, playerIndex, nowMs });`.
  5. 방패 막힘(`target.isGuarding`)·황금 캔·투사체·아이템 분기는 주 대상 함수 흐름에서 이미 먼저 `return`하므로 추가 명중이 일어나지 않는다. 황금 캔이 주 대상일 때 추가 대상이 없는 것도 같은 이유다.
  6. 반환: 기존과 같이 `hitTargets`(이제 `[target, ...맞은 추가 대상]`)를 담아 `EngineShootResult`를 돌려준다.
- **함정**: ① 추가 대상 처치가 `handleMonsterKilled`로 한맥 폭발 예약(`pendingHanmacBlasts`)을 만들 수 있다 — 기존 관통과 같은 경로라 그대로 둔다. ② `computeTargetAimCoords`는 호출마다 `syncProjectionCamera()`를 한다. 후보가 수십 개가 아니므로 문제없지만, 반드시 샷건일 때만(다른 무기 분기에서는) 호출하지 않는다. ③ 튜토리얼·샌드박스도 같은 규칙이다(`modeRules` 분기 없음).

### I03. 기존 테스트의 샷건 값 정정과 새 테스트
- Related Files:
  - `tests/shotgun-spread.test.ts` :: 새 테스트 — new
  - `tests/engine-judgment-and-spawn.test.ts` :: 'should support 3-weapon ballistics' (489행 부근, 주석과 기대값 `0.16`·`8.3`), 777·827행 부근 샷건 GREAT 테스트 — modify
  - `tests/shared-protocol.test.ts` :: 106행 `expect(sg.levels[1].damagePerHit).toBe(0.42)` — modify
  - `tests/weapon-rules.test.ts`, `tests/game-tuning.test.ts` — 전체 실행으로 깨지는 값 확인 후 modify
#### Details
- 정정할 계산: 샷건 Lv2 PERFECT(2.0배) 한 발 피해 = 4 × 0.40 × 1.0 × 2.0 = **3.2**(전에는 1.2 곱해 3.84). 따라서 체력 4.0 병은 `0.8`이 남는다(`0.16` → `0.8`). `damagePerHit` Lv1은 `0.35`(`0.42` → `0.35`).
- `tests/shotgun-spread.test.ts` 케이스:
  1. `GAME_TUNING.shotgunSpread` 값 고정(마릿수 2/2/3/3, 비율 0.10/0.15/0.20/0.25, 반경 0.30)과 `WEAPON_ARCHETYPE_SPECS.shotgun.levels[l].damagePerHit * pelletCount`가 1.05/1.60/2.50/3.60.
  2. Lv1 GREAT 한 발(주 대상 정중앙이 아닌 중간 오차로 GREAT)이 체력 1 몬스터를 처치한다(1레벨 원샷 규칙). 주 대상 `hp`는 0이 되어 목록에서 사라진다.
  3. 주 대상 A와 가까운 B·C·D를 두고 Lv3(추가 3마리) 한 발: A에 `5×0.5=2.5×배율`, B·C·D는 각 `2.5×배율×0.20` 피해. `result.hitTargets`가 `[A, B, C, D]`(가까운 순). Lv1(추가 2마리)에서는 3마리째가 맞지 않는다.
  4. 반경 밖(화면 거리 0.30 초과) 몬스터는 맞지 않고, 보스·방패 올린 오비(`isGuarding = true`)·아이템·착지 전(`dropLandAtMs` 미래)은 제외된다. 주 대상이 보스일 때 추가 대상은 일반 몬스터만 맞고 보스에는 `damageScaleByWeapon`(1.0)만 적용된다.
  5. 추가 대상이 죽으면 `player.totalKills`가 오르고 `targetKilled` 이벤트가 나간다(`engine.addEventListener`로 수집).
  6. 누르고 쏘기(`source: 'hold'`)는 주 대상·추가 대상 모두 `holdDamageByWeapon.shotgun`(0.6) 배율을 받는다. 리볼버·게틀링은 `hitTargets`에 추가 대상이 들어가지 않는다(리볼버는 관통만).
  7. 주 대상이 큰 병(체력 4, 분열)이고 한 발에 죽을 때 분열로 생긴 작은 병이 같은 발에 맞지 않는다.
- 조준 좌표는 `engine.computeTargetAimCoords(target)`의 `targetNormX/Y`를 써서 만들고, 추가 대상은 같은 좌표계에서 화면 거리가 0.30 안팎이 되도록 `thetaRad`/`radiusM`을 배치한다(테스트 도우미 함수로 `screenDistance(engine, a, b)`를 만들어 배치 후 거리를 직접 확인한다).

### I04. 가이드 문구 한 줄과 문서 동기화
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: 샷건 항목(406행 부근 불릿 목록) — modify (P05에서 카드로 다시 바뀐다)
  - `docs/무기_및_스킬_가이드.md` :: 85행(샷건 피해 ×1.2), 87~96행 샷건 수치표, 새 "평타 퍼짐" 소절 — modify
  - `README.md` :: 샷건 설명 문구가 있으면 한 줄 갱신 — modify
#### Details
- `GuideModal`의 샷건 불릿에 `• <strong>퍼짐:</strong> 십자선 주변 몬스터 {extra}마리에게도 주 대상 피해의 {ratio}%`를 **튜닝 값에서 계산**해 넣는다(Lv별 `extraTargetsByLevel`/`damageRatioByLevel`를 `levelSeries`로 이어 붙임, `Math.round(ratio*100)`). 손으로 숫자를 적지 않는다(D12).
- `docs/무기_및_스킬_가이드.md` 85행의 "샷건 피해 ×1.2"를 "×1.0"으로, 샷건 수치표의 펠릿당 공격력(0.35/0.40/0.50/0.60)·총 공격력(1.05/1.60/2.50/3.60)을 새 값으로 고치고, "평타 퍼짐" 소절에 마릿수·비율·반경 기준(십자선 중심 화면 거리)·보스 제외를 적는다. `tests/docs-sync.test.ts`가 문서 표와 `WEAPON_ARCHETYPE_SPECS`를 비교하므로 전체 테스트로 확인한다.

## Acceptance Criteria
- [ ] 샷건 한 발이 Lv별 2/2/3/3마리의 주변 몬스터를 10/15/20/25% 피해로 함께 맞힌다.
- [ ] 보스·방패 오비·아이템·착지 전 몬스터는 추가 대상이 아니고, 리볼버·게틀링 동작은 변하지 않는다.
- [ ] 샷건 한 발 피해가 1.05/1.60/2.50/3.60이고 Lv1 GREAT 한 발이 체력 1 몬스터를 처치한다.
- [ ] 추가 대상 처치가 킬 수·점수·`targetKilled` 이벤트에 반영된다.
- [ ] `npm test`와 `npx tsc --noEmit`이 통과한다.

## Validation
- `npx vitest run tests/shotgun-spread.test.ts tests/engine-judgment-and-spawn.test.ts tests/weapon-rules.test.ts tests/game-tuning.test.ts tests/shared-protocol.test.ts` — 모두 통과
- `npm test` — 전체 통과(가이드 문서 동기화 테스트 `docs-sync` 포함)
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(shotgun): 평타 퍼짐 추가 명중과 피해 스케일 1.0

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P01-shotgun-spread
Task: T01-extra-hit-engine

- I01 gameTuning: shotgunSpread(마릿수 2/2/3/3, 비율 10/15/20/25%, 반경 0.30), 샷건 스케일 1.2 -> 1.0
- I02 엔진: 십자선 화면 거리 기준 추가 명중 대상 선택·피해·처치, 보스·방패·아이템 제외
- I03 테스트: 샷건 값 정정과 shotgun-spread 테스트 추가
- I04 가이드 문구·문서 동기화
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 3605532
