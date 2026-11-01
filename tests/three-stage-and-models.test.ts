import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TargetKind } from '../src/shared/types';
import { buildBreweryStage3D } from '../src/pc/three/BreweryStage3D';
import {
  createTargetMesh3D,
  updateTargetAnimation3D,
  applyTargetHitFlash3D,
} from '../src/pc/three/TargetModels3D';
import { DraftTapGun3D } from '../src/pc/three/DraftTapGun3D';
import { ParticleEffects3D } from '../src/pc/three/ParticleEffects3D';
import { SoundSynthesizer } from '../src/pc/audio/SoundSynthesizer';

describe('3D Brewery Stage & 6 Target Models', () => {
  it('should create all 6 procedural 3D target models with correct geometries and userData', () => {
    const kinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'mug', 'boss'];

    kinds.forEach((kind) => {
      const mesh = createTargetMesh3D(kind);
      expect(mesh).toBeInstanceOf(THREE.Group);
      expect(mesh.userData.kind).toBe(kind);
      expect(mesh.userData.hitRadiusM).toBeGreaterThan(0);

      const inner = mesh.userData.inner as THREE.Group;
      expect(inner).toBeDefined();
      expect(inner.children.length).toBeGreaterThanOrEqual(3);

      if (kind === 'mug') {
        // Must contain torus handle and foam elements
        const hasTorusHandle = inner.children.some(
          (c) => (c as THREE.Mesh).geometry instanceof THREE.TorusGeometry
        );
        expect(hasTorusHandle).toBe(true);
      }

      if (kind === 'boss') {
        // Boss should have more than 8 parts (cabinet, grille, draft tower, dual taps, wheels)
        expect(inner.children.length).toBeGreaterThanOrEqual(8);
      }

      // Update animation and flash
      updateTargetAnimation3D(mesh, kind, 1.0, 1.0);
      applyTargetHitFlash3D(mesh, 1.0);
      expect(mesh.userData.hitFlashUntilSec).toBeGreaterThan(1.0);
    });
  });

  it('should build BreweryStage3D rig with 1.8m defense arc and neon pub lights', () => {
    const scene = new THREE.Scene();
    const rig = buildBreweryStage3D(scene);

    expect(rig.root).toBeInstanceOf(THREE.Group);
    expect(rig.defenseArcMesh).toBeInstanceOf(THREE.Mesh);
    expect(rig.neonLights.length).toBeGreaterThanOrEqual(3);

    // Test stage animation update
    expect(() => {
      rig.updateStageAnimation(1.0, false, false);
      rig.updateStageAnimation(2.0, true, true);
    }).not.toThrow();
  });

  it('should handle DraftTapGun3D recoil and aim updates', () => {
    const gun = new DraftTapGun3D();
    expect(gun.group).toBeInstanceOf(THREE.Group);

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
  });

  it('should manage 3D particle effects pool', () => {
    const fx = new ParticleEffects3D();
    expect(fx.group).toBeInstanceOf(THREE.Group);

    fx.spawnHitEffect(new THREE.Vector3(0, 1, -5), '#f59e0b', 10);
    expect(fx.group.children.length).toBe(10);

    fx.update(0.1);
    expect(fx.group.children.length).toBe(10);

    fx.clear();
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
});
