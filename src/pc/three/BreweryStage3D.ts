import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { STAGE_CONSTANTS } from '../../shared/constants';

export interface BreweryStageRig {
  root: THREE.Group;
  neonLights: THREE.PointLight[];
  defenseArcMesh: THREE.Mesh;
  healPulseMesh: THREE.Mesh;
  triggerHealPulse: () => void;
  updateStageAnimation: (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => void;
}

let cachedHdriTexture: THREE.DataTexture | null = null;
let hdriLoadCallbacks: Array<(tex: THREE.DataTexture) => void> | null = null;

export function applyCachedHdriToScene(scene: THREE.Scene): void {
  if (cachedHdriTexture) {
    scene.environment = cachedHdriTexture;
    scene.background = cachedHdriTexture;
    scene.backgroundBlurriness = 0.08;
    scene.backgroundIntensity = 0.72;
    return;
  }

  if (typeof window === 'undefined') return;

  if (hdriLoadCallbacks !== null) {
    hdriLoadCallbacks.push((texture) => {
      scene.environment = texture;
      scene.background = texture;
      scene.backgroundBlurriness = 0.08;
      scene.backgroundIntensity = 0.72;
    });
    return;
  }

  hdriLoadCallbacks = [
    (texture) => {
      scene.environment = texture;
      scene.background = texture;
      scene.backgroundBlurriness = 0.08;
      scene.backgroundIntensity = 0.72;
    },
  ];

  try {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      '/hdri/pub_interior_2k.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        cachedHdriTexture = texture;
        const cbs = hdriLoadCallbacks || [];
        hdriLoadCallbacks = null;
        cbs.forEach((cb) => cb(texture));
      },
      undefined,
      (err) => {
        console.warn('Failed to load HDRI texture, using canvas fallback:', err);
        hdriLoadCallbacks = null;
      }
    );
  } catch (err) {
    console.warn('RGBELoader failed to initialize:', err);
    hdriLoadCallbacks = null;
  }
}

export function createHazardStripeTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([245, 158, 11, 255]);
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f59e0b'; // Amber-gold background
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#1e140d'; // Dark brown/black diagonal stripes
    const stripeWidth = 32;
    for (let x = -64; x < 512 + 64; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + 64, 64);
      ctx.lineTo(x + 64, 64);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(16, 1);
  return tex;
}

