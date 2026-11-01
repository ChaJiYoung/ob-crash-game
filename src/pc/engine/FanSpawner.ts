import { STAGE_CONSTANTS } from '../../shared/constants';

export function computeHorizontalHalfFovRad(vFovDeg: number, aspect: number): number {
  const vFovRad = (vFovDeg * Math.PI) / 180;
  return Math.atan(Math.tan(vFovRad / 2) * aspect);
}

export interface FanSpawnPoint {
  thetaRad: number;
  x: number;
  z: number;
  radiusM: number;
}

export function sampleFanSpawnPoint(options: {
  vFovDeg: number;
  aspect: number;
  spawnRadiusM?: number;
  marginRatio?: number;
  existingAnglesRad?: number[];
  rng?: () => number;
}): FanSpawnPoint {
  const spawnRadiusM = options.spawnRadiusM ?? STAGE_CONSTANTS.SPAWN_RADIUS_M;
  const marginRatio = options.marginRatio ?? STAGE_CONSTANTS.FAN_MARGIN_RATIO;
  const rng = options.rng ?? Math.random;
  const existing = options.existingAnglesRad ?? [];

  const hHalfFov = computeHorizontalHalfFovRad(options.vFovDeg, options.aspect);
  const maxTheta = hHalfFov * marginRatio;

  const minSeparationRad = 0.22; // ~12.6 degrees separation
  let chosenTheta = 0;
  let bestSeparation = -1;

  for (let attempt = 0; attempt < 24; attempt++) {
    // Sample across [-maxTheta, +maxTheta]
    const candidateTheta = (rng() * 2 - 1) * maxTheta;

    if (existing.length === 0) {
      chosenTheta = candidateTheta;
      break;
    }

    let minDiff = Infinity;
    for (const ang of existing) {
      const diff = Math.abs(candidateTheta - ang);
      if (diff < minDiff) {
        minDiff = diff;
      }
    }

    if (minDiff >= minSeparationRad) {
      chosenTheta = candidateTheta;
      break;
    }

    if (minDiff > bestSeparation) {
      bestSeparation = minDiff;
      chosenTheta = candidateTheta;
    }
  }

  const x = spawnRadiusM * Math.sin(chosenTheta);
  const z = -spawnRadiusM * Math.cos(chosenTheta);

  return {
    thetaRad: chosenTheta,
    x,
    z,
    radiusM: spawnRadiusM,
  };
}

export interface RadialTargetState {
  x: number;
  z: number;
  radiusM: number;
  thetaRad: number;
  yawRad: number;
  breached: boolean;
}

export function advanceRadialTarget(
  current: { radiusM: number; thetaRad: number },
  speedMps: number,
  dtSec: number,
  defenseRadiusM: number = STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M
): RadialTargetState {
  const nextRadius = current.radiusM - speedMps * dtSec;
  const breached = nextRadius <= defenseRadiusM;
  const clampedRadius = Math.max(0.1, nextRadius);

  const x = clampedRadius * Math.sin(current.thetaRad);
  const z = -clampedRadius * Math.cos(current.thetaRad);
  // Face towards the origin (player at 0, 0)
  const yawRad = Math.atan2(-x, -z);

  return {
    x,
    z,
    radiusM: clampedRadius,
    thetaRad: current.thetaRad,
    yawRad,
    breached,
  };
}
