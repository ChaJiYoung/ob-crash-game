import * as THREE from 'three';

export const MAX_INSTANCED_SHADOWS = 128;

const _shadowDummy = new THREE.Object3D();

/**
 * 씬 내 모든 활성 타겟·아이템·황금캔·투사체의 바닥 그림자를
 * 단 1개의 InstancedMesh(Draw Call 1회)로 일괄 렌더링한다.
 */
export class InstancedShadowPool {
  readonly mesh: THREE.InstancedMesh;
  private readonly maxCount: number;
  private activeCount = 0;

  constructor(maxCount: number = MAX_INSTANCED_SHADOWS) {
    this.maxCount = maxCount;
    const geo = new THREE.CircleGeometry(1, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.name = 'InstancedDropShadows';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  beginFrame(): void {
    this.activeCount = 0;
  }

  pushShadow(worldX: number, worldZ: number, radius: number, worldY: number = 0.015): void {
    if (this.activeCount >= this.maxCount || radius <= 0) return;
    _shadowDummy.position.set(worldX, worldY, worldZ);
    _shadowDummy.rotation.set(0, 0, 0);
    _shadowDummy.scale.set(radius, 1, radius);
    _shadowDummy.updateMatrix();
    this.mesh.setMatrixAt(this.activeCount++, _shadowDummy.matrix);
  }

  endFrame(): void {
    this.mesh.count = this.activeCount;
    if (this.activeCount > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}
