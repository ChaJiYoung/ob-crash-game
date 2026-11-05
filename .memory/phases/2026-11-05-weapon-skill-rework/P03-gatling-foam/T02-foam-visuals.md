# Task: T02 작은 거품 렌더링

## Status: done

## Goal
작은 거품을 많이 뿌려 파도처럼 쓸고 가는 모습을 그리고, 레벨업하면 거품이 많아 보이게 한다. 지금은 큰 거품 50개라 레벨 차이도 없고 파도 앞면과도 맞지 않는다.

## Decision Summary
- 결정 D08. 거품은 엔진 파도 앞면을 따라가므로 "닿는 순간"과 화면이 일치한다. 인스턴싱으로 그린다. 거품 수는 보이는 부분만 바꾼다.

## Implementation

### I01. 인스턴스 거품
- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `syncSkillFoam`(new), `foamWaveInstanceCount`(new), `spawnSkillEffect`, `clear`, `createWarmupObjects`, 생성자; modify

#### Details
- **Signatures & Types**:
  ```typescript
  const FOAM_WAVE_CAPACITY = 600; // Lv.4 2회 연속(280 x 2)을 담는다
  interface FoamWaveSeeds { theta: Float32Array; back: Float32Array; y: Float32Array; scale: Float32Array; color: Uint8Array; }
  private foamWaveMesh: THREE.InstancedMesh;
  private foamWaveSeeds = new Map<string, FoamWaveSeeds>();
  public syncSkillFoam(waves: ReadonlyArray<{ id: string; radiusM: number; count: number }>, spreadHalfRad: number): void;
  public get foamWaveInstanceCount(): number; // this.foamWaveMesh.count
  ```
- **생성자**: `new THREE.SphereGeometry(1, 6, 6)`(공유 표시), `MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })`(공유 표시)로 `InstancedMesh`를 만든다. `frustumCulled = false`, `count = 0`, `instanceMatrix.setUsage(THREE.DynamicDrawUsage)`, `setColorAt(0, white)`, `instanceColor.setUsage(THREE.DynamicDrawUsage)`, `this.group.add(...)`.
- **`syncSkillFoam` 흐름**:
  1. 목록에 없는 id의 씨앗을 지운다.
  2. 새 파도의 씨앗을 만든다: `theta`는 `±spreadHalfRad` 균등, `back`은 0~2.4m, `y`는 0.1~1.7m, `scale`은 0.045~0.11m, `color`는 0~2(흰색 `0xffffff`, 연하늘 `0xe0f2fe`, 하늘 `0x7dd3fc`).
  3. 파도마다 `i`를 돌며 용량까지 채운다.
     ```typescript
     const r = Math.max(0.6, wave.radiusM - seeds.back[i]);
     const s = seeds.scale[i] * (1 + r * 0.04); // 멀어져도 보이게
     const y = seeds.y[i] + Math.sin(r * 1.5 + i) * 0.12;
     matrix.makeScale(s, s, s).setPosition(Math.sin(seeds.theta[i]) * r, y, -Math.cos(seeds.theta[i]) * r);
     mesh.setMatrixAt(n, matrix);
     mesh.setColorAt(n, FOAM_COLORS[seeds.color[i]]);
     n++;
     ```
  4. `mesh.count = n`. `n > 0`이거나 직전 count가 0보다 크면 `instanceMatrix.needsUpdate = true`, `instanceColor.needsUpdate = true`.
- **제거**: `spawnSkillEffect`의 개틀링 분기, `tsunamiBubbles` getter, `skillFoamGeo`, `skillFoamMats`. `spawnSkillEffect` 첫머리를 `if (kind !== 'shotgun') return;`로 바꾼다. 샷건 분기는 그대로 둔다. 더는 쓰지 않는 `spec`이 있으면 분기 안으로 옮긴다.
- **`clear()`**: `foamWaveMesh.count = 0`, 씨앗 Map 비우기.
- **`createWarmupObjects()`**: `new THREE.Mesh(this.skillFoamGeo, this.skillFoamMats[0])`를 지우고, 인스턴스 변종을 직접 넣는다.
  ```typescript
  const foamInst = new THREE.InstancedMesh(this.foamWaveMesh.geometry, this.foamWaveMesh.material, 1);
  foamInst.setMatrixAt(0, new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
  foamInst.setColorAt(0, new THREE.Color(0xffffff));
  objs.push(foamInst);
  ```
