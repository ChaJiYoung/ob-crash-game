/**
 * 총(카메라 로컬 좌표 gunPos)이 목표(카메라 로컬 좌표 target)를 겨누는 회전.
 * 총 모델의 앞은 로컬 -Z. rotation.order는 'YXZ'(먼저 좌우 yaw, 그다음 상하 pitch)로 적용한다.
 */
export function computeGunAimAngles(
  gunPos: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): { yaw: number; pitch: number } {
  const dx = target.x - gunPos.x;
  const dy = target.y - gunPos.y;
  const dz = target.z - gunPos.z;

  const horizontalDist = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, horizontalDist);

  return { yaw, pitch };
}
