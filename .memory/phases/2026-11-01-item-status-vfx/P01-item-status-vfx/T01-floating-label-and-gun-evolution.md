# Task: T01 피격 지점 3D 플로팅 숏라벨 팝업 및 파워샷 총기 골든 캐논 진화·홀로그램 사이트 빔 구현

## Status: done

## Goal
아이템을 사격하여 명중·획득한 바로 그 3D 월드 좌표에서 영문 숏라벨(`💥 DAMAGE 2X`, `🎯 WIDE 1.6X`, `🧊 SLOW 50%`, `🍺 LIFE +1`)이 위로 0.8초간 솟구치며 페이드아웃되는 3D 플로팅 텍스트 이펙트를 구현하고, 파워 샷 활성 시 총기(생맥주 탭 건)가 황금빛 '골든 드래프트 캐논'으로 진화하며, 빅 스코프 활성 시 총구 전방에 홀로그램 가이드 빔이 전개되도록 구현한다.

## Decision Summary
- `2026-11-01-intuitive-items.md` (D01, D02, D03):
  - 평소에는 글자 없이 3D 소품과 발광 오라 링만 부유.
  - 피격 순간 해당 3D 위치에서 간결한 영문 숏라벨이 위로 0.8초간 Y축 상승 및 페이드아웃 소멸.
  - 파워 샷 활성 시 3D 총기가 골든 캐논으로 진화 + 화염 오라 구체 점등.
  - 빅 스코프 활성 시 총구 전방에 홀로그램 조준 가이드 빔 투사.

## Implementation

### I01. 3D 플로팅 숏라벨 시스템 (`ParticleEffects3D.ts`)

- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `ParticleEffects3D.spawnFloatingLabel`, `FloatingLabelItem` — 3D 월드 좌표에서 위로 솟구치며 페이드아웃되는 텍스트 스프라이트 이펙트 구현; modify
  - `src/shared/constants.ts` :: `ITEM_BUFF_SPECS` — 영문 숏라벨 정의 확인; read-only

#### Details
- **Signatures & Types (`src/pc/three/ParticleEffects3D.ts`)**:
  ```typescript
  interface FloatingLabelItem {
    sprite: THREE.Sprite;
    initialPos: THREE.Vector3;
    lifeSec: number;
    maxLifeSec: number; // 0.8s
  }

  export class ParticleEffects3D {
    // ...
    private floatingLabels: FloatingLabelItem[] = [];
    private labelTextureCache = new Map<ItemBuffKind, THREE.Texture>();

    private getOrCreateFloatingLabelTexture(itemKind: ItemBuffKind): THREE.Texture;

    public spawnFloatingLabel(
      worldPos: THREE.Vector3,
      itemKind: ItemBuffKind
    ): void;
  }
  ```
- **Execution Flow / Logic**:
  1. `getOrCreateFloatingLabelTexture(itemKind)`:
     - 4종 아이템(`power_shot`, `wide_scope`, `ice_freeze`, `bar_repair`)에 대해 1회만 256x64 Canvas 텍스처를 생성하여 캐싱.
     - 텍스처 그래픽: 둥근 모서리 반투명 블랙 백그라운드(`rgba(15, 23, 42, 0.9)`), 아이템 고유 색상 네온 보더(`ITEM_BUFF_SPECS[itemKind].auraColorHex`), 볼드 텍스트(`💥 DAMAGE 2X`, `🎯 WIDE 1.6X`, `🧊 SLOW 50%`, `🍺 LIFE +1`).
     - Node (테스트) 환경에서는 `DataTexture` 폴백 반환.
  2. `spawnFloatingLabel(worldPos, itemKind)`:
     - `THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1.0, depthWrite: false }))` 생성.
     - `sprite.scale.set(1.4, 0.35, 1.0)`.
     - `sprite.position.copy(worldPos).add(new THREE.Vector3(0, 0.4, 0))`.
     - `this.group.add(sprite)`.
     - `this.floatingLabels.push({ sprite, initialPos: sprite.position.clone(), lifeSec: 0, maxLifeSec: 0.8 })`.
  3. `update(dtSec)`:
     - `lifeSec += dtSec`.
     - Y축 상승: `const progress = p.lifeSec / p.maxLifeSec; sprite.position.y = p.initialPos.y + Math.sin(progress * Math.PI * 0.5) * 0.65;`
     - 페이드아웃: `(sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1.0 - Math.pow(progress, 1.5));`
     - `lifeSec >= maxLifeSec` 도달 시 `this.group.remove(sprite)` 및 배열에서 제거.
  4. `clear()`:
     - 모든 floatingLabels 메시를 group에서 제거하고 배열 초기화.

