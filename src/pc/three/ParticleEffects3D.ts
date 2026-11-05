import * as THREE from 'three';
import { ItemBuffKind, WeaponKind, WeaponLevel } from '../../shared/types';
import { ITEM_BUFF_SPECS, WEAPON_ARCHETYPE_SPECS } from '../../shared/constants';
import { GAME_TUNING } from '../../shared/gameTuning';
import { createRealisticPlungerMesh } from './DraftTapGun3D';

export const HIT_PARTICLE_COUNTS = { hit: 5, kill: 10, boss: 15 } as const;
const BOTTLE_SHARD_COUNT = 5;
const BOTTLE_DROP_COUNT = 4;

interface BatchParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotSpeed: THREE.Vector3;
  color: THREE.Color;
  lifeSec: number;
  maxLifeSec: number;
}

interface ParticleBatch {
  mesh: THREE.InstancedMesh;
  items: BatchParticle[];
  capacity: number;
  usesColor: boolean;
}

const _dummy = new THREE.Object3D();

interface TracerBeamItem {
  beamMesh: THREE.Mesh;
  flashMesh: THREE.Mesh;
  flashBaseRadius: number;
  lifeSec: number;
  maxLifeSec: number;
}

const FLASH_MAX_OPACITY = 0.55;

export interface FloatingLabelItem {
  sprite: THREE.Sprite;
  initialPos: THREE.Vector3;
  lifeSec: number;
  maxLifeSec: number;
}

export interface ProjectileItem {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  progress: number;
  weaponKind?: WeaponKind;
  isStuck?: boolean;
  stuckTargetPos?: THREE.Vector3;
  velocity?: THREE.Vector3;
  lifeSec: number;
  maxLifeSec: number;
  isBouncing?: boolean;
  /** 이 위치에 닿으면 박히지 않고 튕겨 나간다(보스). */
  bounceOffPos?: THREE.Vector3;
}

/** 파도 세 개가 겹쳐도(황금 캔으로 충전한 연속 사용) 모두 담는다. */
const FOAM_WAVE_CAPACITY = 3 * Math.max(...Object.values(GAME_TUNING.skills.foam.countByLevel));
const FOAM_COLORS = [new THREE.Color(0xffffff), new THREE.Color(0xe0f2fe), new THREE.Color(0x7dd3fc)];

interface FoamWaveSeeds {
  theta: Float32Array;
  /** 파도 앞면 뒤쪽으로 얼마나 처져 있는지(m). */
  back: Float32Array;
  y: Float32Array;
  scale: Float32Array;
  color: Uint8Array;
}

export interface SkillEffectItem {
  group: THREE.Group;
  kind: WeaponKind;
  lifeSec: number;
  maxLifeSec: number;
  updateFn: (dt: number, life: number) => boolean; // returns true when finished
}

export interface ParticlePoolStats {
  activeProjectiles: number;
  pooledProjectiles: number;
  activeTracers: number;
  pooledTracers: number;
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.isShared) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if (!m.userData?.isShared) m.dispose();
        });
      } else if (!mesh.material.userData?.isShared) {
        mesh.material.dispose();
      }
    }
  });
}

export class ParticleEffects3D {
  public readonly group: THREE.Group;
  private batches: ParticleBatch[] = [];
  private foamBatch!: ParticleBatch;
  private shardBatch!: ParticleBatch;
  private capBatch!: ParticleBatch;
  private dropBatch!: ParticleBatch;
  private tracerBeams: TracerBeamItem[] = [];
  private floatingLabels: FloatingLabelItem[] = [];
  private projectiles: ProjectileItem[] = [];
  private skillEffects: SkillEffectItem[] = [];

  public get activeParticleCount(): number {
    let n = 0;
    for (const b of this.batches) n += b.items.length;
    return n;
  }

  public get activeProjectiles(): ProjectileItem[] {
    return this.projectiles;
  }

  public get activeSkillEffects(): SkillEffectItem[] {
    return this.skillEffects;
  }

  public get parabolicPlungers(): ProjectileItem[] {
    return this.projectiles.filter((p) => p.velocity !== undefined);
  }

