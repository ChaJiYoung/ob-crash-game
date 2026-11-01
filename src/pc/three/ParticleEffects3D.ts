import * as THREE from 'three';
import { ItemBuffKind } from '../../shared/types';
import { ITEM_BUFF_SPECS } from '../../shared/constants';

interface ParticleItem {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifeSec: number;
  maxLifeSec: number;
  rotSpeed: THREE.Vector3;
}

interface TracerBeamItem {
  beamMesh: THREE.Mesh;
  flashMesh: THREE.Mesh;
  lifeSec: number;
  maxLifeSec: number;
}

export interface FloatingLabelItem {
  sprite: THREE.Sprite;
  initialPos: THREE.Vector3;
  lifeSec: number;
  maxLifeSec: number;
}

export class ParticleEffects3D {
  public readonly group: THREE.Group;
  private particles: ParticleItem[] = [];
  private tracerBeams: TracerBeamItem[] = [];
  private floatingLabels: FloatingLabelItem[] = [];
  private labelTextureCache = new Map<ItemBuffKind, THREE.Texture>();
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

  private getOrCreateFloatingLabelTexture(itemKind: ItemBuffKind): THREE.Texture {
    if (this.labelTextureCache.has(itemKind)) {
      return this.labelTextureCache.get(itemKind)!;
    }

    if (typeof document === 'undefined') {
      const fallbackTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      fallbackTex.needsUpdate = true;
      this.labelTextureCache.set(itemKind, fallbackTex);
      return fallbackTex;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = new THREE.Texture();
      this.labelTextureCache.set(itemKind, fallback);
      return fallback;
    }

    const textMap: Record<ItemBuffKind, string> = {
      power_shot: '💥 DAMAGE 2X',
      wide_scope: '🎯 WIDE 1.6X',
      ice_freeze: '🧊 SLOW 50%',
      bar_repair: '🍺 LIFE +1',
    };

    const spec = ITEM_BUFF_SPECS[itemKind];
    const labelText = textMap[itemKind] || (spec ? `${spec.icon} ${spec.shortLabel}` : itemKind);
    const borderColor = spec ? spec.auraColorHex : '#fbbf24';

    // Rounded rectangle card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(4, 4, 248, 56, 12);
    } else {
      ctx.rect(4, 4, 248, 56);
    }
    ctx.fill();

    // Glowing border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Bold text
    ctx.font = '900 24px "Pretendard", "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 10;
    ctx.fillText(labelText, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    this.labelTextureCache.set(itemKind, tex);
    return tex;
  }

  public spawnFloatingLabel(worldPos: THREE.Vector3, itemKind: ItemBuffKind): void {
    const tex = this.getOrCreateFloatingLabelTexture(itemKind);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.35, 1.0);
    sprite.position.copy(worldPos).add(new THREE.Vector3(0, 0.4, 0));
    this.group.add(sprite);

    this.floatingLabels.push({
      sprite,
      initialPos: sprite.position.clone(),
      lifeSec: 0,
      maxLifeSec: 0.8,
    });
  }

  public get activeFloatingLabels(): readonly FloatingLabelItem[] {
    return this.floatingLabels;
  }

  public spawnTracerBeam(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    colorHex: string,
    isFeverOrPower = false
  ): void {
    const direction = new THREE.Vector3().subVectors(toPos, fromPos);
    const distance = Math.max(0.5, direction.length());
    const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);

    const radius = isFeverOrPower ? 0.045 : 0.024;
    const beamGeo = new THREE.CylinderGeometry(radius, radius, distance, 8);
    beamGeo.rotateX(Math.PI / 2); // Align with Z forward

    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.copy(midPoint);
    beamMesh.lookAt(toPos);
    this.group.add(beamMesh);

    // Muzzle flash sphere
    const flashRadius = isFeverOrPower ? 0.16 : 0.11;
    const flashGeo = new THREE.SphereGeometry(flashRadius, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(fromPos);
    this.group.add(flashMesh);

    this.tracerBeams.push({
      beamMesh,
      flashMesh,
      lifeSec: 0,
      maxLifeSec: 0.14,
    });
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
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifeSec += dtSec;

      if (p.lifeSec >= p.maxLifeSec) {
        this.group.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 9.8 * dtSec;
      p.mesh.position.addScaledVector(p.velocity, dtSec);
      p.mesh.rotation.x += p.rotSpeed.x * dtSec;
      p.mesh.rotation.y += p.rotSpeed.y * dtSec;
      p.mesh.rotation.z += p.rotSpeed.z * dtSec;

      const progress = p.lifeSec / p.maxLifeSec;
      const scale = 1.0 - progress * 0.8;
      p.mesh.scale.set(scale, scale, scale);
    }

    // 2. Update tracer beams
    for (let i = this.tracerBeams.length - 1; i >= 0; i--) {
      const tb = this.tracerBeams[i];
      tb.lifeSec += dtSec;

      if (tb.lifeSec >= tb.maxLifeSec) {
        this.group.remove(tb.beamMesh);
        this.group.remove(tb.flashMesh);
        this.tracerBeams.splice(i, 1);
        continue;
      }

      const fade = 1.0 - tb.lifeSec / tb.maxLifeSec;
      (tb.beamMesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.95;
      (tb.flashMesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.95;
      tb.flashMesh.scale.set(1.0 + (1.0 - fade) * 0.5, 1.0 + (1.0 - fade) * 0.5, 1.0 + (1.0 - fade) * 0.5);
    }

    // 3. Update floating combat labels
    for (let i = this.floatingLabels.length - 1; i >= 0; i--) {
      const fl = this.floatingLabels[i];
      fl.lifeSec += dtSec;

      if (fl.lifeSec >= fl.maxLifeSec) {
        this.group.remove(fl.sprite);
        fl.sprite.material.dispose();
        this.floatingLabels.splice(i, 1);
        continue;
      }

      const progress = fl.lifeSec / fl.maxLifeSec;
      // Float upwards with smooth easing
      fl.sprite.position.y = fl.initialPos.y + Math.sin(progress * Math.PI * 0.5) * 0.65;
      // Fade out towards the end
      (fl.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1.0 - Math.pow(progress, 1.5));
    }
  }

  public clear(): void {
    this.particles.forEach((p) => this.group.remove(p.mesh));
    this.particles = [];
    this.tracerBeams.forEach((tb) => {
      this.group.remove(tb.beamMesh);
      this.group.remove(tb.flashMesh);
    });
    this.tracerBeams = [];
    this.floatingLabels.forEach((fl) => {
      this.group.remove(fl.sprite);
      fl.sprite.material.dispose();
    });
    this.floatingLabels = [];
  }
}
