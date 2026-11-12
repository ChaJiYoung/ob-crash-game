import * as THREE from 'three';
import { ItemBuffKind, TargetKind } from '../../shared/types';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../../shared/constants';
import { GAME_TUNING } from '../../shared/gameTuning';
import { createRealisticPlungerMesh } from './DraftTapGun3D';

const labelTextureCache = new Map<string, THREE.Texture>();

/** 공유 텍스처는 몬스터가 사라질 때 dispose되지 않도록 표시한다. */
function markShared<T extends THREE.Texture>(tex: T): T {
  tex.userData.isShared = true;
  return tex;
}

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
    officialCassTexture = markShared(fallback);
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
    officialCassTexture = markShared(texture);
    return texture;
  } catch {
    const fallback = createDataTextureFallback('#004b91');
    officialCassTexture = markShared(fallback);
    return fallback;
  }
}

let chalangCutoutTexture: THREE.Texture | null = null;

/** 찰랑 누끼 이미지(투명 배경 PNG). 카스 빌보드와 같은 방식으로 불러온다. */
export function getOrCreateChalangCutoutTexture(): THREE.Texture {
  if (chalangCutoutTexture) return chalangCutoutTexture;
  if (typeof document === 'undefined') {
    chalangCutoutTexture = markShared(createDataTextureFallback('#38bdf8'));
    return chalangCutoutTexture;
  }
  const texture = new THREE.TextureLoader().load('/textures/chalang_cutout.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  chalangCutoutTexture = markShared(texture);
  return texture;
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
    labelTextureCache.set(kind, markShared(fallback));
    return fallback;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = createDataTextureFallback(spec.brandColorHex);
      labelTextureCache.set(kind, markShared(fallback));
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

    labelTextureCache.set(kind, markShared(texture));
    return texture;
  } catch {
    const fallback = createDataTextureFallback(spec.brandColorHex);
    labelTextureCache.set(kind, markShared(fallback));
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
    itemBillboardCache.set(itemKind, markShared(fallback));
    return fallback;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = createDataTextureFallback(colorHex);
      itemBillboardCache.set(itemKind, markShared(fallback));
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
    itemBillboardCache.set(itemKind, markShared(texture));
    return texture;
  } catch {
    const fallback = createDataTextureFallback(colorHex);
    itemBillboardCache.set(itemKind, markShared(fallback));
    return fallback;
  }
}

