# Task: T02 칼날 렌더링과 타격 연출

## Status: done

## Goal
엔진의 칼날을 세로 초승달로 그리고, 칼날이나 거품이 닿는 순간 몬스터 높이에 타격 연출과 베인 자국을 보여 준다. "맞는 건지 모르겠다"를 해결하는 핵심 Task다.

## Decision Summary
- 결정 D05, D06. 화면 위치는 엔진 상태를 그대로 그린다. 평타 연출을 재사용하고 베인 자국만 새로 넣는다. 화면 흔들림은 넣지 않는다.
- 소비 코드는 `source`로 칼날·거품을 나누므로 P03의 거품도 이 코드를 그대로 쓴다.

## Implementation

### I01. 초승달과 베인 자국
- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `syncSkillBlades`(new), `spawnSlashMark`(new), `activeBladeMeshCount`(new), `spawnSkillEffect`, `clear`, `createWarmupObjects`, 생성자; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public syncSkillBlades(blades: ReadonlyArray<{ id: string; thetaRad: number; radiusM: number }>): void;
  public spawnSlashMark(position: THREE.Vector3): void;
  public get activeBladeMeshCount(): number;
  ```
- **초승달 도형** (`GAME_TUNING`을 `../../shared/gameTuning`에서 import):
  ```typescript
  const w = GAME_TUNING.skills.blade.halfWidthM;
  const h = 0.95; // 위아래 절반, 전체 1.9m
  const shape = new THREE.Shape();
  shape.moveTo(-w, h);
  shape.quadraticCurveTo(3 * w, 0, -w, -h); // 바깥 곡선, 가운데 x = +w
  shape.quadraticCurveTo(w + 0.4, 0, -w, h); // 안쪽 곡선
  this.bladeGeo = new THREE.ShapeGeometry(shape);
  this.bladeGeo.userData.isShared = true;
  this.bladeMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  this.bladeMat.userData.isShared = true;
  ```
- **`syncSkillBlades`**: `Map<string, THREE.Mesh>`과 메시 풀(최대 16개)을 쓴다. 칼날마다 `x = sin(θ)·r`, `y = 0.95`, `z = -cos(θ)·r`로 놓고 `rotation.y = Math.atan2(-x, -z)`로 돌린다. 목록에 없는 id의 메시는 그룹에서 빼고 풀로 돌려준다.
- **`spawnSlashMark`**: 공유 `PlaneGeometry(1.6, 0.12)`와 공유 `MeshBasicMaterial({ color: 0xfff7cc, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })`로 메시를 만들고 `rotation.z = Math.PI / 4`를 준다. 이 메시를 담은 그룹을 `position`에 두고 `group.lookAt(0, 1.65, 2.2)`로 카메라를 보게 한다. `skillEffects`에 `kind: 'revolver'`, `maxLifeSec: 0.2`, `updateFn`은 `t = life / 0.2`로 `mesh.scale.set(1 + t * 0.4, Math.max(0.01, 1 - t), 1)`, `return false`로 넣는다. 재질이 공유라 투명도 대신 크기로 사라지게 한다.
- **제거**: `spawnSkillEffect`의 리볼버 분기(부메랑), `boomerangBlade` getter, `skillGoldMat`, `skillBladeGeo`, `skillHookGeo`. `spawnSkillEffect` 첫머리에 `if (kind === 'revolver') return;`를 둔다. 개틀링 분기는 P03까지 그대로 둔다.
- **`clear()`**: 칼날 메시를 모두 그룹에서 빼고 Map을 비운다.
- **`createWarmupObjects()`**: `new THREE.Mesh(this.skillBladeGeo, this.skillGoldMat)`를 `new THREE.Mesh(this.bladeGeo, this.bladeMat)`와 `new THREE.Mesh(this.slashGeo, this.slashMat)`로 바꾼다.
- **함정**: 예열 목록에서 빠뜨리면 첫 시전 때 셰이더 컴파일로 화면이 멈춘다. `disposeObject3D`는 `userData.isShared`가 없으면 지우므로 공유 도형과 재질에 꼭 표시한다.

### I02. 화면 연결
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `computeSkillHitFxPosition`(new), `playTargetBurst`(new), `playShotFx`, `animate`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function computeSkillHitFxPosition(target: ActiveTargetEntity): THREE.Vector3 {
    const baseY = target.customBaseY ?? getTargetBaseY(target.kind, target.isItem);
    return new THREE.Vector3(target.x, baseY + 0.35, target.z);
  }
  const SKILL_HIT_SOUND_GAP_MS = 70;
  ```
