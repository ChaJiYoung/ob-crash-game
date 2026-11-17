# Task: T01 무기 밸런스 조정 (탄창·리볼버 관통·샷건 범위·부수 처치 판정)

## Status: done

## Goal
EX 사전 시뮬레이션에서 드러난 무기 격차를 본편 수치부터 바로잡는다. 탄창 증가를 Lv.3 한 번으로 정리하고, 리볼버 관통 피해를 관통 순서별로 줄이고(60% → 40%), 샷건 추가 타격 반경을 넓히고(0.30 → 0.45), 관통·추가 타격으로 처치한 몬스터의 점수 판정을 그 발의 실제 판정으로 바꾼다. 무기 가이드 문구·레이더 차트와 관련 테스트도 함께 맞춘다.

## Decision Summary
- 결정 D10(무기 수치), D11(부수 처치 판정). 근거 시뮬레이션: `.memory/references/ex-rush-simulation-2026-11-17.md`.
- `RANKING_RULESET_VERSION`은 올리지 않는다(D09: 시즌 초기화 없음). 과거에는 밸런스 변경 때 올렸던 관례가 있으나(v4, v5) 이번에는 사용자 결정으로 유지한다.

## Implementation

### I01. 탄창 표

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.maxAmmoByWeapon`(약 105행); modify

#### Details
```ts
maxAmmoByWeapon: {
  shotgun: { 1: 15, 2: 15, 3: 18, 4: 18 },
  revolver: { 1: 10, 2: 10, 3: 12, 4: 12 },
  gatling: { 1: 35, 2: 35, 3: 40, 4: 40 },
},
```
- 주석을 "무기·레벨별 기본 탄수. 레벨업 증가는 Lv.3에서만(샷건 +3, 리볼버 +2, 개틀링 +5). rapid_reload 카드가 장당 +2발 더한다."로 바꾼다.
- `WEAPON_ARCHETYPE_SPECS`는 `applyWeaponTuning`이 이 표를 읽으므로(`constants.ts:527`) 따로 고치지 않는다.

### I02. 리볼버 관통 순서별 비율

- Related Files:
  - `src/shared/types.ts` :: `WeaponLevelSpec.pierceDamageRatio`(26행); modify
  - `src/shared/constants.ts` :: 무기 표의 모든 `pierceDamageRatio`(226~442행, 샷건·리볼버·개틀링 12곳); modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: 리볼버 관통 루프(약 2451행); modify
  - `src/pc/components/guide/weaponGuideData.ts` :: 레벨 설명(28행), `weaponBestCasePerShot`(45행); modify

#### Details
- 타입: `pierceDamageRatio: number` → `/** 관통 순서별 피해 비율(길이 = pierceCount). 첫 관통 대상이 [0]. */ pierceDamageRatios: readonly number[];`
- 값: 샷건·개틀링 모든 레벨 `[]`. 리볼버 Lv.1 `[0.5]`, Lv.2 `[0.5]`, Lv.3 `[0.6, 0.4]`, Lv.4 `[0.6, 0.4]`. `pierceCount`는 그대로(1, 1, 2, 2) — 반드시 `pierceDamageRatios.length === pierceCount`.
- 엔진:
  ```ts
  rearTargets.slice(0, levelSpec.pierceCount).forEach((rear, order) => {
    const ratio = levelSpec.pierceDamageRatios[order] ?? 0;
    const pierceDmg = Number((damage * ratio).toFixed(3));
    ...
  ```
- 가이드 레벨 설명: `${spec.pierceCount}체 관통(관통 피해 ${spec.pierceDamageRatios.map((r) => Math.round(r * 100) + '%').join('→')})` → 예: `2체 관통(관통 피해 60%→40%)`.
- `weaponBestCasePerShot` 리볼버: `spec.damagePerHit * (1 + spec.pierceDamageRatios.reduce((a, b) => a + b, 0))`. 주석도 "리볼버 = 한 발 x (1 + 관통 비율 합)"으로.

### I03. 샷건 추가 타격 반경

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.shotgunSpread.radiusNorm`(66행); modify

#### Details
- `radiusNorm: 0.30` → `0.45`. 주석에 "2026-11-17: 0.30에서 평균 0.6마리만 추가로 맞아 넓힘(D10)" 추가.

### I04. 부수 처치 판정

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAtInner` 안 리볼버 관통 처치(2461행), 샷건 추가 타격 처치(2519행); modify

#### Details
- 두 곳의 `player.scoreManager.registerHit('PERFECT', rear.killBonusScore, true);`를 `player.scoreManager.registerHit(result.grade as Exclude<JudgmentGrade, 'MISS'>, rear.killBonusScore, true);`로 바꾼다. `result`는 같은 함수의 판정 결과(이미 `grade: result.grade`로 반환에 쓰이는 변수)이고, 이 경로는 명중했을 때만 오므로 MISS가 아니다. 피버 중에는 판정이 GREAT로 고정되므로 그대로 GREAT가 된다.
- 주변 주석("처치는 리볼버 관통과 같은 경로")에 "점수 판정은 그 발의 판정(D11)"을 덧붙인다.
- 스킬(칼날·거품·뚫어뻥) 처치 경로는 바꾸지 않는다.

### I05. 테스트 동기화

- Related Files (기대값이 바뀌는 곳):
  - `tests/game-tuning.test.ts:111-121` — "샷건 = 리볼버 + 4" 규칙: 새 표에서 Lv.1 +5, Lv.3 +6이므로 테스트 이름과 단언을 "샷건 15/15/18/18, 리볼버 10/10/12/12, 개틀링 35/35/40/40이고 레벨업 증가는 Lv.3에서만"으로 교체. "레벨업으로 줄지 않는다" 단언은 유지.
  - `tests/boss-distance-and-mix.test.ts:14` — 개틀링 탄창 `{1:35,2:35,3:40,4:40}`.
  - `tests/shared-protocol.test.ts:121,126-128,194,235-250` — 관통 비율을 `pierceDamageRatios` 배열 기대값으로, 개틀링 Lv.4 40, 샷건 초기 탄창 15, 레벨업 후 15/18/18, rapid_reload 후 18+2=20 등 실제 흐름에 맞게 고친다(각 단언 주변 코드를 읽고 같은 의미로 갱신).
  - `tests/weapon-power-order.test.ts:21-22` — `[[0.5],[0.5],[0.6,0.4],[0.6,0.4]]`. 같은 파일에 "한 발 피해 서열 리볼버 > 샷건 > 개틀링"(2026-11-10 결정) 단언이 있으면 **아래 주의**를 따른다.
  - `tests/shotgun-spread.test.ts:72` — `radiusNorm` 0.45.
  - 새 테스트(`tests/side-kill-grade.test.ts`, new): ① 리볼버로 GOOD 판정이 나도록 조준을 살짝 비켜 쏴서 앞 대상 뒤의 HP 0.1 몬스터를 관통 처치 → 점수 증가분이 GOOD 기준(`JUDGMENT_SPECS.GOOD.baseScore`)으로 계산되고 피버 게이지에 PERFECT 보너스가 붙지 않음. ② 샷건 추가 타격 처치도 같은 규칙. ③ 리볼버 Lv.4 관통 피해가 첫 대상 60%, 두 번째 40%.
- 서열 유지(사용자 결정 2026-11-17, 옵션 2): `tests/weapon-power-order.test.ts`의 "리볼버 > 샷건 > 개틀링" 서열 단언은 **그대로 통과해야 한다**(I06의 리볼버 Lv.4 상향으로 리볼버 2.65 > 샷건 2.63). Lv.4 한 발 피해 값을 직접 단언하는 테스트(`grep -rn "1.208\|1\.15" tests`)가 있으면 1.323 / 1.26으로 고친다.

### I06. 리볼버 Lv.4 한 발 피해 상향

- Related Files:
  - `src/shared/constants.ts` :: 기본 무기 표 리볼버 Lv.4 `damagePerHit`(약 386행); modify

#### Details
- `damagePerHit: 1.15` → `1.26`. `applyWeaponTuning`이 `weaponDamageScale.revolver`(1.05)를 곱해 1.323이 된다. 칼날 스킬 `skillDamage`는 한 발 피해를 따라가는 규칙이므로(`gameTuning.ts` skills 주석) 자동으로 1.323이 되는지 확인하고, 따로 고정값으로 덮어쓰는 코드가 있으면 그 규칙에 맞춘다.
- 근거: Lv.4 최선의 경우 한 발 피해 = 1.323 × (1 + 0.6 + 0.4) = 2.646 > 샷건 1.12 × (1 + 3 × 0.45) = 2.632. 시뮬레이션: 본편 클리어 오차 범위, EX 점수 +5~10%.

## Acceptance Criteria
- [x] 탄창이 새 표대로 나오고 레벨업 증가는 Lv.3에서만.
- [x] 리볼버 Lv.3·4 관통 피해가 60%, 40% 순서로 들어간다.
- [x] 샷건 추가 타격 반경이 0.45.
- [x] 관통·추가 타격 처치가 그 발의 판정으로 점수·콤보·게이지를 계산한다.
- [x] 무기 가이드에 `2체 관통(관통 피해 60%→40%)`로 보인다.
- [x] 리볼버 Lv.4 한 발 피해 1.323, 최선의 경우 한 발 피해 서열 리볼버 > 샷건 > 개틀링 유지.
- [x] 전체 테스트·타입 체크 통과.

## Validation
- `npx vitest run tests/side-kill-grade.test.ts tests/game-tuning.test.ts tests/shared-protocol.test.ts tests/weapon-power-order.test.ts tests/shotgun-spread.test.ts tests/boss-distance-and-mix.test.ts tests/weapon-rules.test.ts tests/docs-sync.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 40 all` — 본편 클리어율이 시뮬레이션 기록(개틀링 누름 ~80%, 리볼버 탭 63~88%, 샷건 탭 70~83%)과 비슷한지 확인하고 결과를 `references/scripts/out/balance-2026-11-17-after.txt`로 저장

## Commit Message
```text
feat(balance): 탄창 Lv.3 증가로 정리, 리볼버 관통 60→40%·Lv.4 피해 상향, 샷건 반경 0.45, 부수 처치는 실제 판정

Plan: 2026-11-17-ex-endless-waves
Phase: P01-engine-ex-rush
Task: T01-weapon-balance

- maxAmmoByWeapon: 샷건 15/15/18/18, 리볼버 10/10/12/12, 개틀링 35/35/40/40
- WeaponLevelSpec.pierceDamageRatios(관통 순서별), 리볼버 Lv.3·4 [0.6, 0.4]
- shotgunSpread.radiusNorm 0.30 → 0.45
- 관통·추가 타격 처치 점수를 그 발의 판정으로 계산
- 리볼버 Lv.4 한 발 피해 1.208 → 1.323(서열 유지)
- 무기 가이드 문구·최선의 경우 한 발 피해, 관련 테스트 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
