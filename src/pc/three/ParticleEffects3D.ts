import * as THREE from 'three';

interface ParticleItem {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifeSec: number;
  maxLifeSec: number;
  rotSpeed: THREE.Vector3;
}

export class ParticleEffects3D {
  public readonly group: THREE.Group;
  private particles: ParticleItem[] = [];
  private foamGeo = new THREE.SphereGeometry(0.08, 6, 6);
  private shardGeo = new THREE.BufferGeometry();
  private foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  private matCache = new Map<string, THREE.MeshBasicMaterial>();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ParticleEffects3D';

    // Triangle shard geometry
    const verts = new Float32Array([
      -0.08, -0.06, 0,
      0.08, -0.04, 0,
      0, 0.09, 0,
    ]);
    this.shardGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  }

  private getMaterial(colorHex: string): THREE.MeshBasicMaterial {
    if (!this.matCache.has(colorHex)) {
      this.matCache.set(
        colorHex,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorHex),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
      );
    }
    return this.matCache.get(colorHex)!;
  }

  public spawnHitEffect(origin: THREE.Vector3, colorHex: string, count = 12): void {
    const shardMat = this.getMaterial(colorHex);

    for (let i = 0; i < count; i++) {
      const isFoam = i % 2 === 0;
      const mesh = new THREE.Mesh(isFoam ? this.foamGeo : this.shardGeo, isFoam ? this.foamMat : shardMat);
      mesh.position.copy(origin);

      const speed = 2.5 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      const vx = Math.cos(phi) * Math.sin(theta) * speed;
      const vy = (Math.sin(phi) + 0.3) * speed;
      const vz = Math.cos(phi) * Math.cos(theta) * speed;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(vx, vy, vz),
        lifeSec: 0,
        maxLifeSec: 0.45 + Math.random() * 0.35,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
      });
    }
  }

  public update(dtSec: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifeSec += dtSec;

      if (p.lifeSec >= p.maxLifeSec) {
        this.group.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      // Physics update: gravity
      p.velocity.y -= 9.8 * dtSec;
      p.mesh.position.addScaledVector(p.velocity, dtSec);
      p.mesh.rotation.x += p.rotSpeed.x * dtSec;
      p.mesh.rotation.y += p.rotSpeed.y * dtSec;
      p.mesh.rotation.z += p.rotSpeed.z * dtSec;

      // Scale fade
      const progress = p.lifeSec / p.maxLifeSec;
      const scale = 1.0 - progress * 0.8;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  public clear(): void {
    this.particles.forEach((p) => this.group.remove(p.mesh));
    this.particles = [];
  }
}
