import { describe, it, expect, vi } from 'vitest';
import { GAME_TUNING } from '../src/shared/gameTuning';
import * as THREE from 'three';
import { ItemBuffKind, TargetKind } from '../src/shared/types';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../src/shared/constants';
import { buildBreweryStage3D } from '../src/pc/three/BreweryStage3D';
import {
  createTargetMesh3D,
  createItemMesh3D,
  createGoldenCanMesh3D,
  createProjectileMesh3D,
  createCardTargetMesh3D,
  createLandingMarker3D,
  updateLandingMarker3D,
  MINION_DROP_HEIGHT_M,
  getMinionDropRemaining,
  updateTargetAnimation3D,
  updateItemAnimation3D,
  applyTargetHitFlash3D,
  getTargetBaseY,
  getSharedTargetResourceStats,
  getOrCreateTargetLabelTexture,
} from '../src/pc/three/TargetModels3D';
import { buildShaderAnchorGroup } from '../src/pc/three/ShaderWarmup';
import { DraftTapGun3D, createRealisticPlungerMesh } from '../src/pc/three/DraftTapGun3D';
import { ParticleEffects3D, HIT_PARTICLE_COUNTS } from '../src/pc/three/ParticleEffects3D';
import { SoundSynthesizer } from '../src/pc/audio/SoundSynthesizer';
import { computeAimWorldPoint, computeSkillHitFxPosition, disposeSceneGroup, resolveHitFxColor } from '../src/pc/components/GameCanvas3D';
import { aimToNdc } from '../src/pc/components/CrosshairOverlay';

