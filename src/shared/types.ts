export type TargetKind = 'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'bottle' | 'boss';
export type ItemBuffKind = 'power_shot' | 'wide_scope' | 'ice_freeze' | 'bar_repair';
export type JudgmentGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export type GamePhase = 'PAIRING' | 'ZEROING' | 'PLAYING' | 'TUTORIAL' | 'SANDBOX' | 'GAMEOVER' | 'VICTORY';

export type WeaponKind = 'shotgun' | 'revolver' | 'gatling';
export type WeaponLevel = 1 | 2 | 3 | 4;
export type RewardCardKind = 'weapon_level_up' | 'rapid_reload' | 'bar_repair' | 'fever_boost' | 'lucky_drop';

export interface WeaponLevelSpec {
  level: WeaponLevel;
  damagePerHit: number;
  pelletCount: number;
  spreadRad: number;
  pierceCount: number;
  pierceDamageRatio: number;
  knockbackM: number;
  slowDurationMs: number;
  maxAmmo: number;
  reloadDurationMs: number;
  fireIntervalMs: number;
  skillNameKo: string;
  skillDamage: number;
  skillBossDamage: number;
  skillStunMs: number;
  skillSlowRatio: number;
  skillSlowMs: number;
  skillKnockbackM: number;
  skillArcDeg: number;
  skillPlungerCount: number;
  skillCooldownMs: number;
  maxSkillStock: number;
}

export interface WeaponArchetypeSpec {
  kind: WeaponKind;
  nameKo: string;
  badgeIcon: string;
  accentColorHex: string;
  descriptionKo: string;
  levels: Record<WeaponLevel, WeaponLevelSpec>;
}

export interface RewardCardSpec {
  kind: RewardCardKind;
  nameKo: string;
  badgeText: string;
  colorHex: string;
  descriptionKo: string;
}

export type TutorialStep = 1 | 2 | 3 | 'COMPLETED';

export interface TutorialState {
  step: TutorialStep;
  targetsRemaining: number;
  guideMessage: string;
  isFeverTriggered: boolean;
}

export interface TargetSpec {
  kind: TargetKind;
  displayName: string;
  maxHp: number;
  speedMps: number;
  hitRadiusM: number;
  killBonusScore: number;
  brandColorHex: string;
  accentColorHex: string;
  isAirborne?: boolean;
  modelScale?: number;
}

export interface ItemBuffSpec {
  kind: ItemBuffKind;
  displayName: string;
  shortLabel: string;
  icon: string;
  durationMs: number;
  auraColorHex: string;
  description: string;
}

export interface ActiveBuffState {
  kind: ItemBuffKind;
  remainingMs: number;
  totalDurationMs: number;
}

export interface PlayerProfile {
  deviceId: string;
  nickname: string;
  bestScore: number;
  totalGames: number;
  lastPlayedAt: string;
}

export interface SensorFramePayload {
  aimX: number; // -1.0 ~ +1.0 (정면 영점 대비 수평 조준)
  aimY: number; // -1.0 ~ +1.0 (정면 영점 대비 수직 조준)
  rawAimX?: number; // 필터링 이전 원시 조준 좌표 (-1.0 ~ 1.0)
  rawAimY?: number; // 필터링 이전 원시 조준 좌표 (-1.0 ~ 1.0)
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
  snapFire: boolean; // +X축 상단 스냅 단발 사격 트리거
  rapidFireHold: boolean; // 85% 통합 패드 0.25s 홀드 연사 상태
  feverTriggered: boolean; // 85% 통합 패드 0.3s 더블탭 피버 발동 트리거
  isCocked: boolean; // 화면 터치 홀드로 코킹(장전) 및 조준 고정 상태 여부
  skillSnapTriggered?: boolean; // 상단 '휙!(Snap)' 가속도 제스처 액티브 스킬 트리거
  timestamp: number;
}

export type ClientToServerMessage =
  | { type: 'CREATE_ROOM'; roomId?: string }
  | { type: 'DEVICE_CHECK'; roomId: string; deviceId: string }
  | { type: 'REGISTER_NICKNAME'; roomId: string; deviceId: string; nickname: string }
  | { type: 'CALIBRATE_ZERO'; roomId: string; deviceId: string }
  | { type: 'START_GAME_REQUEST'; roomId: string; deviceId: string }
  | { type: 'SENSOR_FRAME'; roomId: string; deviceId: string; payload: SensorFramePayload }
  | { type: 'FEVER_STATUS_SYNC'; roomId: string; isFeverReady: boolean }
  | {
      type: 'SKILL_STATE_SYNC';
      roomId: string;
      weaponKind: WeaponKind;
      weaponLevel: WeaponLevel;
      skillStock: number;
      maxSkillStock: number;
      skillCooldownRemainingMs: number;
      skillCooldownTotalMs: number;
    }
  | { type: 'GAME_SCORE_SUBMIT'; roomId: string; deviceId: string; score: number; waveReached: number; maxCombo: number }
  | {
      type: 'SENSOR_CONFIG_UPDATE';
      roomId: string;
      deviceId?: string;
      config: Record<string, any>;
    };

export type ServerToClientMessage =
  | { type: 'ROOM_CREATED'; roomId: string; rankings: PlayerProfile[]; lanIp?: string }
  | { type: 'AUTH_RESULT'; roomId: string; isNewUser: boolean; player?: PlayerProfile; rankings: PlayerProfile[] }
  | { type: 'CONTROLLER_PAIRED'; roomId: string; player: PlayerProfile }
  | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string }
  | { type: 'GAME_COUNTDOWN_START'; roomId: string; sec: number }
  | { type: 'GAME_STARTED'; roomId: string }
  | { type: 'GAME_START_RELAY'; roomId: string; deviceId: string }
  | { type: 'SENSOR_RELAY'; roomId: string; deviceId: string; payload: SensorFramePayload }
  | { type: 'FEVER_STATUS_RELAY'; roomId: string; isFeverReady: boolean }
  | {
      type: 'SKILL_STATE_SYNC';
      roomId?: string;
      weaponKind: WeaponKind;
      weaponLevel: WeaponLevel;
      skillStock: number;
      maxSkillStock: number;
      skillCooldownRemainingMs: number;
      skillCooldownTotalMs: number;
    }
  | {
      type: 'SENSOR_CONFIG_UPDATE';
      roomId: string;
      config: Record<string, any>;
    }
  | { type: 'RANKING_UPDATED'; rankings: PlayerProfile[]; updatedPlayer?: PlayerProfile }
  | { type: 'ERROR'; code: string; message: string };
