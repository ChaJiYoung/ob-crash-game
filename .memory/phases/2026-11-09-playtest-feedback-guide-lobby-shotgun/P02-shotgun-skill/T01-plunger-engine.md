# Task: T01 샷건 스킬 엔진 재설계 (박힘 → 기절 → 폭발)

## Status: done

## Goal
샷건 스킬 "사방 뚫어뻥 폭풍"을 "방어선에 가까운 일반 몬스터 최대 4/5/6/8마리에 박혀 2.0/2.2/2.5/3.0초 기절한 뒤, 기절이 끝나는 순간 0.7/0.8/0.9/1.0 피해로 터진다"로 바꾼다. 보스는 즉시 피해만 받는다. 스킬 수치는 `GAME_TUNING.skills.plunger`로 옮긴다(D01~D04, D14, D16).

## Decision Summary
- 박히는 즉시 피해는 없다. 폭발 피해는 **박힌 몬스터 자신**에게만 들어가고 주변은 맞지 않는다(D02).
- 폭발 피해는 시전 시점에 고정(`getDamageBonusMultiplier` 포함, 블레이드와 같은 방식). 킬 점수·콤보는 스킬을 쓴 플레이어(`ownerIndex`) 몫이다(D16).
- 폭발 시각은 **`stunUntilMs`와 같다**(별도 시각 필드를 만들지 않는다). `freezeTimers`가 이미 `stunUntilMs`를 일시정지·카드 선택 시간만큼 밀어 주므로 폭발도 함께 밀린다.
- 박힌 채로 폭발 전에 죽으면 폭발 피해는 없고 **폭발 연출 이벤트만** 낸다(D16).
- 이미 박힌 몬스터는 새 시전의 대상에서 빼고 다음으로 가까운 몬스터를 고른다(2인팟 겹침 포함, D02).

## Implementation

### I01. 튜닝 값과 무기 표 덮어쓰기 (D14)
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.skills.plunger` — modify
  - `src/shared/types.ts` :: `WeaponLevelSpec` — modify
  - `src/shared/constants.ts` :: `applyWeaponTuning`, `BaseWeaponLevelSpec`, 195행 부근 주석 — modify
#### Details
- **Signatures & Types**:
  ```ts
  // gameTuning.ts, skills 안(blade, foam 옆)
  /** 샷건 '사방 뚫어뻥 폭풍'(2026-11-09 D01~D04). 박힘 상한은 방어선에 가까운 일반 몬스터부터, 보스는 박히지 않고 즉시 피해만 받는다. 기절이 끝나는 순간 박힌 몬스터가 터진다. */
  plunger: {
    stickMaxByLevel: { 1: 4, 2: 5, 3: 6, 4: 8 },
    stunMsByLevel: { 1: 2000, 2: 2200, 3: 2500, 4: 3000 },
    blastDamageByLevel: { 1: 0.7, 2: 0.8, 3: 0.9, 4: 1.0 },
    bossDamageByLevel: { 1: 4, 2: 5, 3: 6, 4: 6 },
    /** 화면에 그리는 뚫어뻥 수(피해와 무관). 지금 값 그대로. */
    visualCountByLevel: { 1: 12, 2: 15, 3: 18, 4: 22 },
  },
  ```
  ```ts
  // types.ts WeaponLevelSpec에 추가
  /** 샷건 스킬이 한 번에 박는 최대 일반 몬스터 수. 다른 무기는 0. */
  skillStickMax: number;
  ```
- **Execution Flow / Logic**: `constants.ts`의 `type BaseWeaponLevelSpec`이 `Omit<WeaponLevelSpec, 'skillBladeCount' | 'skillBladePierce' | 'skillFoamCount'>`이므로 `'skillStickMax'`를 Omit 목록에 추가한다(기본 표 3개 무기 항목에 새 필드를 쓰지 않아도 되게). `applyWeaponTuning`의 `levels[lv] = {...}`에 추가:
  ```ts
  skillStickMax: kind === 'shotgun' ? GAME_TUNING.skills.plunger.stickMaxByLevel[lv] : 0,
  ...(kind === 'shotgun'
    ? {
        skillDamage: GAME_TUNING.skills.plunger.blastDamageByLevel[lv],
        skillBossDamage: GAME_TUNING.skills.plunger.bossDamageByLevel[lv],
        skillStunMs: GAME_TUNING.skills.plunger.stunMsByLevel[lv],
        skillPlungerCount: GAME_TUNING.skills.plunger.visualCountByLevel[lv],
      }
    : {}),
  ```
  기본 표(`BASE_WEAPON_ARCHETYPE_SPECS.shotgun`)의 샷건 스킬 값(`skillDamage` 0.5 등)은 지우지 않는다(다른 무기도 같은 방식으로 남아 있다). 대신 195행 부근 주석의 "덮어쓴다" 목록에 `샷건 skillDamage·skillBossDamage·skillStunMs·skillPlungerCount`를 추가해 읽는 사람이 기본 표 값을 믿지 않게 한다.

### I02. 엔진: 시전(박힘 선택)·폭발·사격 중 처치·이벤트
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`(40~85행), `runWeaponSkill`(2711행), `update`(1247행), `handleMonsterKilled`(1782행), `applySkillDamage`(2442행), `SkillHitSource`(160행), `pushSkillHitEvent`(2600행), 새 private `advancePlungerBlasts` — modify
  - `src/pc/engine/engineEvents.ts` :: `EngineEvent` — modify
