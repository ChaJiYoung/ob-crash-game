import * as THREE from 'three';
import { WeaponKind, WeaponLevel } from '../../shared/types';

/**
 * Procedural Realistic 3D Plunger Mesh
 * 3-stage rubber bell dome + bottom suction rim torus + wooden stick
 */
export function createRealisticPlungerMesh(scale = 1.0): THREE.Group {
  const plungerGroup = new THREE.Group();
  plungerGroup.name = 'RealisticPlunger';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xc89666,
    roughness: 0.7,
    metalness: 0.05,
  });
  const rubberRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.55,
    metalness: 0.1,
  });
  const rubberDarkRimMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.6,
    metalness: 0.15,
  });

  const handleLength = 0.55 * scale;
  const handleRadius = 0.02 * scale;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 12),
    woodMat
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = handleLength / 2;
  plungerGroup.add(handle);

  const handleCap = new THREE.Mesh(
    new THREE.SphereGeometry(handleRadius * 1.15, 10, 8),
    woodMat
  );
  handleCap.position.z = handleLength;
  plungerGroup.add(handleCap);

  const cupGroup = new THREE.Group();
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035 * scale, 0.045 * scale, 0.08 * scale, 16),
    rubberRedMat
  );
  neck.rotation.x = Math.PI / 2;
  neck.position.z = 0.04 * scale;
  cupGroup.add(neck);

  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045 * scale, 0.14 * scale, 0.14 * scale, 18, 1, true),
    rubberRedMat
  );
  bell.rotation.x = Math.PI / 2;
  bell.position.z = -0.05 * scale;
  cupGroup.add(bell);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.14 * scale, 0.022 * scale, 10, 24),
    rubberDarkRimMat
  );
  rim.position.z = -0.12 * scale;
  cupGroup.add(rim);

  plungerGroup.add(cupGroup);
  return plungerGroup;
}

export class DraftTapGun3D {
  public readonly group: THREE.Group;
  private readonly basePosition = new THREE.Vector3(0.0, -0.46, -0.92);
  private currentRecoilZ = 0;
  private currentRecoilPitch = 0;

  // Evolution & Dynamic Weapon Meshes
  private evolutionGroup: THREE.Group;
  public currentWeaponKind: WeaponKind = 'shotgun';
  public currentWeaponLevel: WeaponLevel = 1;

  // Shared Materials
  private chromeMat: THREE.MeshStandardMaterial;
  private brassMat: THREE.MeshStandardMaterial;
  private goldMat: THREE.MeshStandardMaterial;
  private darkGripMat: THREE.MeshStandardMaterial;
  private nozzleMat: THREE.MeshStandardMaterial;

  // Buff Visuals (Backward Compatibility)
  private flameAuraMesh: THREE.Mesh;
  private scopeLaserBeam: THREE.Mesh;
  private isPowerMode = false;
  private isScopeMode = false;