export function buildBreweryStage3D(scene: THREE.Scene): BreweryStageRig {
  const root = new THREE.Group();
  root.name = 'BreweryStage3D';

  // 1. Initial Warm Pub PMREM Environment Fallback
  if (typeof document !== 'undefined') {
    try {
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 128;
      envCanvas.height = 64;
      const envCtx = envCanvas.getContext('2d');
      if (envCtx) {
        const envGrad = envCtx.createLinearGradient(0, 0, 0, 64);
        envGrad.addColorStop(0, '#78350f');
        envGrad.addColorStop(0.5, '#f59e0b');
        envGrad.addColorStop(1, '#1e1b4b');
        envCtx.fillStyle = envGrad;
        envCtx.fillRect(0, 0, 128, 64);

        const envTex = new THREE.CanvasTexture(envCanvas);
        envTex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envTex;
      }
    } catch {
      // Ignore in headless
    }
  }

  // Load Real CC0 2K Pub HDRI Environment in Browser (Singleton cached)
  applyCachedHdriToScene(scene);

  // 2. Warm Brewery Wooden Floor (100m x 100m)
  const floorGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x221812,
    roughness: 0.75,
    metalness: 0.15,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  root.add(floor);

  // 3. Defense Line Bar Counter at R = 1.8m with 30cm Hazard Stripe (Floor y = 0.02)
  const hazardTex = createHazardStripeTexture();
  const defArcGeo = new THREE.RingGeometry(1.65, 1.95, 64, 1, 0, Math.PI);
  const defArcMat = new THREE.MeshBasicMaterial({
    map: hazardTex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const defenseArcMesh = new THREE.Mesh(defArcGeo, defArcMat);
  defenseArcMesh.rotation.x = -Math.PI / 2;
  defenseArcMesh.rotation.z = Math.PI; // Face forward (-Z)
  defenseArcMesh.position.set(0, 0.02, 0);
  root.add(defenseArcMesh);

  // Outer Neon Glow Perimeter Line (R = 1.94 ~ 1.98 at floor y = 0.022)
  const neonRimGeo = new THREE.RingGeometry(1.94, 1.98, 64, 1, 0, Math.PI);
  const neonRimMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const neonRimMesh = new THREE.Mesh(neonRimGeo, neonRimMat);
  neonRimMesh.rotation.x = -Math.PI / 2;
  neonRimMesh.rotation.z = Math.PI;
  neonRimMesh.position.set(0, 0.022, 0);
  root.add(neonRimMesh);

  // Emerald heal pulse shockwave ring on bar defense line
  const healPulseGeo = new THREE.RingGeometry(1.72, 1.88, 48, 1, 0, Math.PI);
  const healPulseMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const healPulseMesh = new THREE.Mesh(healPulseGeo, healPulseMat);
  healPulseMesh.rotation.x = -Math.PI / 2;
  healPulseMesh.rotation.z = Math.PI;
  healPulseMesh.position.set(0, 0.02, 0);
  healPulseMesh.visible = false;
  root.add(healPulseMesh);

  let healPulseUntilSec = 0;
  const triggerHealPulse = () => {
    healPulseUntilSec = performance.now() / 1000 + 0.5;
    healPulseMesh.visible = true;
  };

  // Bar Counter curved wall
  const barCounterGeo = new THREE.CylinderGeometry(1.85, 1.85, 1.05, 48, 1, true, 0, Math.PI);
  const barCounterMat = new THREE.MeshStandardMaterial({
    color: 0x3b2111,
    roughness: 0.65,
    metalness: 0.22,
    side: THREE.DoubleSide,
  });
  const barCounter = new THREE.Mesh(barCounterGeo, barCounterMat);
  barCounter.position.set(0, 0.52, 0);
  barCounter.rotation.y = Math.PI;
  barCounter.receiveShadow = true;
  root.add(barCounter);

  // Brass Bar Rail Trim on top
  const brassRailGeo = new THREE.TorusGeometry(1.86, 0.045, 10, 48, Math.PI);
  const brassRailMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.92,
    roughness: 0.18,
  });
  const brassRail = new THREE.Mesh(brassRailGeo, brassRailMat);
  brassRail.rotation.x = Math.PI / 2;
  brassRail.rotation.z = Math.PI;
  brassRail.position.set(0, 1.06, 0);
  root.add(brassRail);

  // Brass Tap Tower on Bar Counter
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.94,
    roughness: 0.14,
  });
  [-0.6, 0.6].forEach((tx) => {
    const tapTower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.42, 16), towerMat);
    tapTower.position.set(tx, 1.25, -1.72);
    root.add(tapTower);
  });

  // 4. Distance Arcs (6m, 12m, 18m Spawn Radius)
  const distanceArcRadii = [6.0, 12.0, STAGE_CONSTANTS.SPAWN_RADIUS_M];
  distanceArcRadii.forEach((radius, idx) => {
    const arcGeo = new THREE.RingGeometry(radius - 0.06, radius + 0.06, 64, 1, 0, Math.PI);
    const arcMat = new THREE.MeshBasicMaterial({
      color: idx === 2 ? 0xef4444 : 0x38bdf8,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.rotation.x = -Math.PI / 2;
    arcMesh.rotation.z = Math.PI;
    arcMesh.position.set(0, 0.02, 0);
    root.add(arcMesh);
  });

  // 5. Copper Fermentation Tanks (6 Large Brewery Tanks on Left and Right)
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0xb87333,
    metalness: 0.88,
    roughness: 0.24,
  });
  const tankCapMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.92,
    roughness: 0.18,
  });

  const tankPositions = [
    [-14, -8],
    [-17, -18],
    [-20, -28],
    [14, -8],
    [17, -18],
    [20, -28],
  ];

  tankPositions.forEach(([tx, tz]) => {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(tx, 0, tz);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 10, 24), tankMat);
    body.position.y = 5;
    body.castShadow = true;
    body.receiveShadow = true;
    tankGroup.add(body);

    const topCap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.5, 24), tankCapMat);
    topCap.position.y = 11.25;
    tankGroup.add(topCap);

    root.add(tankGroup);
  });

  // 6. Upgraded Stage Lights & Directional Shadows
  const neonLights: THREE.PointLight[] = [];

  const ambientLight = new THREE.AmbientLight(0xfff0d8, 1.15);
  root.add(ambientLight);

  const mainDirLight = new THREE.DirectionalLight(0xfff5e4, 1.75);
  mainDirLight.position.set(6, 22, 10);
  mainDirLight.castShadow = true;
  mainDirLight.shadow.mapSize.width = 1024;
  mainDirLight.shadow.mapSize.height = 1024;
  mainDirLight.shadow.camera.near = 0.5;
  mainDirLight.shadow.camera.far = 45;
  mainDirLight.shadow.camera.left = -20;
  mainDirLight.shadow.camera.right = 20;
  mainDirLight.shadow.camera.top = 20;
  mainDirLight.shadow.camera.bottom = -20;
  root.add(mainDirLight);

  // Amber Neon Sign Light
  const amberNeon = new THREE.PointLight(0xf59e0b, 2.6, 35);
  amberNeon.position.set(0, 6, -14);
  root.add(amberNeon);
  neonLights.push(amberNeon);

  // Cyan Neon Side Light
  const cyanNeon = new THREE.PointLight(0x06b6d4, 2.2, 30);
  cyanNeon.position.set(-10, 5, -8);
  root.add(cyanNeon);
  neonLights.push(cyanNeon);

  // Red/Gold Defense Alert Light
  const alertLight = new THREE.PointLight(0xef4444, 1.4, 20);
  alertLight.position.set(0, 3, -2);
  root.add(alertLight);
  neonLights.push(alertLight);

  scene.add(root);

  const updateStageAnimation = (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => {
    // Pulse neon lights
    if (isFeverActive) {
      amberNeon.color.setHex(0xffd700);
      amberNeon.intensity = 4.2 + Math.sin(elapsedSec * 12) * 1.8;
      cyanNeon.color.setHex(0xf59e0b);
      cyanNeon.intensity = 3.6;
    } else {
      amberNeon.color.setHex(0xf59e0b);
      amberNeon.intensity = 2.4 + Math.sin(elapsedSec * 2) * 0.5;
      cyanNeon.color.setHex(0x06b6d4);
      cyanNeon.intensity = 2.0 + Math.cos(elapsedSec * 2.5) * 0.4;
    }

    if (dangerAlert) {
      alertLight.intensity = 3.6 + Math.sin(elapsedSec * 16) * 2.4;
      neonRimMat.color.setHex(0xef4444);
      neonRimMat.opacity = Math.min(1.0, 0.85 + Math.sin(elapsedSec * 16) * 0.25);
    } else {
      alertLight.intensity = 0.6;
      neonRimMat.color.setHex(isFeverActive ? 0xffd700 : 0xf59e0b);
      neonRimMat.opacity = 0.80;
    }

    // Emerald heal pulse expansion & fadeout over 0.5s
    const nowSec = performance.now() / 1000;
    if (nowSec < healPulseUntilSec) {
      const progress = 1.0 - (healPulseUntilSec - nowSec) / 0.5; // 0.0 -> 1.0
      const scale = 1.0 + progress * 0.22; // 1.0 -> 1.22
      healPulseMesh.scale.set(scale, scale, 1);
      healPulseMat.opacity = Math.max(0, 0.95 * (1.0 - progress));
      healPulseMesh.visible = true;
    } else {
      healPulseMesh.visible = false;
      healPulseMesh.scale.set(1, 1, 1);
    }
  };

  return {
    root,
    neonLights,
    defenseArcMesh,
    healPulseMesh,
    triggerHealPulse,
    updateStageAnimation,
  };
}
