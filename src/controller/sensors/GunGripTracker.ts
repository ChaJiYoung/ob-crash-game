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

export interface AimCalibrationConfig {
  yawHalfRangeDeg: number;   // 기본 25 (최소 8, 최대 45)
  pitchHalfRangeDeg: number; // 기본 18 (최소 6, 최대 40)
  sensitivityX: number;      // 기본 1.0 (0.4 ~ 2.5)
  sensitivityY: number;      // 기본 1.0 (0.4 ~ 2.5)
  invertY: boolean;          // 기본 false
}

export interface MeasuredRangeBounds {
  minYawDeg: number;
  maxYawDeg: number;
  minPitchDeg: number;
  maxPitchDeg: number;
  sampleCount: number;
}

export function shortestAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

export class GunGripTracker {
  private zeroSample: EulerOrientation = { alpha: 0, beta: 0, gamma: 0 };
  private invZeroQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private isCalibrated = false;
  private lastSnapTimeMs = 0;
  private smoothedAimX = 0;
  private smoothedAimY = 0;
  private hasSmoothedSample = false;

  private config: AimCalibrationConfig = {
    yawHalfRangeDeg: 25,
    pitchHalfRangeDeg: 18,
    sensitivityX: 1.0,
    sensitivityY: 1.0,
    invertY: false,
  };

  private isMeasuringRange = false;
  private rangeBounds: MeasuredRangeBounds = {
    minYawDeg: 0,
    maxYawDeg: 0,
    minPitchDeg: 0,
    maxPitchDeg: 0,
    sampleCount: 0,
  };

  private eulerToQuaternion(sample: EulerOrientation): THREE.Quaternion {
    const radBeta = THREE.MathUtils.degToRad(sample.beta);
    const radAlpha = THREE.MathUtils.degToRad(sample.alpha);
    const radGamma = THREE.MathUtils.degToRad(-sample.gamma);

    const euler = new THREE.Euler(radBeta, radAlpha, radGamma, 'YXZ');
    return new THREE.Quaternion().setFromEuler(euler);
  }

  public calibrateZero(sample: EulerOrientation): void {
    this.zeroSample = { ...sample };
    const qCurrent = this.eulerToQuaternion(sample);
    this.invZeroQuaternion = qCurrent.clone().invert();
    this.isCalibrated = true;
    this.smoothedAimX = 0;
    this.smoothedAimY = 0;
    this.hasSmoothedSample = false;
  }

  public getCalibrationConfig(): AimCalibrationConfig {
    return { ...this.config };
  }

  public setCalibrationConfig(partial: Partial<AimCalibrationConfig>): AimCalibrationConfig {
    this.config = {
      yawHalfRangeDeg: Math.max(8, Math.min(45, partial.yawHalfRangeDeg ?? this.config.yawHalfRangeDeg)),
      pitchHalfRangeDeg: Math.max(6, Math.min(40, partial.pitchHalfRangeDeg ?? this.config.pitchHalfRangeDeg)),
      sensitivityX: Math.max(0.4, Math.min(2.5, partial.sensitivityX ?? this.config.sensitivityX)),
      sensitivityY: Math.max(0.4, Math.min(2.5, partial.sensitivityY ?? this.config.sensitivityY)),
      invertY: partial.invertY ?? this.config.invertY,
    };
    return this.getCalibrationConfig();
  }

  public startRangeMeasurement(): void {
    this.isMeasuringRange = true;
    this.rangeBounds = {
      minYawDeg: 0,
      maxYawDeg: 0,
      minPitchDeg: 0,
      maxPitchDeg: 0,
      sampleCount: 0,
    };
  }

  public recordRangeSample(sample: EulerOrientation): MeasuredRangeBounds {
    const angles = this.computeRelativeAngles(sample);
    if (!this.isMeasuringRange) {
      this.startRangeMeasurement();
    }

    this.rangeBounds.minYawDeg = Math.min(this.rangeBounds.minYawDeg, angles.yawDeg);
    this.rangeBounds.maxYawDeg = Math.max(this.rangeBounds.maxYawDeg, angles.yawDeg);
    this.rangeBounds.minPitchDeg = Math.min(this.rangeBounds.minPitchDeg, angles.pitchDeg);
    this.rangeBounds.maxPitchDeg = Math.max(this.rangeBounds.maxPitchDeg, angles.pitchDeg);
    this.rangeBounds.sampleCount += 1;

    return { ...this.rangeBounds };
  }

