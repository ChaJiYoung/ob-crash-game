# Task: T01 튜닝 값 변경과 테스트·무기 가이드 표 동기화

## Status: done

## Goal
스킬 쿨타임·오비 방패 주기·장전 배율·탄수를 새 값으로 바꾸고, 샷건·리볼버 탄수도 `gameTuning.ts`에서 조정되게 한다. 값을 가리키는 기존 테스트와 `docs/무기_및_스킬_가이드.md` 표(docs-sync 테스트가 검사)를 같은 Task에서 고쳐 `npm test`가 통과하게 한다.

## Decision Summary
- 결정 문서 D01~D04. 실제 적용 값의 원천은 `GAME_TUNING`이다. `constants.ts`의 `BASE_WEAPON_ARCHETYPE_SPECS`에 있는 `skillCooldownMs`·`reloadDurationMs`·(샷건·리볼버)`maxAmmo`는 `applyWeaponTuning`이 덮어쓰므로 건드리지 않는다.
- 샷건·리볼버 탄수는 현재 base 표에서 오므로(`kind === 'gatling' ? ... : b.maxAmmo`), `gatlingMaxAmmoByLevel`을 무기별 표 `maxAmmoByWeapon`으로 일반화한다.

## Implementation

### I01. `gameTuning.ts` 값 변경
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING` — 수치 변경과 탄수 표 일반화; modify

#### Details
- **변경할 필드(정확한 새 값)**:
  ```ts
  skillCooldownMsByLevel: { 1: 21000, 2: 19000, 3: 16000, 4: 14000 },   // 기존 35/31/27/23초
  fire: { intervalScale: 0.7, reloadScale: 1.2, /* holdDamageByWeapon, holdIntervalScaleByWeapon 그대로 */ },  // reloadScale 기존 2.0
  monsters: { /* ... */ obi: { guardUpMs: 800, guardDownMs: 2400 }, /* ... */ },  // 기존 1500 / 1500
  // gatlingMaxAmmoByLevel 삭제, 아래로 교체
  maxAmmoByWeapon: {
    shotgun:  { 1: 10, 2: 10, 3: 12, 4: 12 },
    revolver: { 1: 10, 2: 10, 3: 12, 4: 12 },
    gatling:  { 1: 20, 2: 25, 3: 30, 4: 35 },
  },
  ```
- 주석: `maxAmmoByWeapon` 위에 "무기·레벨별 기본 탄수. rapid_reload 카드가 장당 +2발 더한다" 한 줄. `gameTuning.ts`는 다른 파일을 import하지 않는다는 규칙 유지(순환 참조 방지, 파일 머리 주석).
- 새 값으로 계산되는 실제 장전 시간(ms, `Math.round(base × 1.2)`): 샷건 1680/1560/1440/1320, 리볼버 1680/1440/1320/1200, 개틀링 1680/1560/1440/1200.

### I02. `applyWeaponTuning`이 새 표를 쓰도록 수정
- Related Files:
  - `src/shared/constants.ts` :: `applyWeaponTuning` — `maxAmmo` 줄 교체; modify
  - `.memory/references/scripts/*` 및 `scripts/*` 중 `gatlingMaxAmmoByLevel`을 쓰는 파일 — 이름 변경 반영; modify(있을 때만)

#### Details
- 교체 전: `maxAmmo: kind === 'gatling' ? GAME_TUNING.gatlingMaxAmmoByLevel[lv] : b.maxAmmo,`
- 교체 후: `maxAmmo: GAME_TUNING.maxAmmoByWeapon[kind][lv],`
- 먼저 `grep -rn "gatlingMaxAmmoByLevel" src tests scripts .memory/references docs README.md`로 남은 참조를 모두 찾아 `maxAmmoByWeapon.gatling`로 바꾼다. 하나라도 남으면 `tsc`가 실패한다.
- base 표(`BASE_WEAPON_ARCHETYPE_SPECS`)의 `maxAmmo`는 타입상 필수라 값을 그대로 둔다. 표 위 주석에 "maxAmmo는 GAME_TUNING.maxAmmoByWeapon이 덮어쓴다"를 한 줄 추가한다.

### I03. 깨지는 테스트 기대값 수정 + 새 테스트
- Related Files:
  - `tests/shared-protocol.test.ts` — 탄수·쿨타임·장전 기대값; modify
  - `tests/weapon-rules.test.ts` — 장전 시간·탄수 기대값; modify
  - `tests/game-tuning.test.ts` — 쿨타임 기대값 + 새 불변식 테스트; modify

#### Details
- `tests/shared-protocol.test.ts`:
  - 개틀링 Lv.1 `maxAmmo` 13→**20**, Lv.4 25→**35** (127·129행 근처).
  - `new WeaponSystem('shotgun', 1)` 초기 `maxAmmo`/`ammo` 5→**10** (157·158행).
  - Lv.1 쿨타임 35000→**21000** (167행). 10초 경과 후 남은 시간 25000→**11000**(21000−10000) (175행). 남은 시간 소진용 호출은 `ws.update(22000, false, 11000)`로 바꿔 재충전을 확인한다(기존 `36000, 25000` 대체).
  - 레벨업 후 `maxAmmo`: Lv.2 **10**, Lv.3 **12**, Lv.4 **12** (185~193행).
  - rapid_reload 적용 후: `maxAmmo` **14**(12+2), `getReloadDurationMs()` **1056**(1320×0.8) — 주석도 `1100*2*0.8=1760`에서 `1100*1.2*0.8=1056`으로 (200·201행).
  - 개틀링 선택 후: `maxAmmo` **22**(20+2) (206행).
- `tests/weapon-rules.test.ts`: 67행 `toBe(1400 * 2)` → `toBe(Math.round(1400 * GAME_TUNING.fire.reloadScale))`(=1680). 68행 `GAME_TUNING.gatlingMaxAmmoByLevel[3]` → `GAME_TUNING.maxAmmoByWeapon.gatling[3]`.
- `tests/game-tuning.test.ts`: 60행 `toBe(35000)` → `toBe(21000)`. 같은 파일에 아래 `describe('2026-11-05 tuning')`을 추가:
  1. 샷건·리볼버·개틀링 모두 `WEAPON_ARCHETYPE_SPECS[kind].levels[lv].maxAmmo`가 `GAME_TUNING.maxAmmoByWeapon[kind][lv]`와 같다(12개 조합).
  2. 샷건·리볼버 Lv.1 탄수는 10, 모든 무기에서 레벨이 오를수록 탄수가 줄지 않는다.
  3. 오비 `guardDownMs / (guardUpMs + guardDownMs)`가 0.7 이상이다(내려간 비율 75%).
  4. 쿨타임 4레벨이 단조 감소한다.
- 이 외에 `npm test`가 새로 깨는 테스트(예: 5발을 가정하고 루프를 도는 테스트)는 하드코딩된 숫자 대신 `weapon.getMaxAmmo()`를 쓰도록 고친다. 의도(탄창을 비워 장전을 일으킨다)는 유지한다.

### I04. 무기 가이드 표 동기화
- Related Files:
  - `docs/무기_및_스킬_가이드.md` :: "3. Lv.1 ~ Lv.4 (MAX) 상세 밸런스 수치표" — 탄창·장전 시간·스킬 쿨타임 열과 80행 요약 문장; modify

#### Details
- `tests/docs-sync.test.ts`가 각 행에서 `${maxAmmo}발`, `${(reloadDurationMs/1000).toFixed(1)}s`, `${skillCooldownMs/1000}s`를 찾는다. 새 값(Lv.1→4 순서):
  | 무기 | 탄창 | 장전 시간 | 스킬 쿨타임 |
  | :--- | :--- | :--- | :--- |
  | 샷건 | 10발 / 10발 / 12발 / 12발 | 1.7s / 1.6s / 1.4s / 1.3s | 21s / 19s / 16s / 14s |
  | 리볼버 | 10발 / 10발 / 12발 / 12발 | 1.7s / 1.4s / 1.3s / 1.2s | 21s / 19s / 16s / 14s |
  | 개틀링 | 20발 / 25발 / 30발 / 35발 | 1.7s / 1.6s / 1.4s / 1.2s | 21s / 19s / 16s / 14s |
- 쿨타임 열의 `(1회)`, `(**2회 스택**)` 표기와 다른 열은 그대로 둔다.
- 80행 요약 문장을 "연사 간격 ×0.7, 장전 ×1.2, 샷건 피해 ×1.2, 개틀링 피해 ×2, 탄창 샷건·리볼버 10/10/12/12 · 개틀링 20/25/30/35, 스킬 쿨타임 21/19/16/14초"로 바꾼다.

## Acceptance Criteria
- [ ] `GAME_TUNING`에 `gatlingMaxAmmoByLevel`이 없고 `maxAmmoByWeapon`이 있으며, 코드 어디에도 옛 이름이 남지 않는다.
- [ ] `WEAPON_ARCHETYPE_SPECS.shotgun.levels[1].maxAmmo === 10`, `...gatling.levels[4].maxAmmo === 35`, `...shotgun.levels[1].skillCooldownMs === 21000`, `...shotgun.levels[1].reloadDurationMs === 1680`.
- [ ] `GAME_TUNING.monsters.obi`가 `{ guardUpMs: 800, guardDownMs: 2400 }`.
- [ ] `npm test` 전체 통과(docs-sync 포함), `npx tsc --noEmit` 오류 없음.

## Validation
- `grep -rn "gatlingMaxAmmoByLevel" src tests scripts .memory/references docs README.md` — 결과 없음
- `npx tsc --noEmit` — 오류 없음
- `npm test` — 전체 통과

## Commit Message
```text
feat(tuning): faster skills, longer shield-down time, bigger magazines

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P01-tuning-values
Task: T01-tuning-values-and-weapon-table

- skill cooldown 35/31/27/23s -> 21/19/16/14s
- obi guard 1.5s/1.5s -> 0.8s up / 2.4s down
- reloadScale 2.0 -> 1.2
- maxAmmoByWeapon replaces gatlingMaxAmmoByLevel (shotgun/revolver 10/10/12/12, gatling 20/25/30/35)
- update tests and the weapon guide table to the new values
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
