import * as THREE from 'three';
import { WEAPON_CONSTANTS } from '../../shared/constants';

export interface EulerOrientation {
  alpha: number; // 0 ~ 360
  beta: number;  // -180 ~ 180
  gamma: number; // -90 ~ 90
}

export interface LinearAccelerationSample {
  x: number;
  y: number;
  z: number;
  timestampMs: number;
}

export interface AimResult {
  aimX: number;
  aimY: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export class GunGripTracker {
  private invZeroQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private isCalibrated = false;
  private lastSnapTimeMs = 0;

  private eulerToQuaternion(sample: EulerOrientation): THREE.Quaternion {
    const radBeta = THREE.MathUtils.degToRad(sample.beta);
    const radAlpha = THREE.MathUtils.degToRad(sample.alpha);
    const radGamma = THREE.MathUtils.degToRad(-sample.gamma);

    // Standard W3C DeviceOrientation conversion
    const euler = new THREE.Euler(radBeta, radAlpha, radGamma, 'YXZ');
    return new THREE.Quaternion().setFromEuler(euler);
  }

  public calibrateZero(sample: EulerOrientation): void {
    const qCurrent = this.eulerToQuaternion(sample);
    this.invZeroQuaternion = qCurrent.clone().invert();
    this.isCalibrated = true;
  }

  public computeAim(sample: EulerOrientation): AimResult {
    const qCurrent = this.eulerToQuaternion(sample);

    // If not calibrated yet, treat first sample as zero
    if (!this.isCalibrated) {
      this.calibrateZero(sample);
      return { aimX: 0, aimY: 0, yawDeg: 0, pitchDeg: 0, rollDeg: 0 };
    }

    // Relative quaternion: q_rel = q_zero_inv * q_current
    const qRel = this.invZeroQuaternion.clone().multiply(qCurrent);

    // Barrel vector (+Y axis in phone coordinates, pointing out the top edge)
    const barrel = new THREE.Vector3(0, 1, 0).applyQuaternion(qRel);

    // In pistol grip (screen facing left, top edge pointing forward):
    // - Up/Down tilt (Pitch) moves barrel towards device +X (towards ceiling)
    const pitchRad = -Math.asin(Math.max(-1, Math.min(1, barrel.x)));
    const pitchDeg = THREE.MathUtils.radToDeg(pitchRad);

    // - Left/Right turn (Yaw) moves barrel towards device -Z (right) / +Z (left)
    const yawRad = Math.atan2(-barrel.z, barrel.y);
    const yawDeg = THREE.MathUtils.radToDeg(yawRad);

    // Normalized aim coordinates [-1.0, +1.0]
    // 25 degrees horizontal yaw -> full screen width
    // 18 degrees vertical pitch -> full screen height
    const aimX = Math.max(-1, Math.min(1, yawDeg / 25));
    const aimY = Math.max(-1, Math.min(1, pitchDeg / 18));

    return {
      aimX,
      aimY,
      yawDeg,
      pitchDeg,
      rollDeg: 0,
    };
  }

  public detectSnapFire(sample: LinearAccelerationSample): boolean {
    const threshold = WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2; // 12.0 m/s^2
    const cooldownMs = 180;

    if (Math.abs(sample.x) >= threshold) {
      if (sample.timestampMs - this.lastSnapTimeMs >= cooldownMs) {
        this.lastSnapTimeMs = sample.timestampMs;
        return true;
      }
    }
    return false;
  }
}
