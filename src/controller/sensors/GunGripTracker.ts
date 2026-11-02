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
  private zeroForward: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private zeroRight: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private zeroUp: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private isCalibrated = false;
  private lastSnapTimeMs = 0;
  private smoothedAimX = 0;
  private smoothedAimY = 0;
  private hasSmoothedSample = false;
  private lockedAim: AimResult | null = null;

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
    const radAlpha = THREE.MathUtils.degToRad(sample.alpha);
    const radBeta = THREE.MathUtils.degToRad(sample.beta);
    const radGamma = THREE.MathUtils.degToRad(sample.gamma);

    const qAlpha = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), radAlpha);
    const qBeta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radBeta);
    const qGamma = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radGamma);

    return qAlpha.multiply(qBeta).multiply(qGamma);
  }

  public calibrateZero(sample: EulerOrientation): void {
    this.zeroSample = { ...sample };
    const qCurrent = this.eulerToQuaternion(sample);

    // 폰 총구(+Y) 방향을 회전시킨 월드 정면 벡터
    this.zeroForward.set(0, 1, 0).applyQuaternion(qCurrent).normalize();

    // 월드 하늘 방향(Z=Up)과 외적하여 화면 수평축(Right) 계산
    let worldUp = new THREE.Vector3(0, 0, 1);
    this.zeroRight.crossVectors(this.zeroForward, worldUp);

    // 수직 천장/바닥을 정면으로 겨눌 때의 특이점(외적=0) 방어
    if (this.zeroRight.lengthSq() < 1e-4) {
      worldUp.set(0, 1, 0);
      this.zeroRight.crossVectors(this.zeroForward, worldUp);
      if (this.zeroRight.lengthSq() < 1e-4) {
        this.zeroRight.set(1, 0, 0);
      }
    }
    this.zeroRight.normalize();

    // 화면 수직축(Up = Right x Forward)
    this.zeroUp.crossVectors(this.zeroRight, this.zeroForward).normalize();

    this.isCalibrated = true;
    this.smoothedAimX = 0;
    this.smoothedAimY = 0;
    this.hasSmoothedSample = false;
    this.lockedAim = null;
  }

  public lockAim(sample: EulerOrientation): AimResult {
    this.lockedAim = this.computeAim(sample);
    return this.lockedAim;
  }

  public unlockAim(): void {
    this.lockedAim = null;
  }

  public isAimLocked(): boolean {
    return this.lockedAim !== null;
  }

  public getEffectiveAim(
    sample: EulerOrientation,
    smoothingAlpha = 0.92
  ): { aim: AimResult; isLocked: boolean } {
    if (this.lockedAim) {
      return { aim: this.lockedAim, isLocked: true };
    }
    return { aim: this.computeAim(sample, smoothingAlpha), isLocked: false };
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

    const qCurrent = this.eulerToQuaternion(sample);
    const currentForward = new THREE.Vector3(0, 1, 0).applyQuaternion(qCurrent).normalize();

    // 가상 모니터 직교 기저(zeroRight, zeroUp, zeroForward)로 투영
    const projX = currentForward.dot(this.zeroRight);
    const projY = currentForward.dot(this.zeroUp);
    const projZ = currentForward.dot(this.zeroForward);

    const yawDeg = THREE.MathUtils.radToDeg(Math.atan2(projX, projZ));
    const pitchDeg = THREE.MathUtils.radToDeg(Math.atan2(projY, projZ));
    const rollDeg = 0;

    return { yawDeg, pitchDeg, rollDeg };
  }

  public computeAim(sample: EulerOrientation, smoothingAlpha = 0.92): AimResult {
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
    const threshold = WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2;
    const cooldownMs = 110;
    const magnitude = Math.hypot(sample.x, sample.y, sample.z);

    if (magnitude >= threshold) {
      if (sample.timestampMs - this.lastSnapTimeMs >= cooldownMs) {
        this.lastSnapTimeMs = sample.timestampMs;
        return true;
      }
    }
    return false;
  }
}