  private labelTextureCache = new Map<ItemBuffKind, THREE.Texture>();
  private foamGeo = new THREE.SphereGeometry(0.08, 6, 6);
  private shardGeo = new THREE.BufferGeometry();
  private foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  private shardMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  private sharedShotgunPelletGeo: THREE.CylinderGeometry;
  private sharedShotgunPelletMat: THREE.MeshBasicMaterial;
  private foamWaveMesh: THREE.InstancedMesh;
  private foamWaveSeeds: Map<string, FoamWaveSeeds> = new Map();
  private bladeGeo: THREE.ShapeGeometry;
  private bladeMat: THREE.MeshBasicMaterial;
  private slashGeo: THREE.PlaneGeometry;
  private slashMat: THREE.MeshBasicMaterial;
  private bladeMeshes: Map<string, THREE.Mesh> = new Map();
  private bladeMeshPool: THREE.Mesh[] = [];

  // Object Pools
  private tracerPool: TracerBeamItem[] = [];
  private projectilePools: Map<WeaponKind, THREE.Group[]> = new Map([
    ['shotgun', []],
    ['revolver', []],
    ['gatling', []],
  ]);

  // Shared Geometries & Materials
  private unitTracerGeo: THREE.CylinderGeometry;
  private unitFlashGeo: THREE.SphereGeometry;
  private revolverBoltGeo: THREE.CylinderGeometry;
  private gatlingBubbleGeo: THREE.SphereGeometry;
  private bottleCapGeo: THREE.CylinderGeometry;
  private beerDropGeo: THREE.SphereGeometry;

  private revolverMat: THREE.MeshStandardMaterial;
  private gatlingMat: THREE.MeshBasicMaterial;
  private bottleCapMat: THREE.MeshBasicMaterial;
  private beerMat: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ParticleEffects3D';

    this.foamGeo.userData.isShared = true;
    this.foamMat.userData.isShared = true;

    const verts = new Float32Array([
      -0.08, -0.06, 0,
      0.08, -0.04, 0,
      0, 0.09, 0,
    ]);
    this.shardGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    this.shardGeo.userData.isShared = true;

    // Unit length cylinder (length = 1.0 along Z axis)
    this.unitTracerGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.unitTracerGeo.rotateX(Math.PI / 2);
    this.unitTracerGeo.userData.isShared = true;

    this.unitFlashGeo = new THREE.SphereGeometry(1, 8, 8);
    this.unitFlashGeo.userData.isShared = true;

