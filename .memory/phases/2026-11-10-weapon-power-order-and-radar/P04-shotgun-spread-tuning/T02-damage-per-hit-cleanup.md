# Task: T02 damage-per-hit-cleanup

## Status: done

## Goal
샷건 `damagePerHit`를 한 발 피해(1.00/1.03/1.07/1.12)로 두고 `pelletCount`는 연출 전용으로 만든다(D10).

## Implementation
- `src/shared/constants.ts` 샷건 `damagePerHit` 값 교체, `src/shared/types.ts` 필드 주석 추가
- `src/pc/engine/BeerCrusherEngine.ts` `baseDamage = levelSpec.damagePerHit`
- `src/pc/components/guide/weaponGuideData.ts` `pelletCount *` 제거 (성능 줄, `weaponBestCasePerShot`)
- 테스트 기대값 정정(`shared-protocol`, `shotgun-spread`, `weapon-power-order`, `engine-judgment-and-spawn`, `guide-cards`)

## Validation
- `npx vitest run` 1054개 통과, `npx tsc --noEmit -p .` 오류 없음 (게임 피해는 그대로)

## Commit Message
```text
refactor(shotgun): damagePerHit를 한 발 피해로 정리하고 펠릿 수는 연출 전용으로 변경
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