### I02. 파워 샷 총기 골든 캐논 진화 & 빅 스코프 가이드 빔 (`DraftTapGun3D.ts`)

- Related Files:
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D.setPowerMode`, `DraftTapGun3D.setScopeMode` — 총기 황금/불꽃 진화 및 홀로그램 가이드 빔 구현; modify
  - `src/pc/components/GameCanvas3D.tsx` — 아이템 피격 시 `spawnFloatingLabel` 호출 및 총기 파워/스코프 모드 연동; modify
  - `tests/three-stage-and-models.test.ts` — 플로팅 라벨 생성/업데이트 및 총기 진화 상태 단위 테스트; modify

#### Details
- **Signatures & Types (`src/pc/three/DraftTapGun3D.ts`)**:
  ```typescript
  export class DraftTapGun3D {
    // ...
    private barrelMesh: THREE.Mesh;
    private receiverMesh: THREE.Mesh;
    private flameAuraMesh: THREE.Mesh;
    private scopeLaserBeam: THREE.Mesh;

    public setPowerMode(isPower: boolean): void;
    public setScopeMode(isScope: boolean): void;
  }
  ```
- **Execution Flow / Logic**:
  1. 총기 구조에 골든 진화 및 조준선 메쉬 추가:
     - `flameAuraMesh`: 총구 노즐 끝에 위치한 붉은 화염 구체(`SphereGeometry(0.08, 12, 12)` with `MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 })`). 기본 `visible = false`.
     - `scopeLaserBeam`: 총구 전방 -15m까지 뻗어나가는 반투명 하늘색 홀로그램 원통 빔(`CylinderGeometry(0.008, 0.008, 15, 8)` with `MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })`). 기본 `visible = false`.
  2. `setPowerMode(isPower: boolean)`:
     - `isPower === true`:
       - `barrelMesh` & `receiverMesh`의 재질 색상을 골든 크롬(`color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.85, metalness: 0.95`)으로 전환.
       - `flameAuraMesh.visible = true`.
     - `isPower === false`:
       - 기존 실버 크롬(`color: 0xe2e8f0, emissive: 0x000000, metalness: 0.9`)으로 복원.
       - `flameAuraMesh.visible = false`.
  3. `setScopeMode(isScope: boolean)`:
     - `scopeLaserBeam.visible = isScope`.
  4. `GameCanvas3D.tsx`:
     - 사격 피격 처리 시 `result.target.isItem && result.target.itemKind`이면:
       `particles.spawnFloatingLabel(mesh.position, result.target.itemKind);`
     - 애니메이션 루프 내:
       `tapGun.setPowerMode(engine.isBuffActive('power_shot', time));`
       `tapGun.setScopeMode(engine.isBuffActive('wide_scope', time));`

## Acceptance Criteria
- [x] 아이템 피격 시 해당 3D 위치에서 영문 숏라벨(`DAMAGE 2X` 등)이 위로 0.8초간 솟구치며 페이드아웃된다.
- [x] 파워 샷 버프 활성 시 총기가 황금빛으로 변하고 총구에 붉은 화염 오라가 켜지며, 버프 종료 시 원상복구된다.
- [x] 빅 스코프 버프 활성 시 총구 전방에 홀로그램 가이드 빔이 투사된다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts && npx tsc --noEmit` — 모든 테스트 통과 및 타입 에러 0건.

## Commit Message
```text
feat(3d): add floating item pop label, golden gun evolution, and scope guide beam

Plan: 2026-11-01-item-status-vfx
Phase: P01-item-status-vfx
Task: T01-floating-label-and-gun-evolution

- Implement 3D world floating combat text labels on item destruction
- Add golden draft cannon transformation with flame aura in DraftTapGun3D
- Add holographic scope laser guide beam in DraftTapGun3D
- Connect item hit events and status modes in GameCanvas3D
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
