import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeShellSpring, createProjectileMesh3D, createItemMesh3D, updateProjectileAnimation3D } from '../src/pc/three/TargetModels3D';
import { resolveHitFxColor } from '../src/pc/components/GameCanvas3D';
import { ParticleEffects3D } from '../src/pc/three/ParticleEffects3D';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('enemy shells are brown poop, not shiny item orbs', () => {
  it('has three tiers plus a tip, no glow and no ring', () => {
    const shell = createProjectileMesh3D();
    expect(shell.userData.isProjectile).toBe(true);
    let tori = 0;
    let glowing = 0;
    const colors = new Set<number>();
    shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry instanceof THREE.TorusGeometry) tori++;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.emissive && mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) glowing++;
      colors.add(mat.color.getHex());
    });
    expect(tori).toBe(0);
    expect(glowing).toBe(0);
    expect(colors.has(0x7a4a21)).toBe(true);
    const meshes: THREE.Mesh[] = [];
    shell.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes.length).toBeGreaterThanOrEqual(6); // 3 tiers + tip + 2 eyes
  });

  it('looks nothing like an item (no aura ring, different colours)', () => {
    const item = createItemMesh3D('power_shot');
    let itemTori = 0;
    item.traverse((o) => { if ((o as THREE.Mesh).geometry instanceof THREE.TorusGeometry) itemTori++; });
    expect(itemTori).toBeGreaterThan(0);
    const shell = createProjectileMesh3D();
    let shellTori = 0;
    shell.traverse((o) => { if ((o as THREE.Mesh).geometry instanceof THREE.TorusGeometry) shellTori++; });
    expect(shellTori).toBe(0);
  });

  it('squashes like a spring, keeping its volume and its bottom on the floor', () => {
    const scales = new Set<number>();
    for (let t = 0; t < 1; t += 0.03) {
      const { scaleY, scaleXZ, liftY } = computeShellSpring(t);
      scales.add(Number(scaleY.toFixed(2)));
      expect(scaleY).toBeGreaterThan(0);
      expect(scaleY * scaleXZ * scaleXZ).toBeCloseTo(1, 5);
      expect(liftY - 0.238 * (scaleY - 1)).toBeCloseTo(0, 5);
    }
    expect(scales.size).toBeGreaterThan(5);
    const shell = createProjectileMesh3D();
    updateProjectileAnimation3D(shell, 0.1);
    const inner = shell.userData.inner as THREE.Group;
    const expected = computeShellSpring(0.1, shell.id * 0.7);
    expect(inner.scale.y).toBeCloseTo(1.15 * expected.scaleY, 5);
    expect(inner.position.y).toBeCloseTo(1.15 * expected.liftY, 5);
    expect(shell.userData.shadowMesh).toBeInstanceOf(THREE.Mesh);
  });

  it('the hit zone follows the floor model, not a fixed screen height', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.activeTargets = [];
    const shell = e.spawnMonsterProjectile(1000, 'boss', { thetaRad: 0.05, radiusM: 7 });
    const aim = e.computeTargetAimCoords(shell);
    expect(aim.targetNormY).toBeLessThan(0);
    expect(aim.targetNormY).not.toBeCloseTo(0.1, 2);
    const shot = e.shootAt(aim.targetNormX, aim.targetNormY, 1100);
    expect(shot.interceptedProjectile).toBe(true);
  });

  it('interception sparks are brown', () => {
    expect(resolveHitFxColor({ isProjectile: true } as any)).toBe('#7a4a21');
  });

  it('the engine reports a launch event for boss shells, once', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.spawnMonsterProjectile(1000, 'boss', { thetaRad: 0.1, radiusM: 11 });
    e.spawnMonsterProjectile(1100, 'boss', { thetaRad: -0.2, radiusM: 10 });
    const events = e.drainProjectileLaunchEvents();
    expect(events.map((x) => x.source)).toEqual(['boss', 'boss']);
    expect(events[0].x).toBeCloseTo(Math.sin(0.1) * 11, 5);
    expect(events[0].z).toBeCloseTo(-Math.cos(0.1) * 11, 5);
    expect(e.drainProjectileLaunchEvents()).toEqual([]);
  });

  it('a new wave drops stale launch events', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.spawnMonsterProjectile(1000, 'boss', { thetaRad: 0, radiusM: 11 });
    e.startWave(2);
    expect(e.drainProjectileLaunchEvents()).toEqual([]);
  });

  it('the launch burst adds brown and smoke particles', () => {
    const fx = new ParticleEffects3D();
    const before = fx.activeParticleCount;
    fx.spawnProjectileLaunchBurst(new THREE.Vector3(0, 1.45, -11));
    expect(fx.activeParticleCount - before).toBeGreaterThanOrEqual(15);
  });
});
