import * as THREE from 'three';

export class DraftTapGun3D {
  public readonly group: THREE.Group;
  private readonly basePosition = new THREE.Vector3(0.48, -0.46, -0.95);
  private currentRecoilZ = 0;
  private currentRecoilPitch = 0;
  private nozzleMesh: THREE.Mesh;
  private nozzleMat: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DraftTapGun3D';
    this.group.position.copy(this.basePosition);

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.22,
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
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 16), chromeMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.22);
    this.group.add(barrel);

    // 2. Brass Nozzle Tip
    this.nozzleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.12, 16), this.nozzleMat);
    this.nozzleMesh.rotation.x = Math.PI / 2;
    this.nozzleMesh.position.set(0, 0, -0.52);
    this.group.add(this.nozzleMesh);

    // 3. Draft Tap Tower / Receiver Block
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.2), brassMat);
    receiver.position.set(0, 0.02, 0);
    this.group.add(receiver);

    // 4. Tap Handle / Lever (Top)
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.24, 12), brassMat);
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
  }

  public triggerRecoil(isFeverShot = false): void {
    const kick = isFeverShot ? 0.08 : 0.12;
    this.currentRecoilZ = kick;
    this.currentRecoilPitch = kick * 0.7;
  }
}
