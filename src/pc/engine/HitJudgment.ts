import { JudgmentGrade } from '../../shared/types';
import { JUDGMENT_SPECS } from '../../shared/constants';

export interface HitJudgmentResult {
  grade: JudgmentGrade;
  errorRatio: number;
  baseScore: number;
  feverDelta: number;
  damage: number;
}

export function evaluateHitJudgment(
  distanceToCenterM: number,
  hitRadiusM: number,
  isFeverActive = false
): HitJudgmentResult {
  if (hitRadiusM <= 0) {
    return {
      grade: 'MISS',
      errorRatio: 999,
      baseScore: 0,
      feverDelta: -5,
      damage: 0,
    };
  }

  const errorRatio = distanceToCenterM / hitRadiusM;

  if (isFeverActive) {
    if (errorRatio <= 1.0) {
      return {
        grade: 'PERFECT',
        errorRatio,
        baseScore: JUDGMENT_SPECS.PERFECT.baseScore * 1.5,
        feverDelta: 0, // Fever is already active
        damage: 2, // Double damage during fever
      };
    }
    return {
      grade: 'MISS',
      errorRatio,
      baseScore: 0,
      feverDelta: 0,
      damage: 0,
    };
  }

  if (errorRatio <= JUDGMENT_SPECS.PERFECT.maxErrorRatio) {
    return {
      grade: 'PERFECT',
      errorRatio,
      baseScore: JUDGMENT_SPECS.PERFECT.baseScore,
      feverDelta: JUDGMENT_SPECS.PERFECT.feverDelta,
      damage: 1,
    };
  }

  if (errorRatio <= JUDGMENT_SPECS.GREAT.maxErrorRatio) {
    return {
      grade: 'GREAT',
      errorRatio,
      baseScore: JUDGMENT_SPECS.GREAT.baseScore,
      feverDelta: JUDGMENT_SPECS.GREAT.feverDelta,
      damage: 1,
    };
  }

  if (errorRatio <= JUDGMENT_SPECS.GOOD.maxErrorRatio) {
    return {
      grade: 'GOOD',
      errorRatio,
      baseScore: JUDGMENT_SPECS.GOOD.baseScore,
      feverDelta: JUDGMENT_SPECS.GOOD.feverDelta,
      damage: 1,
    };
  }

  return {
    grade: 'MISS',
    errorRatio,
    baseScore: 0,
    feverDelta: -5,
    damage: 0,
  };
}