export function getTargetBaseY(kind: TargetKind, isItem?: boolean): number {
  if (isItem) {
    return 1.15; // Mid-air floating altitude for shootable item drops
  }
  if (kind === 'caslight') {
    return 1.45; // The only airborne monster: gliding flight altitude
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

let obLogoTexture: THREE.Texture | null = null;

/** 냉각기 이름판의 실제 OB 로고. 브라우저 밖(테스트)에서는 null이라 흰 이름판이 된다. */
function getObLogoTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (!obLogoTexture) {
    const tex = new THREE.TextureLoader().load('/textures/labels/ob-logo.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    obLogoTexture = markShared(tex);
  }
  return obLogoTexture;
}

export function createTargetMesh3D(kind: TargetKind, bossRole?: 'cooler' | 'king'): THREE.Group {
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
  // 대왕은 kingScale만큼 올려 세우므로 그림자도 그만큼 내려 바닥에 맞춘다.
  shadowMesh.position.y = -(bossRole === 'king' ? baseY * GAME_TUNING.boss.kingScale : baseY) + 0.01;
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
  let obiShield: THREE.Mesh | null = null;
  let chalangParts: { body: THREE.Mesh; ripple: THREE.Mesh } | null = null;

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
  } else if (kind === 'chalang') {
    // 찰랑: 카스와 같은 누끼 빌보드. 제공 이미지(투명 배경 PNG, 254x378)의 비율을 유지한다.
    const cutoutGeo = getCachedGeometry('chalang-cutout-geo', () => new THREE.PlaneGeometry(0.85, 1.27));
    const cutoutMat = new THREE.MeshBasicMaterial({
      map: getOrCreateChalangCutoutTexture(),
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    const chalangBody = new THREE.Mesh(cutoutGeo, cutoutMat);
    chalangBody.name = 'chalangBody';
    chalangBody.userData.isBodyMaterial = true;
    chalangBody.position.y = 0.635; // 누끼 아래끝을 바닥(y=0)에 맞춤
    inner.add(chalangBody);

    // 물결 링: 수면 표시. 잠수 중에만 보이게 T05가 켠다.
    const rippleGeo = getCachedGeometry('chalang-ripple-geo', () => new THREE.TorusGeometry(0.9, 0.04, 8, 32));
    const rippleMat = getCachedMaterial('chalang-ripple-mat', () => new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
    const chalangRipple = new THREE.Mesh(rippleGeo, rippleMat);
    chalangRipple.name = 'chalangRipple';
    chalangRipple.rotation.x = -Math.PI / 2;
    chalangRipple.position.y = -0.2;
    chalangRipple.visible = false;
    inner.add(chalangRipple);

    chalangParts = { body: chalangBody, ripple: chalangRipple };
  } else if (kind === 'boss') {
    // 🧊 Boss: 실제 업소용 순간냉각기처럼 세로로 긴 몸통 앞면에 탭이 달렸다. 소형은 은색 1구, 대왕은 검정 3구에 왕관.
    const isKing = bossRole === 'king';
    const W = 1.3;
    const H = 1.75;
    const D = 1.2;
    const floorY = -baseY / baseScale;
    const cy = floorY + H / 2;

    // 얼음 효과가 몸통 재질 색을 바꾸므로 몸통에는 공유 재질을 쓰지 않는다.
    const bodyMat = new THREE.MeshStandardMaterial(
      isKing
        ? { color: 0x17191d, metalness: 0.55, roughness: 0.42 }
        : { color: 0xc4cad2, metalness: 0.75, roughness: 0.32 }
    );
    const topMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.6, roughness: 0.4 });
    const bodyGeo = getCachedGeometry('boss-body-geo', () => new THREE.BoxGeometry(W, H, D));
    const body = new THREE.Mesh(bodyGeo, [bodyMat, bodyMat, topMat, bodyMat, bodyMat, bodyMat]);
    body.position.y = cy;
    body.userData.isBodyMaterial = true;
    inner.add(body);

    // Side vents
    const slitMat = getCachedMaterial('boss-slit-mat', () => new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.9 }));
    const slitGeo = getCachedGeometry('boss-slit-geo', () => new THREE.BoxGeometry(0.015, 0.035, D * 0.55));
    [W / 2 + 0.008, -W / 2 - 0.008].forEach((x) => {
      [cy + H / 2 - 0.14, floorY + 0.5].forEach((top) => {
        for (let i = 0; i < 5; i++) {
          const slit = new THREE.Mesh(slitGeo, slitMat);
          slit.position.set(x, top - i * 0.07, 0);
          inner.add(slit);
        }
      });
    });

    // Front taps: the levers tilt when the boss summons
    const handles: THREE.Mesh[] = [];
    bossTapHandles = handles;
    const leverMat = isKing
      ? goldMat
      : getCachedMaterial('boss-lever-mat', () => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.1, roughness: 0.5 }));
    const k = isKing ? 1.3 : 1.6;
    const collarGeo = getCachedGeometry(`boss-tap-collar-${k}`, () => {
      const g = new THREE.CylinderGeometry(0.06 * k, 0.06 * k, 0.1 * k, 14);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const tapBodyGeo = getCachedGeometry(`boss-tap-body-${k}`, () => new THREE.CylinderGeometry(0.055 * k, 0.05 * k, 0.2 * k, 14));
    const spoutGeo = getCachedGeometry(`boss-tap-spout-${k}`, () => new THREE.CylinderGeometry(0.03 * k, 0.022 * k, 0.16 * k, 10));
    const leverGeo = getCachedGeometry(`boss-tap-lever-${k}`, () => new THREE.CylinderGeometry(0.036 * k, 0.024 * k, 0.34 * k, 12));
    const tapY = cy + 0.46;
    (isKing ? [-0.34, 0, 0.34] : [0]).forEach((x) => {
      const collar = new THREE.Mesh(collarGeo, capMat);
      collar.position.set(x, tapY, D / 2 + 0.05 * k);
      inner.add(collar);
      const tapBody = new THREE.Mesh(tapBodyGeo, capMat);
      tapBody.position.set(x, tapY - 0.01 * k, D / 2 + 0.14 * k);
      inner.add(tapBody);
      const spout = new THREE.Mesh(spoutGeo, capMat);
      spout.position.set(x, tapY - 0.18 * k, D / 2 + 0.14 * k);
      inner.add(spout);
      const lever = new THREE.Mesh(leverGeo, leverMat);
      lever.position.set(x, tapY + 0.24 * k, D / 2 + 0.12 * k);
      lever.rotation.x = -0.22;
      inner.add(lever);
      handles.push(lever);
    });

    // Drip tray with a grate
    const trayMat = getCachedMaterial('boss-tray-mat', () => new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.55, roughness: 0.42 }));
    const trayGeo = getCachedGeometry('boss-tray-geo', () => new THREE.BoxGeometry(W * 0.86, 0.16, 0.42));
    const tray = new THREE.Mesh(trayGeo, trayMat);
    const trayY = floorY + 0.2;
    tray.position.set(0, trayY, D / 2 + 0.2);
    inner.add(tray);
    const grateMat = getCachedMaterial('boss-grate-mat', () => new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.35 }));
    const grateGeo = getCachedGeometry('boss-grate-geo', () => new THREE.BoxGeometry(W * 0.74, 0.012, 0.018));
    for (let i = 0; i < 9; i++) {
      const bar = new THREE.Mesh(grateGeo, grateMat);
      bar.position.set(0, trayY + 0.085, D / 2 + 0.03 + i * 0.043);
      inner.add(bar);
    }

    // Name plate with the real OB logo
    const frameGeo = getCachedGeometry('boss-plate-frame-geo', () => new THREE.BoxGeometry(0.66, 0.26, 0.01));
    const frame = new THREE.Mesh(frameGeo, isKing ? goldMat : capMat);
    frame.position.set(0, cy - 0.2, D / 2 + 0.006);
    inner.add(frame);
    const plateMat = getCachedMaterial('boss-logo-plate-mat', () => {
      const logo = getObLogoTexture();
      return new THREE.MeshStandardMaterial(logo ? { map: logo, roughness: 0.5 } : { color: 0xffffff, roughness: 0.5 });
    });
    const plateGeo = getCachedGeometry('boss-logo-plate-geo', () => new THREE.PlaneGeometry(0.6, 0.2));
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.name = 'bossLogoPlate';
    plate.position.set(0, cy - 0.2, D / 2 + 0.012);
    inner.add(plate);

    if (isKing) {
      const crown = new THREE.Group();
      crown.name = 'bossCrown';
      crown.position.y = floorY + H + 0.08;
      const R = 0.42;
      const bandGeo = getCachedGeometry('boss-crown-band-geo', () => new THREE.CylinderGeometry(R, R * 0.92, 0.16, 16));
      crown.add(new THREE.Mesh(bandGeo, goldMat));
      const spikeGeo = getCachedGeometry('boss-crown-spike-geo', () => new THREE.ConeGeometry(0.095, 0.3, 6));
      const gemGeo = getCachedGeometry('boss-crown-gem-geo', () => new THREE.SphereGeometry(0.05, 10, 10));
      const gemMat = getCachedMaterial('boss-crown-gem-mat', () =>
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.6, roughness: 0.25 })
      );
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, goldMat);
        spike.position.set(Math.sin(a) * R * 0.9, 0.22, Math.cos(a) * R * 0.9);
        crown.add(spike);
        if (i % 2 === 0) {
          const gem = new THREE.Mesh(gemGeo, gemMat);
          gem.position.set(Math.sin(a) * (R + 0.01), 0, Math.cos(a) * (R + 0.01));
          crown.add(gem);
        }
      }
      inner.add(crown);
    }
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

    // Obi guard shield: raised for 2s, lowered for 1s (see updateTargetAnimation3D)
    if (kind === 'obi') {
      const shieldGeo = getCachedGeometry('obi-shield-geo', () => new THREE.BoxGeometry(0.62, 0.9, 0.06));
      const shieldMat = getCachedMaterial('obi-shield-mat', () =>
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
      );
      obiShield = new THREE.Mesh(shieldGeo, shieldMat);
      obiShield.name = 'guardShield';
      obiShield.position.set(0, 0, r + 0.1);
      obiShield.visible = false;
      inner.add(obiShield);
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

    // Hanmac is a bomb can: a red warning band and a lit fuse
    if (kind === 'hanmac') {
      const bombMat = getCachedMaterial('hanmac-bomb-mat', () =>
        new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.7, roughness: 0.4 })
      );
      const bandGeo = getCachedGeometry('hanmac-band-geo', () => {
        const g = new THREE.TorusGeometry(r * 1.0, 0.022, 8, 28);
        g.rotateX(Math.PI / 2);
        return g;
      });
      [h * 0.3, -h * 0.3].forEach((y) => {
        const band = new THREE.Mesh(bandGeo, bombMat);
        band.position.y = y;
        inner.add(band);
      });
      const fuseGeo = getCachedGeometry('hanmac-fuse-geo', () => new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8));
      const fuse = new THREE.Mesh(fuseGeo, capMat);
      fuse.position.set(0.05, h / 2 + 0.2, 0);
      fuse.rotation.z = -0.35;
      inner.add(fuse);
      const sparkGeo = getCachedGeometry('hanmac-spark-geo', () => new THREE.SphereGeometry(0.035, 10, 10));
      const spark = new THREE.Mesh(sparkGeo, bombMat);
      spark.name = 'hanmacFuseSpark';
      spark.position.set(0.08, h / 2 + 0.28, 0);
      inner.add(spark);
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
      if (kind === 'pilgood') {
        // Ground rocket can: exhaust points backwards (away from the player) instead of into the floor
        jetPlume.rotation.x = Math.PI / 2;
        jetPlume.position.set(0, -h * 0.2, -r * 1.2);
      } else {
        jetPlume.position.y = -h / 2 - 0.11;
      }
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
    bossRole,
    shadowMesh,
    lockOnMarker,
    frostRing,
    plungerStuckGroup,
    bodyMaterials,
    guardShieldMesh: obiShield || undefined,
    chalangParts: chalangParts || undefined,
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
  isGuarding?: boolean;
  /** 찰랑이 물속에 있다: 몸체가 납작해지고 눈·병이 숨고 물결 링이 보인다(D01). */
  isSubmerged?: boolean;
  /** 박힌 뚫어뻥이 곧 터진다(남은 500ms 이하): 더 세게 떨린다. */
  plungerBlastImminent?: boolean;
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

  // Obi shield visibility
  const guardShield = root.userData.guardShieldMesh as THREE.Mesh | undefined;
  if (guardShield) {
    guardShield.visible = Boolean(options?.isGuarding);
  }

  // Chalang submerge: the cutout sinks to a flat water line and a ripple ring pulses (T05)
  const chalangParts = root.userData.chalangParts as { body: THREE.Mesh; ripple: THREE.Mesh } | undefined;
  if (chalangParts) {
    const submerged = Boolean(options?.isSubmerged);
    const targetScaleY = submerged ? 0.12 : 1;
    chalangParts.body.scale.y += (targetScaleY - chalangParts.body.scale.y) * 0.2;
    chalangParts.ripple.visible = submerged;
    if (submerged) {
      chalangParts.ripple.scale.setScalar(1 + 0.1 * Math.sin(elapsedSec * 4));
    }
  }

  // Stunned Plunger Status
  const plungerStuckGroup = root.userData.plungerStuckGroup as THREE.Group | undefined;
  if (plungerStuckGroup) {
    plungerStuckGroup.visible = isStunned;
    if (isStunned) {
      // Wiggling vibration animation
      const imminent = Boolean(options?.plungerBlastImminent);
      plungerStuckGroup.rotation.z = Math.sin(elapsedSec * (imminent ? 90 : 45)) * (imminent ? 0.25 : 0.12);
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

  const isGround = kind === 'bottle' || kind === 'obi' || kind === 'hanmac' || kind === 'boss' || kind === 'pilgood' || kind === 'chalang';

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

/** 똥 아래 단의 중심에서 바닥까지 거리(모델 배율 적용 전). */
const SHELL_BOTTOM_OFFSET = 0.238;

/** 부피를 유지하며 위아래로 늘고 준다. liftY는 아래 단이 바닥에서 뜨거나 파묻히지 않게 옮기는 값. */
export function computeShellSpring(
  elapsedSec: number,
  phase = 0
): { scaleY: number; scaleXZ: number; liftY: number } {
  const { springHz, springAmount } = GAME_TUNING.shell;
  const scaleY = 1 + springAmount * Math.sin(elapsedSec * springHz * Math.PI * 2 + phase);
  return { scaleY, scaleXZ: 1 / Math.sqrt(scaleY), liftY: (scaleY - 1) * SHELL_BOTTOM_OFFSET };
}

export function updateProjectileAnimation3D(root: THREE.Group, elapsedSec: number): void {
  const inner = root.userData.inner as THREE.Group | undefined;
  if (!inner) return;
  const base = (root.userData.baseScale as number) || 1.15;
  const { scaleY, scaleXZ, liftY } = computeShellSpring(elapsedSec, root.id * 0.7); // 여러 개가 같이 움직이지 않게
  inner.scale.set(base * scaleXZ, base * scaleY, base * scaleXZ);
  inner.position.y = liftY * base;
}

/**
 * 🫧 Procedural 3D Monster Projectile Mesh
 */
export function createProjectileMesh3D(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Monster_Projectile';

  const inner = new THREE.Group();
  root.add(inner);

  // 갈색 3단 소프트아이스(똥 모양). 빛과 고리가 없어서 빛나는 아이템과 확실히 구분된다.
  const poopMat = getCachedMaterial('projectile-poop-mat', () => {
    return new THREE.MeshStandardMaterial({ color: 0x7a4a21, roughness: 0.85, metalness: 0 });
  });
  const tier = (key: string, radius: number, flatten: number) =>
    getCachedGeometry(key, () => {
      const g = new THREE.SphereGeometry(radius, 14, 10);
      g.scale(flatten, 0.7, flatten);
      return g;
    });

  const bottom = new THREE.Mesh(tier('projectile-poop-bottom', 0.34, 1.25), poopMat);
  bottom.position.y = 0;
  inner.add(bottom);
  const middle = new THREE.Mesh(tier('projectile-poop-middle', 0.26, 1.2), poopMat);
  middle.position.y = 0.2;
  inner.add(middle);
  const top = new THREE.Mesh(tier('projectile-poop-top', 0.18, 1.1), poopMat);
  top.position.y = 0.38;
  inner.add(top);

  const tipGeo = getCachedGeometry('projectile-poop-tip', () => new THREE.ConeGeometry(0.1, 0.22, 10));
  const tip = new THREE.Mesh(tipGeo, poopMat);
  tip.position.y = 0.58;
  tip.rotation.z = 0.35; // 꼭대기가 살짝 휜다
  inner.add(tip);

  const eyeMat = getCachedMaterial('projectile-poop-eye-mat', () => new THREE.MeshBasicMaterial({ color: 0x1c1917 }));
  const eyeGeo = getCachedGeometry('projectile-poop-eye-geo', () => new THREE.SphereGeometry(0.035, 8, 8));
  [-0.1, 0.1].forEach((x) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.04, 0.41); // 아래 단 표면 바깥에 놓아야 보인다
    inner.add(eye);
  });

  inner.scale.setScalar(1.15);

  const shadowMesh = createFloorShadowMesh(0.42);
  shadowMesh.position.y = -GAME_TUNING.shell.baseY + 0.01;
  root.add(shadowMesh);

  root.userData = {
    isProjectile: true,
    inner,
    shadowMesh,
    baseScale: 1.15,
    hitRadiusM: 0.95,
  };

  return root;
}

