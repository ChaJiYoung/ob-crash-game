import * as THREE from 'three';
import { ItemBuffKind, TargetKind } from '../../shared/types';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../../shared/constants';

const labelTextureCache = new Map<string, THREE.Texture>();

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

export function getOrCreateTargetLabelTexture(kind: TargetKind | 'mug' | 'boss'): THREE.Texture {
  if (labelTextureCache.has(kind)) {
    return labelTextureCache.get(kind)!;
  }

  const spec = TARGET_SPECS[kind as TargetKind] || {
    brandColorHex: '#f59e0b',
    accentColorHex: '#ffffff',
    displayName: kind,
  };

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
  return 0.55; // Ground contact rolling altitude (mug, obi, hanmac)
}

function createFloorShadowMesh(radius: number): THREE.Mesh {
  const shadowGeo = new THREE.CircleGeometry(radius, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
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

  // Floor-locked circular drop shadow
  const shadowMesh = createFloorShadowMesh(spec.hitRadiusM * 0.72);
  root.add(shadowMesh);

  const capMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.88,
    roughness: 0.18,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.92,
    roughness: 0.15,
  });

  let wings: [THREE.Mesh, THREE.Mesh] | null = null;

  if (kind === 'mug') {
    // 🍺 500ml Physical Glass Draft Mug
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      transmission: 0.78,
      ior: 1.5,
      roughness: 0.08,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.18,
      metalness: 0.12,
    });
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
    });

    const r = 0.32;
    const h = 0.82;

    // Outer 12-sided facet glass body
    const glassBody = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 12), glassMat);
    inner.add(glassBody);

    // Inner golden beer liquid
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.88, r * 0.8, h * 0.82, 12),
      liquidMat
    );
    liquid.position.y = -h * 0.04;
    inner.add(liquid);

    // Rising carbonation bubbles (small golden beads)
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    for (let i = 0; i < 6; i++) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), bubbleMat);
      const angle = (i * Math.PI) / 3;
      bubble.position.set(Math.cos(angle) * r * 0.45, -h * 0.3 + i * 0.1, Math.sin(angle) * r * 0.45);
      inner.add(bubble);
    }

    // Thick glass mug handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(h * 0.28, 0.052, 10, 20, Math.PI),
      glassMat
    );
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(r * 0.96, 0, 0);
    inner.add(handle);

    // Overflowing foam crown & foam puffs
    const foamBase = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 0.94, 0.18, 16), foamMat);
    foamBase.position.y = h / 2 + 0.05;
    inner.add(foamBase);

    const puffOffsets: [number, number][] = [
      [-0.11, 0.11],
      [0.11, 0.09],
      [0, -0.11],
      [-0.09, -0.09],
      [0.09, -0.09],
      [0, 0],
    ];
    puffOffsets.forEach(([px, pz]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), foamMat);
      puff.position.set(px, h / 2 + 0.15, pz);
      inner.add(puff);
    });
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

    // Main steel cabinet
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(r * 1.8, h * 0.82, r * 1.4),
      [bodyMat, bodyMat, capMat, bodyMat, panelMat, bodyMat]
    );
    inner.add(cabinet);

    // Louver grille on front bottom
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(r * 1.5, h * 0.22, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x050810, roughness: 0.95 })
    );
    grille.position.set(0, -h * 0.24, r * 0.71);
    inner.add(grille);

    // Top Chrome Draft Tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 18), capMat);
    tower.position.set(0, h * 0.41 + 0.26, 0);
    inner.add(tower);

    // Dual Gold Beer Tap Spouts & Handles
    [-0.14, 0.14].forEach((tapX) => {
      const tapSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 12), goldMat);
      tapSpout.rotation.x = Math.PI / 2;
      tapSpout.position.set(tapX, h * 0.41 + 0.38, 0.17);
      inner.add(tapSpout);

      const tapHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.018, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 })
      );
      tapHandle.position.set(tapX, h * 0.41 + 0.53, 0.23);
      tapHandle.rotation.x = -0.22;
      inner.add(tapHandle);
    });

    // 4 Caster Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85 });
    [
      [-r * 0.75, -r * 0.55],
      [r * 0.75, -r * 0.55],
      [-r * 0.75, r * 0.55],
      [r * 0.75, r * 0.55],
    ].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 14), wheelMat);
      wheel.rotation.z = Math.PI / 2;
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
    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r, h, 28), [
      sideMat,
      capMat,
      capMat,
    ]);
    inner.add(canBody);

    // Tapered neck & rim
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.96, h * 0.07, 28), capMat);
    lid.position.y = h / 2 + h * 0.035;
    inner.add(lid);

    // Aluminum pull tab
    const tab = new THREE.Mesh(new THREE.BoxGeometry(r * 0.45, h * 0.025, r * 0.3), capMat);
    tab.position.y = h / 2 + h * 0.075;
    inner.add(tab);

    // Condensation water droplets (8 tiny glassy beads)
    const dropletMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      roughness: 0.04,
      ior: 1.33,
    });
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), dropletMat);
      const angle = (i * Math.PI) / 4 + 0.2;
      const dropY = -h * 0.3 + (i % 4) * 0.2;
      drop.position.set(Math.cos(angle) * (r + 0.006), dropY, Math.sin(angle) * (r + 0.006));
      inner.add(drop);
    }

    // Foam crown on top for pilgood & hanmac
    if (kind === 'pilgood' || kind === 'hanmac') {
      const topFoam = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.65, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
      );
      topFoam.scale.set(1, 0.45, 1);
      topFoam.position.y = h / 2 + 0.08;
      inner.add(topFoam);
    }

    // Airborne jet plume for pilgood & caslight
    if (kind === 'pilgood' || kind === 'caslight') {
      const jetMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.7,
      });
      const jetPlume = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.7, 0.22, 12), jetMat);
      jetPlume.position.y = -h / 2 - 0.11;
      inner.add(jetPlume);
    }

    // Wings for caslight
    if (kind === 'caslight') {
      const wingMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const gl = new THREE.PlaneGeometry(0.52, 0.3);
      gl.translate(-0.26, 0, 0);
      const gr = new THREE.PlaneGeometry(0.52, 0.3);
      gr.translate(0.26, 0, 0);

      const wl = new THREE.Mesh(gl, wingMat);
      const wr = new THREE.Mesh(gr, wingMat);
      wl.position.set(-r, h * 0.12, 0);
      wr.position.set(r, h * 0.12, 0);
      root.add(wl);
      root.add(wr);
      wings = [wl, wr];
    }
  }

  root.userData = {
    kind,
    hitRadiusM: spec.hitRadiusM,
    inner,
    wings,
    shadowMesh,
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

  // Floor-locked circular drop shadow
  const shadowMesh = createFloorShadowMesh(0.55);
  root.add(shadowMesh);

  // Rotating glowing aura torus ring
  const auraGeo = new THREE.TorusGeometry(0.58, 0.035, 12, 32);
  const auraMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.auraColorHex),
    transparent: true,
    opacity: 0.88,
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.name = 'AuraRing';
  root.add(auraRing);

  if (itemKind === 'power_shot') {
    // 💥 Golden Bottle Opener (Handle + Ring Head)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.15,
    });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.04), goldMat);
    handle.position.y = -0.12;
    inner.add(handle);

    const openerRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 10, 20), goldMat);
    openerRing.position.y = 0.22;
    inner.add(openerRing);
  } else if (itemKind === 'wide_scope') {
    // 🎯 OB Beer Coaster Target Disc
    const coasterGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.035, 32);
    const coasterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.3,
      roughness: 0.4,
    });
    const coaster = new THREE.Mesh(coasterGeo, coasterMat);
    coaster.rotation.x = Math.PI / 4;
    inner.add(coaster);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 24), ringMat);
    innerRing.rotation.x = Math.PI / 4;
    inner.add(innerRing);

    const bullseye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), ringMat);
    bullseye.position.set(0, 0, 0.02);
    inner.add(bullseye);
  } else if (itemKind === 'ice_freeze') {
    // 🧊 Silver Ice Bucket with Ice Cubes
    const bucketMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.88,
      roughness: 0.18,
    });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.34, 18), bucketMat);
    inner.add(bucket);

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.75,
      roughness: 0.05,
      ior: 1.31,
    });
    [
      [-0.08, 0.14, -0.06],
      [0.08, 0.15, 0.05],
      [0, 0.18, 0],
    ].forEach(([ix, iy, iz]) => {
      const iceCube = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), iceMat);
      iceCube.position.set(ix, iy, iz);
      iceCube.rotation.set(0.3, 0.4, 0.2);
      inner.add(iceCube);
    });
  } else if (itemKind === 'bar_repair') {
    // 🍺 Fresh Green Hop Cones Cluster + Golden Ribbon
    const hopMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.65,
    });
    [
      [-0.1, 0, -0.05],
      [0.1, 0, -0.05],
      [0, 0.12, 0.05],
    ].forEach(([hx, hy, hz]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 8), hopMat);
      cone.position.set(hx, hy, hz);
      cone.rotation.x = Math.PI;
      inner.add(cone);
    });

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 16), ribbonMat);
    ribbon.position.y = -0.08;
    ribbon.rotation.x = Math.PI / 2;
    inner.add(ribbon);
  }

  root.userData = {
    isItem: true,
    itemKind,
    inner,
    shadowMesh,
    auraRing,
    baseScale,
  };

  return root;
}

