import * as THREE from 'three';
import { aimToNdc } from '../aimMapping';

export const AIM_TARGET_DISTANCE_M = 14;

export function computeAimWorldPoint(
  camera: THREE.PerspectiveCamera,
  aimX: number,
  aimY: number,
  distanceM = AIM_TARGET_DISTANCE_M
): THREE.Vector3 {
  const { ndcX, ndcY } = aimToNdc(aimX, aimY);
  const targetNDC = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const dir = targetNDC.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, distanceM);
}