- **함정**:
  - `createBatch`로 만들면 안 된다. `updateBatch`가 매 프레임 `count`를 파티클 수로 덮어써 거품이 사라진다. 그래서 예열 반복문에도 안 들어가므로 위처럼 직접 넣는다. 빠뜨리면 첫 시전 때 화면이 멈춘다.
  - 파도가 끝나면(앞면 25m) 엔진이 지우면서 거품도 한 번에 사라진다. 그 거리는 안개(`FogExp2 0.02`) 안쪽이지만 거품이 작아 거의 안 보인다. 눈에 띄면 P04-T03 피드백으로 조정한다.

### I02. 화면 연결
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `animate`; modify

#### Details
- `particles.syncSkillBlades(...)` 다음 줄에 넣는다. `computeHorizontalHalfFovRad`는 `../engine/FanSpawner`에서 import한다.
  ```typescript
  particles.syncSkillFoam(
    engine.activeSkillFoamWaves,
    computeHorizontalHalfFovRad(engine.vFovDeg, engine.aspect) + 0.15 // 화면 양옆 끝까지
  );
  ```
- 거품 타격 이벤트는 P02-T02의 소비 코드가 이미 처리한다(`source === 'foam'`이면 베인 자국 없이 평타 연출만).

### I03. 테스트
- Related Files:
  - `tests/three-stage-and-models.test.ts` :: 3종 스킬 FX 테스트(557~562행); modify

#### Details
- 기존 `tsunamiBubbles` 검사를 지우고 추가한다.
  - `fx.spawnSkillEffect('gatling', 4, monsterPos)` 후 `activeSkillEffects`가 늘지 않는다.
  - `fx.syncSkillFoam([{ id: 'w', radiusM: 8, count: 120 }], 0.8)` 후 `foamWaveInstanceCount`가 120이다.
  - 같은 id로 `radiusM: 12`로 부르면 첫 거품이 원점에서 더 멀어진다(`getMatrixAt`으로 위치 확인).
  - 두 파도(280, 280)는 560개, 합이 600을 넘으면 600에서 멈춘다.
  - 빈 배열로 부르면 0이다.
  - `createWarmupObjects()`에 `InstancedMesh`로 거품 재질을 쓰는 객체가 들어 있다.
  - 거품 크기가 이전(0.15m 이상)보다 작다: 씨앗 `scale` 최대 0.11.

## Acceptance Criteria
- [ ] 스킬을 쓰면 작은 거품이 촤악 퍼지며 필드 끝까지 간다.
- [ ] Lv.4의 거품이 Lv.1보다 확실히 많다.
- [ ] 거품 앞면이 닿는 순간 몬스터가 밀리기 시작한다.
- [ ] 첫 시전 때 화면이 멈추지 않는다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 통과
- `grep -n "skillFoamGeo\|skillFoamMats\|tsunamiBubbles" src/pc/three/ParticleEffects3D.ts tests/*.ts` — 결과 없음
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- `npm run dev`만 켜고 `node scripts/capture-weapons-and-skills.mjs` 실행 후 `docs/screens/screen-19-skill-foam-tsunami.png`를 눈으로 확인한다. `perf-frame-profile.mjs`는 스킬을 쓰지 않으므로 프레임 저하는 P04-T03 직접 플레이에서 본다. 떨어지면 `GAME_TUNING.skills.foam.countByLevel`을 줄인다.

## Commit Message
```text
feat(gatling): spray many small instanced bubbles along the foam wave

Plan: 2026-11-05-weapon-skill-rework
Phase: P03-gatling-foam
Task: T02-foam-visuals

- bubbles follow the engine wave front so visuals match the hit moment
- bubble count grows with weapon level
- instanced rendering with shader warmup
- remove the old foam spheres
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
