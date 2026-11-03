import { JudgmentGrade } from '../../shared/types';
import { JUDGMENT_SPECS } from '../../shared/constants';

export interface HitJudgmentResult {
  grade: JudgmentGrade;
  errorRatio: number;
  baseScore: number;
  feverDelta: number;
  damage: number;
  damageMultiplier: number;
}

export interface HitJudgmentOptions {
  isFeverActive?: boolean;
  isPowerShotActive?: boolean;
  isWideScopeActive?: boolean;
}

export function evaluateHitJudgment(
  distanceToCenterM: number,
  hitRadiusM: number,
  optionsOrFever: boolean | HitJudgmentOptions = false
): HitJudgmentResult {
  const options: HitJudgmentOptions =
    typeof optionsOrFever === 'boolean' ? { isFeverActive: optionsOrFever } : optionsOrFever;
  const isFeverActive = Boolean(options.isFeverActive);
  const isPowerShotActive = Boolean(options.isPowerShotActive);
  const isWideScopeActive = Boolean(options.isWideScopeActive);

  if (hitRadiusM <= 0) {
    return {
      grade: 'MISS',
      errorRatio: 999,
      baseScore: 0,
      feverDelta: 0,
      damage: 0,
      damageMultiplier: 0,
    };
  }

  const effectiveHitRadius = isWideScopeActive ? hitRadiusM * 1.6 : hitRadiusM;
  const errorRatio = distanceToCenterM / effectiveHitRadius;
  const baseDamage = isFeverActive || isPowerShotActive ? 2 : 1;

  if (isFeverActive) {
    if (errorRatio <= 1.0) {
      return {
        grade: 'PERFECT',
        errorRatio,
        baseScore: JUDGMENT_SPECS.PERFECT.baseScore * 1.5,
        feverDelta: 0, // Fever is already active
        damage: 2, // Double damage during fever
        damageMultiplier: 1.5,
      };
    }
    return {
      grade: 'MISS',
      errorRatio,
      baseScore: 0,
      feverDelta: 0,
      damage: 0,
      damageMultiplier: 0,
    };
  }

  if (errorRatio <= JUDGMENT_SPECS.PERFECT.maxErrorRatio) {
    return {
      grade: 'PERFECT',
      errorRatio,
      baseScore: JUDGMENT_SPECS.PERFECT.baseScore,
      feverDelta: JUDGMENT_SPECS.PERFECT.feverDelta,
      damage: baseDamage,
      damageMultiplier: JUDGMENT_SPECS.PERFECT.damageMultiplier,
    };
  }

  if (errorRatio <= JUDGMENT_SPECS.GREAT.maxErrorRatio) {
    return {
      grade: 'GREAT',
      errorRatio,
      baseScore: JUDGMENT_SPECS.GREAT.baseScore,
      feverDelta: JUDGMENT_SPECS.GREAT.feverDelta,
      damage: baseDamage,
      damageMultiplier: JUDGMENT_SPECS.GREAT.damageMultiplier,
    };
  }

  if (errorRatio <= JUDGMENT_SPECS.GOOD.maxErrorRatio) {
    return {
      grade: 'GOOD',
      errorRatio,
      baseScore: JUDGMENT_SPECS.GOOD.baseScore,
      feverDelta: JUDGMENT_SPECS.GOOD.feverDelta,
      damage: baseDamage,
      damageMultiplier: JUDGMENT_SPECS.GOOD.damageMultiplier,
    };
  }

  return {
    grade: 'MISS',
    errorRatio,
    baseScore: 0,
    feverDelta: 0,
    damage: 0,
    damageMultiplier: 0,
  };
}