#### Details
- **Signatures & Types**:
  ```ts
  // ActiveTargetEntity (stunUntilMs 옆)
  /** 샷건 스킬 뚫어뻥이 박혀 있다. stunUntilMs가 되면 터져 damage를 준다(시전 시점에 고정). */
  plungerBlast?: { damage: number; ownerIndex: PlayerIndex };

  // SkillHitSource
  export type SkillHitSource = 'blade' | 'foam' | 'blast' | 'plunger';

  // engineEvents.ts
  | { type: 'plungerBlasted'; playerIndex: PlayerIndex; target: ActiveTargetEntity; killed: boolean; nowMs: number }
  ```
  ```ts
  /** 기절이 끝난 박힌 몬스터를 터뜨린다. update()에서 advanceSkillFoam 다음, 이동 처리 전에 호출한다. */
  private advancePlungerBlasts(nowMs: number): void
  ```
- **Execution Flow / Logic**:
  1. **시전**(`runWeaponSkill`의 `if (weaponKind === 'shotgun')` 분기를 통째로 교체). `bonus = player.weaponSystem.getDamageBonusMultiplier()`, `blastDamage = Number((levelSpec.skillDamage * bonus).toFixed(3))`. 후보 = 기존 `activeMonsters`(착지한 일반 표적, 이미 아이템·카드·투사체·황금 캔 제외)에서 `kind !== 'boss'`이고 "이미 박힘"(`m.plungerBlast !== undefined && (m.stunUntilMs ?? 0) > nowMs`)이 아닌 것. `radiusM` 오름차순(방어선에 가까운 순, 같으면 배열 순서 유지)으로 정렬해 앞에서 `levelSpec.skillStickMax`개를 `stuck`으로 한다. 각 `m`에 `m.stunUntilMs = nowMs + levelSpec.skillStunMs; m.stuckPlungerCount = 2; m.plungerBlast = { damage: blastDamage, ownerIndex: playerIndex };`, `affectedTargets.push(m)`. **즉시 피해는 주지 않는다.**
  2. 보스: `activeMonsters` 중 `kind === 'boss'`마다 `affectedTargets.push(boss); this.applySkillDamage(boss, this.getSkillDamage(boss, levelSpec, playerIndex), nowMs, playerIndex); if (this.bossClearUntilMs > 0) break;`. 기절·박힘 없음. `getSkillDamage`는 `skillBossDamage`(I01의 4/5/6/6)를 쓴다.
  3. 반환 객체는 기존 필드 유지: `{ activated: true, weaponKind, weaponLevel, affectedTargets, plungerCount: levelSpec.skillPlungerCount, playerIndex }`. `affectedTargets`는 이제 "박힌 몬스터 + 보스"이다(P02-T02가 연출에 쓴다).
  4. **폭발**(`advancePlungerBlasts`): `for (const t of [...this.activeTargets])`(스냅샷 복사본 — `applySkillDamage`가 목록을 `splice`하고 분열병이 추가되므로 원본을 순회하면 안 된다). `if (!t.plungerBlast) continue; if ((t.stunUntilMs ?? 0) > nowMs) continue;`. 그 몬스터에 대해 **먼저** `const blast = t.plungerBlast; t.plungerBlast = undefined; t.stuckPlungerCount = 0;`(이 순서가 4-6의 "죽기 전 폭발 연출 중복"을 막는다), 이어서 `const killed = this.applySkillDamage(t, blast.damage, nowMs, blast.ownerIndex);`, `this.pushSkillHitEvent({ source: 'plunger', target: t, killed, ownerIndex: blast.ownerIndex }); this.emit({ type: 'plungerBlasted', playerIndex: blast.ownerIndex, target: t, killed, nowMs });`.
  5. `update()`에서 `this.advanceSkillFoam(nowMs, dtSec);` 바로 다음 줄에 `this.advancePlungerBlasts(nowMs);`를 추가한다. 일시정지(`isPaused`)·카드 선택(`freezeOnSelect`)에서는 `update`가 그 앞에서 반환되므로 폭발이 일어나지 않고, 복귀 시 `freezeTimers`가 `stunUntilMs`를 밀어 준 값에 맞춰 터진다(별도 처리 불필요, 확인 테스트만 추가).
  6. **폭발 전에 죽는 경우**: `handleMonsterKilled`의 맨 앞(`VICTORY/GAMEOVER` 조기 반환보다 **앞**)에 추가: `if (target.plungerBlast && (target.stunUntilMs ?? 0) > nowMs) { this.pushSkillHitEvent({ source: 'plunger', target, killed: true, ownerIndex: target.plungerBlast.ownerIndex }); target.plungerBlast = undefined; target.stuckPlungerCount = 0; }`. 피해는 주지 않는다. 폭발 경로(4)는 `plungerBlast`를 먼저 비우므로 이 분기를 다시 타지 않는다.
  7. 스킬 사용자(`ownerIndex`)가 이탈 중(`isAway`)이어도 폭발은 몬스터 상태라 그대로 진행하고 점수는 그 플레이어에 기록한다(`applySkillDamage`는 `getPlayer(ownerIndex)`만 쓴다).