    this.revolverBoltGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12);
    this.revolverBoltGeo.rotateX(Math.PI / 2);
    this.revolverBoltGeo.userData.isShared = true;

    this.gatlingBubbleGeo = new THREE.SphereGeometry(0.065, 10, 10);
    this.gatlingBubbleGeo.userData.isShared = true;

    this.bottleCapGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.04, 16);
    this.bottleCapGeo.userData.isShared = true;

    this.beerDropGeo = new THREE.SphereGeometry(0.06, 6, 6);
    this.beerDropGeo.userData.isShared = true;

    this.revolverMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      metalness: 0.9,
    });
    this.revolverMat.userData.isShared = true;

    this.gatlingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    this.gatlingMat.userData.isShared = true;

    this.bottleCapMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    this.bottleCapMat.userData.isShared = true;

    this.beerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#f59e0b'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.beerMat.userData.isShared = true;
    this.shardMat.userData.isShared = true;

    this.foamBatch = this.createBatch(this.foamGeo, this.foamMat, 96, false);
    this.shardBatch = this.createBatch(this.shardGeo, this.shardMat, 96, true);
    this.capBatch = this.createBatch(this.bottleCapGeo, this.bottleCapMat, 8, false);
    this.dropBatch = this.createBatch(this.beerDropGeo, this.beerMat, 32, false);

    this.sharedShotgunPelletGeo = new THREE.CylinderGeometry(0.045, 0.07, 0.12, 8);
    this.sharedShotgunPelletGeo.rotateX(Math.PI / 2);
    this.sharedShotgunPelletGeo.userData.isShared = true;
    this.sharedShotgunPelletMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    this.sharedShotgunPelletMat.userData.isShared = true;

    // 거품 해일: 작은 거품 수백 개를 인스턴싱 한 번으로 그린다. createBatch를 쓰면 매 프레임 count를 덮어쓴다.
    const foamGeo = new THREE.SphereGeometry(1, 6, 6);
    foamGeo.userData.isShared = true;
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
    foamMat.userData.isShared = true;
    this.foamWaveMesh = new THREE.InstancedMesh(foamGeo, foamMat, FOAM_WAVE_CAPACITY);
    this.foamWaveMesh.frustumCulled = false;
    this.foamWaveMesh.count = 0;
    this.foamWaveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foamWaveMesh.setColorAt(0, FOAM_COLORS[0]);
    this.foamWaveMesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.foamWaveMesh);

    // Crescent blade: a vertical moon as wide as the hit width and as tall as the monsters.
    const w = GAME_TUNING.skills.blade.halfWidthM;
    const h = 0.95;
    const shape = new THREE.Shape();
    shape.moveTo(-w, h);
    shape.quadraticCurveTo(3 * w, 0, -w, -h);
    shape.quadraticCurveTo(w + 0.4, 0, -w, h);
    this.bladeGeo = new THREE.ShapeGeometry(shape);
    this.bladeGeo.userData.isShared = true;
    this.bladeMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.bladeMat.userData.isShared = true;
    this.slashGeo = new THREE.PlaneGeometry(1.6, 0.12);
    this.slashGeo.userData.isShared = true;
    this.slashMat = new THREE.MeshBasicMaterial({
      color: 0xfff7cc,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.slashMat.userData.isShared = true;
  }

  private createBatch(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    capacity: number,
    usesColor: boolean
  ): ParticleBatch {
    const mesh = new THREE.InstancedMesh(geo, mat, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (usesColor) {
      // instanceColor must exist before the first compile, otherwise the shader is rebuilt on first use.
      mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    }
    this.group.add(mesh);
    const batch: ParticleBatch = { mesh, items: [], capacity, usesColor };
    this.batches.push(batch);
    return batch;
  }

  private addToBatch(batch: ParticleBatch, p: BatchParticle): void {
    if (batch.items.length >= batch.capacity) batch.items.shift();
    batch.items.push(p);
  }

  private updateBatch(batch: ParticleBatch, dtSec: number): void {
    const items = batch.items;
    if (items.length === 0 && batch.mesh.count === 0) return;

    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.lifeSec += dtSec;
      if (p.lifeSec >= p.maxLifeSec) {
        items.splice(i, 1);
        continue;
      }
      p.velocity.y -= 9.8 * dtSec;
      p.position.addScaledVector(p.velocity, dtSec);
      p.rotation.x += p.rotSpeed.x * dtSec;
      p.rotation.y += p.rotSpeed.y * dtSec;
      p.rotation.z += p.rotSpeed.z * dtSec;
    }

    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const scale = 1.0 - (p.lifeSec / p.maxLifeSec) * 0.8;
      _dummy.position.copy(p.position);
      _dummy.rotation.copy(p.rotation);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      batch.mesh.setMatrixAt(i, _dummy.matrix);
      if (batch.usesColor) batch.mesh.setColorAt(i, p.color);
    }
    batch.mesh.count = items.length;
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (batch.usesColor && batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
  }

  private makeParticle(
    origin: THREE.Vector3,
    offsetY: number,
    speedBase: number,
    speedRange: number,
    upBias: number,
    life: number,
    lifeRange: number,
    spin: number,
    color: THREE.Color,
    hemisphere = false
  ): BatchParticle {
    const speed = speedBase + Math.random() * speedRange;
    const theta = Math.random() * Math.PI * 2;
    const phi = hemisphere ? Math.random() * 0.5 * Math.PI : (Math.random() - 0.5) * Math.PI;
    const vx = Math.cos(phi) * Math.sin(theta) * speed;
    const vy = hemisphere ? Math.sin(phi) * speed + upBias : (Math.sin(phi) + upBias) * speed;
    const vz = Math.cos(phi) * Math.cos(theta) * speed;
    return {
      position: new THREE.Vector3(origin.x, origin.y + offsetY, origin.z),
      velocity: new THREE.Vector3(vx, vy, vz),
      rotation: new THREE.Euler(0, 0, 0),
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin
      ),
      color,
      lifeSec: 0,
      maxLifeSec: life + Math.random() * lifeRange,
    };
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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(4, 4, 248, 56, 12);
    } else {
      ctx.rect(4, 4, 248, 56);
    }
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();

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

  private acquireTracerItem(colorHex: string): TracerBeamItem {
    // If active tracers >= 24, recycle oldest
    if (this.tracerBeams.length >= 24) {
      const oldest = this.tracerBeams.shift()!;
      this.group.remove(oldest.beamMesh);
      this.group.remove(oldest.flashMesh);
      this.tracerPool.push(oldest);
    }

    if (this.tracerPool.length > 0) {
      const item = this.tracerPool.pop()!;
      (item.beamMesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
      (item.flashMesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
      return item;
    }

    const beamMesh = new THREE.Mesh(
      this.unitTracerGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    const flashMesh = new THREE.Mesh(
      this.unitFlashGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    return {
      beamMesh,
      flashMesh,
      flashBaseRadius: 0.07,
      lifeSec: 0,
      maxLifeSec: 0.14,
    };
  }

  private acquireProjectileGroup(kind: WeaponKind): THREE.Group {
    const pool = this.projectilePools.get(kind)!;
    if (pool.length > 0) {
      const grp = pool.pop()!;
      grp.visible = true;
      return grp;
    }

    if (kind === 'shotgun') {
      const pelletGroup = new THREE.Group();
      pelletGroup.add(new THREE.Mesh(this.sharedShotgunPelletGeo, this.sharedShotgunPelletMat));
      return pelletGroup;
    } else if (kind === 'revolver') {
      const boltGroup = new THREE.Group();
      const boltMesh = new THREE.Mesh(this.revolverBoltGeo, this.revolverMat);
      boltGroup.add(boltMesh);
      return boltGroup;
    } else {
      const bubbleGroup = new THREE.Group();
      const bMesh = new THREE.Mesh(this.gatlingBubbleGeo, this.gatlingMat);
      bubbleGroup.add(bMesh);
      return bubbleGroup;
    }
  }

  private releaseProjectile(pj: ProjectileItem): void {
    this.group.remove(pj.group);
    pj.group.visible = false;
    if (pj.weaponKind) {
      const pool = this.projectilePools.get(pj.weaponKind);
      if (pool && pool.length < 32) {
        pool.push(pj.group);
        return;
      }
    }
    disposeObject3D(pj.group);
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
    const flashRadius = isFeverOrPower ? 0.10 : 0.07;

    const item = this.acquireTracerItem(colorHex);
    item.flashBaseRadius = flashRadius;
    item.beamMesh.scale.set(radius, radius, distance);
    item.beamMesh.position.copy(midPoint);
    item.beamMesh.lookAt(toPos);
    (item.beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
    item.beamMesh.visible = true;

    item.flashMesh.scale.setScalar(flashRadius);
    item.flashMesh.position.copy(fromPos);
    (item.flashMesh.material as THREE.MeshBasicMaterial).opacity = FLASH_MAX_OPACITY;
    item.flashMesh.visible = true;

    item.lifeSec = 0;
    item.maxLifeSec = 0.14;

    this.group.add(item.beamMesh);
    this.group.add(item.flashMesh);
    this.tracerBeams.push(item);
  }

  /**
   * 🔫 1. 3D Flying Weapon Projectiles (Mini Plunger Pellets, Crown Bolt, Carbonation Bubbles)
   */
  public spawnWeaponProjectile(
    origin: THREE.Vector3,
    targetPos: THREE.Vector3,
    kind: WeaponKind,
    level: WeaponLevel = 1
  ): void {
    const spec = WEAPON_ARCHETYPE_SPECS[kind].levels[level] || WEAPON_ARCHETYPE_SPECS[kind].levels[1];

    // Throttle max active projectiles to avoid runaway memory
    if (this.projectiles.length >= 32) {
      const oldestIdx = this.projectiles.findIndex((p) => !p.velocity);
      if (oldestIdx !== -1) {
        const oldest = this.projectiles.splice(oldestIdx, 1)[0];
        this.releaseProjectile(oldest);
      }
    }

    if (kind === 'shotgun') {
      const pelletCount = spec.pelletCount;
      for (let i = 0; i < pelletCount; i++) {
        const miniPlunger = this.acquireProjectileGroup('shotgun');
        miniPlunger.position.copy(origin);
        this.group.add(miniPlunger);

        const spread = (i - (pelletCount - 1) / 2) * 0.28;
        const spreadTarget = targetPos.clone().add(new THREE.Vector3(spread, (Math.random() - 0.5) * 0.25, 0));

        this.projectiles.push({
          group: miniPlunger,
          startPos: origin.clone(),
          targetPos: spreadTarget,
          speed: 28.0 + Math.random() * 4.0,
          progress: 0,
          weaponKind: 'shotgun',
          lifeSec: 0,
          maxLifeSec: 0.45,
        });
      }
      this.spawnTracerBeam(origin, targetPos, '#ef4444', false);
    } else if (kind === 'revolver') {
      const boltGroup = this.acquireProjectileGroup('revolver');
      boltGroup.position.copy(origin);
      this.group.add(boltGroup);

      this.projectiles.push({
        group: boltGroup,
        startPos: origin.clone(),
        targetPos: targetPos.clone(),
        speed: 45.0,
        progress: 0,
        weaponKind: 'revolver',
        lifeSec: 0,
        maxLifeSec: 0.35,
      });

      this.spawnTracerBeam(origin, targetPos, '#f59e0b', true);
    } else {
      // gatling
      const bubbleGroup = this.acquireProjectileGroup('gatling');
      bubbleGroup.position.copy(origin);
      this.group.add(bubbleGroup);

      this.projectiles.push({
        group: bubbleGroup,
        startPos: origin.clone(),
        targetPos: targetPos.clone(),
        speed: 38.0,
        progress: 0,
        weaponKind: 'gatling',
        lifeSec: 0,
        maxLifeSec: 0.35,
      });

      this.spawnTracerBeam(origin, targetPos, '#00f5d4', false);
    }
  }

  /**
   * ⚡ 2. 3 Active Skill Physics FX (Plunger Storm / Foam Tsunami; revolver blades are drawn by syncSkillBlades)
   */
  public spawnSkillEffect(
    kind: WeaponKind,
    level: WeaponLevel,
    monsterPositions: THREE.Vector3[],
    noStickFlags?: boolean[] // monsterPositions와 같은 순서. true면 그 대상에는 박히지 않는다.
  ): void {
    // The revolver blades and the gatling foam are engine state drawn by syncSkillBlades / syncSkillFoam.
    if (kind !== 'shotgun') return;
    const spec = WEAPON_ARCHETYPE_SPECS[kind].levels[level];

    {
      // 1. 사방 뚫어뻥 폭풍: 12~22 3D Plungers in Parabolic Trajectories
      const count = spec.skillPlungerCount || 16;
      for (let i = 0; i < count; i++) {
        const plunger = createRealisticPlungerMesh(0.52);

        // Spawn from 8 outer screen perimeter positions
        const angle = (i / count) * Math.PI * 2;
        const spawnX = Math.cos(angle) * 5.2;
        const spawnY = Math.sin(angle) * 3.0 + 1.2;
        const spawnZ = 1.0;
        plunger.position.set(spawnX, spawnY, spawnZ);
        this.group.add(plunger);

        const targetIdx = i % Math.max(1, monsterPositions.length);
        let target = monsterPositions[targetIdx];
        let isSticking = true;
        let bounceOff = false;

        if (!target || monsterPositions.length === 0 || i >= monsterPositions.length * 2) {
          // Missed plunger targets far pub floor/wall (NEVER blocks camera)
          target = new THREE.Vector3((Math.random() - 0.5) * 8.0, -1.15, -10.0 - Math.random() * 4.0);
          isSticking = false;
        } else if (noStickFlags?.[targetIdx]) {
          isSticking = false;
          bounceOff = true;
        }

        const dir = new THREE.Vector3().subVectors(target, plunger.position).normalize();
        const speed = 16.0 + Math.random() * 6.0;
        const velocity = dir.multiplyScalar(speed);
        velocity.y += 2.5; // Initial upward arc

        this.projectiles.push({
          group: plunger,
          startPos: plunger.position.clone(),
          targetPos: target.clone(),
          speed,
          progress: 0,
          velocity,
          isStuck: false,
          stuckTargetPos: isSticking ? target.clone() : undefined,
          bounceOffPos: bounceOff ? target.clone() : undefined,
          isBouncing: !isSticking,
          lifeSec: 0,
          maxLifeSec: isSticking ? 1.6 : 1.2,
        });
      }
    }
  }

  /** 포탄이 발사되는 순간: 갈색 덩어리와 짧은 회색 연기. */
  public spawnProjectileLaunchBurst(position: THREE.Vector3): void {
    this.spawnHitEffect(position, '#7a4a21', 14);
    this.spawnHitEffect(position, '#d6d3d1', 6);
  }

  /** 보스가 터지는 큰 폭발: 금색·흰색 파편과 유리 조각을 한꺼번에 뿜는다. */
  public spawnBossDefeatBurst(position: THREE.Vector3): void {
    this.spawnHitEffect(position, '#fbbf24', 30);
    this.spawnHitEffect(position, '#ffffff', 30);
    this.triggerBottleCrash(position, 5);
  }

  public spawnHitEffect(origin: THREE.Vector3, colorHex: string, count: number = HIT_PARTICLE_COUNTS.hit): void {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const isFoam = i % 2 === 0;
      const p = this.makeParticle(origin, 0, 2.5, 4.5, 0.3, 0.45, 0.35, 12, color);
      this.addToBatch(isFoam ? this.foamBatch : this.shardBatch, p);
    }
  }

  public triggerBottleCrash(origin: THREE.Vector3, count: number = BOTTLE_SHARD_COUNT): void {
    const cap = this.makeParticle(origin, 0.8, 0, 0, 0, 1.2, 0, 0, new THREE.Color(0xe2e8f0));
    cap.velocity.set((Math.random() - 0.5) * 2.5, 6.0 + Math.random() * 2.0, (Math.random() - 0.5) * 2.5);
    cap.rotSpeed.set(15.0, 8.0, 20.0);
    this.addToBatch(this.capBatch, cap);

    const glassColor = new THREE.Color('#bae6fd');
    for (let i = 0; i < count; i++) {
      this.addToBatch(this.shardBatch, this.makeParticle(origin, 0.4, 4.0, 4.5, 0.4, 0.6, 0.4, 16, glassColor));
    }

    const dropColor = new THREE.Color(0xffffff);
    for (let i = 0; i < BOTTLE_DROP_COUNT; i++) {
      const drop = this.makeParticle(origin, 0.35, 3.0, 3.5, 1.5, 0.5, 0.3, 0, dropColor, true);
      this.addToBatch(this.dropBatch, drop);
    }
  }

  public update(dtSec: number): void {
    // 1. Update instanced particle batches
    for (const batch of this.batches) this.updateBatch(batch, dtSec);

    // 2. Update tracer beams
    for (let i = this.tracerBeams.length - 1; i >= 0; i--) {
      const tb = this.tracerBeams[i];
      tb.lifeSec += dtSec;

      if (tb.lifeSec >= tb.maxLifeSec) {
        this.group.remove(tb.beamMesh);
        this.group.remove(tb.flashMesh);
        tb.beamMesh.visible = false;
        tb.flashMesh.visible = false;
        if (this.tracerPool.length < 24) {
          this.tracerPool.push(tb);
        } else {
          // Geometries (unitTracerGeo, unitFlashGeo) are shared singletons and must NEVER be disposed.
          (tb.beamMesh.material as THREE.Material).dispose();
          (tb.flashMesh.material as THREE.Material).dispose();
        }
        this.tracerBeams.splice(i, 1);
        continue;
      }

      const fade = 1.0 - tb.lifeSec / tb.maxLifeSec;
      (tb.beamMesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.95;
      (tb.flashMesh.material as THREE.MeshBasicMaterial).opacity = fade * FLASH_MAX_OPACITY;
      tb.flashMesh.scale.setScalar(tb.flashBaseRadius * (1.0 + (1.0 - fade) * 0.5));
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
      fl.sprite.position.y = fl.initialPos.y + Math.sin(progress * Math.PI * 0.5) * 0.65;
      (fl.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1.0 - Math.pow(progress, 1.5));
    }

    // 4. Update 3D Flying Projectiles & Skill Plungers
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pj = this.projectiles[i];
      pj.lifeSec += dtSec;

      if (pj.lifeSec >= pj.maxLifeSec) {
        this.releaseProjectile(pj);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pj.isStuck && pj.stuckTargetPos) {
        // Monster stuck vibration
        pj.group.position.copy(pj.stuckTargetPos);
        pj.group.rotation.z = Math.sin(pj.lifeSec * 45.0) * 0.14;
        continue;
      }

      if (pj.velocity) {
        // Physics ballistic flight
        pj.velocity.y -= 12.0 * dtSec; // Gravity
        pj.group.position.addScaledVector(pj.velocity, dtSec);
        pj.group.rotation.x += dtSec * 14.0;

        // Floor bounce at y = -1.15
        if (pj.group.position.y <= -1.15) {
          pj.group.position.y = -1.15;
          pj.velocity.y = Math.abs(pj.velocity.y) * 0.42; // Bounce
          pj.velocity.x *= 0.75;
          pj.velocity.z *= 0.75;
        }

        // Check monster sticking hit
        if (pj.stuckTargetPos && pj.group.position.distanceTo(pj.stuckTargetPos) < 0.6) {
          pj.isStuck = true;
        }
        if (pj.bounceOffPos && pj.group.position.distanceTo(pj.bounceOffPos) < 1.2) {
          pj.velocity.multiplyScalar(-0.35);
          pj.velocity.y = 4.0;
          pj.bounceOffPos = undefined;
        }
      } else {
        // Linear direct flight
        const dist = pj.startPos.distanceTo(pj.targetPos);
        pj.progress += (pj.speed * dtSec) / Math.max(0.1, dist);

        if (pj.progress >= 1.0) {
          this.releaseProjectile(pj);
          this.projectiles.splice(i, 1);
          continue;
        }

        pj.group.position.lerpVectors(pj.startPos, pj.targetPos, pj.progress);
        pj.group.lookAt(pj.targetPos);
      }
    }

    // 5. Update Skill FX (Foam Wave & slash marks)
    for (let i = this.skillEffects.length - 1; i >= 0; i--) {
      const fx = this.skillEffects[i];
      fx.lifeSec += dtSec;

      const isDone = fx.updateFn(dtSec, fx.lifeSec) || fx.lifeSec >= fx.maxLifeSec;
      if (isDone) {
        this.group.remove(fx.group);
        disposeObject3D(fx.group);
        this.skillEffects.splice(i, 1);
      }
    }
  }

  /** 엔진의 칼날 상태를 그대로 그린다. 목록에 없는 칼날 메시는 풀로 돌려보낸다. */
  public syncSkillBlades(blades: ReadonlyArray<{ id: string; thetaRad: number; radiusM: number }>): void {
    const seen = new Set<string>();
    for (const blade of blades) {
      seen.add(blade.id);
      let mesh = this.bladeMeshes.get(blade.id);
      if (!mesh) {
        mesh = this.bladeMeshPool.pop() ?? new THREE.Mesh(this.bladeGeo, this.bladeMat);
        this.bladeMeshes.set(blade.id, mesh);
        this.group.add(mesh);
      }
      const x = Math.sin(blade.thetaRad) * blade.radiusM;
      const z = -Math.cos(blade.thetaRad) * blade.radiusM;
      mesh.position.set(x, 0.95, z);
      mesh.rotation.y = Math.atan2(-x, -z);
    }
    this.bladeMeshes.forEach((mesh, id) => {
      if (seen.has(id)) return;
      this.group.remove(mesh);
      this.bladeMeshes.delete(id);
      if (this.bladeMeshPool.length < 16) this.bladeMeshPool.push(mesh);
    });
  }

  /** 엔진의 거품 파도 상태를 작은 거품 수백 개로 그린다. 거품 위치는 파도 앞면에서 정해진다. */
  public syncSkillFoam(waves: ReadonlyArray<{ id: string; radiusM: number; count: number }>, spreadHalfRad: number): void {
    if (waves.length === 0 && this.foamWaveSeeds.size === 0 && this.foamWaveMesh.count === 0) return;
    const live = new Set(waves.map((w) => w.id));
    this.foamWaveSeeds.forEach((_v, id) => {
      if (!live.has(id)) this.foamWaveSeeds.delete(id);
    });
    const mesh = this.foamWaveMesh;
    const matrix = new THREE.Matrix4();
    let n = 0;
    for (const wave of waves) {
      let seeds = this.foamWaveSeeds.get(wave.id);
      if (!seeds) {
        const c = wave.count;
        seeds = {
          theta: new Float32Array(c),
          back: new Float32Array(c),
          y: new Float32Array(c),
          scale: new Float32Array(c),
          color: new Uint8Array(c),
        };
        for (let i = 0; i < c; i++) {
          seeds.theta[i] = (Math.random() * 2 - 1) * spreadHalfRad;
          seeds.back[i] = Math.random() * 2.4;
          seeds.y[i] = 0.1 + Math.random() * 1.6;
          seeds.scale[i] = 0.045 + Math.random() * 0.065;
          seeds.color[i] = Math.floor(Math.random() * 3);
        }
        this.foamWaveSeeds.set(wave.id, seeds);
      }
      for (let i = 0; i < seeds.theta.length && n < FOAM_WAVE_CAPACITY; i++) {
        const r = Math.max(0.6, wave.radiusM - seeds.back[i]);
        const s = seeds.scale[i] * (1 + r * 0.04); // 멀어져도 보이게
        const y = seeds.y[i] + Math.sin(r * 1.5 + i) * 0.12;
        matrix.makeScale(s, s, s).setPosition(Math.sin(seeds.theta[i]) * r, y, -Math.cos(seeds.theta[i]) * r);
        mesh.setMatrixAt(n, matrix);
        mesh.setColorAt(n, FOAM_COLORS[seeds.color[i]]);
        n++;
      }
    }
    const changed = n > 0 || mesh.count > 0;
    mesh.count = n;
    if (changed) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  public get foamWaveInstanceCount(): number {
    return this.foamWaveMesh.count;
  }

  public get activeBladeMeshCount(): number {
    return this.bladeMeshes.size;
  }

  /** 칼날이 닿은 몬스터 높이에 0.2초 동안 사선 베인 자국을 띄운다. */
  public spawnSlashMark(position: THREE.Vector3): void {
    const mark = new THREE.Mesh(this.slashGeo, this.slashMat);
    mark.rotation.z = Math.PI / 4;
    const group = new THREE.Group();
    group.add(mark);
    group.position.copy(position);
    group.lookAt(0, 1.65, 2.2);
    this.group.add(group);
    this.skillEffects.push({
      group,
      kind: 'revolver',
      lifeSec: 0,
      maxLifeSec: 0.2,
      updateFn: (_dt, life) => {
        const t = Math.min(1, life / 0.2);
        mark.scale.set(1 + t * 0.4, Math.max(0.01, 1 - t), 1);
        return false;
      },
    });
  }

  public clear(): void {
    this.bladeMeshes.forEach((mesh) => this.group.remove(mesh));
    this.bladeMeshes.clear();
    this.foamWaveMesh.count = 0;
    this.foamWaveSeeds.clear();
    for (const batch of this.batches) {
      batch.items.length = 0;
      batch.mesh.count = 0;
    }
    this.tracerBeams.forEach((tb) => {
      this.group.remove(tb.beamMesh);
      this.group.remove(tb.flashMesh);
      tb.beamMesh.visible = false;
      tb.flashMesh.visible = false;
      if (this.tracerPool.length < 24) {
        this.tracerPool.push(tb);
      }
    });
    this.tracerBeams = [];
    this.floatingLabels.forEach((fl) => {
      this.group.remove(fl.sprite);
      fl.sprite.material.dispose();
    });
    this.floatingLabels = [];
    this.projectiles.forEach((pj) => {
      this.releaseProjectile(pj);
    });
    this.projectiles = [];
    this.skillEffects.forEach((fx) => {
      this.group.remove(fx.group);
      disposeObject3D(fx.group);
    });
    this.skillEffects = [];
  }

  /**
   * 셰이더 예열용 샘플. 실제 이펙트가 쓰는 재질 종류(투명 Basic, Standard, Sprite)를 한 개씩 담는다.
   * 호출자는 이 객체를 앵커로 살려 두어 셰이더 프로그램이 해제되지 않게 해야 한다.
   */
  public createWarmupObjects(): THREE.Object3D[] {
    // 파티클 배치 메시는 항상 씬에 있으므로 제외한다.
    const objs: THREE.Object3D[] = [];
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
    objs.push(new THREE.Mesh(this.unitTracerGeo, tracerMat));
    objs.push(new THREE.Mesh(this.unitFlashGeo, tracerMat));
    objs.push(new THREE.Mesh(this.revolverBoltGeo, this.revolverMat));
    objs.push(new THREE.Mesh(this.gatlingBubbleGeo, this.gatlingMat));
    objs.push(new THREE.Mesh(this.sharedShotgunPelletGeo, this.sharedShotgunPelletMat));
    objs.push(createRealisticPlungerMesh(0.28));
    objs.push(new THREE.Mesh(this.bladeGeo, this.bladeMat));
    objs.push(new THREE.Mesh(this.slashGeo, this.slashMat));
    const foamInst = new THREE.InstancedMesh(this.foamWaveMesh.geometry, this.foamWaveMesh.material, 1);
    foamInst.setMatrixAt(0, new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
    foamInst.setColorAt(0, new THREE.Color(0xffffff));
    objs.push(foamInst);

    // Instanced variants (USE_INSTANCING / USE_INSTANCING_COLOR) are separate shader programs.
    for (const batch of this.batches) {
      const inst = new THREE.InstancedMesh(batch.mesh.geometry, batch.mesh.material, 1);
      inst.setMatrixAt(0, new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
      if (batch.usesColor) inst.setColorAt(0, new THREE.Color(0xffffff));
      objs.push(inst);
    }

    const labelTex = this.getOrCreateFloatingLabelTexture('power_shot');
    labelTex.userData.isShared = true;
    objs.push(new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false })));
    return objs;
  }

  public getActiveFlashScales(): number[] {
    return this.tracerBeams.map((tb) => tb.flashMesh.scale.x);
  }

  public getPoolStats(): ParticlePoolStats {
    let pooledProjectiles = 0;
    this.projectilePools.forEach((pool) => {
      pooledProjectiles += pool.length;
    });
    return {
      activeProjectiles: this.projectiles.length,
      pooledProjectiles,
      activeTracers: this.tracerBeams.length,
      pooledTracers: this.tracerPool.length,
    };
  }
}
