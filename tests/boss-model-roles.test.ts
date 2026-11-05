import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTargetMesh3D, getTargetBaseY, updateTargetAnimation3D } from '../src/pc/three/TargetModels3D';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { TARGET_SPECS } from '../src/shared/constants';

const crownOf = (m: THREE.Group) => (m.userData.inner as THREE.Group).getObjectByName('bossCrown');

/** 몸통 바닥의 월드 높이. */
function bodyBottom(m: THREE.Group, y: number): number {
  m.position.y = y;
  m.updateMatrixWorld(true);
  const body = (m.userData.inner as THREE.Group).children.find((c) => c.userData.isBodyMaterial)!;
  return new THREE.Box3().setFromObject(body).min.y;
}

describe('boss cooler models', () => {
  it('the small cooler has one tap and no crown; the king has three and a crown', () => {
    const small = createTargetMesh3D('boss');
    const king = createTargetMesh3D('boss', 'king');
    expect(small.userData.bossTapHandles.length).toBe(1);
    expect(king.userData.bossTapHandles.length).toBe(3);
    expect(crownOf(small)).toBeUndefined();
    expect(crownOf(king)).toBeDefined();
    expect((small.userData.inner as THREE.Group).getObjectByName('bossLogoPlate')).toBeDefined();
    expect((king.userData.inner as THREE.Group).getObjectByName('bossLogoPlate')).toBeDefined();
  });

  it('all king levers tilt on summon and return', () => {
    const king = createTargetMesh3D('boss', 'king');
    updateTargetAnimation3D(king, 'boss', 1, 1, { isBossSummoning: true });
    king.userData.bossTapHandles.forEach((h: THREE.Mesh) => expect(h.rotation.x).toBeCloseTo(0.65, 2));
    updateTargetAnimation3D(king, 'boss', 2, 1, { isBossSummoning: false });
    king.userData.bossTapHandles.forEach((h: THREE.Mesh) => expect(h.rotation.x).toBeCloseTo(-0.22, 2));
  });

  it('both stand on the floor', () => {
    expect(Math.abs(bodyBottom(createTargetMesh3D('boss'), getTargetBaseY('boss')))).toBeLessThan(0.05);
    const king = createTargetMesh3D('boss', 'king');
    (king.userData.inner as THREE.Group).scale.multiplyScalar(GAME_TUNING.boss.kingScale);
    const y = getTargetBaseY('boss') * GAME_TUNING.boss.kingScale;
    expect(Math.abs(bodyBottom(king, y))).toBeLessThan(0.05);
    expect(y + king.userData.shadowMesh.position.y).toBeCloseTo(0.01, 5);
  });

  it('body colours are not shared, so frost on one boss cannot tint another', () => {
    const body = (m: THREE.Group) => (m.userData.inner as THREE.Group).children.find((c) => c.userData.isBodyMaterial) as THREE.Mesh;
    const a = body(createTargetMesh3D('boss')).material as THREE.Material[];
    const b = body(createTargetMesh3D('boss')).material as THREE.Material[];
    a.forEach((m) => {
      expect(m.userData.isShared).toBeFalsy();
      expect(b).not.toContain(m);
    });
  });

  it('wave 7: only the king is lifted; hp and the hit size rule are unchanged', () => {
    const e = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    e.startWave(7);
    e.activeTargets = [];
    (e as any).spawnBossEncounter(1000);
    const bosses = e.activeTargets.filter((t) => t.kind === 'boss');
    const king = bosses.find((b) => b.bossRole === 'king')!;
    expect(king.customBaseY).toBeCloseTo(1.725, 5);
    expect(king.hp).toBe(GAME_TUNING.waves[6].boss!.kingHp);
    expect(king.hitRadiusM).toBeCloseTo(TARGET_SPECS.boss.hitRadiusM * GAME_TUNING.boss.kingScale, 5);
    bosses.filter((b) => b.bossRole === 'cooler').forEach((c) => expect(c.customBaseY).toBeUndefined());
  });
});