const cardTextureCache = new Map<string, THREE.CanvasTexture>();

/** 카드 텍스처는 종류별로 한 번만 그려 재사용한다. (key: title|subtitle|colorHex|icon) */
function getOrCreateCardTexture(
  title: string,
  subtitle: string,
  colorHex: string,
  icon: string
): THREE.CanvasTexture | null {
  const key = `${title}|${subtitle}|${colorHex}|${icon}`;
  const cached = cardTextureCache.get(key);
  if (cached) return cached;
  const tex = drawCardTexture(title, subtitle, colorHex, icon);
  if (tex) cardTextureCache.set(key, tex);
  return tex;
}

function drawCardTexture(
  title: string,
  subtitle: string,
  colorHex: string,
  icon: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const safeRoundRect = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      if (typeof context.roundRect === 'function') {
        context.roundRect(x, y, w, h, r);
      } else {
        context.rect(x, y, w, h);
      }
    };

    // Card background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 680);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    safeRoundRect(ctx, 16, 16, 480, 648, 28);
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
    safeRoundRect(ctx, 48, 500, 416, 96, 24);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('🎯 SHOOT TO SELECT', 256, 560);
  }

  const canvasTexture = new THREE.CanvasTexture(canvas);
  canvasTexture.colorSpace = THREE.SRGBColorSpace;
  canvasTexture.userData.isShared = true;
  canvasTexture.needsUpdate = true;
  return canvasTexture;
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

  const canvasTexture = getOrCreateCardTexture(title, subtitle, colorHex, icon);
  const textureKey = `${title}|${subtitle}|${colorHex}|${icon}`;

  const cardMat = getCachedMaterial(`card-frame-mat-${colorHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: 0.85,
      metalness: 0.8,
      roughness: 0.2,
    })
  );
  const cardFrame = new THREE.Mesh(
    getCachedGeometry('card-frame-geo', () => new THREE.BoxGeometry(1.80, 2.40, 0.08)),
    cardMat
  );
  inner.add(cardFrame);

  // Outer Neon Frame for High Visibility in Dark HDRI
  const borderMat = getCachedMaterial(`card-border-mat-${colorHex}`, () =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) })
  );
  const borderThickness = 0.04;
  const borderDepth = 0.09;
  const borderHGeo = getCachedGeometry('card-border-h-geo', () => new THREE.BoxGeometry(1.82, borderThickness, borderDepth));
  const borderVGeo = getCachedGeometry('card-border-v-geo', () => new THREE.BoxGeometry(borderThickness, 2.40, borderDepth));
  const topBar = new THREE.Mesh(borderHGeo, borderMat);
  topBar.position.set(0, 1.20, 0);
  const btmBar = new THREE.Mesh(borderHGeo, borderMat);
  btmBar.position.set(0, -1.20, 0);
  const leftBar = new THREE.Mesh(borderVGeo, borderMat);
  leftBar.position.set(-0.90, 0, 0);
  const rightBar = new THREE.Mesh(borderVGeo, borderMat);
  rightBar.position.set(0.90, 0, 0);

  const borderGroup = new THREE.Group();
  borderGroup.name = 'cardNeonBorder';
  borderGroup.add(topBar, btmBar, leftBar, rightBar);
  inner.add(borderGroup);

  // Card Front Face (z = 0.048 to prevent z-fighting with cardFrame)
  const frontMat = getCachedMaterial(`card-front-mat-${textureKey}`, () =>
    new THREE.MeshBasicMaterial({
      map: canvasTexture,
      transparent: true,
      side: THREE.DoubleSide,
      color: canvasTexture ? 0xffffff : new THREE.Color(colorHex),
    })
  );
  const frontPlane = new THREE.Mesh(
    getCachedGeometry('card-front-geo', () => new THREE.PlaneGeometry(1.74, 2.34)),
    frontMat
  );
  frontPlane.position.z = 0.048;
  inner.add(frontPlane);

  inner.scale.set(1.12, 1.12, 1.12); // 12% scale boost for superior readability

  root.userData = {
    isCard: true,
    hasNeonFrame: true,
    inner,
    baseScale: 1.12,
    hitRadiusM: 1.75,
  };

  return root;
}

// ---------------------------------------------------------------------------
// Boss minion drop: landing marker + fall height
// ---------------------------------------------------------------------------

/** Height (m) a summoned minion falls from; the fall accelerates (remaining^2). */
export const MINION_DROP_HEIGHT_M = 8;

/** 1 right after the summon, 0 once landed (or for anything that never falls). Uses the engine's effective clock. */
export function getMinionDropRemaining(dropLandAtMs: number | undefined, clockMs: number, dropMs: number): number {
  if (dropLandAtMs === undefined || dropMs <= 0) return 0;
  return Math.min(1, Math.max(0, (dropLandAtMs - clockMs) / dropMs));
}

/** Flat ring on the floor where a falling minion will land. */
export function createLandingMarker3D(): THREE.Mesh {
  const geo = getCachedGeometry('landing-marker-geo', () => {
    const g = new THREE.RingGeometry(0.62, 0.9, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const base = getCachedMaterial(
    'landing-marker-mat',
    () => new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8, depthWrite: false })
  );
  // A clone per marker keeps its own opacity but reuses the already compiled shader program
  const mat = base.clone();
  mat.userData.isShared = false;
  const marker = new THREE.Mesh(geo, mat);
  marker.name = 'landingMarker';
  marker.renderOrder = 2;
  marker.position.y = 0.06;
  return marker;
}

/** remaining01: 1 right after the summon, 0 on landing. The ring shrinks onto the hit zone and brightens. */
export function updateLandingMarker3D(marker: THREE.Mesh, remaining01: number, hitRadiusM: number): void {
  const r = Math.min(1, Math.max(0, remaining01));
  const s = Math.max(0.6, hitRadiusM) * (1 + 1.2 * r);
  marker.scale.set(s, 1, s);
  (marker.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * (1 - r);
}

/**
 * 카드 바깥에 플레이어 색 테두리 한 겹을 덧씌운다(D23).
 * 기존 테두리(1.82×2.40)보다 바깥에 배치:
 * 가로 막대 BoxGeometry(1.98, 0.07, 0.1) y ±1.235
 * 세로 막대 BoxGeometry(0.07, 2.54, 0.1) x ±0.955
 */
export function addCardOwnerOutline3D(card: THREE.Group, ownerColorHex: string): void {
  const outlineMat = getCachedMaterial(`card-owner-outline-mat-${ownerColorHex}`, () =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(ownerColorHex) })
  );
  const hGeo = getCachedGeometry('card-owner-outline-h-geo', () => new THREE.BoxGeometry(1.98, 0.07, 0.1));
  const vGeo = getCachedGeometry('card-owner-outline-v-geo', () => new THREE.BoxGeometry(0.07, 2.54, 0.1));

  const topBar = new THREE.Mesh(hGeo, outlineMat);
  topBar.position.set(0, 1.235, 0);
  const btmBar = new THREE.Mesh(hGeo, outlineMat);
  btmBar.position.set(0, -1.235, 0);
  const leftBar = new THREE.Mesh(vGeo, outlineMat);
  leftBar.position.set(-0.955, 0, 0);
  const rightBar = new THREE.Mesh(vGeo, outlineMat);
  rightBar.position.set(0.955, 0, 0);

  const outlineGroup = new THREE.Group();
  outlineGroup.name = 'cardOwnerOutline';
  outlineGroup.add(topBar, btmBar, leftBar, rightBar);

  const targetGroup = (card.children[0] as THREE.Group) || card;
  targetGroup.add(outlineGroup);
}