- **함정**: ① `update()` 안 이동 루프(1349행 부근)는 `!isStunned && target.stuckPlungerCount`이면 `stuckPlungerCount = 0`으로 되돌린다. 폭발은 이동 루프보다 **먼저** 처리돼야 `plungerBlast`가 정리된 뒤 이 정리가 돈다(순서: I02-5). ② 샷건 스킬로 몬스터가 박힌 뒤 보스 연출(`bossClearUntilMs > 0`)이 시작되면 `update`가 `advanceBossClear`로 갈라져 폭발이 잠시 처리되지 않는다. 연출이 끝나면 웨이브가 정리되므로 문제없다. ③ `plungerBlast`는 서버로 보내지 않는 엔진 내부 상태이므로 `debugSnapshot`·`hudSnapshot`에 넣을 필요가 없다(확인만).

### I03. 테스트와 문서·가이드 문구
- Related Files:
  - `tests/shotgun-plunger-skill.test.ts` :: 새 테스트 — new
  - `tests/engine-judgment-and-spawn.test.ts` :: 'shotgun skill' 구간(610~640행) — modify
  - `tests/shared-protocol.test.ts`, `tests/game-tuning.test.ts` — modify(필요 시)
  - `src/pc/components/GuideModal.tsx` :: 샷건 스킬 불릿(406행 부근) — modify
  - `docs/무기_및_스킬_가이드.md` :: 4장 ① 샷건 스킬 소절, 상세 수치표 — modify
  - `README.md` — 샷건 스킬 한 줄이 있으면 modify
