import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createProjectileMesh3D, createItemMesh3D } from '../src/pc/three/TargetModels3D';
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

  it('interception sparks are brown', () => {
    expect(resolveHitFxColor({ isProjectile: true } as any)).toBe('#7a4a21');
  });

  it('the engine reports a launch event for hanmac and boss shells, once', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.spawnMonsterProjectile(1000, 'hanmac', { thetaRad: 0.1, radiusM: 11 });
    e.spawnMonsterProjectile(1100, 'boss', { thetaRad: -0.2, radiusM: 10 });
    const events = e.drainProjectileLaunchEvents();
    expect(events.map((x) => x.source)).toEqual(['hanmac', 'boss']);
    expect(events[0].x).toBeCloseTo(Math.sin(0.1) * 11, 5);
    expect(events[0].z).toBeCloseTo(-Math.cos(0.1) * 11, 5);
    expect(e.drainProjectileLaunchEvents()).toEqual([]);
  });

  it('a new wave drops stale launch events', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.spawnMonsterProjectile(1000, 'hanmac', { thetaRad: 0, radiusM: 11 });
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
