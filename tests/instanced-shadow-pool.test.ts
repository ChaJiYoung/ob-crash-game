import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InstancedShadowPool } from '../src/pc/three/InstancedShadowPool';

describe('InstancedShadowPool', () => {
  it('단일 InstancedMesh로 여러 바닥 그림자를 일괄 등록하고 count를 갱신한다', () => {
    const pool = new InstancedShadowPool(8);
    expect(pool.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(pool.mesh.frustumCulled).toBe(false);
    expect(pool.mesh.count).toBe(0);

    pool.beginFrame();
    pool.pushShadow(1.5, -4.0, 0.8);
    pool.pushShadow(-2.0, -6.5, 1.2);
    pool.endFrame();

    expect(pool.mesh.count).toBe(2);

    const m0 = new THREE.Matrix4();
    const pos0 = new THREE.Vector3();
    const scale0 = new THREE.Vector3();
    pool.mesh.getMatrixAt(0, m0);
    m0.decompose(pos0, new THREE.Quaternion(), scale0);
    expect(pos0.x).toBeCloseTo(1.5, 4);
    expect(pos0.z).toBeCloseTo(-4.0, 4);
    expect(scale0.x).toBeCloseTo(0.8, 4);
    expect(scale0.z).toBeCloseTo(0.8, 4);

    // 다음 프레임에 그림자가 없으면 count가 0으로 줄어든다.
    pool.beginFrame();
    pool.endFrame();
    expect(pool.mesh.count).toBe(0);

    pool.dispose();
  });

  it('maxCount 상한과 유효하지 않은 반지름(<=0)을 안전하게 무시한다', () => {
    const pool = new InstancedShadowPool(2);
    pool.beginFrame();
    pool.pushShadow(0, 0, 0); // invalid radius
    pool.pushShadow(1, 1, 0.5);
    pool.pushShadow(2, 2, 0.6);
    pool.pushShadow(3, 3, 0.7); // over capacity
    pool.endFrame();

    expect(pool.mesh.count).toBe(2);
    pool.dispose();
  });
});
