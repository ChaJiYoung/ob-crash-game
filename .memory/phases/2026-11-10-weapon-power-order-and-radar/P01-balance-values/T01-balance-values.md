# Task: T01 balance-values

## Status: done

## Goal
샷건 한 발 합계를 1.002/1.032/1.07/1.122로, 리볼버 관통 피해 비율을 0.5/0.5/0.6/0.7로, 무기별 판정 허용 배율을 모두 1.0으로 바꾸고 "넓은 명중 범위" 문구를 산탄 설명으로 고친다. 그에 맞춰 기존 테스트의 기대값을 바로잡는다.

## Decision Summary
- D01 한 발 서열 리볼버>샷건>개틀링, D02 샷건 합계, D03 리볼버 관통 비율, D05 판정 통일. 산탄 수치(D04)는 건드리지 않는다.
- 펠릿당 피해는 소수 3자리 반올림(`Number(x.toFixed(3))`)이라 0.333×3=0.999가 되어 Lv.1 1HP 원샷이 깨진다. 그래서 0.334를 쓴다.

## Implementation

### I01. 무기 표 수치
- Related Files:
  - `src/shared/constants.ts` :: `BASE_WEAPON_ARCHETYPE_SPECS.shotgun.levels[1..4].damagePerHit`, `.revolver.levels[1..4].pierceDamageRatio`, `.shotgun.descriptionKo` — modify
#### Details
- 샷건 `damagePerHit`: Lv1 0.34→**0.334**, Lv2 0.33→**0.258**, Lv3 0.33→**0.214**, Lv4 0.41→**0.187** (`weaponDamageScale.shotgun`=1.0이라 그대로 반영, 합계 1.002/1.032/1.070/1.122).
- 리볼버 `pierceDamageRatio`: Lv1 0.467→**0.5**, Lv2 0.5(유지), Lv3 0.5→**0.6**, Lv4 1.00→**0.7**.
- `descriptionKo`: `'넓은 명중 범위와 한 발에 몰아넣는 강한 화력'` → `'옆 몬스터까지 함께 맞는 산탄과 한 발에 몰아넣는 화력'`.
- 상단 주석(`applyWeaponTuning` 위, 샷건 GREAT 주석 `BeerCrusherEngine.ts` "Lv.1 GREAT = 3 * 0.35 * 1.0 = 1.05")도 새 값으로 고친다.

### I02. 판정 허용 배율 통일과 선택 카드 문구
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.hitZone.toleranceByWeapon` — modify
  - `src/pc/components/GameCanvas3D.tsx` :: 무기 선택 카드 `sub` 문구(약 661행) — modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: 샷건 주석(약 2321행) — modify
#### Details
- `toleranceByWeapon: { shotgun: 1.40, revolver: 0.95, gatling: 1.05 }` → `{ shotgun: 1.0, revolver: 1.0, gatling: 1.0 }`. 주석에 "2026-11-10 D05: 샷건은 판정이 아니라 산탄이 특성이라 통일" 한 줄 추가.
- `'넓은 명중 범위\n한 발 강한 화력 샷건'` → `'옆 몬스터까지 맞는 산탄\n한 발 강한 화력 샷건'`.
- 세로 보정(`verticalScale` 리볼버 0.70)은 허용 배율이 아니므로 건드리지 않는다.

### I03. 기존 테스트 기대값 정정
- Related Files: 아래 테스트 중 실패하는 것만 수정 — modify
  - `tests/shotgun-spread.test.ts`, `tests/weapon-crosshair-hit-detection.test.ts`, `tests/engine-judgment-and-spawn.test.ts`, `tests/monster-traits.test.ts`, `tests/shared-protocol.test.ts`, `tests/server-session.test.ts`
#### Details
- `npx vitest run`을 돌려 실패한 테스트만, 새 수치(결정 문서 D02·D03·D05)에 맞게 기대값을 고친다. 테스트 의도(서열·원샷 규칙)를 지키고, 필요하면 한 발 서열(리볼버 > 샷건 > 개틀링) 테스트를 `tests/weapon-power-order.test.ts`로 새로 추가한다: 레벨별 `pelletCount*damagePerHit` < 리볼버 `damagePerHit` 그리고 > 개틀링 `damagePerHit`, Lv.1 샷건 합계 ≥ 1.0, `toleranceByWeapon` 세 값 동일.

## Acceptance Criteria
- [ ] 샷건 `pelletCount*damagePerHit` = 1.002/1.032/1.07/1.122
- [ ] 리볼버 `pierceDamageRatio` = 0.5/0.5/0.6/0.7
- [ ] `toleranceByWeapon` 세 값 모두 1.0
- [ ] `grep -rn "넓은 명중" src` 결과 없음
- [ ] 전체 테스트·tsc 통과

## Validation
- `npx vitest run` — 전체 통과
- `npx tsc --noEmit -p .` — 오류 없음

## Commit Message
```text
fix(balance): 한 발 피해 서열을 리볼버>샷건>개틀링으로 맞추고 판정 허용 배율 통일

Plan: 2026-11-10-weapon-power-order-and-radar
Phase: P01-balance-values
Task: T01-balance-values

- 샷건 펠릿당 피해 0.334/0.258/0.214/0.187 (한 발 1.00~1.12)
- 리볼버 관통 피해 비율 0.5/0.5/0.6/0.7
- 판정 허용 배율 세 무기 1.0, 샷건 문구를 산탄 설명으로 변경
- 기존 테스트 기대값 정정, 서열 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