  // Gatling animation
  private gatlingCluster: THREE.Group | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DraftTapGun3D';
    this.group.position.copy(this.basePosition);

    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
    });

    this.brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.22,
    });

    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.85,
      metalness: 0.95,
      roughness: 0.18,
    });

    this.darkGripMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.75,
    });

    this.nozzleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x000000,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Pistol Grip (Base mount)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), this.darkGripMat);
    grip.position.set(0, -0.14, 0.04);
    grip.rotation.x = 0.35;
    this.group.add(grip);

    // Evolution Group for dynamic weapon models
    this.evolutionGroup = new THREE.Group();
    this.evolutionGroup.name = 'WeaponEvolutionGroup';
    this.group.add(this.evolutionGroup);

    // Buff Aura Meshes
    this.flameAuraMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.flameAuraMesh.position.set(0, 0, -0.58);
    this.flameAuraMesh.visible = false;
    this.group.add(this.flameAuraMesh);

    const scopeBeamGeo = new THREE.CylinderGeometry(0.008, 0.008, 15, 8);
    scopeBeamGeo.rotateX(Math.PI / 2);
    this.scopeLaserBeam = new THREE.Mesh(
      scopeBeamGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    this.scopeLaserBeam.position.set(0, 0.12, -7.5);
    this.scopeLaserBeam.visible = false;
    this.group.add(this.scopeLaserBeam);

    // Default weapon appearance: Shotgun Lv.1
    this.setWeaponAppearance('shotgun', 1);
  }

  public setWeaponAppearance(kind: WeaponKind, level: WeaponLevel = 1): void {
    this.currentWeaponKind = kind;
    this.currentWeaponLevel = level;
    this.gatlingCluster = null;

    // Clear previous evolution parts
    while (this.evolutionGroup.children.length > 0) {
      this.evolutionGroup.remove(this.evolutionGroup.children[0]);
    }

    if (kind === 'shotgun') {
      this.buildShotgunModel(level);
    } else if (kind === 'revolver') {
      this.buildRevolverModel(level);
    } else if (kind === 'gatling') {
      this.buildGatlingModel(level);
    }
  }

  private buildShotgunModel(level: WeaponLevel): void {
    // 1. Brass Receiver Box
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.26), this.brassMat);
    receiver.position.set(0, 0.02, 0);
    this.evolutionGroup.add(receiver);

    // 2. Draft Tap Lever Handle
    const leverHeight = 0.22 + level * 0.03;
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, leverHeight, 10), this.brassMat);
    lever.position.set(0, leverHeight / 2 + 0.08, 0.02);
    lever.rotation.x = -0.2;
    this.evolutionGroup.add(lever);

    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    knob.position.set(0, leverHeight + 0.08, -0.01);
    this.evolutionGroup.add(knob);

    // 3. Evolving Chrome Barrels
    const barrelCount = level === 1 ? 1 : level === 2 ? 2 : level === 3 ? 3 : 4;
    const barrelLen = 0.45 + level * 0.06;

    for (let bIdx = 0; bIdx < barrelCount; bIdx++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, barrelLen, 14), this.chromeMat);
      barrel.rotation.x = Math.PI / 2;
      let ox = 0;
      let oy = 0.02;

      if (barrelCount === 2) {
        ox = (bIdx - 0.5) * 0.09;
      } else if (barrelCount === 3) {
        // Triangular barrel array
        ox = bIdx === 0 ? 0 : (bIdx === 1 ? -0.05 : 0.05);
        oy = bIdx === 0 ? 0.06 : -0.02;
      } else if (barrelCount === 4) {
        // 2x2 Quad array
        ox = bIdx % 2 === 0 ? -0.05 : 0.05;
        oy = bIdx < 2 ? 0.06 : -0.02;
      }

      barrel.position.set(ox, oy, -barrelLen / 2 - 0.1);
      this.evolutionGroup.add(barrel);
    }

    // 4. Muzzle Plunger
    const plungerScale = 0.72 + level * 0.16;
    const tipPlunger = createRealisticPlungerMesh(plungerScale);
    tipPlunger.position.set(0, 0.02, -barrelLen - 0.12);
    this.evolutionGroup.add(tipPlunger);

    // 5. Lv.2+ Brass Pressure Gauge
    if (level >= 2) {
      const pGauge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), this.goldMat);
      pGauge.rotation.z = Math.PI / 2;
      pGauge.position.set(0.09, 0.05, -0.05);
      this.evolutionGroup.add(pGauge);
    }

    // 6. Lv.3+ Amber Beer Tube Bridge
    if (level >= 3) {
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
        emissive: 0xd97706,
        emissiveIntensity: 0.5,
      });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, barrelLen, 10), tubeMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.11, -barrelLen / 2 - 0.1);
      this.evolutionGroup.add(tube);
    }

    // 7. Lv.4 MAX Red Neon Energy Ring
    if (level >= 4) {
      const auraRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.015, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      auraRing.position.set(0, 0.02, -barrelLen - 0.08);
      this.evolutionGroup.add(auraRing);
    }
  }

  private buildRevolverModel(level: WeaponLevel): void {
    // 1. Golden Frame
    const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.3), this.goldMat);
    rFrame.position.set(0, 0.02, 0);
    this.evolutionGroup.add(rFrame);

    // 2. Crown Bottle Cap Cylinder
    const cylRadius = level >= 4 ? 0.095 : 0.078;
    const rCyl = new THREE.Mesh(new THREE.CylinderGeometry(cylRadius, cylRadius, 0.15, 16), this.brassMat);
    rCyl.rotation.x = Math.PI / 2;
    rCyl.position.set(0, 0.02, -0.02);
    this.evolutionGroup.add(rCyl);

    // 3. Octagonal Sniper Barrel
    const rBarrelLen = 0.5 + level * 0.1;
    const rLongBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, rBarrelLen, 8), this.chromeMat);
    rLongBarrel.rotation.x = Math.PI / 2;
    rLongBarrel.position.set(0, 0.03, -rBarrelLen / 2 - 0.15);
    this.evolutionGroup.add(rLongBarrel);

    // 4. Hook Hammer
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16, Math.PI * 1.5), this.goldMat);
    hook.rotation.y = Math.PI / 2;
    hook.position.set(0, 0.12, 0.12);
    this.evolutionGroup.add(hook);

    // 5. Lv.2+ Gold Compensator Tip
    if (level >= 2) {
      const muzzleTip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), this.goldMat);
      muzzleTip.position.set(0, 0.03, -rBarrelLen - 0.15);
      this.evolutionGroup.add(muzzleTip);
    }

    // 6. Lv.3+ Cyan Laser Scope
    if (level >= 3) {
      const lScope = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 12), this.chromeMat);
      lScope.rotation.x = Math.PI / 2;
      lScope.position.set(0, 0.11, -0.35);
      this.evolutionGroup.add(lScope);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 12, 6),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })
      );
      beam.rotation.x = Math.PI / 2;
      beam.position.set(0, 0.11, -6.35);
      this.evolutionGroup.add(beam);
    }
  }

  private buildGatlingModel(level: WeaponLevel): void {
    // 1. Cass Blue Drum Magazine
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0x004b91,
      metalness: 0.8,
      roughness: 0.25,
    });
    const gDrum1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 18), drumMat);
    gDrum1.position.set(level >= 3 ? -0.16 : 0, -0.04, 0.02);
    this.evolutionGroup.add(gDrum1);

    if (level >= 3) {
      const gDrum2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 18), drumMat);
      gDrum2.position.set(0.16, -0.04, 0.02);
      this.evolutionGroup.add(gDrum2);
    }

    // 2. Revolving Barrel Cluster
    this.gatlingCluster = new THREE.Group();
    this.gatlingCluster.name = 'gatlingCluster';
    const gBarrels = level === 1 ? 6 : level === 2 ? 8 : level === 3 ? 10 : 12;
    const gLen = 0.55 + level * 0.06;
    const gRad = 0.065 + level * 0.015;

    for (let k = 0; k < gBarrels; k++) {
      const ang = (k / gBarrels) * Math.PI * 2;
      const gb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, gLen, 10), this.brassMat);
      gb.rotation.x = Math.PI / 2;
      gb.position.set(Math.cos(ang) * gRad, Math.sin(ang) * gRad, -gLen / 2 - 0.12);
      this.gatlingCluster.add(gb);
    }
    this.evolutionGroup.add(this.gatlingCluster);

    // 3. Cyan Cooling Tube
    const cTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, gLen * 0.85, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    cTube.rotation.x = Math.PI / 2;
    cTube.position.set(gRad + 0.03, gRad + 0.02, -gLen / 2 - 0.1);
    this.evolutionGroup.add(cTube);
  }

  public updateAimAndRecoil(aimX: number, aimY: number, dtSec: number, isFeverActive: boolean): void {
    const targetRotX = aimY * 0.36 + this.currentRecoilPitch;
    const targetRotY = -aimX * 0.58;
    this.group.rotation.x += (targetRotX - this.group.rotation.x) * Math.min(1, dtSec * 18);
    this.group.rotation.y += (targetRotY - this.group.rotation.y) * Math.min(1, dtSec * 18);

    const targetPosX = this.basePosition.x + aimX * 0.04;
    const targetPosY = this.basePosition.y + aimY * 0.03;
    const targetPosZ = this.basePosition.z + this.currentRecoilZ;

    this.group.position.x += (targetPosX - this.group.position.x) * Math.min(1, dtSec * 18);
    this.group.position.y += (targetPosY - this.group.position.y) * Math.min(1, dtSec * 18);
    this.group.position.z += (targetPosZ - this.group.position.z) * Math.min(1, dtSec * 22);

    // Recoil decay
    const decay = Math.exp(-dtSec * 16);
    this.currentRecoilZ *= decay;
    this.currentRecoilPitch *= decay;

    // Gatling spin animation
    if (this.gatlingCluster) {
      const spinSpeed = isFeverActive ? 28 : 6;
      this.gatlingCluster.rotation.z += dtSec * spinSpeed;
    }

    // Fever glow
    if (isFeverActive) {
      this.nozzleMat.emissive.setHex(0xf59e0b);
      this.nozzleMat.emissiveIntensity = 1.8;
    } else {
      this.nozzleMat.emissive.setHex(0x000000);
      this.nozzleMat.emissiveIntensity = 0;
    }

    if (this.isPowerMode) {
      const pulse = 1.0 + Math.sin(Date.now() * 0.012) * 0.18;
      this.flameAuraMesh.scale.set(pulse, pulse, pulse);
    }
  }

  public setPowerMode(isPower: boolean): void {
    this.isPowerMode = isPower;
    this.flameAuraMesh.visible = isPower;
  }

  public setScopeMode(isScope: boolean): void {
    this.isScopeMode = isScope;
    this.scopeLaserBeam.visible = isScope;
  }

  public triggerRecoil(isFeverActive: boolean): void {
    const kickZ = isFeverActive ? 0.05 : 0.09;
    const kickPitch = isFeverActive ? 0.03 : 0.06;
    this.currentRecoilZ = Math.min(0.2, this.currentRecoilZ + kickZ);
    this.currentRecoilPitch = Math.min(0.15, this.currentRecoilPitch + kickPitch);

    if (this.gatlingCluster) {
      this.gatlingCluster.rotation.z += 0.8;
    }
  }

  public get isPower(): boolean {
    return this.isPowerMode;
  }

  public get isScope(): boolean {
    return this.isScopeMode;
  }

  public get flameVisible(): boolean {
    return this.flameAuraMesh.visible;
  }

  public get scopeBeamVisible(): boolean {
    return this.scopeLaserBeam.visible;
  }
}
