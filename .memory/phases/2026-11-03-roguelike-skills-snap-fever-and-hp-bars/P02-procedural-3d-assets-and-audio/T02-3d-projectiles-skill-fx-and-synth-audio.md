---
id: T02-3d-projectiles-skill-fx-and-synth-audio
phase: P02-procedural-3d-assets-and-audio
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: 3D Flying Projectiles, 3 Active Skill Physics FX (Plunger Storm / Boomerang / Foam Tsunami), GameCanvas3D & Synth Audio
status: done
---

# Goal

`src/pc/three/ParticleEffects3D.ts`에 **무기별 3D 비행 탄환(미니 뚫어뻥 산탄 / 황금 병뚜껑 관통탄 / 시안 탄산 기포탄)**과 **3종 액티브 스킬 물리 이펙트(8방향 포물선 뚫어뻥 폭풍 — 몬스터 부착 떨림 vs 빗나간 탄 바닥 바운스 물리, 대형 황금 병따개 회전 부메랑, 160도 거품 해일)**를 구현하고, `src/pc/audio/SoundSynthesizer.ts`의 무기·스킬 타격음 및 `src/pc/components/GameCanvas3D.tsx` 씬 렌더링을 연동한다.

---

# 3D Projectile, Skill Physics & Audio Reference Blueprint

## 1. 무기별 3D 비행 탄환 (`ParticleEffects3D.spawnWeaponProjectile(origin, targetPos, weaponKind, weaponLevel)`)
- `shotgun`: `pelletCount`(3~6개)의 미니 3D 뚫어뻥(`createRealisticPlungerMesh(0.32)`)이 부채꼴로 날아가 타겟에 꽂히며 빨간/황금 스파크 폭발
- `revolver`: 회전하는 황금 왕관 병뚜껑 볼트(`CylinderGeometry(0.09, 0.09, 0.04, 12)`, `#fbbf24`) + 골드 관통 레이저 트레일(`CylinderGeometry(0.018, 0.018, distance)`)
- `gatling`: 시안/화이트 탄산 기포 구체(`SphereGeometry(0.065, 10, 10)`, `#00f5d4` / `#ffffff`)가 초고속 궤적으로 비행

## 2. 전용 액티브 스킬 3D 물리 이펙트 (`ParticleEffects3D.spawnSkillEffect(weaponKind, weaponLevel, targetPositions)`)
1. `shotgun` (**사방 뚫어뻥 폭풍**):
   - 화면 외곽 8방향(`x: ±5.5`, `y: -0.5 ~ 3.8`, `z: 1.5`)에서 `12~22`개의 3D 뚫어뻥(`scale: 0.55`)이 포물선(`vy` 중력 가속도 적용)을 그리며 전방으로 일제히 날아감.
   - **물리 법칙 (D10)**: 몬스터 타겟 좌표로 향한 뚫어뻥은 몬스터 표면에 꽂혀 `1.0~2.0`초 동안 부르르 떨리고(`Math.sin(age * 45) * 0.08`), 빗나간 나머지 뚫어뻥은 **절대로 플레이어 카메라 앞을 가리지 않고** 저 멀리 펍 바닥(`y = -1.15`)이나 뒷벽(`z = -11.5`)에 부딪혀 통통 튕기며(`vy = Math.abs(vy) * 0.42`) 회전 낙하 후 소멸.
2. `revolver` (**오프너 불릿 타임 & 참격**):
   - 거대한 황금 병따개 블레이드(`scale: 1.8`, 골드 링 + 크롬 커터 날 + 시안 네온 글로우 링)가 수평으로 고속 회전(`rotation.y += dt * 28`)하며 전방 아크 궤적으로 모든 몬스터를 베고 지나감 + 시안 슬로우 모션 파동 링 확산.
3. `gatling` (**거품 해일 160도 오버히트**):
   - 총구에서 전방 `90°~160°` 부채꼴 각도로 `45~65`개의 크림 거품 구체(`SphereGeometry(0.14~0.28)`, `#ffffff` / `#67e8f9`)가 파도처럼 밀려나가며 몬스터들을 뒤로 밀어냄.

## 3. Web Audio 프로시저럴 사운드 합성 (`SoundSynthesizer.ts`)
- `playWeaponShoot(weaponKind: WeaponKind, isFever?: boolean)`:
  - `shotgun`: 묵직한 저음 펌프 타격(`130Hz ➔ 42Hz` sawtooth) + 고무 흡착 `"뽁!"` 팝 사운드(`320Hz ➔ 620Hz` sine sweep)
  - `revolver`: 날카로운 금속 오프너 클링(`1800Hz` triangle) + 대구경 매그넘 타격(`220Hz ➔ 55Hz`)
  - `gatling`: 경쾌한 탄산 버블 팝(`520Hz ➔ 880Hz` sine, `0.06s`)
- `playSkillActivation(weaponKind: WeaponKind)`:
  - `shotgun`: 다중 뚫어뻥 슈웅- 뽁뽁뽁! 연쇄 흡착음
  - `revolver`: 중저음 타임 슬로우 워프음 + 황금 칼날 회전음
  - `gatling`: 고압 탄산 개방 슈우우욱- 거품 파도 사운드

---

# Target Files & Symbols

1. `src/pc/three/ParticleEffects3D.ts`
   - `spawnWeaponProjectile(origin: THREE.Vector3, targetPos: THREE.Vector3, kind: WeaponKind, level: WeaponLevel): void` 추가
   - `spawnSkillEffect(kind: WeaponKind, level: WeaponLevel, monsterPositions: THREE.Vector3[]): void` 추가
   - `update(dtSec: number)`에서 비행 탄환, 포물선 뚫어뻥(몬스터 부착 떨림 vs 바닥 `y = -1.15` 바운스 물리), 회전 오프너 부메랑, 거품 해일 파티클 업데이트
2. `src/pc/audio/SoundSynthesizer.ts`
   - `playWeaponShoot(kind: WeaponKind, isFever?: boolean): void`
   - `playSkillActivation(kind: WeaponKind): void`
3. `src/pc/components/GameCanvas3D.tsx`
   - 엔진의 `weaponSystem.getState()`(`weaponKind`, `weaponLevel`)를 읽어 `gun.setWeaponAppearance(kind, level)` 동기화
   - 사격 시 `particleFx.spawnWeaponProjectile(...)`, 스킬 발동 시 `particleFx.spawnSkillEffect(...)` 호출 연동
   - 황금 캔(`isGoldenCan`), 투사체(`isProjectile`), 무기/보상 카드(`weaponSelectKind`, `rewardCardKind`) 3D 메쉬 분기 생성
4. `tests/three-stage-and-models.test.ts`
   - `ParticleEffects3D.spawnWeaponProjectile` & `spawnSkillEffect` (빗나간 뚫어뻥 바닥 바운스 포함), `SoundSynthesizer.playWeaponShoot` & `playSkillActivation` 단위 테스트 추가

# Verification Command

```bash
npx vitest run tests/three-stage-and-models.test.ts
```

# Commit Message

```text
feat(three,audio): implement 3D flying weapon projectiles, 3 skill physics FX, and procedural Web Audio SFX

Plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
Phase: P02-procedural-3d-assets-and-audio
Task: T02-3d-projectiles-skill-fx-and-synth-audio
```
