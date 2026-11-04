import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export interface BreweryStageRig {
  root: THREE.Group;
  neonStrips: THREE.Mesh[];
  defenseArcMesh: THREE.Mesh;
  healPulseMesh: THREE.Mesh;
  triggerHealPulse: () => void;
  updateStageAnimation: (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => void;
}

let cachedHdriTexture: THREE.DataTexture | null = null;
let hdriLoadCallbacks: Array<(tex: THREE.DataTexture) => void> | null = null;
let hdriFailureCallbacks: Array<() => void> = [];

export function applyCachedHdriToScene(scene: THREE.Scene, onReady?: () => void): void {
  let notified = false;
  const notify = () => {
    if (notified) return;
    notified = true;
    onReady?.();
  };
  const applyTexture = (texture: THREE.DataTexture) => {
    scene.environment = texture;
    scene.background = texture;
    scene.backgroundBlurriness = 0.08;
    scene.backgroundIntensity = 0.72;
  };

  if (cachedHdriTexture) {
    applyTexture(cachedHdriTexture);
    notify();
    return;
  }

  if (typeof window === 'undefined') return;

  if (hdriLoadCallbacks !== null) {
    hdriLoadCallbacks.push((texture) => {
      applyTexture(texture);
      notify();
    });
    hdriFailureCallbacks.push(notify);
    return;
  }

  hdriLoadCallbacks = [
    (texture) => {
      applyTexture(texture);
      notify();
    },
  ];
  hdriFailureCallbacks = [notify];

  const fail = () => {
    hdriLoadCallbacks = null;
    const cbs = hdriFailureCallbacks;
    hdriFailureCallbacks = [];
    cbs.forEach((cb) => cb());
  };

  try {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      '/hdri/pub_interior_2k.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        cachedHdriTexture = texture;
        const cbs = hdriLoadCallbacks || [];
        hdriLoadCallbacks = null;
        hdriFailureCallbacks = [];
        cbs.forEach((cb) => cb(texture));
      },
      undefined,
      (err) => {
        console.warn('Failed to load HDRI texture, using canvas fallback:', err);
        fail();
      }
    );
  } catch (err) {
    console.warn('RGBELoader failed to initialize:', err);
    fail();
  }
}

export function buildBreweryStage3D(scene: THREE.Scene, onEnvironmentReady?: () => void): BreweryStageRig {
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
  applyCachedHdriToScene(scene, onEnvironmentReady);

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

  // 3. Defense line: one 12cm neon line on the floor in FRONT of the player (-Z, where monsters come from).
  // RingGeometry(…, 0, PI) is the +y half; rotation.x = -PI/2 alone lays it toward -Z. Do not add rotation.z = PI.
  const neonRimGeo = new THREE.RingGeometry(1.86, 1.98, 64, 1, 0, Math.PI);
  const neonRimMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const neonRimMesh = new THREE.Mesh(neonRimGeo, neonRimMat);
  neonRimMesh.rotation.x = -Math.PI / 2;
  neonRimMesh.position.set(0, 0.022, 0);
  root.add(neonRimMesh);
  const defenseArcMesh = neonRimMesh;

  // Emerald heal pulse shockwave ring on bar defense line
  const healPulseGeo = new THREE.RingGeometry(1.84, 2.0, 48, 1, 0, Math.PI);
  const healPulseMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const healPulseMesh = new THREE.Mesh(healPulseGeo, healPulseMat);
  healPulseMesh.rotation.x = -Math.PI / 2;
  healPulseMesh.position.set(0, 0.02, 0);
  healPulseMesh.visible = false;
  root.add(healPulseMesh);

  let healPulseUntilSec = 0;
  const triggerHealPulse = () => {
    healPulseUntilSec = performance.now() / 1000 + 0.5;
    healPulseMesh.visible = true;
  };

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
  // Soft Dual-tone Hemisphere Light (Warm ceiling sky, dark pub floor)
  const hemiLight = new THREE.HemisphereLight(0xfff0d8, 0x1e293b, 0.85);
  root.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xfff0d8, 0.70);
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

  // Emissive neon meshes replace the decorative point lights (D16): no per-pixel light cost.
  const amberStripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const amberStrip = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 0.12), amberStripMat);
  amberStrip.position.set(0, 6, -14);
  root.add(amberStrip);

  const cyanTubeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  const cyanTubeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), cyanTubeMat);
  cyanTubeMesh.position.set(-10, 5, -8);
  root.add(cyanTubeMesh);

  const neonStrips: THREE.Mesh[] = [amberStrip, cyanTubeMesh];

  scene.add(root);

  const updateStageAnimation = (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => {
    // Neon strips + hemisphere light carry the fever/danger mood (no point lights).
    if (isFeverActive) {
      amberStripMat.color.setHex(0xffd700);
      cyanTubeMat.color.setHex(0xf59e0b);
      hemiLight.color.setHex(0xffe08a);
      hemiLight.intensity = 1.05 + Math.sin(elapsedSec * 4) * 0.1;
    } else {
      amberStripMat.color.setHex(0xf59e0b);
      cyanTubeMat.color.setHex(0x06b6d4);
      hemiLight.color.setHex(0xfff0d8);
      hemiLight.intensity = 0.85 + Math.sin(elapsedSec * 2) * 0.05;
    }
    hemiLight.groundColor.setHex(dangerAlert ? 0x7f1d1d : 0x1e293b);

    if (dangerAlert) {
      neonRimMat.color.setHex(0xef4444);
      neonRimMat.opacity = 0.85 + Math.sin(elapsedSec * 6) * 0.1;
    } else {
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
    neonStrips,
    defenseArcMesh,
    healPulseMesh,
    triggerHealPulse,
    updateStageAnimation,
  };
}
