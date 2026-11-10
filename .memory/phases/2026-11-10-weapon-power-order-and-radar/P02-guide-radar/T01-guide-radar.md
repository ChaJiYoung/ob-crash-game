# Task: T01 guide-radar

## Status: done

## Goal
가이드의 한 발 피해 막대·성능 문구·레이더 차트를 결정 D06·D07 기준(5축, 관통·산탄 포함 최선의 경우, 초당 화력=누르고 쏘기)으로 다시 계산해 보여 준다.

## Decision Summary
- 미커밋 임시 구현(`WeaponRadar.tsx`, `weaponRadarValues`, `weaponStatBars`의 "공격력(탄 1발)")을 새 기준으로 교체한다.
- 모든 수치는 `WEAPON_ARCHETYPE_SPECS`·`GAME_TUNING`에서 계산해 수치 조정 시 자동 갱신.

## Implementation

### I01. 계산 함수
- Related Files:
  - `src/pc/components/guide/weaponGuideData.ts` :: `weaponBestCasePerShot`(new), `weaponRadarValues`, `RADAR_AXES`, `weaponStatBars`, `weaponPerformanceText` — modify
#### Details
```ts
export function weaponBestCasePerShot(kind: WeaponKindKey, level: 1|2|3|4): number
// 샷건: sum*(1 + extraTargetsByLevel[level]*damageRatioByLevel[level]), sum = pelletCount*damagePerHit
// 리볼버: damagePerHit*(1 + pierceCount*pierceDamageRatio)
// 개틀링: damagePerHit
export const RADAR_AXES = ['발당 화력','초당 화력','탄창','장전 속도','다중 타격 수'] as const;
```
- 초당 화력 = `weaponBestCasePerShot * 1000 / GAME_TUNING.fire.holdIntervalMsByWeapon[kind]`.
- 탄창 = `maxAmmo`, 장전 속도 = `1000/reloadDurationMs`, 다중 타격 수 = 리볼버 `pierceCount`, 샷건 `extraTargetsByLevel`, 개틀링 0.
- `weaponRadarValues`: 축별 Lv.4 세 무기 최댓값을 100으로 정규화(판정 범위 축 삭제).
- `weaponStatBars`: 첫 막대 라벨 `한 발 피해(관통·산탄 포함)`, 값은 `weaponBestCasePerShot(kind, 4)`, ratio는 세 무기 최댓값 대비. 탄창·연사 막대는 유지.
- `weaponPerformanceText('shotgun')`: `주대상 합계 (+산탄 추가)` 형식, 예 `1.00 (+0.20 산탄) DMG`. 리볼버: `1.05 DMG, 1체 관통(관통 피해 50%)` 유지.

### I02. 차트 컴포넌트와 탭
- Related Files:
  - `src/pc/components/guide/WeaponRadar.tsx` :: `WeaponRadar` — modify (5축, 각주 문구)
  - `src/pc/components/guide/WeaponsTab.tsx` — modify (개요 섹션 유지, 샷건 문구 "넓은 판정" 없음 확인)
#### Details
- 각주: `축별 Lv.4 최댓값=100 · 샷건·리볼버는 옆·뒤 몬스터까지 맞은 최선의 경우 · 초당 화력은 누르고 쏘기 기준`.
- `shared/guideText.ts`의 `WEAPON_ONE_LINER.shotgun`("한 발이 강하고 주변까지 퍼져 맞는 근접 산탄")은 그대로 둔다.

### I03. 테스트
- Related Files:
  - `tests/guide-cards.test.tsx` — modify
#### Details
- 막대: 각 행 최댓값 무기의 ratio가 정확히 1, 모든 ratio 0..1.
- 서열: Lv.4 `weaponBestCasePerShot` 리볼버 > 샷건 > 개틀링.
- 레이더: 5축, Lv.4 축별 최댓값 100, 모든 값 0..100.

## Acceptance Criteria
- [ ] 레이더 축 5개, 판정 범위 축 없음
- [ ] Lv.4 한 발 피해 막대: 리볼버가 가장 길다
- [ ] 초당 화력 Lv.4: 리볼버 > 개틀링 > 샷건
- [ ] 가이드 테스트 통과, tsc 통과

## Validation
- `npx vitest run tests/guide-cards.test.tsx` — 통과
- `npx tsc --noEmit -p .` — 오류 없음

## Commit Message
```text
feat(guide): 무기 가이드에 5축 레이더 차트를 추가하고 한 발 피해 표기를 최선의 경우 기준으로 변경

Plan: 2026-11-10-weapon-power-order-and-radar
Phase: P02-guide-radar
Task: T01-guide-radar

- weaponBestCasePerShot·레이더 5축 계산 추가
- 막대·성능 문구를 관통/산탄 포함 한 발 피해로 변경
- 레이더 컴포넌트·가이드 탭 개요 섹션
- 가이드 테스트 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
