# Task: T02 대왕 방패 제거

## Status: done

## Goal
대왕의 방패(체력 2/3, 1/3에서 켜지고 몬스터 6마리를 처치하면 풀리는 규칙)를 코드·모델·HUD·문서에서 없앤다. 오비의 방패(`isGuarding`)는 별개이므로 건드리지 않는다.

## Decision Summary
- 결정 D03. 방패가 사라지면 체력 구간 소환(T03)이 막힘 없이 동작한다. 칼날·거품의 `isShielded` 분기는 죽은 코드가 되므로 함께 정리한다.

## Implementation

### I01. 엔진
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts`; modify

#### Details
- **제거할 것**: `ActiveTargetEntity.isShielded`(주석 포함), 필드 `shieldKillCount`·`shieldThresholdIndex`, 메서드 `updateKingShield`·`releaseKingShield`와 `update`의 `this.updateKingShield()` 호출, `spawnBossEncounter`의 `shieldKillCount = 0`·`shieldThresholdIndex = 0`·`king.isShielded = true`, `handleMonsterKilled`의 `if (target.bossRole === 'cooler') this.releaseKingShield();`와 일반 몬스터 처치 때의 `shieldKillCount` 증가·해제 블록, `shootAt`의 "King shield" 분기(`if (target.isShielded) { ... shieldBlocked: true }`), 리볼버 관통 후보 필터의 `!t.isShielded`, `applySkillDamage`의 `if (monster.isShielded) return false;`, `advanceSkillBlades`·`advanceSkillFoam`의 `blocked`(`Boolean(t.isShielded)`)와 `SkillHitEvent.blocked` 필드.
- **유지할 것**: `shieldBlocked`(오비 방패용 `EngineShootResult.shieldBlocked`), `isGuarding`, `updateGuards`.
- `SkillHitEvent`에서 `blocked`를 지우면 `GameCanvas3D.tsx`의 `if (ev.blocked) { ... continue; }` 블록도 지운다.
- `grep -n "isShielded\|shieldKillCount\|shieldThresholdIndex\|updateKingShield\|releaseKingShield" src`로 남은 곳이 없는지 확인한다.

### I02. 설정·모델·HUD
- Related Files:
  - `src/shared/gameTuning.ts` :: `boss.shieldReleaseKills`, `boss.shieldHpThresholds`; modify (삭제)
  - `src/pc/three/TargetModels3D.ts` :: 보스의 방패 구체(`shieldMesh`), `TargetAnimationOptions.isShielded`, `updateTargetAnimation3D`의 `bossShield.visible = ...`; modify (삭제)
  - `src/pc/components/GameCanvas3D.tsx` :: `isShielded: Boolean(target.isShielded)`; modify (삭제)
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `isShielded` 관련 4곳; modify (삭제). 체력바의 쉴드 표시 스타일이 있으면 같이 지운다.
  - `src/pc/hudSnapshot.ts` :: `isShielded` 필드와 `isShielded: Boolean(b.isShielded)`; modify (삭제)
  - `src/pc/components/GuideModal.tsx` :: 보스 설명의 쉴드 문구; modify

#### Details
- 보스 설명 문구에서 "쉴드를 두른 대왕", "몬스터 N마리를 처치하면 방패가 풀립니다" 같은 부분을 지운다. 대왕은 "1.5배 크기의 대왕 냉각기"로만 설명한다.
- `tests/hud-snapshot.test.ts`·`tests/pc-hud-and-banner.test.ts`에서 `isShielded`를 검사하는 곳을 지운다.

### I03. 테스트와 문서
- Related Files:
  - `tests/boss-encounters.test.ts` :: 쉴드 관련 케이스(`skills do not damage a shielded king`, `six minion kills release the shield` 등); modify (삭제)
  - `tests/skill-blade.test.ts`, `tests/skill-foam.test.ts` :: 대왕 쉴드 케이스; modify (삭제 또는 방패 없는 보스 케이스로 교체)
  - `tests/monster-traits.test.ts`, `tests/boss-summon-acceleration.test.ts`, `tests/boss-minion-drop.test.ts`, `tests/game-tuning.test.ts`; modify (쉴드를 언급한 케이스만)
  - `README.md` 45행, `docs/비어 크러셔 요구사항 분석서.md` 73행, `docs/비어 크러셔 상세설계서.md`, `docs/몬스터_도감_설명서.md`; modify (쉴드 설명 삭제)

#### Details
- 새 케이스: 대왕이 체력 1/2에서도 평타·칼날·거품 피해를 그대로 받는다(방패가 켜지지 않는다).
- `tests/docs-sync.test.ts`의 `FORBIDDEN`에 `{ pattern: /쉴드를 두른|방패가 풀립니다|대왕 쉴드/, why: 'the king shield was removed' }`를 추가한다.

## Acceptance Criteria
- [ ] `grep -rn "isShielded\|shieldReleaseKills\|shieldHpThresholds" src tests`에 결과가 없다.
- [ ] 대왕이 어떤 체력에서도 무적이 아니다.
- [ ] 오비의 방패 규칙과 테스트는 그대로 통과한다.

## Validation
- `grep -rn "isShielded\|shieldReleaseKills\|shieldHpThresholds\|updateKingShield" src tests` — 결과 없음
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
refactor(boss): remove the king shield

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P01-speed-and-boss-rules
Task: T02-remove-king-shield

- drop shield state, thresholds, kill counting and the shield bubble model
- skills and shots no longer branch on a shielded king
- obi shields are untouched
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