  public finishRangeMeasurement(): AimCalibrationConfig {
    this.isMeasuringRange = false;
    if (this.rangeBounds.sampleCount > 0) {
      const measuredYawSpan = this.rangeBounds.maxYawDeg - this.rangeBounds.minYawDeg;
      const measuredYawHalf = Math.max(
        Math.abs(this.rangeBounds.minYawDeg),
        Math.abs(this.rangeBounds.maxYawDeg),
        measuredYawSpan > 4 ? measuredYawSpan / 2 : this.config.yawHalfRangeDeg
      );

      const measuredPitchSpan = this.rangeBounds.maxPitchDeg - this.rangeBounds.minPitchDeg;
      const measuredPitchHalf = Math.max(
        Math.abs(this.rangeBounds.minPitchDeg),
        Math.abs(this.rangeBounds.maxPitchDeg),
        measuredPitchSpan > 4 ? measuredPitchSpan / 2 : this.config.pitchHalfRangeDeg
      );

      this.config.yawHalfRangeDeg = Math.max(8, Math.min(45, measuredYawHalf));
      this.config.pitchHalfRangeDeg = Math.max(6, Math.min(40, measuredPitchHalf));
    }
    return this.getCalibrationConfig();
  }

  public computeRelativeAngles(sample: EulerOrientation): { yawDeg: number; pitchDeg: number; rollDeg: number } {
    if (!this.isCalibrated) {
      return { yawDeg: 0, pitchDeg: 0, rollDeg: 0 };
    }

    // 1. 수평 Yaw (우측 회전 시 alpha 감소 -> zero - sample > 0이 우측 조준 +X)
    const yawDeg = shortestAngleDeltaDeg(sample.alpha, this.zeroSample.alpha);

    // 2. 수직 Pitch: W3C 표준 기준 폰 상단을 위로 올리면 beta 증가
    const deltaBeta = shortestAngleDeltaDeg(this.zeroSample.beta, sample.beta);

    // 권총 측면 파지 (screen facing left, gamma ≈ -90) 환경 호환:
    // deltaBeta가 작고 gamma 변화량이 크면 deltaGamma를 pitch로 보조
    const deltaGamma = -(sample.gamma - this.zeroSample.gamma);
    let pitchDeg = deltaBeta;
    if (Math.abs(deltaBeta) < Math.abs(deltaGamma) * 0.5) {
      pitchDeg = deltaBeta + deltaGamma;
    }

    // 3. Roll
    const rollDeg = sample.gamma - this.zeroSample.gamma;

    return { yawDeg, pitchDeg, rollDeg };
  }

  public computeAim(sample: EulerOrientation, smoothingAlpha = 0.72): AimResult {
    if (!this.isCalibrated) {
      this.calibrateZero(sample);
      return { aimX: 0, aimY: 0, yawDeg: 0, pitchDeg: 0, rollDeg: 0 };
    }

    if (this.isMeasuringRange) {
      this.recordRangeSample(sample);
    }

    const { yawDeg, pitchDeg, rollDeg } = this.computeRelativeAngles(sample);

    const rawAimX = Math.max(
      -1,
      Math.min(1, (yawDeg / this.config.yawHalfRangeDeg) * this.config.sensitivityX)
    );

    const signedPitch = this.config.invertY ? -pitchDeg : pitchDeg;
    const rawAimY = Math.max(
      -1,
      Math.min(1, (signedPitch / this.config.pitchHalfRangeDeg) * this.config.sensitivityY)
    );

    const delta = Math.hypot(rawAimX - this.smoothedAimX, rawAimY - this.smoothedAimY);
    const effectiveAlpha = !this.hasSmoothedSample || delta > 0.15 ? 1.0 : smoothingAlpha;
    this.smoothedAimX += (rawAimX - this.smoothedAimX) * effectiveAlpha;
    this.smoothedAimY += (rawAimY - this.smoothedAimY) * effectiveAlpha;
    this.hasSmoothedSample = true;

    return {
      aimX: this.smoothedAimX,
      aimY: this.smoothedAimY,
      yawDeg,
      pitchDeg,
      rollDeg,
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
