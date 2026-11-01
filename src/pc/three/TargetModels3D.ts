import * as THREE from 'three';
import { TargetKind } from '../../shared/types';
import { TARGET_SPECS } from '../../shared/constants';

const labelTextureCache = new Map<TargetKind, THREE.Texture>();

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

export function getOrCreateTargetLabelTexture(kind: TargetKind): THREE.Texture {
  if (labelTextureCache.has(kind)) {
    return labelTextureCache.get(kind)!;
  }

  const spec = TARGET_SPECS[kind];
  if (typeof document === 'undefined') {
    const fallback = createDataTextureFallback(spec.brandColorHex);
    labelTextureCache.set(kind, fallback);
    return fallback;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = createDataTextureFallback(spec.brandColorHex);
      labelTextureCache.set(kind, fallback);
      return fallback;
    }

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, spec.brandColorHex);
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, spec.brandColorHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Accent bands
    ctx.fillStyle = spec.accentColorHex;
    ctx.fillRect(0, 0, 512, 36);
    ctx.fillRect(0, 220, 512, 36);

    // Center circular badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(256, 128, 76, 0, Math.PI * 2);
    ctx.fill();

    // Brand title
    ctx.fillStyle = spec.accentColorHex === '#ffffff' ? '#111827' : '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.displayName.split(' ')[0], 256, 116);

    // Subtitle
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(spec.displayName, 256, 164);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.offset.x = 0.5;
    labelTextureCache.set(kind, texture);
    return texture;
  } catch {
    const fallback = createDataTextureFallback(spec.brandColorHex);
    labelTextureCache.set(kind, fallback);
    return fallback;
  }
}

