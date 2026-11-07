import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeGunAimAngles } from '../src/pc/three/gunAim';
import { computeAimWorldPoint, AIM_TARGET_DISTANCE_M } from '../src/pc/three/aimProjection';
import { DraftTapGun3D } from '../src/pc/three/DraftTapGun3D';

describe('Gun Aim Angle Calculation (P01-T02)', () => {
  it('aims straight ahead when target is directly along -Z', () => {
    const { yaw, pitch } = computeGunAimAngles({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 });
    expect(yaw).toBeCloseTo(0, 5);
    expect(pitch).toBeCloseTo(0, 5);
  });

  it('yaw is negative for right target and pitch is positive for upper target', () => {
    const right = computeGunAimAngles({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: -10 });
    expect(right.yaw).toBeLessThan(0);
    expect(right.pitch).toBeCloseTo(0, 5);

    const left = computeGunAimAngles({ x: 0, y: 0, z: 0 }, { x: -5, y: 0, z: -10 });
    expect(left.yaw).toBeGreaterThan(0);
    expect(left.pitch).toBeCloseTo(0, 5);

    const up = computeGunAimAngles({ x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: -10 });
    expect(up.yaw).toBeCloseTo(0, 5);
    expect(up.pitch).toBeGreaterThan(0);

    const down = computeGunAimAngles({ x: 0, y: 0, z: 0 }, { x: 0, y: -5, z: -10 });
    expect(down.yaw).toBeCloseTo(0, 5);
    expect(down.pitch).toBeLessThan(0);
  });

  it('accurately reproduces normalized direction for arbitrary gun and target pairs', () => {
    const pairs = [
      { gun: { x: 0.32, y: -0.46, z: -0.92 }, target: { x: -1.2, y: 1.5, z: -14 } },
      { gun: { x: -0.32, y: -0.46, z: -0.92 }, target: { x: 3.4, y: -0.8, z: -12 } },
      { gun: { x: 0.0, y: -0.46, z: -0.92 }, target: { x: 0.0, y: 2.1, z: -10 } },
      { gun: { x: 0.5, y: -0.2, z: -1.0 }, target: { x: -4.0, y: -2.0, z: -20 } },
      { gun: { x: -0.5, y: -0.1, z: -0.8 }, target: { x: 5.0, y: 3.0, z: -8 } },
    ];

    for (const { gun, target } of pairs) {
      const { yaw, pitch } = computeGunAimAngles(gun, target);
      const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);

      const expectedDir = new THREE.Vector3(
        target.x - gun.x,
        target.y - gun.y,
        target.z - gun.z
      ).normalize();

      const angleDiff = forward.angleTo(expectedDir);
      expect(angleDiff).toBeLessThan(1e-6);
    }
  });

  it('two-player coop guns aim at crosshair world points within 0.05m tolerance', () => {
    const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 100);
    camera.position.set(0, 1.65, 2.2);
    camera.lookAt(0, 1.35, -12);
    camera.updateMatrixWorld(true);

    const leftGun = new DraftTapGun3D();
    leftGun.setSlotOffset(-0.32);
    const rightGun = new DraftTapGun3D();
    rightGun.setSlotOffset(0.32);

    camera.add(leftGun.group);
    camera.add(rightGun.group);
    camera.updateMatrixWorld(true);

    const testCases = [
      { gun: leftGun, aimX: -0.6, aimY: 0.3 },
      { gun: rightGun, aimX: 0.5, aimY: -0.2 },
    ];

    for (const { gun, aimX, aimY } of testCases) {
      const worldTarget = computeAimWorldPoint(camera, aimX, aimY, AIM_TARGET_DISTANCE_M);
      const localTarget = camera.worldToLocal(worldTarget.clone());
      const angles = computeGunAimAngles(gun.getAimPivot(), localTarget);

      // Gun pivot in world coordinates
      const gunPivotWorld = camera.localToWorld(gun.getAimPivot().clone());

      // Forward direction in camera local coordinates, then transformed to world direction
      const forwardLocal = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(angles.pitch, angles.yaw, 0, 'YXZ'));
      const forwardWorld = forwardLocal.clone().transformDirection(camera.matrixWorld).normalize();

      // Shortest distance from line (gunPivotWorld + t * forwardWorld) to worldTarget
      const toTarget = worldTarget.clone().sub(gunPivotWorld);
      const projectionLength = toTarget.dot(forwardWorld);
      const closestPoint = gunPivotWorld.clone().addScaledVector(forwardWorld, projectionLength);
      const distanceToLine = closestPoint.distanceTo(worldTarget);

      expect(distanceToLine).toBeLessThan(0.05);
    }
  });
});
