import * as THREE from 'three';
import { STAGE_CONSTANTS } from '../../shared/constants';

export interface BreweryStageRig {
  root: THREE.Group;
  neonLights: THREE.PointLight[];
  defenseArcMesh: THREE.Mesh;
  updateStageAnimation: (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => void;
}

export function buildBreweryStage3D(scene: THREE.Scene): BreweryStageRig {
  const root = new THREE.Group();
  root.name = 'BreweryStage3D';

  // 1. Warm Brewery Wooden Floor (100m x 100m)
  const floorGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1f1610,
    roughness: 0.82,
    metalness: 0.12,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  root.add(floor);

  // 2. Defense Line Bar Counter at R = 1.8m (Wooden & Brass Counter)
  // An arc positioned at R = 1.8m in front of player
  const defArcGeo = new THREE.RingGeometry(1.76, 1.84, 48, 1, 0, Math.PI);
  const defArcMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
    metalness: 0.75,
    side: THREE.DoubleSide,
  });
  const defenseArcMesh = new THREE.Mesh(defArcGeo, defArcMat);
  defenseArcMesh.rotation.x = -Math.PI / 2;
  defenseArcMesh.rotation.z = Math.PI; // Face forward (-Z)
  defenseArcMesh.position.set(0, 0.01, 0);
  root.add(defenseArcMesh);

  // Bar Counter curved wall
  const barCounterGeo = new THREE.CylinderGeometry(1.85, 1.85, 1.05, 48, 1, true, 0, Math.PI);
  const barCounterMat = new THREE.MeshStandardMaterial({
    color: 0x2e1a0f,
    roughness: 0.7,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const barCounter = new THREE.Mesh(barCounterGeo, barCounterMat);
  barCounter.position.set(0, 0.52, 0);
  barCounter.rotation.y = Math.PI;
  root.add(barCounter);

  // Brass Bar Rail Trim on top
  const brassRailGeo = new THREE.TorusGeometry(1.86, 0.04, 8, 48, Math.PI);
  const brassRailMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.88,
    roughness: 0.22,
  });
  const brassRail = new THREE.Mesh(brassRailGeo, brassRailMat);
  brassRail.rotation.x = Math.PI / 2;
  brassRail.rotation.z = Math.PI;
  brassRail.position.set(0, 1.06, 0);
  root.add(brassRail);

  // 3. Fan Distance Arcs (10m, 20m, 28m)
  const distanceArcRadii = [10.0, 20.0, STAGE_CONSTANTS.SPAWN_RADIUS_M];
  distanceArcRadii.forEach((radius, idx) => {
    const arcGeo = new THREE.RingGeometry(radius - 0.06, radius + 0.06, 64, 1, 0, Math.PI);
    const arcMat = new THREE.MeshBasicMaterial({
      color: idx === 2 ? 0xef4444 : 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.rotation.x = -Math.PI / 2;
    arcMesh.rotation.z = Math.PI;
    arcMesh.position.set(0, 0.02, 0);
    root.add(arcMesh);
  });

  // 4. Copper Fermentation Tanks (6 Large Brewery Tanks on Left and Right)
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0xb87333, // Copper
    metalness: 0.85,
    roughness: 0.28,
  });
  const tankCapMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.9,
    roughness: 0.2,
  });

  const tankPositions = [
    [-14, -10],
    [-17, -20],
    [-20, -30],
    [14, -10],
    [17, -20],
    [20, -30],
  ];

  tankPositions.forEach(([tx, tz]) => {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(tx, 0, tz);

    // Tank main cylinder
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 10, 24), tankMat);
    body.position.y = 5;
    tankGroup.add(body);

    // Conical bottom/top cap
    const topCap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.5, 24), tankCapMat);
    topCap.position.y = 11.25;
    tankGroup.add(topCap);

    root.add(tankGroup);
  });

  // 5. Neon Pub Lighting
  const neonLights: THREE.PointLight[] = [];

  const ambientLight = new THREE.AmbientLight(0xffecd2, 0.45);
  root.add(ambientLight);

  const mainDirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  mainDirLight.position.set(5, 18, 8);
  root.add(mainDirLight);

  // Amber Neon Sign Light
  const amberNeon = new THREE.PointLight(0xf59e0b, 2.2, 35);
  amberNeon.position.set(0, 6, -14);
  root.add(amberNeon);
  neonLights.push(amberNeon);

  // Cyan Neon Side Light
  const cyanNeon = new THREE.PointLight(0x06b6d4, 1.8, 30);
  cyanNeon.position.set(-10, 5, -8);
  root.add(cyanNeon);
  neonLights.push(cyanNeon);

  // Red/Gold Defense Alert Light
  const alertLight = new THREE.PointLight(0xef4444, 1.2, 20);
  alertLight.position.set(0, 3, -2);
  root.add(alertLight);
  neonLights.push(alertLight);

  scene.add(root);

  const updateStageAnimation = (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => {
    // Pulse neon lights
    if (isFeverActive) {
      amberNeon.color.setHex(0xffd700);
      amberNeon.intensity = 3.5 + Math.sin(elapsedSec * 12) * 1.5;
      cyanNeon.color.setHex(0xf59e0b);
      cyanNeon.intensity = 3.0;
    } else {
      amberNeon.color.setHex(0xf59e0b);
      amberNeon.intensity = 2.0 + Math.sin(elapsedSec * 2) * 0.4;
      cyanNeon.color.setHex(0x06b6d4);
      cyanNeon.intensity = 1.6 + Math.cos(elapsedSec * 2.5) * 0.3;
    }

    if (dangerAlert) {
      alertLight.intensity = 3.0 + Math.sin(elapsedSec * 16) * 2.0;
      (defArcMat as THREE.MeshStandardMaterial).color.setHex(0xef4444);
    } else {
      alertLight.intensity = 0.5;
      (defArcMat as THREE.MeshStandardMaterial).color.setHex(isFeverActive ? 0xffd700 : 0xf59e0b);
    }
  };

  return {
    root,
    neonLights,
    defenseArcMesh,
    updateStageAnimation,
  };
}
