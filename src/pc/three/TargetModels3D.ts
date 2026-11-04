import * as THREE from 'three';
import { ItemBuffKind, TargetKind } from '../../shared/types';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../../shared/constants';
import { createRealisticPlungerMesh } from './DraftTapGun3D';

const labelTextureCache = new Map<string, THREE.Texture>();
let officialCassTexture: THREE.Texture | null = null;

const targetGeometryCache = new Map<string, THREE.BufferGeometry>();
const targetMaterialCache = new Map<string, THREE.Material>();

export function getCachedGeometry<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
  let geo = targetGeometryCache.get(key) as T;
  if (!geo) {
    geo = factory();
    geo.userData.isShared = true;
    targetGeometryCache.set(key, geo);
  }
  return geo;
}

export function getCachedMaterial<T extends THREE.Material>(key: string, factory: () => T): T {
  let mat = targetMaterialCache.get(key) as T;
  if (!mat) {
    mat = factory();
    mat.userData.isShared = true;
    targetMaterialCache.set(key, mat);
  }
  return mat;
}

export function getSharedTargetResourceStats(): {
  cachedGeometries: number;
  cachedMaterials: number;
  cachedTextures: number;
} {
  return {
    cachedGeometries: targetGeometryCache.size,
    cachedMaterials: targetMaterialCache.size,
    cachedTextures: labelTextureCache.size + itemBillboardCache.size + (officialCassTexture ? 1 : 0),
  };
}

export function getOrCreateOfficialCassTexture(): THREE.Texture {
  if (officialCassTexture) {
    return officialCassTexture;
  }

  if (typeof document === 'undefined') {
    const fallback = createDataTextureFallback('#004b91');
    officialCassTexture = fallback;
    return fallback;
  }

  try {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      '/textures/cass_official_cutout.png',
      (tex) => {
        tex.needsUpdate = true;
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    officialCassTexture = texture;
    return texture;
  } catch {
    const fallback = createDataTextureFallback('#004b91');
    officialCassTexture = fallback;
    return fallback;
  }
}

function createDataTextureFallback(colorHex: string): THREE.DataTexture {
  const c = new THREE.Color(colorHex);
  const data = new Uint8Array([
    Math.floor(c.r * 255),
    Math.floor(c.g * 255),
    Math.floor(c.b * 255),
    255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

export function getOrCreateTargetLabelTexture(kind: TargetKind | 'bottle-neck'): THREE.Texture {
  if (labelTextureCache.has(kind)) {
    return labelTextureCache.get(kind)!;
  }

  const spec = kind === 'bottle-neck'
    ? { brandColorHex: '#002855', accentColorHex: '#f59e0b', displayName: 'COLD BREWED' }
    : (TARGET_SPECS[kind as TargetKind] || {
        brandColorHex: '#f59e0b',
        accentColorHex: '#ffffff',
        displayName: kind,
      });

  if (typeof document === 'undefined') {
    const fallback = createDataTextureFallback(spec.brandColorHex);
    labelTextureCache.set(kind, fallback);
    return fallback;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = createDataTextureFallback(spec.brandColorHex);
      labelTextureCache.set(kind, fallback);
      return fallback;
    }

    // High quality canvas fallback procedural label
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, spec.brandColorHex);
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, spec.brandColorHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = spec.accentColorHex;
    ctx.fillRect(0, 0, 1024, 48);
    ctx.fillRect(0, 464, 1024, 48);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(512, 256, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = spec.accentColorHex === '#ffffff' ? '#111827' : '#ffffff';
    ctx.font = 'bold 88px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.displayName.split(' ')[0], 512, 230);

    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(spec.displayName, 512, 330);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.offset.x = 0.5;

    // Asynchronously overlay real static texture in browser environment
    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          texture.image = img;
          texture.needsUpdate = true;
        };
        img.src = `/textures/labels/${kind}.jpg`;
      } catch {
        // Keep canvas texture on error
      }
    }

    labelTextureCache.set(kind, texture);
    return texture;
  } catch {
    const fallback = createDataTextureFallback(spec.brandColorHex);
    labelTextureCache.set(kind, fallback);
    return fallback;
  }
}

const itemBillboardCache = new Map<ItemBuffKind, THREE.Texture>();

