# Task: T01 무기 수치 조정

> 구현 중 값이 바뀌었다(결정 문서 D01~D03이 최종): 리볼버는 `constants.ts`의 Lv.2~4 `damagePerHit`를 1.05/1.10/1.15로(Lv.1 1.0 유지), 개틀링은 `weaponDamageScale.gatling` 1.4와 원래 탄창. 아래 본문의 ×0.85·20/24/28/34는 초안이다.

## Status: done

## Goal
세 무기 수치를 새 값으로 바꾸고 문서·테스트를 맞춘 뒤 봇 클리어율을 확인한다.

## Implementation
- `src/shared/gameTuning.ts` :: `maxAmmoByWeapon.shotgun` `{1: 14, 2: 14, 3: 16, 4: 16}`, `maxAmmoByWeapon.gatling` `{1: 20, 2: 24, 3: 28, 4: 34}`, `weaponDamageScale.revolver` 0.85; modify. (`maxAmmo`는 `applyWeaponTuning`이 이 표에서 읽고, 리볼버 피해는 `damagePerHit × weaponDamageScale`이다. `constants.ts`의 기본표 탄창 값은 무시된다.)
- `docs/무기_및_스킬_가이드.md` 26~28행 탄창 칸: 샷건 `14 ~ 16발`, 리볼버 `10 ~ 12발`, 개틀링 `20 ~ 34발`; 같은 문서와 README·도감·가이드에 탄창이나 리볼버 피해 숫자를 직접 적은 곳은 `grep`으로 찾아 맞춘다; modify.
- 테스트: `tests/boss-distance-and-mix.test.ts` 14행(개틀링 탄창 표), `tests/game-tuning.test.ts` 97~98행(샷건·리볼버 Lv.1 탄창), `tests/shared-protocol.test.ts` 119행 부근(리볼버 Lv.4 `damagePerHit` 2.20 → 1.87), 리볼버 피해를 고정한 다른 테스트(`skill-blade`, `weapon-rules` 등)는 실행해서 깨지는 것만 고친다; modify.
- 함정: 리볼버 칼날 피해는 평타 GREAT 한 발과 같아 무기 표에서 자동으로 내려간다. 칼날 테스트가 숫자를 고정했으면 새 값에 맞춘다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- `npx tsx .memory/references/scripts/boss-strategy-compare.ts 60 all minions-first` — 샷건 약 62%, 리볼버 약 77%, 개틀링 약 77%(오차 ±6%p)

## Commit Message
```text
tune(weapons): shotgun +4 ammo, revolver damage x0.85, gatling ammo 20-34

Plan: 2026-11-07-weapon-balance
Phase: P01-numbers
Task: T01-weapon-numbers

- maxAmmoByWeapon: shotgun 14/14/16/16, gatling 20/24/28/34
- weaponDamageScale.revolver 1.0 -> 0.85
- Sync the weapon guide and the tests that pinned the old numbers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
