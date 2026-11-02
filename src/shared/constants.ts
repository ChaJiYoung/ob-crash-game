import { ItemBuffKind, ItemBuffSpec, JudgmentGrade, TargetKind, TargetSpec } from './types';

export const TARGET_SPECS: Record<TargetKind, TargetSpec> = {
  pilgood: {
    kind: 'pilgood',
    displayName: '필굿 (FiLGOOD)',
    maxHp: 1,
    speedMps: 2.6,
    hitRadiusM: 0.85,
    killBonusScore: 30,
    brandColorHex: '#00a8e8',
    accentColorHex: '#ffd100',
    isAirborne: true,
    modelScale: 1.85,
  },
  caslight: {
    kind: 'caslight',
    displayName: '카스 라이트 (Cass Light)',
    maxHp: 1,
    speedMps: 2.2,
    hitRadiusM: 0.90,
    killBonusScore: 40,
    brandColorHex: '#38bdf8',
    accentColorHex: '#e2e8f0',
    isAirborne: true,
    modelScale: 1.85,
  },
  obi: {
    kind: 'obi',
    displayName: '오비 라거 (OB Lager)',
    maxHp: 2,
    speedMps: 1.9,
    hitRadiusM: 0.95,
    killBonusScore: 70,
    brandColorHex: '#f59e0b',
    accentColorHex: '#b91c1c',
    isAirborne: false,
    modelScale: 1.9,
  },
  hanmac: {
    kind: 'hanmac',
    displayName: '한맥 (HANMAC)',
    maxHp: 2,
    speedMps: 2.0,
    hitRadiusM: 0.95,
    killBonusScore: 90,
    brandColorHex: '#047857',
    accentColorHex: '#d4af37',
    isAirborne: false,
    modelScale: 1.9,
  },
  bottle: {
    kind: 'bottle',
    displayName: '카스 프레시 병맥주 (Cass Fresh Bottle)',
    maxHp: 3,
    speedMps: 1.5,
    hitRadiusM: 1.15,
    killBonusScore: 160,
    brandColorHex: '#004b91',
    accentColorHex: '#e2e8f0',
    isAirborne: false,
    modelScale: 1.95,
  },
  boss: {
    kind: 'boss',
    displayName: '업소용 생맥주 냉각기 보스',
    maxHp: 40,
    speedMps: 0.85,
    hitRadiusM: 2.10,
    killBonusScore: 1500,
    brandColorHex: '#111827',
    accentColorHex: '#f59e0b',
    isAirborne: false,
    modelScale: 1.65,
  },
};

export const ITEM_BUFF_SPECS: Record<ItemBuffKind, ItemBuffSpec> = {
  power_shot: {
    kind: 'power_shot',
    displayName: '파워 샷 (황금 병따개)',
    shortLabel: 'POWER 2X',
    icon: '💥',
    durationMs: 8000,
    auraColorHex: '#ef4444',
    description: '8초간 사격 데미지 2배 증폭',
  },
  wide_scope: {
    kind: 'wide_scope',
    displayName: '빅 스코프 (맥주 코스터)',
    shortLabel: 'WIDE 1.6X',
    icon: '🎯',
    durationMs: 8000,
    auraColorHex: '#38bdf8',
    description: '8초간 조준경 및 명중 반경 1.6배 확대',
  },
  ice_freeze: {
    kind: 'ice_freeze',
    displayName: '아이스 프리즈 (얼음 버킷)',
    shortLabel: 'FREEZE 50%',
    icon: '🧊',
    durationMs: 8000,
    auraColorHex: '#60a5fa',
    description: '8초간 모든 몬스터 이동 속도 50% 감속',
  },
  bar_repair: {
    kind: 'bar_repair',
    displayName: '바 수리 (홉 열매 다발)',
    shortLabel: 'LIFE +1',
    icon: '🍺',
    durationMs: 0,
    auraColorHex: '#10b981',
    description: '바 방어선 체력 즉시 +1 회복 (최대 5)',
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
    maxErrorRatio: 0.25,
    baseScore: 150,
    feverDelta: 30,
    colorHex: '#fbbf24',
  },
  GREAT: {
    maxErrorRatio: 0.55,
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
  SNAP_ACCEL_THRESHOLD_MPS2: 4.8,
  FEVER_AUTO_FIRE_INTERVAL_MS: 95,
} as const;

export const STAGE_CONSTANTS = {
  SPAWN_RADIUS_M: 24.0,
  DEFENSE_LINE_RADIUS_M: 1.8,
  CAMERA_FOV_DEG: 52,
  FAN_MARGIN_RATIO: 0.92,
  PLAYER_MAX_LIVES: 5,
  TOTAL_WAVES: 5,
  ITEM_DURATION_MS: 8000,
} as const;