export function getOrCreateItemBillboardTexture(itemKind: ItemBuffKind): THREE.Texture {
  if (itemBillboardCache.has(itemKind)) {
    return itemBillboardCache.get(itemKind)!;
  }

  const spec = ITEM_BUFF_SPECS[itemKind];
  const colorHex = spec ? spec.auraColorHex : '#f59e0b';
  const labelText = spec ? `${spec.icon} ${spec.shortLabel}` : itemKind;

  if (typeof document === 'undefined') {
    const fallback = createDataTextureFallback(colorHex);
    itemBillboardCache.set(itemKind, fallback);
    return fallback;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = createDataTextureFallback(colorHex);
      itemBillboardCache.set(itemKind, fallback);
      return fallback;
    }

    // Dark rounded card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8, 8, 496, 112, 24);
    } else {
      ctx.rect(8, 8, 496, 112);
    }
    ctx.fill();

    // Glowing neon border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 8;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // High contrast bold typography
    ctx.font = '900 48px "Pretendard", "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    itemBillboardCache.set(itemKind, texture);
    return texture;
  } catch {
    const fallback = createDataTextureFallback(colorHex);
    itemBillboardCache.set(itemKind, fallback);
    return fallback;
  }
}

export function getTargetBaseY(kind: TargetKind, isItem?: boolean): number {
  if (isItem) {
    return 1.15; // Mid-air floating altitude for shootable item drops
  }
  if (kind === 'pilgood' || kind === 'caslight') {
    return 1.45; // Airborne gliding flight altitude
  }
  if (kind === 'boss') {
    return 1.15; // Ground-standing heavy commercial cabinet center
  }
  return 0.55; // Ground contact rolling altitude (bottle, obi, hanmac)
}

