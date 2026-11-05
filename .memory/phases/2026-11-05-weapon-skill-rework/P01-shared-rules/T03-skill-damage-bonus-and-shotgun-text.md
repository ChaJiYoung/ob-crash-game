# Task: T03 스킬 피해 공용 함수, 카드 적용, spreadRad 삭제, 샷건 설명

## Status: done

## Goal
공격력 강화 카드가 세 스킬 피해에 적용되게 하고, 판정에 쓰이지 않는 `spreadRad`와 실제와 다른 샷건 설명을 정리한다.

## Decision Summary
- 결정 D15, D16, D17. 카드 3장 +30%와 Lv.4 재강화 +15%가 모두 들어가는 `getDamageBonusMultiplier()`를 곱한다.
- 샷건 넉백 수치는 바꾸지 않고 설명만 고친다.

## Implementation

### I01. 스킬 피해 공용 함수
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `getSkillDamage`(new), `applySkillDamage`(new), `triggerWeaponSkill`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 공격력 강화 카드까지 반영한 스킬 피해. 보스는 보스 피해 값을 쓴다. */
  private getSkillDamage(target: ActiveTargetEntity, levelSpec: WeaponLevelSpec): number {
    const base = target.kind === 'boss' ? levelSpec.skillBossDamage : levelSpec.skillDamage;
    return Number((base * this.weaponSystem.getDamageBonusMultiplier()).toFixed(3));
  }

  /** 스킬 피해를 주고, 죽었으면 점수와 웨이브 처리까지 한다. 대왕 쉴드에는 피해가 없다. 죽었으면 true. */
  private applySkillDamage(monster: ActiveTargetEntity, damage: number, nowMs: number): boolean {
    if (monster.isShielded) return false;
    monster.hp = Number(Math.max(0, monster.hp - damage).toFixed(3));
    if (monster.hp > 0) return false;
    const idx = this.activeTargets.indexOf(monster);
    if (idx < 0) return false;
    this.activeTargets.splice(idx, 1);
    this.killedInWave += 1;
    this.scoreManager.registerHit('PERFECT', monster.killBonusScore, true);
    this.handleMonsterKilled(monster, nowMs);
    return true;
  }
  ```
  `WeaponLevelSpec`을 `src/shared/types` import 목록에 추가한다.
- **Execution Flow / Logic**: `triggerWeaponSkill` 세 분기의 `const dmg = ...`, `if (!monster.isShielded) monster.hp = ...`, `if (monster.hp <= 0) { ... }` 묶음을 아래로 바꾼다. 기절·둔화·밀기 처리는 각 분기에 남긴다.
  ```typescript
  this.applySkillDamage(monster, this.getSkillDamage(monster, levelSpec), nowMs);
  if (this.gamePhase === 'VICTORY') break;
  ```
  기절·둔화·밀기는 지금처럼 피해 전에 적용해도, 죽은 몬스터에는 영향이 없다.

### I02. `spreadRad` 삭제
- Related Files:
  - `src/shared/types.ts` :: `WeaponLevelSpec.spreadRad`; modify
  - `src/shared/constants.ts` :: 무기 표 12곳(`spreadRad:` 줄 전체); modify
  - `docs/무기_및_스킬_가이드.md` :: 샷건 표(83~88행); modify

#### Details
- 샷건 표에서 "탄착군 확산" 칸을 뺀다. 머리줄과 구분줄에서 칸을 하나씩 줄이고, 각 행의 `0.14 rad`, `0.16 rad`, `0.18 rad`, `0.20 rad`를 지운다.
- `ParticleEffects3D.ts` 584행의 `spread`는 `spreadRad`와 무관한 지역 변수이므로 그대로 둔다.
- `docs/비어 크러셔 상세설계서.md`와 가이드 198행의 "탄착군"은 조준경 모양 설명이라 그대로 둔다.

### I03. 문구
- Related Files:
  - `src/shared/constants.ts` :: 샷건 `descriptionKo`(197행), `REWARD_CARD_SPECS.damage_up`(589~590행); modify
  - `src/pc/components/GameCanvas3D.tsx` :: 무기 선택 카드 샷건 `sub`(517행); modify
  - `src/pc/components/GuideModal.tsx` :: 샷건 부제(364행); modify
  - `docs/무기_및_스킬_가이드.md` :: 26행, 163행; modify

#### Details
| 위치 | 바꿀 문구 |
|---|---|
| `constants.ts` 샷건 `descriptionKo` | `넓은 명중 범위와 한 발에 몰아넣는 강한 화력` |
| `damage_up.descriptionKo` | `사격·스킬 피해 +10% (최대 3회 중첩)` |
| `damage_up.cardSubtitleKo` | `사격·스킬 피해 +10%\n최대 3회 중첩` |
| `GameCanvas3D.tsx` 샷건 `sub` | `넓은 명중 범위\n한 발 강한 화력 샷건` |
| `GuideModal.tsx` 샷건 부제 | `넓은 명중 범위 & 한 발 강한 화력` |
| 가이드 26행 세 번째 칸 | `넓은 명중 범위 & 한 발 강한 화력` |
| 가이드 163행 효과 칸 | `사격·스킬 피해 +10%` |

### I04. 테스트
- Related Files:
  - `tests/skill-damage-bonus.test.ts` — 새 테스트; new
  - `tests/docs-sync.test.ts` :: `FORBIDDEN`; modify

#### Details
- 샷건 Lv.1 스킬: 카드 없음 일반 피해 0.5, 보스 피해 4. `weaponSystem.addDamageBonus(0.3)` 후 0.65, 5.2.
- 칼날과 거품의 카드 적용은 P02-T01, P03-T01 테스트에서 확인한다. 두 스킬은 그때 닿는 순간 피해로 바뀌므로, 여기서 즉시 피해를 전제로 테스트하면 나중에 깨진다.
- 스킬로 죽으면 `killedInWave`가 오르고, 큰 병맥주는 분열한다(기존 `a skill kill also splits a big bottle` 유지).
- 카드 설명에 `스킬`이 들어 있다.
- `FORBIDDEN`에 추가: `{ pattern: /탄착군 확산|근접 넉백|넉백 밀쳐내기/, why: 'shotgun has no spread stat and its knockback is minor' }`
- `WeaponLevelSpec`에 `spreadRad`가 없는 것은 `tsc`로 확인한다.

## Acceptance Criteria
- [ ] 카드를 받으면 세 스킬의 일반·보스 피해가 함께 오른다.
- [ ] `grep -rn spreadRad src tests docs README.md`에 결과가 없다.
- [ ] 샷건 설명에서 "근접 넉백"과 "탄착군 확산"이 사라진다.

## Validation
- `grep -rn "spreadRad" src tests docs README.md` — 결과 없음
- `npx vitest run tests/skill-damage-bonus.test.ts tests/docs-sync.test.ts tests/monster-traits.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(skills): apply the damage card to skills and drop unused shotgun spread

Plan: 2026-11-05-weapon-skill-rework
Phase: P01-shared-rules
Task: T03-skill-damage-bonus-and-shotgun-text

- shared getSkillDamage and applySkillDamage for all skills
- damage card now covers skill damage
- remove spreadRad, which no code read
- describe the shotgun by what it actually does
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
