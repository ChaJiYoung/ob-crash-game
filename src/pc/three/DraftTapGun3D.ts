import * as THREE from 'three';

export class DraftTapGun3D {
  public readonly group: THREE.Group;
  private readonly basePosition = new THREE.Vector3(0.48, -0.46, -0.95);
  private currentRecoilZ = 0;
  private currentRecoilPitch = 0;
  private nozzleMesh: THREE.Mesh;
  private nozzleMat: THREE.MeshStandardMaterial;
  private barrelMesh: THREE.Mesh;
  private receiverMesh: THREE.Mesh;
  private chromeMat: THREE.MeshStandardMaterial;
  private brassMat: THREE.MeshStandardMaterial;
  private goldMat: THREE.MeshStandardMaterial;
  private flameAuraMesh: THREE.Mesh;
  private scopeLaserBeam: THREE.Mesh;
  private isPowerMode = false;
  private isScopeMode = false;

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

    const darkGripMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.75,
    });

    this.nozzleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x000000,
      metalness: 0.8,
      roughness: 0.2,
    });

    // 1. Main Chrome Barrel
    this.barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 16), this.chromeMat);
    this.barrelMesh.rotation.x = Math.PI / 2;
    this.barrelMesh.position.set(0, 0, -0.22);
    this.group.add(this.barrelMesh);

    // 2. Brass Nozzle Tip
    this.nozzleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.12, 16), this.nozzleMat);
    this.nozzleMesh.rotation.x = Math.PI / 2;
    this.nozzleMesh.position.set(0, 0, -0.52);
    this.group.add(this.nozzleMesh);

    // Flame aura sphere at nozzle tip (lit during Power Shot)
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

    // 3. Draft Tap Tower / Receiver Block
    this.receiverMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.2), this.brassMat);
    this.receiverMesh.position.set(0, 0.02, 0);
    this.group.add(this.receiverMesh);

    // Hologram laser guide beam forward (lit during Wide Scope)
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

    // 4. Tap Handle / Lever (Top)
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.24, 12), this.brassMat);
    lever.position.set(0, 0.16, 0.02);
    lever.rotation.x = -0.25;
    this.group.add(lever);

    const leverKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 })
    );
    leverKnob.position.set(0, 0.28, -0.01);
    this.group.add(leverKnob);

    // 5. Pistol Grip (Bottom angled)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), darkGripMat);
    grip.position.set(0, -0.14, 0.04);
    grip.rotation.x = 0.35;
    this.group.add(grip);
  }

  public updateAimAndRecoil(aimX: number, aimY: number, dtSec: number, isFeverActive: boolean): void {
    // Aim tilt
    const targetRotX = aimY * 0.18 + this.currentRecoilPitch;
    const targetRotY = -aimX * 0.25;
    this.group.rotation.x += (targetRotX - this.group.rotation.x) * Math.min(1, dtSec * 18);
    this.group.rotation.y += (targetRotY - this.group.rotation.y) * Math.min(1, dtSec * 18);

    // Aim position sway + recoil
    const targetPosX = this.basePosition.x + aimX * 0.06;
    const targetPosY = this.basePosition.y + aimY * 0.05;
    const targetPosZ = this.basePosition.z + this.currentRecoilZ;

    this.group.position.x += (targetPosX - this.group.position.x) * Math.min(1, dtSec * 18);
    this.group.position.y += (targetPosY - this.group.position.y) * Math.min(1, dtSec * 18);
    this.group.position.z += (targetPosZ - this.group.position.z) * Math.min(1, dtSec * 22);

    // Recoil decay
    const decay = Math.exp(-dtSec * 16);
    this.currentRecoilZ *= decay;
    this.currentRecoilPitch *= decay;

    // Fever glow
    if (isFeverActive) {
      this.nozzleMat.emissive.setHex(0xf59e0b);
      this.nozzleMat.emissiveIntensity = 1.8;
    } else {
      this.nozzleMat.emissive.setHex(0x000000);
      this.nozzleMat.emissiveIntensity = 0;
    }

    // Flame aura breathing animation when Power Mode is active
    if (this.isPowerMode) {
      const pulse = 1.0 + Math.sin(Date.now() * 0.012) * 0.18;
      this.flameAuraMesh.scale.set(pulse, pulse, pulse);
    }
  }

  public setPowerMode(isPower: boolean): void {
    if (this.isPowerMode === isPower) return;
    this.isPowerMode = isPower;
    if (isPower) {
      this.barrelMesh.material = this.goldMat;
      this.receiverMesh.material = this.goldMat;
      this.flameAuraMesh.visible = true;
    } else {
      this.barrelMesh.material = this.chromeMat;
      this.receiverMesh.material = this.brassMat;
      this.flameAuraMesh.visible = false;
      this.flameAuraMesh.scale.set(1, 1, 1);
    }
  }

  public setScopeMode(isScope: boolean): void {
    this.isScopeMode = isScope;
    this.scopeLaserBeam.visible = isScope;
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

  public triggerRecoil(isFeverShot = false): void {
    const kick = isFeverShot ? 0.08 : 0.12;
    this.currentRecoilZ = kick;
    this.currentRecoilPitch = kick * 0.7;
  }

  public getMuzzleWorldPosition(camera?: THREE.Camera): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.nozzleMesh.getWorldPosition(worldPos);
    // If attached to camera or detached, worldPos reflects accurate nozzle tip
    return worldPos;
  }
}
