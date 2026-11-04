import * as THREE from 'three';
import { ItemBuffKind, WeaponKind, WeaponLevel } from '../../shared/types';
import { ITEM_BUFF_SPECS, WEAPON_ARCHETYPE_SPECS } from '../../shared/constants';
import { createRealisticPlungerMesh } from './DraftTapGun3D';

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
  private particles: ParticleItem[] = [];
  private tracerBeams: TracerBeamItem[] = [];
  private floatingLabels: FloatingLabelItem[] = [];
  private projectiles: ProjectileItem[] = [];
  private skillEffects: SkillEffectItem[] = [];

  public get activeProjectiles(): ProjectileItem[] {
    return this.projectiles;
  }

  public get activeSkillEffects(): SkillEffectItem[] {
    return this.skillEffects;
  }

  public get parabolicPlungers(): ProjectileItem[] {
    return this.projectiles.filter((p) => p.velocity !== undefined);
  }

  public get boomerangBlade(): SkillEffectItem | undefined {
    return this.skillEffects.find((s) => s.kind === 'revolver');
  }

  public get tsunamiBubbles(): THREE.Mesh[] {
    const s = this.skillEffects.find((fx) => fx.kind === 'gatling');
    return s ? (s.group.children as THREE.Mesh[]) : [];
  }

  private labelTextureCache = new Map<ItemBuffKind, THREE.Texture>();
  private foamGeo = new THREE.SphereGeometry(0.08, 6, 6);
  private shardGeo = new THREE.BufferGeometry();
  private foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  private matCache = new Map<string, THREE.MeshBasicMaterial>();

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
      return createRealisticPlungerMesh(0.28);
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
   * ⚡ 2. 3 Active Skill Physics FX (Plunger Storm / Boomerang / Foam Tsunami)
   */
  public spawnSkillEffect(
    kind: WeaponKind,
    level: WeaponLevel,
    monsterPositions: THREE.Vector3[]
  ): void {
    const spec = WEAPON_ARCHETYPE_SPECS[kind].levels[level];

    if (kind === 'shotgun') {
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

        let target = monsterPositions[i % Math.max(1, monsterPositions.length)];
        let isSticking = true;

        if (!target || monsterPositions.length === 0 || i >= monsterPositions.length * 2) {
          // Missed plunger targets far pub floor/wall (NEVER blocks camera)
          target = new THREE.Vector3((Math.random() - 0.5) * 8.0, -1.15, -10.0 - Math.random() * 4.0);
          isSticking = false;
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
          isBouncing: !isSticking,
          lifeSec: 0,
          maxLifeSec: isSticking ? 1.6 : 1.2,
        });
      }
    } else if (kind === 'revolver') {
      // 2. 오프너 불릿 타임 & 참격: Giant Golden Bottle Opener Boomerang
      const boomerangGroup = new THREE.Group();
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.5,
        metalness: 0.95,
        roughness: 0.1,
      });

      // Opener Ring Blade (Large 2.7m diameter golden blade tilted toward camera)
      const blade = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 16, 36), goldMat);
      blade.rotation.x = Math.PI / 3.5;
      boomerangGroup.add(blade);

      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.24), goldMat);
      hook.position.set(0.95, 0, 0);
      boomerangGroup.add(hook);

      // Eye-level starting position right in front of camera
      boomerangGroup.position.set(0, 1.35, -2.2);
      this.group.add(boomerangGroup);

      this.skillEffects.push({
        group: boomerangGroup,
        kind: 'revolver',
        lifeSec: 0,
        maxLifeSec: 1.8,
        updateFn: (dt, life) => {
          boomerangGroup.rotation.y += dt * 26.0;
          boomerangGroup.rotation.z += dt * 12.0;
          // Elliptical arc trajectory centered on monsters
          const t = (life / 1.8) * Math.PI * 2;
          boomerangGroup.position.x = Math.sin(t) * 2.8;
          boomerangGroup.position.y = 1.35 + Math.sin(t * 2.0) * 0.25;
          boomerangGroup.position.z = -2.2 - Math.sin(t * 0.5) * 6.5;
          return life >= 1.8;
        },
      });
    } else {
      // 3. gatling: 거품 해일 160도 오버히트: 반투명 크리미 폼 웨이브
      const waveGroup = new THREE.Group();
      const halfArc = ((spec.skillArcDeg / 2) * Math.PI) / 180;
      const foamCount = 50;

      for (let k = 0; k < foamCount; k++) {
        const radius = 0.15 + Math.random() * 0.14;
        const fMat = new THREE.MeshBasicMaterial({
          color: k % 3 === 0 ? 0xffffff : k % 3 === 1 ? 0xe0f2fe : 0x7dd3fc,
          transparent: true,
          opacity: 0.42,
        });
        const fMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 10), fMat);
        const theta = (Math.random() * 2 - 1) * halfArc;
        fMesh.userData.theta = theta;
        fMesh.userData.speed = 10.0 + Math.random() * 5.0;
        fMesh.userData.dist = 0.6 + Math.random() * 0.6;
        fMesh.userData.initY = 0.75 + (Math.random() - 0.5) * 0.45;
        waveGroup.add(fMesh);
      }
      this.group.add(waveGroup);

      this.skillEffects.push({
        group: waveGroup,
        kind: 'gatling',
        lifeSec: 0,
        maxLifeSec: 1.4,
        updateFn: (dt) => {
          waveGroup.children.forEach((child) => {
            child.userData.dist += dt * child.userData.speed;
            const th = child.userData.theta;
            child.position.set(
              Math.sin(th) * child.userData.dist,
              child.userData.initY + Math.sin(child.userData.dist * 1.5) * 0.25,
              -Math.cos(th) * child.userData.dist
            );
          });
          return false;
        },
      });
    }
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

  public triggerBottleCrash(origin: THREE.Vector3, count = 16): void {
    const capMesh = new THREE.Mesh(this.bottleCapGeo, this.bottleCapMat);
    capMesh.position.copy(origin).add(new THREE.Vector3(0, 0.8, 0));
    this.group.add(capMesh);

    const capVx = (Math.random() - 0.5) * 2.5;
    const capVy = 6.0 + Math.random() * 2.0;
    const capVz = (Math.random() - 0.5) * 2.5;

    this.particles.push({
      mesh: capMesh,
      velocity: new THREE.Vector3(capVx, capVy, capVz),
      lifeSec: 0,
      maxLifeSec: 1.2,
      rotSpeed: new THREE.Vector3(15.0, 8.0, 20.0),
    });

    const glassShardMat = this.getMaterial('#bae6fd');
    for (let i = 0; i < count; i++) {
      const shardMesh = new THREE.Mesh(this.shardGeo, glassShardMat);
      shardMesh.position.copy(origin).add(new THREE.Vector3(0, 0.4, 0));

      const speed = 4.0 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      const vx = Math.cos(phi) * Math.sin(theta) * speed;
      const vy = (Math.sin(phi) + 0.4) * speed;
      const vz = Math.cos(phi) * Math.cos(theta) * speed;

      this.group.add(shardMesh);
      this.particles.push({
        mesh: shardMesh,
        velocity: new THREE.Vector3(vx, vy, vz),
        lifeSec: 0,
        maxLifeSec: 0.6 + Math.random() * 0.4,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16
        ),
      });
    }

    for (let i = 0; i < 14; i++) {
      const beerDrop = new THREE.Mesh(this.beerDropGeo, this.beerMat);
      beerDrop.position.copy(origin).add(new THREE.Vector3(0, 0.35, 0));

      const speed = 3.0 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * 0.5 * Math.PI;

      const vx = Math.cos(phi) * Math.sin(theta) * speed;
      const vy = Math.sin(phi) * speed + 1.5;
      const vz = Math.cos(phi) * Math.cos(theta) * speed;

      this.group.add(beerDrop);
      this.particles.push({
        mesh: beerDrop,
        velocity: new THREE.Vector3(vx, vy, vz),
        lifeSec: 0,
        maxLifeSec: 0.5 + Math.random() * 0.3,
        rotSpeed: new THREE.Vector3(0, 0, 0),
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

    // 5. Update Skill FX (Boomerang & Foam Wave)
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

  public clear(): void {
    this.particles.forEach((p) => this.group.remove(p.mesh));
    this.particles = [];
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
