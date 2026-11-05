# Task: T02 보스 처치 화면 연출

## Status: pending

## Goal
엔진의 보스 처치 사건을 받아 큰 폭발, 연쇄 폭발, 중앙 "BOSS DOWN!" 배너를 보여 준다.

## Decision Summary
- 결정 D10. 평타·칼날·거품·뚫어뻥 모든 처치 경로는 엔진 사건 하나로 통일된다. 처치한 일격의 일반 폭발음은 그대로 나고, 사건 연출은 파편과 배너만 더한다(소리 중복 방지).

## Implementation

### I01. HUD 값
- Related Files:
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot.bossDown`(new boolean), `buildHudSnapshot`; modify
  - `tests/hud-snapshot.test.ts`; modify

#### Details
- `HudSnapshot`에 `bossDown: boolean` 추가, `buildHudSnapshot`에서 `bossDown: engine.isBossClearSequence()`. `isHudSnapshotEqual`은 키를 순회하므로 자동 반영된다.
- 테스트: 보스 처치 직후 `bossDown`이 true이고 시퀀스 뒤 false이다.

### I02. 배너
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `WAVE n CLEAR` 배너 위쪽에 "BOSS DOWN!" 배너; modify

#### Details
- `gamePhase === 'PLAYING' && hudState.bossDown`일 때 화면 중앙(`top: '38%'`, `left: '50%'`, `transform: 'translateX(-50%)'`)에 큰 글씨 배너를 그린다. `data-testid="boss-down-banner"`, 글자 `BOSS DOWN!`, 금색(`#fbbf24`) 글씨, 굵기 900, 크기 `56px`, 외곽선과 그림자, `zIndex: 125`, `pointerEvents: 'none'`. 짧은 확대 애니메이션(`@keyframes`가 이미 있으면 재사용, 없으면 `transform: scale`을 인라인 `animation`으로)을 넣는다.
- 기존 `WAVE n CLEAR` 배너(`top: '16%'`)와 겹치지 않는 위치다.
- 테스트(`tests/pc-hud-and-banner.test.ts` 또는 `wave-clear-banner.test.ts` 방식 참고): `bossDown`이 true일 때 배너가 렌더되고 false일 때 없다.

### I03. 3D 연출
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `animate`의 이벤트 처리; modify
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnBossDefeatBurst`(new); modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 보스가 터지는 큰 폭발: 흰·금색 파편과 거품을 한꺼번에 뿜는다. 파티클 풀 용량(96)을 넘지 않게 나눠서 호출한다. */
  public spawnBossDefeatBurst(position: THREE.Vector3): void
  ```
  구현: `spawnHitEffect(position, '#fbbf24', 30)` + `spawnHitEffect(position, '#ffffff', 30)` + `triggerBottleCrash(position, 5)`(유리 파편). 위치는 `new THREE.Vector3(ev.x, ev.y + 0.6, ev.z)`.
- `animate`에서 스킬 타격 사건 처리 바로 뒤에 추가:
  ```typescript
  for (const ev of engine.drainBossClearEvents()) {
    if (ev.type === 'defeated') {
      particles.spawnBossDefeatBurst(new THREE.Vector3(ev.x, ev.y + 0.6, ev.z));
      continue;
    }
    const pos = computeSkillHitFxPosition(ev.target);
    const nowMs = performance.now();
    const canSound = nowMs - lastSkillHitSoundMs >= SKILL_HIT_SOUND_GAP_MS;
    if (canSound) lastSkillHitSoundMs = nowMs;
    playTargetBurst(particles, soundSynth, ev.target, pos, true, canSound);
  }
  ```
- **함정**: 연쇄 대상은 이미 `activeTargets`에서 빠졌으므로 메시가 다음 프레임에 지워진다. 위치는 대상 객체의 좌표에서 계산한다(메시가 아니라). 보스 폭발 파편은 `Boss.explosion` 소리를 따로 내지 않는다(일격 경로에서 이미 난다).
- 기존 평타 경로의 보스 처치(`playShotFx`)와 스킬 경로(`drainSkillHitEvents`)는 그대로 둔다.

## Acceptance Criteria
- [ ] 보스를 잡으면 큰 폭발이 나고 남은 몬스터가 순서대로 터진다.
- [ ] 화면 중앙에 "BOSS DOWN!"이 1.5초 뜨고 카드·결과 화면이 그 뒤에 나온다.
- [ ] 소리가 겹쳐 시끄럽지 않다(70ms 제한).

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- `npm run dev`만 켜고 플레이/캡처 스크립트로 보스 처치 장면을 한 장 찍어 눈으로 확인한다(스크립트는 P04-T01에서 갱신).

## Commit Message
```text
feat(boss): show an explosion, a cascade and a banner when the last boss falls

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P02-boss-clear-effect
Task: T02-boss-clear-visuals

- big defeat burst at the boss position
- cascade bursts for the leftover monsters
- BOSS DOWN! banner while the sequence runs
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
