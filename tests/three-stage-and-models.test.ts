import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ItemBuffKind, TargetKind } from '../src/shared/types';
import { buildBreweryStage3D } from '../src/pc/three/BreweryStage3D';
import {
  createTargetMesh3D,
  createItemMesh3D,
  createGoldenCanMesh3D,
  createProjectileMesh3D,
  createCardTargetMesh3D,
  updateTargetAnimation3D,
  updateItemAnimation3D,
  applyTargetHitFlash3D,
  getTargetBaseY,
} from '../src/pc/three/TargetModels3D';
import { DraftTapGun3D, createRealisticPlungerMesh } from '../src/pc/three/DraftTapGun3D';
import { ParticleEffects3D } from '../src/pc/three/ParticleEffects3D';
import { SoundSynthesizer } from '../src/pc/audio/SoundSynthesizer';
import { computeAimWorldPoint } from '../src/pc/components/GameCanvas3D';
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
    expect(getTargetBaseY('pilgood')).toBe(1.45);
    expect(getTargetBaseY('caslight')).toBe(1.45);
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
    expect(rig.neonLights.length).toBeGreaterThanOrEqual(3);

    // Initial state: heal pulse invisible
    expect(rig.healPulseMesh.visible).toBe(false);

    // Trigger heal pulse
    rig.triggerHealPulse();
    expect(rig.healPulseMesh.visible).toBe(true);

    // Test stage animation update with heal pulse active
    rig.updateStageAnimation(1.0, false, false);
    expect(rig.healPulseMesh.scale.x).toBeGreaterThanOrEqual(1.0);

    rig.updateStageAnimation(2.0, true, true);
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

    fx.spawnHitEffect(new THREE.Vector3(0, 1, -5), '#f59e0b', 10);
    expect(fx.group.children.length).toBe(10);

    fx.update(0.1);
    expect(fx.group.children.length).toBe(10);

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
    expect(fx.group.children.length).toBe(0);
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
});