export function updateTargetAnimation3D(
  root: THREE.Group,
  kind: TargetKind,
  elapsedSec: number,
  hpRatio: number
): void {
  const inner = root.userData.inner as THREE.Group | undefined;
  if (!inner) return;

  const shadowMesh = root.userData.shadowMesh as THREE.Mesh | undefined;
  if (shadowMesh) {
    shadowMesh.position.y = -root.position.y + 0.02;
  }

  const isGround = kind === 'mug' || kind === 'obi' || kind === 'hanmac' || kind === 'boss';

  if (isGround) {
    // Ground monsters contact bounce & limited rotation so label stays visible
    if (kind === 'boss') {
      const bounce = Math.abs(Math.sin(elapsedSec * 3.0)) * 0.04;
      inner.position.y = bounce;
      inner.rotation.y = Math.sin(elapsedSec * 1.5) * 0.12;
    } else {
      const bounce = Math.abs(Math.sin(elapsedSec * 5.0 + (root.id ? root.id * 0.2 : 0))) * 0.14;
      inner.position.y = bounce;
      inner.rotation.y = Math.sin(elapsedSec * 2.8) * 0.2;
    }
  } else {
    // Airborne monsters smooth floating flight & tilt
    inner.position.y = Math.sin(elapsedSec * 4.0 + (root.id ? root.id * 0.3 : 0)) * 0.12;
    inner.rotation.z = Math.sin(elapsedSec * 3.2 + (root.id ? root.id * 0.3 : 0)) * 0.09;
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
