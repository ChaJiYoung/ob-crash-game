import { JudgmentGrade } from '../../shared/types';
import { FEVER_CONSTANTS, JUDGMENT_SPECS } from '../../shared/constants';

export class ScoreAndFeverManager {
  private totalScore = 0;
  private combo = 0;
  private maxCombo = 0;
  private feverGauge = 0;
  private isFeverReady = false;
  private isFeverActive = false;
  private feverEndTimeMs = 0;
  private feverBaseCombo = 0;
  private lastHitCombo = 0;

  public getComboMultiplier(): number {
    if (this.combo >= 30) return 2.5;
    if (this.combo >= 20) return 2.0;
    if (this.combo >= 10) return 1.5;
    if (this.combo >= 5) return 1.2;
    return 1.0;
  }

  public registerHit(
    grade: Exclude<JudgmentGrade, 'MISS'>,
    killBonusScore = 0
  ): {
    earnedScore: number;
    totalScore: number;
    combo: number;
    maxCombo: number;
    feverGauge: number;
    isFeverReady: boolean;
  } {
    this.combo += 1;
    this.lastHitCombo = this.combo;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    const spec = JUDGMENT_SPECS[grade];
    const mult = this.getComboMultiplier();
    const feverBonusMult = this.isFeverActive ? 1.5 : 1.0;
    const earnedScore = Math.round(spec.baseScore * mult * feverBonusMult) + killBonusScore;
    this.totalScore += earnedScore;

    if (!this.isFeverActive) {
      this.feverGauge = Math.min(FEVER_CONSTANTS.MAX_GAUGE, this.feverGauge + spec.feverDelta);
      if (this.feverGauge >= FEVER_CONSTANTS.MAX_GAUGE) {
        this.feverGauge = FEVER_CONSTANTS.MAX_GAUGE;
        this.isFeverReady = true;
      }
    }

    return {
      earnedScore,
      totalScore: this.totalScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      feverGauge: this.feverGauge,
      isFeverReady: this.isFeverReady,
    };
  }

  public applyMissPenalty(): {
    combo: number;
    maxCombo: number;
    feverGauge: number;
    isFeverReady: boolean;
  } {
    // Fever Combo Floor Protection (D02):
    // During active fever, missed shots NEVER reset combo to 0!
    // Instead, combo is preserved with a hard floor at feverBaseCombo.
    if (this.isFeverActive) {
      this.combo = Math.max(this.feverBaseCombo, this.combo);
      return {
        combo: this.combo,
        maxCombo: this.maxCombo,
        feverGauge: this.feverGauge,
        isFeverReady: this.isFeverReady,
      };
    }

    // Fever Ready Protection (D02):
    // When fever gauge is 100% full (or fever ready), missed shots NEVER reset combo or decrease gauge!
    if (this.feverGauge >= FEVER_CONSTANTS.MAX_GAUGE || this.isFeverReady) {
      return {
        combo: this.combo,
        maxCombo: this.maxCombo,
        feverGauge: this.feverGauge,
        isFeverReady: this.isFeverReady,
      };
    }

    this.combo = 0;
    this.feverGauge = Math.max(0, this.feverGauge - FEVER_CONSTANTS.MISS_PENALTY);
    return {
      combo: this.combo,
      maxCombo: this.maxCombo,
      feverGauge: this.feverGauge,
      isFeverReady: this.isFeverReady,
    };
  }

  public activateFever(nowMs: number): boolean {
    if (!this.isFeverReady || this.isFeverActive) {
      return false;
    }

    this.isFeverActive = true;
    this.isFeverReady = false;
    this.feverEndTimeMs = nowMs + FEVER_CONSTANTS.DURATION_MS;
    this.feverBaseCombo = Math.max(this.combo, this.lastHitCombo);
    this.combo = this.feverBaseCombo;
    return true;
  }

  public updateFeverTimer(nowMs: number): void {
    if (this.isFeverActive) {
      if (nowMs >= this.feverEndTimeMs) {
        this.isFeverActive = false;
        this.feverGauge = 0;
        this.isFeverReady = false;
      } else {
        // Decrease gauge smoothly for UI
        const remainMs = Math.max(0, this.feverEndTimeMs - nowMs);
        this.feverGauge = Math.round((remainMs / FEVER_CONSTANTS.DURATION_MS) * 100);
      }
    }
  }

  public shiftFeverTimer(deltaMs: number): void {
    if (this.isFeverActive && deltaMs > 0) {
      this.feverEndTimeMs += deltaMs;
    }
  }

  public forceSetFeverGauge(gauge: number): void {
    this.feverGauge = Math.max(0, Math.min(FEVER_CONSTANTS.MAX_GAUGE, gauge));
    if (this.feverGauge >= FEVER_CONSTANTS.MAX_GAUGE) {
      this.isFeverReady = true;
    } else {
      this.isFeverReady = false;
    }
  }

  public addFeverGauge(delta: number): void {
    this.forceSetFeverGauge(this.feverGauge + delta);
  }

  public chargeFeverToMax(): void {
    this.forceSetFeverGauge(FEVER_CONSTANTS.MAX_GAUGE);
  }

  public getState() {
    return {
      totalScore: this.totalScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      feverGauge: this.feverGauge,
      isFeverReady: this.isFeverReady,
      isFeverActive: this.isFeverActive,
      feverBaseCombo: this.feverBaseCombo,
      comboMultiplier: this.getComboMultiplier(),
    };
  }

  public reset(): void {
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.feverGauge = 0;
    this.isFeverReady = false;
    this.isFeverActive = false;
    this.feverEndTimeMs = 0;
    this.feverBaseCombo = 0;
    this.lastHitCombo = 0;
  }
}