function createFloorShadowMesh(radius: number): THREE.Mesh {
  const rounded = radius.toFixed(2);
  const shadowGeo = getCachedGeometry(`shadow-geo-${rounded}`, () => {
    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const shadowMat = getCachedMaterial('shadow-mat', () => {
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.name = 'DropShadow';
  return shadowMesh;
}

export function createTargetMesh3D(kind: TargetKind): THREE.Group {
  const spec = TARGET_SPECS[kind];
  const root = new THREE.Group();
  root.name = `Target_${kind}`;

  const inner = new THREE.Group();
  inner.name = 'InnerModel';
  root.add(inner);

  const baseScale = spec.modelScale ?? 1.85;
  inner.scale.setScalar(baseScale);

  // Floor-locked circular drop shadow (snapped directly to world ground y=0.01)
  const baseY = getTargetBaseY(kind);
  const shadowMesh = createFloorShadowMesh(spec.hitRadiusM * 0.72);
  shadowMesh.position.y = -baseY + 0.01;
  root.add(shadowMesh);

  const capMat = getCachedMaterial('target-cap-mat', () => {
    return new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.88,
      roughness: 0.18,
    });
  });

  const goldMat = getCachedMaterial('target-gold-mat', () => {
    return new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.92,
      roughness: 0.15,
    });
  });

  let wings: [THREE.Mesh, THREE.Mesh] | null = null;
  let bossTapHandles: THREE.Mesh[] | null = null;

  if (kind === 'bottle') {
    // 🍾 Official All New Cass 500ml Authentic Transparent Cutout Billboard
    const cassTexture = getOrCreateOfficialCassTexture();
    const billboardGeo = getCachedGeometry('cass-billboard-geo', () => new THREE.PlaneGeometry(0.277, 1.02));
    const billboardMat = new THREE.MeshBasicMaterial({
      map: cassTexture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    const billboardMesh = new THREE.Mesh(billboardGeo, billboardMat);
    billboardMesh.name = 'cassBillboard';
    billboardMesh.userData.isBodyMaterial = true;
    billboardMesh.position.y = 0.05;
    inner.add(billboardMesh);

    // Silver metallic crown cap marker/anchor for 3D explosion particles
    const capMatShared = getCachedMaterial('crown-cap-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.18,
        transparent: true,
        opacity: 0.0,
      });
    });
    const capGeo = getCachedGeometry('crown-cap-geo', () => new THREE.CylinderGeometry(0.065, 0.065, 0.02, 12));
    const crownCap = new THREE.Mesh(capGeo, capMatShared);
    crownCap.name = 'crownCap';
    crownCap.position.y = 0.55;
    inner.add(crownCap);

    // Neck anchor for status effects & test compatibility
    const neckMat = getCachedMaterial('neck-label-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0x002855,
        transparent: true,
        opacity: 0.0,
      });
    });
    const neckGeo = getCachedGeometry('neck-label-geo', () => new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12));
    const neckLabelMesh = new THREE.Mesh(neckGeo, neckMat);
    neckLabelMesh.name = 'neckLabel';
    neckLabelMesh.position.y = 0.38;
    inner.add(neckLabelMesh);
  } else if (kind === 'boss') {
    // 🧊 Boss: Commercial Stainless Beer Dispenser Cooler
    const r = 0.85;
    const h = 1.75;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.82,
      roughness: 0.28,
    });
    const panelTexture = getOrCreateTargetLabelTexture('boss');
    const panelMat = new THREE.MeshStandardMaterial({
      map: panelTexture,
      metalness: 0.45,
      roughness: 0.3,
    });

    const cabinetGeo = getCachedGeometry('boss-cabinet-geo', () => new THREE.BoxGeometry(r * 1.8, h * 0.82, r * 1.4));
    const cabinet = new THREE.Mesh(
      cabinetGeo,
      [bodyMat, bodyMat, capMat, bodyMat, panelMat, bodyMat]
    );
    cabinet.userData.isBodyMaterial = true;
    inner.add(cabinet);

    // Louver grille on front bottom
    const grilleGeo = getCachedGeometry('boss-grille-geo', () => new THREE.BoxGeometry(r * 1.5, h * 0.22, 0.06));
    const grilleMat = getCachedMaterial('boss-grille-mat', () => new THREE.MeshStandardMaterial({ color: 0x050810, roughness: 0.95 }));
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, -h * 0.24, r * 0.71);
    inner.add(grille);

    // Top Chrome Draft Tower
    const towerGeo = getCachedGeometry('boss-tower-geo', () => new THREE.CylinderGeometry(0.18, 0.22, 0.55, 18));
    const tower = new THREE.Mesh(towerGeo, capMat);
    tower.position.set(0, h * 0.41 + 0.26, 0);
    inner.add(tower);

    // Dual Gold Beer Tap Spouts & Handles
    const handles: THREE.Mesh[] = [];
    bossTapHandles = handles;
    const spoutGeo = getCachedGeometry('boss-spout-geo', () => {
      const g = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 12);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const handleGeo = getCachedGeometry('boss-handle-geo', () => new THREE.CylinderGeometry(0.026, 0.018, 0.28, 12));
    const handleMat = getCachedMaterial('boss-handle-mat', () => new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 }));

    [-0.14, 0.14].forEach((tapX) => {
      const tapSpout = new THREE.Mesh(spoutGeo, goldMat);
      tapSpout.position.set(tapX, h * 0.41 + 0.38, 0.17);
      inner.add(tapSpout);

      const tapHandle = new THREE.Mesh(handleGeo, handleMat);
      tapHandle.position.set(tapX, h * 0.41 + 0.53, 0.23);
      tapHandle.rotation.x = -0.22;
      inner.add(tapHandle);
      handles.push(tapHandle);
    });

    // 4 Caster Wheels
    const wheelMat = getCachedMaterial('boss-wheel-mat', () => new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85 }));
    const wheelGeo = getCachedGeometry('boss-wheel-geo', () => {
      const g = new THREE.CylinderGeometry(0.08, 0.08, 0.09, 14);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    [
      [-r * 0.75, -r * 0.55],
      [r * 0.75, -r * 0.55],
      [-r * 0.75, r * 0.55],
      [r * 0.75, r * 0.55],
    ].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, -h * 0.41 - 0.05, wz);
      inner.add(wheel);
    });
  } else {
    // 🥫 4 Realistic Aluminum Beer Cans (pilgood, caslight, obi, hanmac)
    const r = 0.26;
    const h = 0.74;

    const labelTex = getOrCreateTargetLabelTexture(kind);
    const sideMat = new THREE.MeshPhysicalMaterial({
      map: labelTex,
      metalness: 0.74,
      roughness: 0.2,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
    });

    // Can body
    const canGeo = getCachedGeometry('can-body-geo', () => new THREE.CylinderGeometry(r * 0.96, r, h, 28));
    const canBody = new THREE.Mesh(canGeo, [sideMat, capMat, capMat]);
    canBody.userData.isBodyMaterial = true;
    inner.add(canBody);

    // Tapered neck & rim
    const lidGeo = getCachedGeometry('can-lid-geo', () => new THREE.CylinderGeometry(r * 0.82, r * 0.96, h * 0.07, 28));
    const lid = new THREE.Mesh(lidGeo, capMat);
    lid.position.y = h / 2 + h * 0.035;
    inner.add(lid);

    // Aluminum pull tab
    const tabGeo = getCachedGeometry('can-tab-geo', () => new THREE.BoxGeometry(r * 0.45, h * 0.025, r * 0.3));
    const tab = new THREE.Mesh(tabGeo, capMat);
    tab.position.y = h / 2 + h * 0.075;
    inner.add(tab);

    // Condensation water droplets (8 tiny glassy beads)
    const dropletGeo = getCachedGeometry('can-droplet-geo', () => new THREE.SphereGeometry(0.012, 6, 6));
    const dropletMat = getCachedMaterial('can-droplet-mat', () => {
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        roughness: 0.04,
        ior: 1.33,
      });
    });
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(dropletGeo, dropletMat);
      const angle = (i * Math.PI) / 4 + 0.2;
      const dropY = -h * 0.3 + (i % 4) * 0.2;
      drop.position.set(Math.cos(angle) * (r + 0.006), dropY, Math.sin(angle) * (r + 0.006));
      inner.add(drop);
    }

    // Foam crown on top for pilgood & hanmac
    if (kind === 'pilgood' || kind === 'hanmac') {
      const foamGeo = getCachedGeometry('top-foam-geo', () => new THREE.SphereGeometry(r * 0.65, 12, 8));
      const foamMat = getCachedMaterial('top-foam-mat', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
      const topFoam = new THREE.Mesh(foamGeo, foamMat);
      topFoam.scale.set(1, 0.45, 1);
      topFoam.position.y = h / 2 + 0.08;
      inner.add(topFoam);
    }

    // Airborne jet plume for pilgood & caslight
    if (kind === 'pilgood' || kind === 'caslight') {
      const jetGeo = getCachedGeometry('jet-plume-geo', () => new THREE.CylinderGeometry(r * 0.3, r * 0.7, 0.22, 12));
      const jetMat = getCachedMaterial('jet-plume-mat', () => {
        return new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.7,
        });
      });
      const jetPlume = new THREE.Mesh(jetGeo, jetMat);
      jetPlume.position.y = -h / 2 - 0.11;
      inner.add(jetPlume);
    }

    // Wings for caslight
    if (kind === 'caslight') {
      const wingMat = getCachedMaterial('caslight-wing-mat', () => {
        return new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
      });
      const gl = getCachedGeometry('caslight-wing-l-geo', () => {
        const g = new THREE.PlaneGeometry(0.52, 0.3);
        g.translate(-0.26, 0, 0);
        return g;
      });
      const gr = getCachedGeometry('caslight-wing-r-geo', () => {
        const g = new THREE.PlaneGeometry(0.52, 0.3);
        g.translate(0.26, 0, 0);
        return g;
      });

      const wl = new THREE.Mesh(gl, wingMat);
      const wr = new THREE.Mesh(gr, wingMat);
      wl.position.set(-r, h * 0.12, 0);
      wr.position.set(r, h * 0.12, 0);
      root.add(wl);
      root.add(wr);
      wings = [wl, wr];
    }
  }

  // Holographic Lock-on Targeting Marker on top (+0.9m)
  const lockOnGeo = getCachedGeometry('lockon-geo', () => {
    const g = new THREE.TorusGeometry(0.35, 0.02, 8, 24);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const lockOnMat = getCachedMaterial('lockon-mat', () => {
    return new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
  });
  const lockOnMarker = new THREE.Mesh(lockOnGeo, lockOnMat);
  lockOnMarker.position.set(0, 0.9, 0);
  lockOnMarker.visible = false;
  root.add(lockOnMarker);

  // Frost freeze ice ring at monster ground level
  const frostRingGeo = getCachedGeometry(`frost-ring-geo-${spec.hitRadiusM.toFixed(2)}`, () => {
    const g = new THREE.RingGeometry(spec.hitRadiusM * 0.75, spec.hitRadiusM * 1.15, 24);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const frostRingMat = getCachedMaterial('frost-ring-mat', () => {
    return new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  });
  const frostRing = new THREE.Mesh(frostRingGeo, frostRingMat);
  frostRing.position.set(0, 0.025, 0);
  frostRing.visible = false;
  root.add(frostRing);

  // Collect monster body materials for frost tinting (only unshared instance materials to prevent cross-monster color bleed)
  const bodyMaterials: { mat: THREE.MeshStandardMaterial; origColor: THREE.Color }[] = [];
  inner.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (
          !mat.userData?.isShared &&
          'color' in mat &&
          (mat as THREE.MeshStandardMaterial).color instanceof THREE.Color
        ) {
          bodyMaterials.push({
            mat: mat as THREE.MeshStandardMaterial,
            origColor: (mat as THREE.MeshStandardMaterial).color.clone(),
          });
        }
      });
    }
  });

  // Plunger Stuck Status Group (Visible during Stun)
  const plungerStuckGroup = new THREE.Group();
  plungerStuckGroup.name = 'plungerStuckGroup';
  plungerStuckGroup.visible = false;

  const p1 = createRealisticPlungerMesh(0.38);
  p1.position.set(-0.14, 0.12, 0.32);
  p1.rotation.y = -Math.PI / 2;
  plungerStuckGroup.add(p1);

  const p2 = createRealisticPlungerMesh(0.34);
  p2.position.set(0.16, -0.05, 0.30);
  p2.rotation.y = -Math.PI / 2;
  p2.rotation.z = 0.35;
  plungerStuckGroup.add(p2);

  inner.add(plungerStuckGroup);

  root.userData = {
    kind,
    hitRadiusM: spec.hitRadiusM,
    inner,
    wings,
    bossTapHandles: bossTapHandles || undefined,
    shadowMesh,
    lockOnMarker,
    frostRing,
    plungerStuckGroup,
    bodyMaterials,
    baseScale,
    hitFlashUntilSec: 0,
  };

  return root;
}

