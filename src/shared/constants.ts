import { JudgmentGrade, TargetKind, TargetSpec } from './types';

export const TARGET_SPECS: Record<TargetKind, TargetSpec> = {
  pilgood: {
    kind: 'pilgood',
    displayName: '필굿 (FiLGOOD)',
    maxHp: 1,
    speedMps: 4.5,
    hitRadiusM: 0.55,
    killBonusScore: 30,
    brandColorHex: '#00a8e8',
    accentColorHex: '#ffd100',
  },
  caslight: {
    kind: 'caslight',
    displayName: '카스 라이트 (Cass Light)',
    maxHp: 1,
    speedMps: 3.8,
    hitRadiusM: 0.58,
    killBonusScore: 40,
    brandColorHex: '#38bdf8',
    accentColorHex: '#e2e8f0',
  },
  obi: {
    kind: 'obi',
    displayName: '오비 라거 (OB Lager)',
    maxHp: 2,
    speedMps: 3.1,
    hitRadiusM: 0.65,
    killBonusScore: 70,
    brandColorHex: '#f59e0b',
    accentColorHex: '#b91c1c',
  },
  hanmac: {
    kind: 'hanmac',
    displayName: '한맥 (HANMAC)',
    maxHp: 2,
    speedMps: 3.3,
    hitRadiusM: 0.65,
    killBonusScore: 90,
    brandColorHex: '#047857',
    accentColorHex: '#d4af37',
  },
  mug: {
    kind: 'mug',
    displayName: '500ml 생맥주잔 (Draft Mug)',
    maxHp: 3,
    speedMps: 2.4,
    hitRadiusM: 0.80,
    killBonusScore: 160,
    brandColorHex: '#fbbf24',
    accentColorHex: '#ffffff',
  },
  boss: {
    kind: 'boss',
    displayName: '업소용 생맥주 냉각기 보스',
    maxHp: 30,
    speedMps: 1.15,
    hitRadiusM: 1.55,
    killBonusScore: 1500,
    brandColorHex: '#111827',
    accentColorHex: '#f59e0b',
  },
};

export interface JudgmentSpec {
  maxErrorRatio: number;
  baseScore: number;
  feverDelta: number;
  colorHex: string;
}

export const JUDGMENT_SPECS: Record<Exclude<JudgmentGrade, 'MISS'>, JudgmentSpec> = {
  PERFECT: {
    maxErrorRatio: 0.15,
    baseScore: 150,
    feverDelta: 30,
    colorHex: '#fbbf24',
  },
  GREAT: {
    maxErrorRatio: 0.45,
    baseScore: 100,
    feverDelta: 20,
    colorHex: '#38bdf8',
  },
  GOOD: {
    maxErrorRatio: 1.00,
    baseScore: 50,
    feverDelta: 10,
    colorHex: '#4ade80',
  },
};

export const FEVER_CONSTANTS = {
  MAX_GAUGE: 100,
  MISS_PENALTY: 5,
  DURATION_MS: 6000,
  LOCK_WHEN_FULL: true,
} as const;

export const WEAPON_CONSTANTS = {
  MAX_AMMO: 10,
  AUTO_RELOAD_MS: 1200,
  RAPID_FIRE_HOLD_MS: 250,
  RAPID_FIRE_INTERVAL_MS: 115,
  FEVER_DOUBLE_TAP_MS: 300,
  SNAP_ACCEL_THRESHOLD_MPS2: 12.0,
} as const;

export const STAGE_CONSTANTS = {
  SPAWN_RADIUS_M: 28.0,
  DEFENSE_LINE_RADIUS_M: 1.8,
  CAMERA_FOV_DEG: 52,
  FAN_MARGIN_RATIO: 0.92,
  PLAYER_MAX_LIVES: 3,
} as const;
