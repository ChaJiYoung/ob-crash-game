# Task: T01 한맥 발사 제거와 폭탄 캔

## Status: pending

## Goal
한맥은 쏘지 않고 방어선까지 오며, 잡으면 터져 주변 몬스터에게 피해를 준다. 똥은 보스 전용이 된다.

## Decision Summary
- 결정 D04. 반경 4m, 피해 2, 일반 플레이에서만. 보스·아이템·똥·카드·낙하 중 대상 제외.

## Implementation

### I01. 발사 제거
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: 이동 루프 hanmac 분기, `hanmacArrivedAtMs`, `lastFireMs`, `spawnMonsterProjectile`, `ProjectileLaunchEvent`; modify
  - `src/shared/gameTuning.ts` :: `monsters.hanmac` → `{ blastRadiusM: 4, blastDamage: 2 }`; modify
#### Details
- 출처 타입을 `'boss'`만 남긴다. 테스트와 스크립트의 `'hanmac'` 인자도 바꾼다.

### I02. 지연 폭발
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `pendingHanmacBlasts`, `processHanmacBlasts`, `hanmacBlastEvents`, `drainHanmacBlastEvents`, `handleMonsterKilled`, `SkillHitSource`; modify
#### Details
- 함정: `handleMonsterKilled` 안에서 바로 터뜨리면 안 된다. 관통 사격은 `index`를 잡은 채 대상을 처리하는 중이고 칼날·거품도 목록을 도는 중이라, 폭발이 다른 대상을 지우면 잘못된 대상이 제거되거나 두 번 처리될 수 있다. 큐에 넣고 다음 `update`의 이동 처리 전에 처리한다.
- `handleMonsterKilled`: 일반 플레이의 `kind === 'hanmac'`이면 위치를 큐에 넣는다. 보스 처치 연출 중 반환 뒤에 둬서 연쇄 폭발에서는 터지지 않는다. 방어선 통과는 이 함수를 거치지 않는다.
- `processHanmacBlasts`: 큐를 비울 때까지 반복한다. 사건을 넣고 xz 거리 반경 안 대상에 `applySkillDamage`와 `pushSkillHitEvent({source:'blast'})`. 죽은 대상은 목록에서 빠지므로 연쇄가 무한 반복되지 않는다. 오비 방패는 스킬처럼 뚫는다.
- 연출 중이거나 새 웨이브면 큐를 버린다(`resetBossClear`, `startBossClearSequence`).

### I03. 표시
- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: 한맥 빨간 띠와 심지; modify
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnHanmacBlast`; modify
  - `src/pc/audio/SoundSynthesizer.ts` :: `playHanmacBlastSound`; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 사건 소비; modify

### I04. 테스트
- Related Files:
  - `tests/hanmac-bomb.test.ts`; new
  - `tests/monster-traits.test.ts`, `tests/boss-encounters.test.ts`, `tests/boss-minion-drop.test.ts`, `tests/poop-shell.test.ts`; modify
#### Details
- 한맥이 쏘지 않고 방어선을 넘어 체력을 깎는다. 폭발은 반경 안 몬스터만 2 피해, 보스·똥·아이템 제외, 연쇄 동작, 방어선 통과와 샌드박스에서 없음, 관통 사격 중 처치에 안전.

## Acceptance Criteria
- [ ] 보스 없는 웨이브에 똥이 나오지 않는다.
- [ ] 한맥을 잡으면 주변이 터지고 체력 구간 소환은 영향이 없다.

## Validation
- `npm test`, `npx tsc --noEmit` — 통과

## Commit Message
```text
feat(hanmac): replace its shelling with a blast when it is killed

Plan: 2026-11-05-boss-distance-gatling-hanmac
Phase: P02-hanmac-bomb
Task: T01-hanmac-bomb

- Hanmac now walks to the defense line and only bosses fire shells
- Queue the blast for the next update so it cannot disturb a shot in progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