export function createTargetMesh3D(kind: TargetKind): THREE.Group {
  const spec = TARGET_SPECS[kind];
  const root = new THREE.Group();
  root.name = `Target_${kind}`;

  const inner = new THREE.Group();
  inner.name = 'InnerModel';
  root.add(inner);

  const capMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.2,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.9,
    roughness: 0.18,
  });

  let wings: [THREE.Mesh, THREE.Mesh] | null = null;

  if (kind === 'mug') {
    // 🍺 500ml Crystal Draft Beer Glass Mug
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      roughness: 0.12,
      metalness: 0.05,
    });
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.1,
    });
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
    });

    const r = 0.32;
    const h = 0.82;

    // Outer 10-sided facet glass body
    const glassBody = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, h, 10), glassMat);
    inner.add(glassBody);

    // Inner amber beer liquid
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.78, h * 0.82, 10), liquidMat);
    liquid.position.y = -h * 0.04;
    inner.add(liquid);

    // Thick glass mug handle
    const handle = new THREE.Mesh(new THREE.TorusGeometry(h * 0.28, 0.048, 8, 16, Math.PI), glassMat);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(r * 0.95, 0, 0);
    inner.add(handle);

    // Overflowing foam crown & foam puffs
    const foamBase = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 0.94, 0.16, 12), foamMat);
    foamBase.position.y = h / 2 + 0.04;
    inner.add(foamBase);

    const puffOffsets: [number, number][] = [
      [-0.1, 0.1],
      [0.1, 0.08],
      [0, -0.1],
      [-0.08, -0.08],
      [0.08, -0.08],
    ];
    puffOffsets.forEach(([px, pz]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), foamMat);
      puff.position.set(px, h / 2 + 0.13, pz);
      inner.add(puff);
    });
  } else if (kind === 'boss') {
    // 🧊 Boss: Commercial OB Draft Beer Dispenser Cooler
    const r = 0.85;
    const h = 1.75;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.72,
      roughness: 0.35,
    });
    const panelTexture = getOrCreateTargetLabelTexture('boss');
    const panelMat = new THREE.MeshStandardMaterial({
      map: panelTexture,
      metalness: 0.35,
      roughness: 0.35,
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
      new THREE.MeshStandardMaterial({ color: 0x050810, roughness: 0.9 })
    );
    grille.position.set(0, -h * 0.24, r * 0.71);
    inner.add(grille);

    // Top Chrome Draft Tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 16), capMat);
    tower.position.set(0, h * 0.41 + 0.26, 0);
    inner.add(tower);

    // Dual Gold Beer Tap Spouts & Handles
    [-0.12, 0.12].forEach((tapX) => {
      const tapSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12), goldMat);
      tapSpout.rotation.x = Math.PI / 2;
      tapSpout.position.set(tapX, h * 0.41 + 0.38, 0.16);
      inner.add(tapSpout);

      const tapHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.016, 0.26, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 })
      );
      tapHandle.position.set(tapX, h * 0.41 + 0.52, 0.22);
      tapHandle.rotation.x = -0.2;
      inner.add(tapHandle);
    });

    // 4 Caster Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    [
      [-r * 0.75, -r * 0.55],
      [r * 0.75, -r * 0.55],
      [-r * 0.75, r * 0.55],
      [r * 0.75, r * 0.55],
    ].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, -h * 0.41 - 0.05, wz);
      inner.add(wheel);
    });
  } else {
    // 🥫 4 Aluminum Beer Cans (pilgood, caslight, obi, hanmac)
    const r = 0.26;
    const h = 0.72;

    const labelTex = getOrCreateTargetLabelTexture(kind);
    const sideMat = new THREE.MeshStandardMaterial({
      map: labelTex,
      metalness: 0.78,
      roughness: 0.24,
    });

    // Can body
    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r, h, 24), [
      sideMat,
      capMat,
      capMat,
    ]);
    inner.add(canBody);

    // Tapered silver neck
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.96, h * 0.07, 24), capMat);
    lid.position.y = h / 2 + h * 0.035;
    inner.add(lid);

    // Aluminum pull tab
    const tab = new THREE.Mesh(new THREE.BoxGeometry(r * 0.45, h * 0.025, r * 0.3), capMat);
    tab.position.y = h / 2 + h * 0.075;
    inner.add(tab);

    // Extra foam or wings
    if (kind === 'pilgood' || kind === 'hanmac') {
      const topFoam = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.7, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
      );
      topFoam.scale.set(1, 0.45, 1);
      topFoam.position.y = h / 2 + 0.08;
      inner.add(topFoam);
    }

    if (kind === 'caslight') {
      const wingMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const gl = new THREE.PlaneGeometry(0.48, 0.28);
      gl.translate(-0.24, 0, 0);
      const gr = new THREE.PlaneGeometry(0.48, 0.28);
      gr.translate(0.24, 0, 0);

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
    hitFlashUntilSec: 0,
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

  // Bobbing and tilt
  if (kind === 'boss') {
    inner.position.y = Math.sin(elapsedSec * 3) * 0.05;
    inner.rotation.y = Math.sin(elapsedSec * 1.5) * 0.08;
  } else if (kind === 'mug') {
    inner.position.y = Math.sin(elapsedSec * 4) * 0.08;
    inner.rotation.z = Math.sin(elapsedSec * 3.5) * 0.07;
  } else {
    inner.position.y = Math.sin(elapsedSec * 5 + root.id) * 0.07;
    inner.rotation.z = Math.sin(elapsedSec * 4 + root.id) * 0.1;
  }

  // Flap wings for caslight
  const wings = root.userData.wings as [THREE.Mesh, THREE.Mesh] | null;
  if (wings) {
    const flap = Math.sin(elapsedSec * 14) * 0.35;
    wings[0].rotation.y = flap;
    wings[1].rotation.y = -flap;
  }

  // Flash decay
  if (root.userData.hitFlashUntilSec && elapsedSec > root.userData.hitFlashUntilSec) {
    root.userData.hitFlashUntilSec = 0;
    inner.scale.set(1, 1, 1);
  }
}

export function applyTargetHitFlash3D(root: THREE.Group, nowSec: number): void {
  const inner = root.userData.inner as THREE.Group | undefined;
  if (inner) {
    inner.scale.set(1.2, 0.85, 1.2); // Squish impact
    root.userData.hitFlashUntilSec = nowSec + 0.15;
  }
}