describe('3D Brewery Stage & 6 Target Models & 4 Item Meshes', () => {
  it('should create all 6 procedural 3D target models with correct geometries, drop shadows, and scale', () => {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'];

    kinds.forEach((kind) => {
      const mesh = createTargetMesh3D(kind);
      expect(mesh).toBeInstanceOf(THREE.Group);
      expect(mesh.userData.kind).toBe(kind);
      expect(mesh.userData.hitRadiusM).toBeGreaterThan(0);
      expect(mesh.userData.baseScale).toBeGreaterThanOrEqual(1.6);
      expect(mesh.userData.shadowMesh).toBeInstanceOf(THREE.Mesh);
      const shadowMesh = mesh.userData.shadowMesh as THREE.Mesh;
      const expectedBaseY = getTargetBaseY(kind);
      expect(shadowMesh.position.y).toBeCloseTo(-expectedBaseY + 0.01, 3);

      const inner = mesh.userData.inner as THREE.Group;
      expect(inner).toBeDefined();
      expect(inner.children.length).toBeGreaterThanOrEqual(3);

      if (kind === 'bottle') {
        // Must contain silver crownCap and neckLabel
        const hasCrownCap = inner.children.some(
          (c) => (c as THREE.Mesh).name === 'crownCap'
        );
        expect(hasCrownCap).toBe(true);
        const neckLabelMesh = inner.children.find(
          (c) => (c as THREE.Mesh).name === 'neckLabel'
        ) as THREE.Mesh;
        expect(neckLabelMesh).toBeDefined();
        expect(neckLabelMesh.material).toBeDefined();
      }

      if (kind === 'boss') {
        // Boss should have more than 8 parts (cabinet, grille, draft tower, dual taps, wheels)
        expect(inner.children.length).toBeGreaterThanOrEqual(8);
        expect(mesh.userData.bossTapHandles).toBeDefined();
        const tapHandles = mesh.userData.bossTapHandles as THREE.Mesh[];
        expect(tapHandles.length).toBe(2);

        // When summoning minions, tap levers pull forward (+0.65 rad)
        updateTargetAnimation3D(mesh, 'boss', 1.0, 1.0, { isBossSummoning: true });
        expect(tapHandles[0].rotation.x).toBeCloseTo(0.65, 2);
        expect(tapHandles[1].rotation.x).toBeCloseTo(0.65, 2);

        // At rest, tap levers restore to -0.22 rad
        updateTargetAnimation3D(mesh, 'boss', 2.0, 1.0, { isBossSummoning: false });
        expect(tapHandles[0].rotation.x).toBeCloseTo(-0.22, 2);
      }

      // Update animation and flash
      updateTargetAnimation3D(mesh, kind, 1.0, 1.0);
      applyTargetHitFlash3D(mesh, 1.0);
      expect(mesh.userData.hitFlashUntilSec).toBeGreaterThan(1.0);

      // Verify frost overlay and lock-on marker status effects
      expect(mesh.userData.frostRing).toBeInstanceOf(THREE.Mesh);
      expect(mesh.userData.lockOnMarker).toBeInstanceOf(THREE.Mesh);

      // Inactive by default
      expect((mesh.userData.frostRing as THREE.Mesh).visible).toBe(false);
      expect((mesh.userData.lockOnMarker as THREE.Mesh).visible).toBe(false);

      // Activate ice_freeze & wide_scope
      updateTargetAnimation3D(mesh, kind, 1.5, 1.0, { isIceFreeze: true, isWideScope: true });
      expect((mesh.userData.frostRing as THREE.Mesh).visible).toBe(true);
      expect((mesh.userData.lockOnMarker as THREE.Mesh).visible).toBe(true);

      // Deactivate
      updateTargetAnimation3D(mesh, kind, 2.0, 1.0, { isIceFreeze: false, isWideScope: false });
      expect((mesh.userData.frostRing as THREE.Mesh).visible).toBe(false);
      expect((mesh.userData.lockOnMarker as THREE.Mesh).visible).toBe(false);
    });
  });

  it('should calculate ground vs airborne altitudes with getTargetBaseY', () => {
    expect(getTargetBaseY('pilgood')).toBe(0.55); // pilgood runs on the ground now
    expect(getTargetBaseY('caslight')).toBe(1.45); // caslight is the only airborne monster
    expect(getTargetBaseY('boss')).toBe(1.15);
    expect(getTargetBaseY('bottle')).toBe(0.55);
    expect(getTargetBaseY('obi')).toBe(0.55);
    expect(getTargetBaseY('hanmac')).toBe(0.55);
    expect(getTargetBaseY('pilgood', true)).toBe(1.15); // Items float at 1.15m
  });

  it('should create 4 pub-themed item 3D models with rotating aura rings and shadows', () => {
    const itemKinds: ItemBuffKind[] = ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'];

    itemKinds.forEach((itemKind) => {
      const itemMesh = createItemMesh3D(itemKind);
      expect(itemMesh).toBeInstanceOf(THREE.Group);
      expect(itemMesh.userData.isItem).toBe(true);
      expect(itemMesh.userData.itemKind).toBe(itemKind);
      expect(itemMesh.userData.auraRing).toBeInstanceOf(THREE.Mesh);
      expect(itemMesh.userData.shadowMesh).toBeInstanceOf(THREE.Mesh);

      const inner = itemMesh.userData.inner as THREE.Group;
      expect(inner.children.length).toBeGreaterThanOrEqual(1);

      // Verify persistent 3D neon billboard label card (Mockup Plan 1)
      const billboard = itemMesh.children.find((c) => c.name === 'itemBillboard') as THREE.Sprite;
      expect(billboard).toBeDefined();
      expect(billboard).toBeInstanceOf(THREE.Sprite);
      expect(billboard.position.y).toBeGreaterThanOrEqual(0.4);

      // Animation loop should not throw
      expect(() => {
        updateItemAnimation3D(itemMesh, itemKind, 1.0);
        updateItemAnimation3D(itemMesh, itemKind, 2.5);
      }).not.toThrow();
    });
  });

  it('should build BreweryStage3D rig with 1.8m defense arc, heal pulse mesh, and neon pub lights', () => {
    const scene = new THREE.Scene();
    const rig = buildBreweryStage3D(scene);

    expect(rig.root).toBeInstanceOf(THREE.Group);
    expect(rig.defenseArcMesh).toBeInstanceOf(THREE.Mesh);
    expect(rig.healPulseMesh).toBeInstanceOf(THREE.Mesh);
    expect(rig.neonStrips.length).toBeGreaterThanOrEqual(2);

    // Initial state: heal pulse invisible
    expect(rig.healPulseMesh.visible).toBe(false);

    // Trigger heal pulse
    rig.triggerHealPulse();
    expect(rig.healPulseMesh.visible).toBe(true);

    // Test stage animation update with heal pulse active
    rig.updateStageAnimation(1.0, false, false);
    expect(rig.healPulseMesh.scale.x).toBeGreaterThanOrEqual(1.0);

    rig.updateStageAnimation(2.0, true, true);

    // Verify amberSignMesh has been completely removed to prevent untextured orange box artifact (D01)
    let hasAmberSignBox = false;
    rig.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        // A thin neon strip (height 0.12) is allowed; the removed sign was a thick untextured box.
        if (
          mesh.geometry instanceof THREE.BoxGeometry &&
          mesh.geometry.parameters.height > 0.5 &&
          Math.abs(mesh.position.z - (-14.05)) < 0.2
        ) {
          hasAmberSignBox = true;
        }
      }
    });
    expect(hasAmberSignBox).toBe(false);

    // Verify the amber neon strip replaced the amber point light (D16)
    const amberStrip = rig.neonStrips.find((m) => {
      const hex = (m.material as THREE.MeshBasicMaterial).color.getHex();
      return hex === 0xf59e0b || hex === 0xffd700;
    });
    expect(amberStrip).toBeDefined();
  });

  it('should not contain any point lights and should switch strips to gold in fever (gameplay-polish P01-T04)', () => {
    const scene = new THREE.Scene();
    const rig = buildBreweryStage3D(scene);

    let pointLights = 0;
    rig.root.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) pointLights++;
    });
    expect(pointLights).toBe(0);

    rig.updateStageAnimation(1, true, false);
    const amberMat = rig.neonStrips[0].material as THREE.MeshBasicMaterial;
    expect(amberMat.color.getHex()).toBe(0xffd700);

    rig.updateStageAnimation(1, false, false);
    expect(amberMat.color.getHex()).toBe(0xf59e0b);
  });

  it('should draw the defense line and heal pulse in front of the player (-Z), not behind (gameplay-polish P02-T01)', () => {
    const scene = new THREE.Scene();
    const rig = buildBreweryStage3D(scene);
    rig.root.updateMatrixWorld(true);

    const worldZRange = (mesh: THREE.Mesh) => {
      const pos = mesh.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        mesh.localToWorld(v);
        minZ = Math.min(minZ, v.z);
        maxZ = Math.max(maxZ, v.z);
      }
      return { minZ, maxZ };
    };

    const line = worldZRange(rig.defenseArcMesh);
    expect(line.maxZ).toBeLessThanOrEqual(0.001);
    expect(line.minZ).toBeCloseTo(-1.98, 1);

    const pulse = worldZRange(rig.healPulseMesh);
    expect(pulse.maxZ).toBeLessThanOrEqual(0.001);
    expect(pulse.minZ).toBeCloseTo(-2.0, 1);
  });

  it('should not contain the bar wall, brass rail, hazard stripe or distance arcs (gameplay-polish P02-T01)', () => {
    const scene = new THREE.Scene();
    const rig = buildBreweryStage3D(scene);
    let wall = 0;
    let rail = 0;
    let rings = 0;
    rig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry instanceof THREE.CylinderGeometry && mesh.geometry.parameters.radiusTop === 1.85) wall++;
      if (mesh.geometry instanceof THREE.TorusGeometry && mesh.geometry.parameters.radius === 1.86) rail++;
      if (mesh.geometry instanceof THREE.RingGeometry) rings++;
    });
    expect(wall).toBe(0);
    expect(rail).toBe(0);
    // Only the neon defense line and the heal pulse remain
    expect(rings).toBe(2);
  });

  it('should resolve hit FX colors for projectiles, items and monsters (gameplay-polish P02-T02)', () => {
    const base = { id: 't', hp: 1, maxHp: 1, radiusM: 5, thetaRad: 0, x: 0, z: -5, speedMps: 1, hitRadiusM: 1, killBonusScore: 0, breached: false };
    expect(resolveHitFxColor({ ...base, kind: 'pilgood', isProjectile: true })).toBe('#f87171');
    expect(resolveHitFxColor({ ...base, kind: 'pilgood', isItem: true, itemKind: 'power_shot' })).toBe(
      ITEM_BUFF_SPECS.power_shot.auraColorHex
    );
    expect(resolveHitFxColor({ ...base, kind: 'obi' })).toBe(TARGET_SPECS.obi.brandColorHex);
  });

  it('should show the boss shield bubble only while shielded (gameplay-polish P04-T05)', () => {
    const boss = createTargetMesh3D('boss');
    const shield = boss.userData.shieldMesh as THREE.Mesh;
    expect(shield).toBeDefined();
    expect(shield.visible).toBe(false);
    updateTargetAnimation3D(boss, 'boss', 1.0, 1.0, { isShielded: true });
    expect(shield.visible).toBe(true);
    updateTargetAnimation3D(boss, 'boss', 1.1, 1.0, { isShielded: false });
    expect(shield.visible).toBe(false);
  });

  it('should show the obi shield plate only while guarding (gameplay-polish P04-T03)', () => {
    const obi = createTargetMesh3D('obi');
    const plate = obi.userData.guardShieldMesh as THREE.Mesh;
    expect(plate).toBeDefined();
    updateTargetAnimation3D(obi, 'obi', 1.0, 1.0, { isGuarding: true });
    expect(plate.visible).toBe(true);
    updateTargetAnimation3D(obi, 'obi', 1.1, 1.0, { isGuarding: false });
    expect(plate.visible).toBe(false);
  });

  it('should handle DraftTapGun3D center mount, recoil, and aim updates', () => {
    const gun = new DraftTapGun3D();
    expect(gun.group).toBeInstanceOf(THREE.Group);
    // Center mount: X position should be centered at 0.0 to eliminate horizontal parallax
    expect(gun.group.position.x).toBeCloseTo(0.0, 2);

    const initialZ = gun.group.position.z;
    gun.triggerRecoil(false);

    // Immediately after kick, position should move back
    gun.updateAimAndRecoil(0, 0, 0.016, false);
    expect(gun.group.position.z).toBeGreaterThan(initialZ);

    // Over time, should decay back near initial position
    for (let i = 0; i < 60; i++) {
      gun.updateAimAndRecoil(0, 0, 0.05, false);
    }
    expect(Math.abs(gun.group.position.z - initialZ)).toBeLessThan(0.05);

    // Test Power Mode (Golden cannon evolution & flame aura)
    expect(gun.isPower).toBe(false);
    expect(gun.flameVisible).toBe(false);
    gun.setPowerMode(true);
    expect(gun.isPower).toBe(true);
    expect(gun.flameVisible).toBe(true);
    gun.setPowerMode(false);
    expect(gun.isPower).toBe(false);
    expect(gun.flameVisible).toBe(false);

    // Test Scope Mode (Holographic guide beam)
    expect(gun.isScope).toBe(false);
    expect(gun.scopeBeamVisible).toBe(false);
    gun.setScopeMode(true);
    expect(gun.isScope).toBe(true);
    expect(gun.scopeBeamVisible).toBe(true);
    gun.setScopeMode(false);
    expect(gun.isScope).toBe(false);
    expect(gun.scopeBeamVisible).toBe(false);
  });

  it('should project aimWorldPoint matching CrosshairOverlay NDC exactly', () => {
    const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 100);
    camera.position.set(0, 1.65, 2.2);
    camera.lookAt(0, 1.35, -12);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    // Aim right-up: aimX = 0.5, aimY = 0.5
    const pt = computeAimWorldPoint(camera, 0.5, 0.5, 10);
    const ndcExpected = aimToNdc(0.5, 0.5);

    // Project 3D point back to NDC
    const projected = pt.clone().project(camera);
    expect(projected.x).toBeCloseTo(ndcExpected.ndcX, 2);
    expect(projected.y).toBeCloseTo(ndcExpected.ndcY, 2);
  });

  it('should manage 3D particle effects pool and floating combat labels', () => {
    const fx = new ParticleEffects3D();
    expect(fx.group).toBeInstanceOf(THREE.Group);

    const batchMeshCount = fx.group.children.length;
    fx.spawnHitEffect(new THREE.Vector3(0, 1, -5), '#f59e0b', 10);
    expect(fx.activeParticleCount).toBe(10);
    // Particles are drawn through fixed instanced batches: spawning never adds scene children
    expect(fx.group.children.length).toBe(batchMeshCount);

    fx.update(0.1);
    expect(fx.activeParticleCount).toBe(10);
    expect(fx.group.children.length).toBe(batchMeshCount);

    // Test 3D floating labels
    const originPos = new THREE.Vector3(0, 1.2, -5);
    fx.spawnFloatingLabel(originPos, 'power_shot');
    expect(fx.activeFloatingLabels.length).toBe(1);

    const label = fx.activeFloatingLabels[0];
    const initialY = label.sprite.position.y;
    expect(label.sprite.material.opacity).toBeCloseTo(1.0);

    // After 0.4s (half life), should rise and slightly fade
    fx.update(0.4);
    expect(label.sprite.position.y).toBeGreaterThan(initialY);
    expect(label.sprite.material.opacity).toBeLessThan(1.0);

    // After another 0.45s (total 0.85s > maxLifeSec 0.8s), should expire and be removed
    fx.update(0.45);
    expect(fx.activeFloatingLabels.length).toBe(0);

    // Spawning and clear
    fx.spawnFloatingLabel(originPos, 'ice_freeze');
    fx.spawnFloatingLabel(originPos, 'bar_repair');
    expect(fx.activeFloatingLabels.length).toBe(2);
    fx.clear();
    expect(fx.activeFloatingLabels.length).toBe(0);
    expect(fx.activeParticleCount).toBe(0);
    expect(fx.group.children.length).toBe(batchMeshCount);
  });

  it('should expire instanced particles, stay within capacity, and keep fixed draw batches (gameplay-polish P01-T05)', () => {
    const fx = new ParticleEffects3D();
    const batchMeshCount = fx.group.children.length;
    const origin = new THREE.Vector3(0, 1, -5);

    for (let i = 0; i < 20; i++) fx.spawnHitEffect(origin, '#ef4444', HIT_PARTICLE_COUNTS.kill);
    fx.triggerBottleCrash(origin);
    expect(fx.activeParticleCount).toBeGreaterThan(0);
    expect(fx.group.children.length).toBe(batchMeshCount);

    // Far above capacity (96 + 96 + 8 + 32): must not throw and must stay bounded
    for (let i = 0; i < 100; i++) fx.spawnHitEffect(origin, '#ef4444', 50);
    expect(fx.activeParticleCount).toBeLessThanOrEqual(232);
    fx.update(0.016);

    for (let step = 0; step < 20; step++) fx.update(0.1);
    expect(fx.activeParticleCount).toBe(0);
    expect(fx.group.children.length).toBe(batchMeshCount);
  });

  it('should use the slimmed particle counts (gameplay-polish P01-T05)', () => {
    expect(HIT_PARTICLE_COUNTS).toEqual({ hit: 5, kill: 10, boss: 15 });
    const fx = new ParticleEffects3D();
    fx.triggerBottleCrash(new THREE.Vector3(0, 1, -5));
    // 1 cap + 5 shards + 4 drops
    expect(fx.activeParticleCount).toBe(10);
  });

  it('should not add condensation droplets to can monsters (gameplay-polish P01-T05)', () => {
    const mesh = createTargetMesh3D('pilgood');
    let droplets = 0;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry instanceof THREE.SphereGeometry && m.geometry.parameters.radius === 0.012) droplets++;
    });
    expect(droplets).toBe(0);
  });

  it('should instantiate SoundSynthesizer safely in headless test environment', () => {
    const synth = new SoundSynthesizer();
    expect(synth).toBeDefined();

    // Should not throw even when Web Audio is mock/absent
    expect(() => {
      synth.playShoot(false);
      synth.playShoot(true);
      synth.playHit('PERFECT');
      synth.playAutoReload();
      synth.playFeverStart();
    }).not.toThrow();
  });

  it('should create procedural realistic plunger and handle 3-weapon Lv.1~MAX evolutions in DraftTapGun3D', () => {
    // 1. Realistic Plunger Mesh
    const plunger = createRealisticPlungerMesh(1.0);
    expect(plunger).toBeInstanceOf(THREE.Group);
    expect(plunger.name).toBe('RealisticPlunger');
    expect(plunger.children.length).toBeGreaterThanOrEqual(3); // handle, cap, cupGroup

    // 2. DraftTapGun3D Weapon Evolutions
    const gun = new DraftTapGun3D();

    // Shotgun Lv.1 ~ Lv.4
    gun.setWeaponAppearance('shotgun', 1);
    expect(gun.currentWeaponKind).toBe('shotgun');
    expect(gun.currentWeaponLevel).toBe(1);

    gun.setWeaponAppearance('shotgun', 4);
    expect(gun.currentWeaponLevel).toBe(4);

    // Revolver Lv.1 ~ Lv.4
    gun.setWeaponAppearance('revolver', 1);
    expect(gun.currentWeaponKind).toBe('revolver');

    gun.setWeaponAppearance('revolver', 4);
    expect(gun.currentWeaponLevel).toBe(4);

    // Gatling Lv.1 ~ Lv.4 & Spin animation
    gun.setWeaponAppearance('gatling', 1);
    expect(gun.currentWeaponKind).toBe('gatling');

    gun.setWeaponAppearance('gatling', 4);
    expect(gun.currentWeaponLevel).toBe(4);

    // Test recoil kick & gatling spin
    gun.triggerRecoil(false);
    gun.updateAimAndRecoil(0, 0, 0.05, false);
  });

  it('should create procedural 3D Golden Can, Monster Projectile, and Shoot-to-Select Card targets', () => {
    // 1. Golden Can Mesh
    const goldenCan = createGoldenCanMesh3D();
    expect(goldenCan).toBeInstanceOf(THREE.Group);
    expect(goldenCan.userData.isGoldenCan).toBe(true);
    expect(goldenCan.userData.auraRing).toBeInstanceOf(THREE.Mesh);

    // 2. Monster Projectile Mesh
    const proj = createProjectileMesh3D();
    expect(proj).toBeInstanceOf(THREE.Group);
    expect(proj.userData.isProjectile).toBe(true);

    // 3. Card Target Mesh
    const card = createCardTargetMesh3D('LEVEL UP', '무기 레벨업', '#fbbf24');
    expect(card).toBeInstanceOf(THREE.Group);
    expect(card.userData.isCard).toBe(true);
    // Torus ring should be removed to not obstruct card text
    const innerCard = card.userData.inner as THREE.Group;
    const hasTorusRing = innerCard.children.some(
      (c) => (c as THREE.Mesh).geometry instanceof THREE.TorusGeometry
    );
    expect(hasTorusRing).toBe(false);

    // 4. Stunned Plunger Status on Target Models
    const monster = createTargetMesh3D('bottle');
    expect(monster.userData.plungerStuckGroup).toBeDefined();
    const stuckGroup = monster.userData.plungerStuckGroup as THREE.Group;
    expect(stuckGroup.visible).toBe(false);

    // Activate stun
    updateTargetAnimation3D(monster, 'bottle', 1.0, 1.0, { isStunned: true });
    expect(stuckGroup.visible).toBe(true);

    // Deactivate stun
    updateTargetAnimation3D(monster, 'bottle', 2.0, 1.0, { isStunned: false });
    expect(stuckGroup.visible).toBe(false);
  });

  it('should spawn 3D flying weapon projectiles for shotgun, revolver, and gatling in ParticleEffects3D', () => {
    const fx = new ParticleEffects3D();
    const origin = new THREE.Vector3(0.2, -0.2, 0.4);
    const target = new THREE.Vector3(0, 1.0, -10.0);

    // 1. Shotgun projectiles
    fx.spawnWeaponProjectile(origin, target, 'shotgun', 1);
    expect(fx.activeProjectiles.length).toBeGreaterThanOrEqual(3);

    // 2. Revolver projectile
    fx.spawnWeaponProjectile(origin, target, 'revolver', 2);
    expect(fx.activeProjectiles.length).toBeGreaterThan(3);

    // 3. Gatling projectile
    fx.spawnWeaponProjectile(origin, target, 'gatling', 3);
    expect(fx.activeProjectiles.length).toBeGreaterThan(4);

    // Update projectiles
    fx.update(0.016);
    expect(fx.activeProjectiles.every((p) => p.lifeSec > 0)).toBe(true);
  });

  it('should spawn and simulate 3 active skill physics FX with floor bounce and target sticking', () => {
    const fx = new ParticleEffects3D();
    const monsterPos = [new THREE.Vector3(0, 1.0, -8.0), new THREE.Vector3(1.5, 0.5, -6.0)];

    // 1. Shotgun Skill: 8-way plunger storm
    fx.spawnSkillEffect('shotgun', 2, monsterPos);
    expect(fx.parabolicPlungers.length).toBeGreaterThanOrEqual(12);

    // Simulate physics updates (including floor collision at y = -1.15)
    for (let i = 0; i < 60; i++) {
      fx.update(0.016);
    }
    // Plungers should either stick to targets or bounce at floor y = -1.15 without falling into negative infinity
    fx.parabolicPlungers.forEach((p) => {
      expect(p.group.position.y).toBeGreaterThanOrEqual(-1.20);
    });

    // 2. Revolver Skill: the blades are engine state drawn by syncSkillBlades, not a one-shot effect
    const fxBefore = fx.activeSkillEffects.length;
    fx.spawnSkillEffect('revolver', 3, monsterPos);
    expect(fx.activeSkillEffects.length).toBe(fxBefore);
    fx.syncSkillBlades([{ id: 'a', thetaRad: 0.2, radiusM: 10 }]);
    expect(fx.activeBladeMeshCount).toBe(1);
    fx.syncSkillBlades([]);
    expect(fx.activeBladeMeshCount).toBe(0);

    fx.spawnSlashMark(new THREE.Vector3(0, 1, -5));
    const marks = fx.activeSkillEffects.length;
    expect(marks).toBeGreaterThan(fxBefore);
    for (let i = 0; i < 20; i++) fx.update(0.016);
    expect(fx.activeSkillEffects.length).toBeLessThan(marks);

    // 3. Gatling Skill: the foam wave is engine state drawn by syncSkillFoam
    const fxBefore2 = fx.activeSkillEffects.length;
    fx.spawnSkillEffect('gatling', 4, monsterPos);
    expect(fx.activeSkillEffects.length).toBe(fxBefore2);
    fx.syncSkillFoam([{ id: 'w', radiusM: 8, count: 120 }], 0.8);
    expect(fx.foamWaveInstanceCount).toBe(120);
    const posOf = (i: number) => {
      const m = new THREE.Matrix4();
      (fx as any).foamWaveMesh.getMatrixAt(i, m);
      return new THREE.Vector3().setFromMatrixPosition(m);
    };
    const before = posOf(0).length();
    fx.syncSkillFoam([{ id: 'w', radiusM: 14, count: 120 }], 0.8);
    expect(posOf(0).length()).toBeGreaterThan(before);
    fx.syncSkillFoam([{ id: 'a', radiusM: 8, count: 280 }, { id: 'b', radiusM: 6, count: 280 }], 0.8);
    expect(fx.foamWaveInstanceCount).toBe(560);
    fx.syncSkillFoam([{ id: 'a', radiusM: 8, count: 280 }, { id: 'b', radiusM: 6, count: 280 }, { id: 'c', radiusM: 4, count: 280 }, { id: 'd', radiusM: 3, count: 280 }], 0.8);
    expect(fx.foamWaveInstanceCount).toBe(840); // three Lv.4 waves fit; the fourth is cut
    fx.syncSkillFoam([], 0.8);
    expect(fx.foamWaveInstanceCount).toBe(0);
    fx.syncSkillFoam([{ id: 'z', radiusM: 8, count: 50 }], 0.8);
    fx.clear();
    expect(fx.foamWaveInstanceCount).toBe(0);
    expect((fx as any).foamWaveSeeds.size).toBe(0);
    const warm = fx.createWarmupObjects();
    const foamWarm = warm.find((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).material === (fx as any).foamWaveMesh.material) as THREE.InstancedMesh;
    expect(foamWarm.instanceColor).toBeTruthy();
    expect(warm.some((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).material === (fx as any).foamWaveMesh.material)).toBe(true);
  });

  it('the crescent blade is as wide as the hit width and as tall as the monsters', () => {
    const fx = new ParticleEffects3D();
    fx.syncSkillBlades([{ id: 'a', thetaRad: 0, radiusM: 10 }]);
    const mesh = fx.group.children.find((c) => (c as THREE.Mesh).geometry instanceof THREE.ShapeGeometry) as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(1.9, 1);
    expect(size.x).toBeCloseTo(GAME_TUNING.skills.blade.halfWidthM * 2, 1);
  });

  it('hit effect position uses the monster height, not the floor', () => {
    const ground = computeSkillHitFxPosition({ kind: 'hanmac', x: 1, z: -8 } as any);
    const shell = computeSkillHitFxPosition({ kind: 'pilgood', x: 0, z: -8, customBaseY: 1.45 } as any);
    expect(ground.y).toBeCloseTo(0.9, 5);
    expect(shell.y).toBeCloseTo(1.8, 5);
  });

  it('plungers aimed at a boss bounce off instead of sticking', () => {
    const fx = new ParticleEffects3D();
    fx.spawnSkillEffect('shotgun', 1, [new THREE.Vector3(0, 1.0, -10)], [true]);
    const everStuck: boolean[] = [];
    for (let i = 0; i < 70; i++) {
      fx.update(0.016);
      everStuck.push(...fx.parabolicPlungers.map((p) => Boolean(p.isStuck)));
    }
    expect(everStuck.length).toBeGreaterThan(0);
    expect(everStuck.some(Boolean)).toBe(false);
  });

  it('should synthesize procedural audio for 3 weapons and 3 active skills', () => {
    const synth = new SoundSynthesizer();

    // Weapon shots
    expect(() => {
      synth.playWeaponShoot('shotgun', false);
      synth.playWeaponShoot('shotgun', true);
      synth.playWeaponShoot('revolver', false);
      synth.playWeaponShoot('revolver', true);
      synth.playWeaponShoot('gatling', false);
      synth.playWeaponShoot('gatling', true);
    }).not.toThrow();

    // Active skills
    expect(() => {
      synth.playSkillActivation('shotgun');
      synth.playSkillActivation('revolver');
      synth.playSkillActivation('gatling');
    }).not.toThrow();
  });

  it('should create 3D holographic card target mesh with high-visibility emissive frame and neon border (D02)', () => {
    const card = createCardTargetMesh3D('테스트 카드', '설명 문구\n두번째 줄', '#38bdf8', '🃏');
    expect(card).toBeInstanceOf(THREE.Group);
    expect(card.userData.isCard).toBe(true);
    expect(card.userData.hasNeonFrame).toBe(true);
    expect(card.userData.hitRadiusM).toBeGreaterThanOrEqual(1.5);

    const inner = card.userData.inner as THREE.Group;
    expect(inner).toBeDefined();

    // Check cardFrame emissiveIntensity
    const frameMesh = inner.children.find((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry) as THREE.Mesh;
    expect(frameMesh).toBeDefined();
    const frameMat = frameMesh.material as THREE.MeshStandardMaterial;
    expect(frameMat.emissiveIntensity).toBeGreaterThanOrEqual(0.8);

    // Check neon border group
    const borderGroup = inner.children.find((c) => c.name === 'cardNeonBorder') as THREE.Group;
    expect(borderGroup).toBeDefined();
    expect(borderGroup.children.length).toBe(4);
  });

  it('should pool weapon projectiles and tracer beams across 100 shots without unbounded allocations (P02-T01, T03)', () => {
    const fx = new ParticleEffects3D();

    const origin = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(0, 0, -10);

    // Fire 100 projectiles and tracers across 3 weapons
    for (let i = 0; i < 100; i++) {
      const weapon = i % 3 === 0 ? 'shotgun' : i % 3 === 1 ? 'revolver' : 'gatling';
      const level = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      fx.spawnWeaponProjectile(origin, target, weapon, level);
      fx.spawnTracerBeam(origin, target, '#ffaa00');
      fx.update(0.02);
    }

    // Advance time until all active projectiles and tracers expire and return to pool
    for (let step = 0; step < 20; step++) {
      fx.update(0.1);
    }

    const poolStats = fx.getPoolStats();
    expect(poolStats.pooledProjectiles).toBeGreaterThan(0);
    expect(poolStats.pooledTracers).toBeGreaterThan(0);
    // Max pool size should be bounded (shotgun 32 + revolver 32 + gatling 32 = max 96; tracers max 24)
    expect(poolStats.pooledProjectiles).toBeLessThanOrEqual(96);
    expect(poolStats.pooledTracers).toBeLessThanOrEqual(24);
  });

  it('should keep muzzle flash small instead of covering the screen (gameplay-polish P01-T01)', () => {
    const fx = new ParticleEffects3D();
    const origin = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(0, 0, -10);

    fx.spawnTracerBeam(origin, target, '#00f5d4', false);
    fx.update(0.016);
    const normalScales = fx.getActiveFlashScales();
    expect(normalScales.length).toBe(1);
    expect(normalScales[0]).toBeLessThan(0.15);

    fx.spawnTracerBeam(origin, target, '#00f5d4', true);
    fx.update(0.016);
    const scales = fx.getActiveFlashScales();
    expect(scales.length).toBe(2);
    scales.forEach((s) => expect(s).toBeLessThan(0.2));
  });

  it('should keep shared label textures alive when a monster is disposed (gameplay-polish P01-T03)', () => {
    const labelTex = getOrCreateTargetLabelTexture('pilgood');
    expect(labelTex.userData.isShared).toBe(true);
    const spy = vi.spyOn(labelTex, 'dispose');

    const monster = createTargetMesh3D('pilgood');
    disposeSceneGroup(monster);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should reuse card geometry and materials for the same card (gameplay-polish P01-T03)', () => {
    const a = createCardTargetMesh3D('공격력 증가', '설명', '#f43f5e', '🔥');
    const b = createCardTargetMesh3D('공격력 증가', '설명', '#f43f5e', '🔥');
    const meshesA: THREE.Mesh[] = [];
    const meshesB: THREE.Mesh[] = [];
    a.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshesA.push(o as THREE.Mesh); });
    b.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshesB.push(o as THREE.Mesh); });
    expect(meshesA.length).toBe(meshesB.length);
    meshesA.forEach((m, i) => {
      expect(m.geometry).toBe(meshesB[i].geometry);
      expect(m.material).toBe(meshesB[i].material);
    });
  });

  it('should build a visible shader anchor group without throwing (gameplay-polish P01-T03)', () => {
    const fx = new ParticleEffects3D();
    const anchors = buildShaderAnchorGroup(fx);
    expect(anchors.children.length).toBeGreaterThan(10);
    anchors.traverse((o) => expect(o.visible).toBe(true));
  });

  it('should reuse cached geometries across 30 spawned monsters and preserve shared resources on dispose (P02-T02, T03)', () => {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'];

    // 1. First batch of 6 archetypes to populate shared cache
    const firstBatch = kinds.map((k) => createTargetMesh3D(k));
    const statsInitial = getSharedTargetResourceStats();
    expect(statsInitial.cachedGeometries).toBeGreaterThan(0);

    // 2. Spawn 24 more monsters (total 30 monsters across 5 cycles)
    const extraMonsters: THREE.Group[] = [];
    for (let i = 0; i < 24; i++) {
      const kind = kinds[i % kinds.length];
      extraMonsters.push(createTargetMesh3D(kind));
    }

    const statsAfter30 = getSharedTargetResourceStats();
    // Cache count must not grow beyond archetype archetypes
    expect(statsAfter30.cachedGeometries).toBe(statsInitial.cachedGeometries);

    // 3. Dispose 15 monsters (firstBatch + 9 extra)
    const monstersToDispose = [...firstBatch, ...extraMonsters.slice(0, 9)];
    const survivingMonsters = extraMonsters.slice(9); // 15 surviving monsters

    monstersToDispose.forEach((m) => {
      disposeSceneGroup(m);
    });

    // Verify surviving monsters still have valid, non-disposed geometries
    survivingMonsters.forEach((survivor) => {
      survivor.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          expect(mesh.geometry.userData?.disposed).toBeUndefined();
        }
      });
    });

    // Verify disposed monsters had their non-shared materials disposed, but shared geometries spared
    monstersToDispose.forEach((disposed) => {
      disposed.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          if (mesh.geometry?.userData?.isShared) {
            expect(mesh.geometry.userData.disposed).toBeUndefined();
          }
          if (mesh.userData?.isBodyMaterial) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const nonSharedMats = mats.filter((m) => !m.userData?.isShared);
            expect(nonSharedMats.length).toBeGreaterThan(0);
            nonSharedMats.forEach((mat) => {
              expect(mat.userData?.disposed).toBe(true);
            });
          }
        }
      });
    });
  });

  it('should re-parent cached target meshes to active scene when scene instance changes (D02, T02)', () => {
    const scene1 = new THREE.Scene();
    const scene2 = new THREE.Scene();
    const targetMeshMap = new Map<string, THREE.Group>();

    const targetId = 'weapon_select_shotgun';
    const cardMesh = createCardTargetMesh3D('맥주관 뚫어뻥', '산탄', '#f59e0b', '🪠');

    // Simulate Mount 1: mesh added to scene1
    scene1.add(cardMesh);
    targetMeshMap.set(targetId, cardMesh);
    expect(cardMesh.parent).toBe(scene1);

    // Simulate Mount 2 (StrictMode or re-mount): sync loop in scene2
    const mesh = targetMeshMap.get(targetId);
    const needsAdd = !mesh || mesh.parent !== scene2;
    if (mesh && mesh.parent && mesh.parent !== scene2) {
      mesh.parent.remove(mesh);
    }
    if (needsAdd && mesh) {
      scene2.add(mesh);
    }

    // Verify mesh is now properly detached from scene1 and attached to scene2
    expect(cardMesh.parent).toBe(scene2);
    expect(scene1.children.includes(cardMesh)).toBe(false);
    expect(scene2.children.includes(cardMesh)).toBe(true);
  });

  describe('boss minion drop visuals (score-differentiation P02-T03)', () => {
    it('builds a flat landing ring that shares geometry and shader program with every other marker', () => {
      const a = createLandingMarker3D();
      const b = createLandingMarker3D();
      expect(a.geometry).toBe(b.geometry);
      expect(a.geometry.userData.isShared).toBe(true);
      // Own material per marker (own opacity) but never flagged as the shared one, so it is disposed with the marker
      expect(a.material).not.toBe(b.material);
      expect((a.material as THREE.Material).userData.isShared).toBe(false);
      expect((a.material as THREE.MeshBasicMaterial).type).toBe('MeshBasicMaterial');
      expect(a.position.y).toBeGreaterThan(0);
    });

    it('shrinks onto the hit zone and brightens as the minion lands', () => {
      const m = createLandingMarker3D();
      updateLandingMarker3D(m, 1, 1);
      const farScale = m.scale.x;
      const farOpacity = (m.material as THREE.MeshBasicMaterial).opacity;
      updateLandingMarker3D(m, 0, 1);
      expect(m.scale.x).toBeLessThan(farScale);
      expect((m.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(farOpacity);
      expect((m.material as THREE.MeshBasicMaterial).opacity).toBeLessThanOrEqual(1);
      // never collapses to nothing, even for tiny hit radii
      updateLandingMarker3D(m, 0, 0);
      expect(m.scale.x).toBeGreaterThan(0.5);
    });

    it('keeps the shared geometry alive when a marker is disposed', () => {
      const m = createLandingMarker3D();
      const geo = m.geometry;
      const mat = m.material as THREE.Material;
      const geoSpy = vi.spyOn(geo, 'dispose');
      const matSpy = vi.spyOn(mat, 'dispose');
      disposeSceneGroup(m as unknown as THREE.Group);
      expect(geoSpy).not.toHaveBeenCalled();
      expect(matSpy).toHaveBeenCalled();
    });

    it('includes a landing marker in the shader anchor group so the first drop does not compile a program', () => {
      const anchors = buildShaderAnchorGroup(new ParticleEffects3D());
      let found = false;
      anchors.traverse((o) => {
        if (o.name === 'landingMarker') found = true;
      });
      expect(found).toBe(true);
    });

    it('reports the fall progress: 1 at the summon, 0 on landing, 0 for things that never fall', () => {
      expect(getMinionDropRemaining(undefined, 1000, 700)).toBe(0);
      expect(getMinionDropRemaining(1700, 1000, 700)).toBe(1);
      expect(getMinionDropRemaining(1700, 1350, 700)).toBeCloseTo(0.5, 6);
      expect(getMinionDropRemaining(1700, 1700, 700)).toBe(0);
      expect(getMinionDropRemaining(1700, 5000, 700)).toBe(0);
      expect(getMinionDropRemaining(1700, 0, 700)).toBe(1); // clamped, never above 1
    });

    it('falls from a positive height', () => {
      expect(MINION_DROP_HEIGHT_M).toBeGreaterThan(2);
    });
  });
});
