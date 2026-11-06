# Task: T01 엔진 스킬 3단계와 피버 4단계

## Status: done

## Goal
튜토리얼이 1 조준 → 2 홀드 → 3 스킬 → 4 피버 → COMPLETED 로 진행된다. 3단계는 스킬을 1회 발동하면 4단계로 넘어간다.

## Decision Summary
- 번호가 밀리므로 `tutorialStep === 3` 피버 판정을 모두 4로 옮기고, 이름에 숫자가 박힌 `spawnTutorialStep3Enemies` 는 `spawnTutorialFeverEnemies` 로 바꾼다(모든 호출부 포함, 같은 Task에서 해야 컴파일이 깨지지 않음).

## Implementation

### I01. 타입
- Related Files: `src/shared/types.ts` :: `TutorialStep` — modify
#### Details
```typescript
export type TutorialStep = 1 | 2 | 3 | 4 | 'COMPLETED';
```

### I02. 엔진
- Related Files: `src/pc/engine/BeerCrusherEngine.ts` :: `advanceTutorialStep`, `spawnTutorialStep3Enemies`(→`spawnTutorialFeverEnemies`), 신규 `spawnTutorialSkillTargets`, `triggerWeaponSkill`, `update`(약 1208행), 돌파 처리(약 1325~1337행), 킬 처리(약 2164~2176행) — modify
#### Details
- `advanceTutorialStep(nextStep)`:
  - `nextStep === 3`: `this.weaponSystem.refillSkillInstant(); this.spawnTutorialSkillTargets();`
  - `nextStep === 4`: `this.scoreManager.forceSetFeverGauge(100); this.activeTargets = [];` (기존 3단계 분기를 4로)
  - 2, COMPLETED 분기는 그대로.
- `spawnTutorialSkillTargets(): void` — `activeTargets` 를 비우고 `kinds = ['pilgood','caslight','pilgood','caslight','pilgood']`, `angles = [-0.30,-0.15,0,0.15,0.30]`, `radius = 12.0 + (i % 2)`, `speedMps: 0`, id `tutorial_skill_${targetCounter}_${kind}`, 나머지 필드는 `spawnTutorialFeverEnemies` 와 같은 모양(hp/maxHp/hitRadiusM/killBonusScore는 `TARGET_SPECS[kind]`, `breached:false`).
- `spawnTutorialFeverEnemies` — 기존 `spawnTutorialStep3Enemies` 본문 그대로, 이름만 변경.
- `triggerWeaponSkill` — `activated: true` 를 반환하기 직전(모든 무기 분기 공통 지점이 없으면 `consumeSkill` 통과 직후)에 `if (this.isTutorialMode && this.tutorialStep === 3) this.advanceTutorialStep(4);` 를 실행한다. 반환 객체의 `affectedTargets` 는 advance 전에 계산된 값이어야 하므로 advance 는 스킬 효과 적용 이후, 반환 직전에 호출. 무기 분기가 여러 return 이면 래퍼로 감싸 한 곳에서 처리(예: 기존 본문을 `private runWeaponSkill` 로 옮기고 `triggerWeaponSkill` 에서 결과 `activated` 면 advance).
- `update` 의 `this.tutorialStep === 3` → `=== 4`.
- 돌파 처리: `else if (this.tutorialStep === 3)` → `=== 4`. 3단계(스킬)는 속도 0이라 돌파가 없지만, 혹시 대비해 `tutorialStep === 3` 이면 `target.breached=false; continue;` 분기를 2단계 분기 앞에 두지 말고 기존 `splice` 기본 경로를 쓴다.
- 킬 처리: `tutorialStep === 3` 블록을 두 개로: `=== 3` → 일반 사격으로 표적이 모두 사라지면 `this.spawnTutorialSkillTargets()` (스킬을 쓰기 전에는 단계가 끝나지 않게 재배치), `=== 4` → 기존 `activeTargets.length === 0` 이면 `advanceTutorialStep('COMPLETED')`.
- 함정: `tutorialStep` 숫자 비교가 `PCGamePage.tsx:484`, `GameCanvas3D.tsx:465` 에도 있다(I03).

### I03. 호출부 이름·번호
- Related Files: `src/pc/PCGamePage.tsx`(484~485행), `src/pc/components/GameCanvas3D.tsx`(465~466행) — `tutorialStep === 3` → `=== 4`, `spawnTutorialStep3Enemies` → `spawnTutorialFeverEnemies`; `scripts/capture-tutorial.mjs`(86~88행: `advanceTutorialStep(3)` → 스킬 화면용 `advanceTutorialStep(3)` 캡처 후 `advanceTutorialStep(4)` + 피버 호출로 확장, 이름 변경) — modify

### I04. 테스트
- Related Files: `tests/tutorial-and-guide.test.ts` — modify; `tests/tutorial-skill-step.test.ts` — new
#### Details
- 기존 테스트: Step 2→3 의 `feverGauge 100` 검사를 `advanceTutorialStep(4)` 로, 피버 활성/스폰 테스트의 `advanceTutorialStep(3)` 을 `(4)` 로, `spawnTutorialStep3Enemies` 를 새 이름으로.
- 신규: ① `advanceTutorialStep(3)` 후 표적 5개, 모두 `speedMps 0`, 스킬 재고 > 0. ② `engine.gamePhase`/tutorial 상태에서 `engine.triggerWeaponSkill(now)` 가 `activated` 이고 `tutorialStep === 4`, `feverGauge 100`, 표적 비움. ③ 3단계에서 일반 사격으로 표적을 모두 제거해도 `tutorialStep` 이 3이고 표적이 다시 5개. ④ 3단계에서는 `feverGauge` 가 100이 아님(스킬 전에 피버 불가). ⑤ 4단계에서 표적 전멸 시 `COMPLETED`.

## Acceptance Criteria
- [x] 단계 순서 1→2→3(스킬)→4(피버)→COMPLETED
- [x] 코드에 `spawnTutorialStep3Enemies` 가 남지 않음

## Validation
- `npx tsc --noEmit && npx vitest run` — 전체 통과
- `grep -rn "spawnTutorialStep3Enemies" src tests scripts` — 결과 없음

## Commit Message
```text
feat(tutorial): add a skill step before the fever step

Plan: 2026-11-06-tutorial-skill-and-lobby-buttons
Phase: P01-tutorial-skill-lobby
Task: T01-engine-skill-step

- add TutorialStep 4 and move the fever step to it
- add stationary skill targets and advance when the skill is used
- rename spawnTutorialStep3Enemies to spawnTutorialFeverEnemies
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
