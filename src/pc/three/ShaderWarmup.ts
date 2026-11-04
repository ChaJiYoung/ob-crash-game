import * as THREE from 'three';
import {
  createTargetMesh3D,
  createItemMesh3D,
  createGoldenCanMesh3D,
  createProjectileMesh3D,
  createCardTargetMesh3D,
  createLandingMarker3D,
} from './TargetModels3D';
import { DraftTapGun3D } from './DraftTapGun3D';
import { ParticleEffects3D } from './ParticleEffects3D';
import { ItemBuffKind, TargetKind, WeaponKind } from '../../shared/types';

const WARMUP_TARGET_KINDS: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'];
const WARMUP_ITEM_KINDS: ItemBuffKind[] = ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'];
const WARMUP_WEAPON_KINDS: WeaponKind[] = ['shotgun', 'revolver', 'gatling'];

/**
 * 게임에서 쓰이는 모든 재질 종류를 한 그룹에 담는다.
 * 이 그룹은 앵커다. dispose하면 셰이더 프로그램이 해제되어 다음 스폰 때 다시 컴파일되므로,
 * 게임이 끝날 때까지 참조를 유지해야 한다.
 */
export function buildShaderAnchorGroup(particles: ParticleEffects3D): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ShaderAnchorGroup';

  WARMUP_TARGET_KINDS.forEach((kind) => group.add(createTargetMesh3D(kind)));
  WARMUP_ITEM_KINDS.forEach((kind) => group.add(createItemMesh3D(kind)));
  group.add(createGoldenCanMesh3D());
  group.add(createProjectileMesh3D());
  group.add(createCardTargetMesh3D('warmup', 'warmup', '#ffffff', '🃏'));
  group.add(createLandingMarker3D());

  WARMUP_WEAPON_KINDS.forEach((kind) => {
    const gun = new DraftTapGun3D();
    gun.setWeaponAppearance(kind, 4);
    group.add(gun.group);
  });

  particles.createWarmupObjects().forEach((obj) => group.add(obj));

  // 숨겨진 자식(쉴드, 프리즈 링, 록온)까지 컴파일 대상에 넣는다.
  group.traverse((o) => {
    o.visible = true;
  });
  return group;
}