- **Execution Flow / Logic**:
  1. `playShotFx`의 `if (result.killed) { ... } else { ... }` 블록(파편과 소리)을 `useCallback`으로 만든 `playTargetBurst(target, pos, killed, withSound)`로 옮기고, `playShotFx`에서는 `withSound: true`로 호출해 동작을 유지한다. 소리 호출만 `if (withSound)`로 감싼다. 포탄 분기는 지금처럼 소리를 내지 않는다.
  2. `animate`에서 `engine.update` 직후, "Sync 3D Target Meshes" 전에 이벤트를 처리한다.
     ```typescript
     for (const ev of engine.drainSkillHitEvents()) {
       const pos = computeSkillHitFxPosition(ev.target);
       const nowMs = performance.now();
       const canSound = nowMs - lastSkillHitSoundMs >= SKILL_HIT_SOUND_GAP_MS;
       if (canSound) lastSkillHitSoundMs = nowMs;
       if (ev.blocked) {
         particles.spawnHitEffect(pos, '#e2e8f0', 2);
         if (canSound) soundSynth.playShieldBlockSound();
         continue;
       }
       const mesh = targetMeshMap.get(ev.target.id);
       if (mesh && !ev.killed) applyTargetHitFlash3D(mesh, nowMs / 1000);
       playTargetBurst(ev.target, pos, ev.killed, canSound);
       if (ev.target.isProjectile && canSound) soundSynth.playInterceptSound();
       if (ev.source === 'blade') particles.spawnSlashMark(pos);
     }
     ```
     `lastSkillHitSoundMs`는 `animate` 바깥의 `let`으로 둔다.
  3. `particles.update(dtSec);` 바로 앞에 `particles.syncSkillBlades(engine.activeSkillBlades);`를 넣는다.
- **함정**:
  - 위치는 메시가 아니라 대상 객체에서 계산한다. 죽은 몬스터의 메시는 곧바로 지워지지만 `ev.target`의 `x`, `z`는 남아 있다.
  - 이벤트를 메시 제거 뒤에 처리하면 살아남은 대상의 번쩍임은 괜찮지만, 순서가 흐려지므로 `engine.update` 직후로 고정한다.
  - `triggerSkillEffect`의 리볼버 호출은 `spawnSkillEffect`가 바로 돌아오므로 그대로 둔다. `PCGamePage.executeSkill`은 바꾸지 않는다.
  - 카드 선택 중에는 엔진이 칼날을 안 움직이므로 칼날이 공중에 멈춘 채 보인다. 결정 D11의 의도된 동작이다.

### I03. 테스트
- Related Files:
  - `tests/three-stage-and-models.test.ts` :: 3종 스킬 FX 테스트(549~555행); modify

#### Details
- 부메랑 검사를 지우고 추가한다.
  - `fx.spawnSkillEffect('revolver', 3, monsterPos)` 후 `activeSkillEffects`가 늘지 않는다.
  - `fx.syncSkillBlades([{ id: 'a', thetaRad: 0.2, radiusM: 10 }])` 후 `activeBladeMeshCount`가 1이고, 빈 배열로 다시 부르면 0이다.
  - 초승달 도형의 `boundingBox` 폭이 `2 × GAME_TUNING.skills.blade.halfWidthM`(오차 0.01), 높이가 1.9다.
  - `fx.spawnSlashMark(new THREE.Vector3(0, 1, -5))` 후 0.25초 `update`하면 효과가 사라진다.
  - `computeSkillHitFxPosition`: 지상 몬스터 `y` 0.9, 포탄(`customBaseY: 1.45`) 1.8.
  - `createWarmupObjects()`에 칼날 재질을 쓰는 메시가 들어 있다.

## Acceptance Criteria
- [ ] 스킬을 쓰면 세로 초승달이 부채꼴로 날아가 필드 끝까지 간다.
- [ ] 칼날이 닿는 순간 몬스터가 찌그러지고 파편과 베인 자국이 보이며, 죽으면 터진다.
- [ ] 여러 마리를 맞혀도 타격음이 70ms 간격 안에 겹치지 않는다.
- [ ] 첫 시전 때 화면이 멈추지 않는다(예열 포함).

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- `npm run dev`만 켜고 `node scripts/capture-weapons-and-skills.mjs` 실행 후(`npm run server`를 처음 켜면 `data/players.json`의 점수가 백업 후 초기화되므로, 켜야 한다면 사용자에게 먼저 알린다) `docs/screens/screen-18-*.png`를 눈으로 확인한다(칼날이 보이는지, 시야를 너무 가리지 않는지). 사람이 볼 최종 확인은 P04-T03에서 한다.

## Commit Message
```text
feat(revolver): draw crescent blades and show hits where they land

Plan: 2026-11-05-weapon-skill-rework
Phase: P02-revolver-blades
Task: T02-blade-visuals

- crescent blades follow engine state each frame
- skill hits reuse the shot burst and add a slash mark at target height
- limit skill hit sounds to one per 70ms
- remove the boomerang effect
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