#### Details
- 새 테스트 케이스(전부 `engine.update`로 시간을 진행해 폭발을 확인):
  1. 스킬 직후 박힌 몬스터의 `hp`는 그대로이고(즉시 피해 없음) `stunUntilMs === 시전 시각 + stunMs`, `plungerBlast.damage === 0.7(Lv1)`, `stuckPlungerCount === 2`. `affectedTargets`에 박힌 몬스터가 들어 있다.
  2. 몬스터 7마리 중 Lv1(상한 4)이면 방어선에 가장 가까운(`radiusM`이 작은) 4마리만 박히고, Lv4(8)에서는 7마리 전부 박힌다.
  3. `stunUntilMs` 직전(`update(stunUntilMs - 1, ...)`)에는 `hp` 불변, 직후(`update(stunUntilMs, ...)`)에 `hp -= 0.7`, `plungerBlast` 소멸, `skillHitEvents`에 `source: 'plunger'` 이벤트(`drainSkillHitEvents()`)와 `plungerBlasted` 엔진 이벤트.
  4. 체력 0.5 몬스터가 박혀 있다가 터지면 사라지고 `player.totalKills`가 오르며 `killed: true` 이벤트가 나간다(점수는 시전자 몫: 2인 엔진에서 `playerIndex: 1`이 쏘면 1번 플레이어 점수).
  5. 박힌 몬스터를 평타로 죽이면 폭발 피해는 없고(다른 몬스터 체력 불변) `source: 'plunger'`, `killed: true` 연출 이벤트만 한 번 나가며, 이후 `update`에서 같은 몬스터가 다시 터지지 않는다.
  6. 이미 박힌 몬스터는 두 번째 시전에서 제외되고 다음으로 가까운 몬스터가 박힌다(2인팟 두 번 시전 시나리오).
  7. 보스는 `plungerBlast`·기절이 없고 즉시 `skillBossDamage`(Lv1 4)만 받는다. 보스가 있어도 일반 몬스터 상한(4)에는 포함되지 않는다.
  8. 카드 선택으로 정지(`engine.isSelectPending = true` → `update` 반복) 중에는 폭발하지 않고, 해제 후 밀린 시각에 터진다(`freezeTimers` 시나리오: 선택 3초 → 폭발도 3초 뒤).
  9. `WEAPON_ARCHETYPE_SPECS.shotgun.levels[l]`의 `skillStunMs/skillDamage/skillBossDamage/skillPlungerCount/skillStickMax`가 `GAME_TUNING.skills.plunger`와 같고 리볼버·게틀링의 `skillStickMax`는 0이다. `skillCooldownMs`는 21000/19000/16000/14000 그대로.
  10. 이탈(`isAway`) 플레이어 몫의 폭발도 터진다(`engine.getPlayer(0).isAway = true` 후 시간 진행).
- `tests/engine-judgment-and-spawn.test.ts` 610~640행: `m1.hp`는 4.0 그대로, `m1.stunUntilMs` 3000(1000 + 2000), `m1.plungerBlast`가 있음으로 바꾸고, `engine.update(1500, 0.5)` 정지 확인은 유지, 그 뒤 `engine.update(3000, 1.5)`에서 `m1.hp === 3.3`이 되는지 확인한다.
- `GuideModal.tsx` 샷건 스킬 불릿: "12~22개의 미니 뚫어뻥 … 1.0~2.0초 부착 기절"을 새 동작(박힘 마릿수 `levelSeries(skillStickMax)`, 기절 `levelSeries(skillStunMs/1000)`초, 폭발 피해, 보스는 즉시 피해만)으로 **튜닝 값에서 계산**해 바꾼다(D12). 이 불릿은 P05에서 카드로 다시 옮겨진다.
- `docs/무기_및_스킬_가이드.md` 4장 ①과 수치표(스킬 칸)를 새 동작으로 고친다. `tests/docs-sync.test.ts`가 문서의 표·문구를 검사하므로 전체 테스트로 확인한다.

## Acceptance Criteria
- [ ] 스킬 직후 박힌 몬스터에 즉시 피해가 없고, 기절이 끝나는 순간 폭발 피해가 들어간다(Lv별 0.7/0.8/0.9/1.0).
- [ ] 박히는 마릿수가 방어선에 가까운 순서로 4/5/6/8마리로 제한되고, 이미 박힌 몬스터는 재선택되지 않는다.
- [ ] 보스는 박히지 않고 즉시 피해(4/5/6/6)만 받는다.
- [ ] 박힌 채 죽으면 폭발 피해 없이 연출 이벤트만 한 번 나가고, 폭발 점수·킬은 시전자 몫이다.
- [ ] 일시정지·카드 선택 정지 후에도 폭발 시각이 밀려서 맞는다.
- [ ] 샷건 스킬 수치가 `GAME_TUNING.skills.plunger`에서만 나온다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/shotgun-plunger-skill.test.ts tests/engine-judgment-and-spawn.test.ts tests/shared-protocol.test.ts tests/game-tuning.test.ts tests/skill-double-trigger.test.ts tests/skill-damage-bonus.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(shotgun): 스킬을 박힘·기절·폭발 방식으로 재설계하고 수치를 GAME_TUNING으로 이전

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P02-shotgun-skill
Task: T01-plunger-engine

- I01 GAME_TUNING.skills.plunger와 skillStickMax, applyWeaponTuning 덮어쓰기
- I02 엔진: 방어선 순 마릿수 상한 박힘, 기절 종료 시 폭발, 박힌 채 죽을 때 연출 이벤트, plungerBlasted 이벤트
- I03 테스트·가이드 문구·문서 동기화
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-plunger-engine"