export function createItemMesh3D(itemKind: ItemBuffKind): THREE.Group {
  const spec = ITEM_BUFF_SPECS[itemKind];
  const root = new THREE.Group();
  root.name = `Item_${itemKind}`;

  const inner = new THREE.Group();
  inner.name = 'InnerModel';
  root.add(inner);

  const baseScale = 1.35;
  inner.scale.setScalar(baseScale);

  // Floor-locked circular drop shadow (snapped directly to world ground y=0.01)
  const itemBaseY = getTargetBaseY('bottle' as any, true);
  const shadowMesh = createFloorShadowMesh(0.55);
  shadowMesh.position.y = -itemBaseY + 0.01;
  root.add(shadowMesh);

  // Rotating glowing aura torus ring
  const auraGeo = getCachedGeometry('item-aura-geo', () => new THREE.TorusGeometry(0.58, 0.035, 12, 32));
  const auraMat = getCachedMaterial(`item-aura-mat-${spec.auraColorHex}`, () => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.auraColorHex),
      transparent: true,
      opacity: 0.88,
    });
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.name = 'AuraRing';
  root.add(auraRing);

  if (itemKind === 'power_shot') {
    // 💥 Golden Bottle Opener (Handle + Ring Head)
    const goldMat = getCachedMaterial('item-gold-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.92,
        roughness: 0.15,
      });
    });
    const handleGeo = getCachedGeometry('opener-handle-geo', () => new THREE.BoxGeometry(0.12, 0.48, 0.04));
    const handle = new THREE.Mesh(handleGeo, goldMat);
    handle.position.y = -0.12;
    inner.add(handle);

    const ringGeo = getCachedGeometry('opener-ring-geo', () => new THREE.TorusGeometry(0.16, 0.04, 10, 20));
    const openerRing = new THREE.Mesh(ringGeo, goldMat);
    openerRing.position.y = 0.22;
    inner.add(openerRing);
  } else if (itemKind === 'wide_scope') {
    // 🎯 OB Beer Coaster Target Disc
    const coasterGeo = getCachedGeometry('coaster-geo', () => new THREE.CylinderGeometry(0.38, 0.38, 0.035, 32));
    const coasterMat = getCachedMaterial('coaster-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        metalness: 0.3,
        roughness: 0.4,
      });
    });
    const coaster = new THREE.Mesh(coasterGeo, coasterMat);
    coaster.rotation.x = Math.PI / 4;
    inner.add(coaster);

    const ringMat = getCachedMaterial('coaster-ring-mat', () => new THREE.MeshBasicMaterial({ color: 0xfde047 }));
    const ringGeo = getCachedGeometry('coaster-ring-geo', () => new THREE.TorusGeometry(0.24, 0.02, 8, 24));
    const innerRing = new THREE.Mesh(ringGeo, ringMat);
    innerRing.rotation.x = Math.PI / 4;
    inner.add(innerRing);

    const bullseyeGeo = getCachedGeometry('bullseye-geo', () => new THREE.SphereGeometry(0.06, 12, 12));
    const bullseye = new THREE.Mesh(bullseyeGeo, ringMat);
    bullseye.position.set(0, 0, 0.02);
    inner.add(bullseye);
  } else if (itemKind === 'ice_freeze') {
    // 🧊 Silver Ice Bucket with Ice Cubes
    const bucketMat = getCachedMaterial('bucket-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.88,
        roughness: 0.18,
      });
    });
    const bucketGeo = getCachedGeometry('bucket-geo', () => new THREE.CylinderGeometry(0.26, 0.2, 0.34, 18));
    const bucket = new THREE.Mesh(bucketGeo, bucketMat);
    inner.add(bucket);

    const iceMat = getCachedMaterial('ice-mat', () => {
      return new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.75,
        roughness: 0.05,
        ior: 1.31,
      });
    });
    const cubeGeo = getCachedGeometry('ice-cube-geo', () => new THREE.BoxGeometry(0.11, 0.11, 0.11));
    [
      [-0.08, 0.14, -0.06],
      [0.08, 0.15, 0.05],
      [0, 0.18, 0],
    ].forEach(([ix, iy, iz]) => {
      const iceCube = new THREE.Mesh(cubeGeo, iceMat);
      iceCube.position.set(ix, iy, iz);
      iceCube.rotation.set(0.3, 0.4, 0.2);
      inner.add(iceCube);
    });
  } else if (itemKind === 'bar_repair') {
    // 🍺 Fresh Green Hop Cones Cluster + Golden Ribbon
    const hopMat = getCachedMaterial('hop-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.65,
      });
    });
    const coneGeo = getCachedGeometry('hop-cone-geo', () => new THREE.ConeGeometry(0.12, 0.26, 8));
    [
      [-0.1, 0, -0.05],
      [0.1, 0, -0.05],
      [0, 0.12, 0.05],
    ].forEach(([hx, hy, hz]) => {
      const cone = new THREE.Mesh(coneGeo, hopMat);
      cone.position.set(hx, hy, hz);
      cone.rotation.x = Math.PI;
      inner.add(cone);
    });

    const ribbonMat = getCachedMaterial('hop-ribbon-mat', () => {
      return new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.8,
        roughness: 0.2,
      });
    });
    const ribbonGeo = getCachedGeometry('hop-ribbon-geo', () => new THREE.TorusGeometry(0.16, 0.02, 8, 16));
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.y = -0.08;
    ribbon.rotation.x = Math.PI / 2;
    inner.add(ribbon);
  }

  // Persistent 3D Neon Billboard Label Card
  const billboardTex = getOrCreateItemBillboardTexture(itemKind);
  const billboardMat = new THREE.SpriteMaterial({
    map: billboardTex,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  const billboard = new THREE.Sprite(billboardMat);
  billboard.name = 'itemBillboard';
  billboard.scale.set(1.5, 0.38, 1.0);
  billboard.position.set(0, 0.60, 0);
  root.add(billboard);

  root.userData = {
    isItem: true,
    itemKind,
    inner,
    shadowMesh,
    auraRing,
    billboard,
    baseScale,
  };

  return root;
}

export interface TargetAnimationOptions {
  isIceFreeze?: boolean;
  isWideScope?: boolean;
  isStunned?: boolean;
  isSlowed?: boolean;
  stuckPlungerCount?: number;
  isBossSummoning?: boolean;
}

const FROST_TINT_COLOR = new THREE.Color(0x93c5fd);

export function updateTargetAnimation3D(
  root: THREE.Group,
  kind: TargetKind,
  elapsedSec: number,
  hpRatio: number,
  options?: TargetAnimationOptions
): void {
  const inner = root.userData.inner as THREE.Group | undefined;
  if (!inner) return;

  const shadowMesh = root.userData.shadowMesh as THREE.Mesh | undefined;
  if (shadowMesh) {
    shadowMesh.position.y = -root.position.y + 0.02;
  }

  const isIceFreeze = Boolean(options?.isIceFreeze || options?.isSlowed);
  const isWideScope = Boolean(options?.isWideScope);
  const isStunned = Boolean(options?.isStunned);

  // Stunned Plunger Status
  const plungerStuckGroup = root.userData.plungerStuckGroup as THREE.Group | undefined;
  if (plungerStuckGroup) {
    plungerStuckGroup.visible = isStunned;
    if (isStunned) {
      // Wiggling vibration animation
      plungerStuckGroup.rotation.z = Math.sin(elapsedSec * 45) * 0.12;
    }
  }

  // 1. Ice freeze ground ring
  const frostRing = root.userData.frostRing as THREE.Mesh | undefined;
  if (frostRing) {
    frostRing.visible = isIceFreeze;
    if (shadowMesh) {
      frostRing.position.y = shadowMesh.position.y + 0.005;
    }
    if (isIceFreeze) {
      frostRing.rotation.z = elapsedSec * 2.0;
    }
  }

  // 2. Wide scope lock-on holographic marker (exclude boss if desired or show above all)
  const lockOnMarker = root.userData.lockOnMarker as THREE.Mesh | undefined;
  if (lockOnMarker) {
    lockOnMarker.visible = isWideScope;
    if (isWideScope) {
      lockOnMarker.rotation.z = elapsedSec * 3.0;
      const pulse = 1.0 + Math.sin(elapsedSec * 6.0) * 0.08;
      lockOnMarker.scale.set(pulse, pulse, pulse);
    }
  }

  // 3. Body frost tint (lerp smoothly to ice blue and restore cleanly)
  const bodyMaterials = root.userData.bodyMaterials as
    | { mat: THREE.MeshStandardMaterial; origColor: THREE.Color }[]
    | undefined;
  if (bodyMaterials) {
    bodyMaterials.forEach(({ mat, origColor }) => {
      if (isIceFreeze) {
        mat.color.copy(origColor).lerp(FROST_TINT_COLOR, 0.65);
      } else {
        mat.color.copy(origColor);
      }
    });
  }

  const isGround = kind === 'bottle' || kind === 'obi' || kind === 'hanmac' || kind === 'boss';

  if (isGround) {
    // Ground monsters contact bounce & limited rotation so label stays visible
    if (kind === 'boss') {
      const isSummoning = Boolean(options?.isBossSummoning);
      const bossTapHandles = root.userData.bossTapHandles as THREE.Mesh[] | undefined;
      if (bossTapHandles && Array.isArray(bossTapHandles)) {
        bossTapHandles.forEach((handle) => {
          handle.rotation.x = isSummoning ? 0.65 : -0.22;
        });
      }

      if (isSummoning) {
        inner.position.x = Math.sin(elapsedSec * 38) * 0.08;
        const base = (root.userData.baseScale as number) || 1.85;
        inner.scale.set(base * 1.06, base * 1.06, base * 1.06);
      } else {
        inner.position.x = 0;
        if (!root.userData.hitFlashUntilSec) {
          const base = (root.userData.baseScale as number) || 1.85;
          inner.scale.set(base, base, base);
        }
      }

      const bounce = Math.abs(Math.sin(elapsedSec * 3.0)) * 0.04;
      inner.position.y = bounce;
      inner.rotation.y = Math.sin(elapsedSec * 1.5) * 0.12;
    } else if (kind === 'bottle') {
      // Authentic PNG billboard bottle: 2.45x scale heavy bouncy tanker with lively side-to-side roll
      const bounce = Math.abs(Math.sin(elapsedSec * 6.0 + (root.id ? root.id * 0.2 : 0))) * 0.28;
      inner.position.y = bounce;
      inner.rotation.y = Math.sin(elapsedSec * 2.0) * 0.05; // Subtle swivel
      inner.rotation.z = Math.sin(elapsedSec * 3.0) * 0.12; // Playful side-to-side rolling tilt
    } else {
      const bounce = Math.abs(Math.sin(elapsedSec * 5.0 + (root.id ? root.id * 0.2 : 0))) * 0.14;
      inner.position.y = bounce;
      inner.rotation.y = Math.sin(elapsedSec * 2.8) * 0.2;
    }
  } else {
    // Airborne monsters smooth floating flight & tilt
    inner.position.y = Math.sin(elapsedSec * 4.0 + (root.id ? root.id * 0.3 : 0)) * 0.18;
    inner.rotation.z = Math.sin(elapsedSec * 3.2 + (root.id ? root.id * 0.3 : 0)) * 0.14;
  }

  // Flap wings for caslight
  const wings = root.userData.wings as [THREE.Mesh, THREE.Mesh] | null;
  if (wings) {
    const flap = Math.sin(elapsedSec * 14) * 0.35;
    wings[0].rotation.y = flap;
    wings[1].rotation.y = -flap;
  }

  // Flash decay (restore to baseScale)
  if (root.userData.hitFlashUntilSec && elapsedSec > root.userData.hitFlashUntilSec) {
    root.userData.hitFlashUntilSec = 0;
    const base = (root.userData.baseScale as number) || 1.85;
    inner.scale.set(base, base, base);
  }
}

export function updateItemAnimation3D(
  root: THREE.Group,
  itemKind: ItemBuffKind,
  elapsedSec: number
): void {
  const inner = root.userData.inner as THREE.Group | undefined;
  const shadowMesh = root.userData.shadowMesh as THREE.Mesh | undefined;
  const auraRing = root.userData.auraRing as THREE.Mesh | undefined;

  if (shadowMesh) {
    shadowMesh.position.y = -root.position.y + 0.02;
  }

  if (inner) {
    // 360 rotation & floating hover
    inner.rotation.y = elapsedSec * 2.2;
    inner.position.y = Math.sin(elapsedSec * 4.0) * 0.08;
  }

  if (auraRing) {
    auraRing.rotation.x = elapsedSec * 1.8;
    auraRing.rotation.y = elapsedSec * 2.5;
    const pulse = 1.0 + Math.sin(elapsedSec * 6.0) * 0.08;
    auraRing.scale.set(pulse, pulse, pulse);
  }
}

export function applyTargetHitFlash3D(root: THREE.Group, nowSec: number): void {
  const inner = root.userData.inner as THREE.Group | undefined;
  if (inner) {
    const base = (root.userData.baseScale as number) || 1.85;
    inner.scale.set(base * 1.18, base * 0.88, base * 1.18); // Squish impact
    root.userData.hitFlashUntilSec = nowSec + 0.15;
  }
}

/**
 * 🌟 Procedural 3D Golden Can Bonus Mesh
 */
export function createGoldenCanMesh3D(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'GoldenCan_Bonus';

  const inner = new THREE.Group();
  root.add(inner);

  const goldMat = getCachedMaterial('goldencan-gold-mat', () => {
    return new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      metalness: 0.95,
      roughness: 0.15,
    });
  });

  const canGeo = getCachedGeometry('goldencan-can-geo', () => new THREE.CylinderGeometry(0.38, 0.38, 1.15, 20));
  const can = new THREE.Mesh(canGeo, goldMat);
  inner.add(can);

  const auraGeo = getCachedGeometry('goldencan-aura-geo', () => {
    const g = new THREE.TorusGeometry(0.55, 0.035, 12, 28);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const auraMat = getCachedMaterial('goldencan-aura-mat', () => new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  inner.add(auraRing);

  const shadowMesh = createFloorShadowMesh(0.65);
  shadowMesh.position.y = -1.15 + 0.01;
  root.add(shadowMesh);

  root.userData = {
    isGoldenCan: true,
    inner,
    auraRing,
    shadowMesh,
    baseScale: 1.85,
    hitRadiusM: 1.15,
  };

  return root;
}

/**
 * 🫧 Procedural 3D Monster Projectile Mesh
 */
export function createProjectileMesh3D(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Monster_Projectile';

  const inner = new THREE.Group();
  root.add(inner);

  const orbMat = getCachedMaterial('projectile-orb-mat', () => {
    return new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
  });
  const orbGeo = getCachedGeometry('projectile-orb-geo', () => new THREE.SphereGeometry(0.28, 16, 16));
  const orb = new THREE.Mesh(orbGeo, orbMat);
  inner.add(orb);

  const rimGeo = getCachedGeometry('projectile-rim-geo', () => {
    const g = new THREE.TorusGeometry(0.32, 0.04, 10, 20);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const rimMat = getCachedMaterial('projectile-rim-mat', () => new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  const rim = new THREE.Mesh(rimGeo, rimMat);
  inner.add(rim);

  root.userData = {
    isProjectile: true,
    inner,
    baseScale: 1.0,
    hitRadiusM: 0.95,
  };

  return root;
}

/**
 * 🃏 Procedural 3D Holographic Shoot-to-Select Card Target Mesh
 */
export function createCardTargetMesh3D(
  title: string,
  subtitle: string,
  colorHex: string,
  icon = '🃏'
): THREE.Group {
  const root = new THREE.Group();
  root.name = `Card_${title}`;

  const inner = new THREE.Group();
  root.add(inner);

  // 1. Holographic Dynamic Canvas Texture (safe in Node.js headless environment)
  let canvasTexture: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Card background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 680);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#1e293b');
      bgGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(16, 16, 480, 648, 28);
      ctx.fill();

      // Neon Border
      ctx.lineWidth = 10;
      ctx.strokeStyle = colorHex;
      ctx.shadowColor = colorHex;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Header Glow Icon
      ctx.font = '96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icon, 256, 140);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText(title, 256, 225);

      // Divider Line
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(50, 255);
      ctx.lineTo(462, 255);
      ctx.stroke();

      // Subtitle / Description
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 28px sans-serif';
      const subLines = subtitle.split('\n');
      subLines.forEach((line, idx) => {
        ctx.fillText(line, 256, 315 + idx * 42);
      });

      // Shoot to Select Button Badge
      const btnGrad = ctx.createLinearGradient(0, 500, 0, 600);
      btnGrad.addColorStop(0, colorHex);
      btnGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(48, 500, 416, 96, 24);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('🎯 SHOOT TO SELECT', 256, 560);
    }

    canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
  }

  const cardMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.85,
    metalness: 0.8,
    roughness: 0.2,
  });
  const cardFrame = new THREE.Mesh(new THREE.BoxGeometry(1.80, 2.40, 0.08), cardMat);
  inner.add(cardFrame);

  // Outer Neon Frame for High Visibility in Dark HDRI
  const borderMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
  const borderThickness = 0.04;
  const borderDepth = 0.09;
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.82, borderThickness, borderDepth), borderMat);
  topBar.position.set(0, 1.20, 0);
  const btmBar = new THREE.Mesh(new THREE.BoxGeometry(1.82, borderThickness, borderDepth), borderMat);
  btmBar.position.set(0, -1.20, 0);
  const leftBar = new THREE.Mesh(new THREE.BoxGeometry(borderThickness, 2.40, borderDepth), borderMat);
  leftBar.position.set(-0.90, 0, 0);
  const rightBar = new THREE.Mesh(new THREE.BoxGeometry(borderThickness, 2.40, borderDepth), borderMat);
  rightBar.position.set(0.90, 0, 0);

  const borderGroup = new THREE.Group();
  borderGroup.name = 'cardNeonBorder';
  borderGroup.add(topBar, btmBar, leftBar, rightBar);
  inner.add(borderGroup);

  // Card Front Face
  const frontPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.74, 2.34),
    new THREE.MeshBasicMaterial({
      map: canvasTexture,
      transparent: true,
      side: THREE.DoubleSide,
      color: canvasTexture ? 0xffffff : new THREE.Color(colorHex),
    })
  );
  frontPlane.position.z = 0.045;
  inner.add(frontPlane);

  root.userData = {
    isCard: true,
    hasNeonFrame: true,
    inner,
    baseScale: 1.0,
    hitRadiusM: 1.75,
  };

  return root;
}
