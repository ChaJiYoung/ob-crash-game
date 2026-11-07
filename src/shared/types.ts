export type TargetKind = 'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'bottle' | 'boss';
export type ItemBuffKind = 'power_shot' | 'wide_scope' | 'ice_freeze' | 'bar_repair';
export type JudgmentGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export type GamePhase = 'PAIRING' | 'ZEROING' | 'PLAYING' | 'TUTORIAL' | 'SANDBOX' | 'GAMEOVER' | 'VICTORY';

export type WeaponKind = 'shotgun' | 'revolver' | 'gatling';
export type WeaponLevel = 1 | 2 | 3 | 4;
export type RewardCardKind =
  | 'weapon_level_up'
  | 'rapid_reload'
  | 'bar_repair'
  | 'fever_boost'
  | 'lucky_drop'
  | 'damage_up'
  | 'skill_cooldown'
  | 'fever_extend'
  | 'hit_zone_up';

export interface WeaponLevelSpec {
  level: WeaponLevel;
  damagePerHit: number;
  pelletCount: number;
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
  skillFoamCount: number;
  skillBladeCount: number;
  skillBladePierce: number;
  skillPlungerCount: number;
  skillCooldownMs: number;
  maxSkillStock: number;
}

/** 발사 입력 종류: 새로 누름 / 누른 채 연사 / 피버 자동 발사. */
export type ShotSource = 'press' | 'hold' | 'fever';

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
  /** 3D 카드에 두 줄로 표시하는 문구(\n 포함). */
  cardSubtitleKo: string;
  icon: string;
}

export type TutorialStep = 1 | 2 | 3 | 4 | 'COMPLETED';

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

/** 서버·프로토콜의 플레이어 자리. 엔진의 PlayerIndex(0|1)와 slot - 1로 변환한다. */
export type PlayerSlot = 1 | 2;
export type PlayMode = 'solo' | 'coop';

export interface CoopRunInfo {
  slot: PlayerSlot;
  /** 1P + 2P 최종 점수 합. */
  teamScore: number;
  partnerScore: number;
  /** PC 페이지가 채운다. 마우스 파트너도 D15 기기 ID가 있다. */
  partnerDeviceId: string;
  partnerNickname: string;
  /** 판이 끝날 때 이 플레이어가 이탈 상태였는가(D20). */
  leftEarly: boolean;
}

/** 끝난 한 판의 통계. 서버가 data/play-records.jsonl에 저장한다. */
export interface PlayRunStats {
  outcome: 'GAMEOVER' | 'VICTORY';
  waveReached: number;
  livesLeft: number;
  durationSec: number;
  totalScore: number;
  baseScore: number;
  timeBonus: number;
  precisionBonus: number;
  levelBonus: number;
  maxCombo: number;
  kills: number;
  /** 이 필드들이 없는 옛 기록도 유효하다. */
  damageTaken?: number;
  healedLives?: number;
  itemsCollected?: number;
  waves: { wave: number; seconds: number; bonus: number }[];
  shots: { PERFECT: number; GREAT: number; GOOD: number; MISS: number };
  /** 0..1 */
  accuracy: number;
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  cardStacks: { damage_up: number; skill_cooldown: number; fever_extend: number; hit_zone_up: number };
  /** 없으면 'solo'. */
  mode?: PlayMode;
  coop?: CoopRunInfo;
}

/** 랭킹 한 줄(판 단위). 같은 사람이 여러 줄 나올 수 있다. */
export interface RunRankingEntry {
  deviceId: string;
  nickname: string;
  score: number;
  waveReached: number;
  weaponKind: WeaponKind;
  playedAt: string;
}

export interface CoopBestEntry {
  partnerDeviceId: string;
  partnerNickname: string;
  teamScore: number;
  myScore: number;
  partnerScore: number;
  waveReached: number;
  playedAt: string;
}

export interface PlayerProfile {
  deviceId: string;
  nickname: string;
  bestScore: number;
  totalGames: number;
  lastPlayedAt: string;
  /** 파트너 기기 ID별 2인팟 팀 합계 최고 기록(D18). 옛 프로필엔 없다. */
  coopBests?: Record<string, CoopBestEntry>;
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
  | { type: 'DEVICE_CHECK'; roomId: string; deviceId: string; slot?: PlayerSlot }
  | { type: 'REGISTER_NICKNAME'; roomId: string; deviceId: string; nickname: string; slot?: PlayerSlot }
  | { type: 'CALIBRATE_ZERO'; roomId: string; deviceId: string; resume?: boolean; slot?: PlayerSlot }
  | { type: 'START_GAME_REQUEST'; roomId: string; deviceId: string; slot?: PlayerSlot }
  | { type: 'SENSOR_FRAME'; roomId: string; deviceId: string; payload: SensorFramePayload; slot?: PlayerSlot }
  | { type: 'FEVER_STATUS_SYNC'; roomId: string; isFeverReady: boolean; slot?: PlayerSlot }
  | {
      type: 'SKILL_STATE_SYNC';
      roomId: string;
      weaponKind: WeaponKind;
      weaponLevel: WeaponLevel;
      skillStock: number;
      maxSkillStock: number;
      skillCooldownRemainingMs: number;
      skillCooldownTotalMs: number;
      slot?: PlayerSlot;
    }
  /** rulesetVersion: 클라이언트 빌드의 RANKING_RULESET_VERSION. 서버와 다르면 점수를 기록하지 않는다(옛 빌드가 새 랭킹을 오염시키지 않게). */
  | { type: 'GAME_SCORE_SUBMIT'; roomId: string; deviceId: string; score: number; waveReached: number; maxCombo: number; stats?: PlayRunStats; rulesetVersion: number; mode?: PlayMode }
  | { type: 'REGISTER_LOCAL_PLAYER'; roomId: string; deviceId: string; nickname: string; slot: PlayerSlot }
  | {
      type: 'SENSOR_CONFIG_UPDATE';
      roomId: string;
      deviceId?: string;
      config: Record<string, any>;
    };

export type ServerToClientMessage =
  | { type: 'ROOM_CREATED'; roomId: string; rankings: RunRankingEntry[]; lanIp?: string }
  | { type: 'AUTH_RESULT'; roomId: string; isNewUser: boolean; player?: PlayerProfile; rankings: RunRankingEntry[] }
  | { type: 'CONTROLLER_PAIRED'; roomId: string; player: PlayerProfile; slot: PlayerSlot }
  | { type: 'LOCAL_PLAYER_REGISTERED'; roomId: string; slot: PlayerSlot; player: PlayerProfile }
  | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string; resume?: boolean; slot: PlayerSlot }
  | { type: 'GAME_COUNTDOWN_START'; roomId: string; sec: number }
  | { type: 'GAME_STARTED'; roomId: string }
  | { type: 'GAME_START_RELAY'; roomId: string; deviceId: string; slot: PlayerSlot }
  | { type: 'SENSOR_RELAY'; roomId: string; deviceId: string; payload: SensorFramePayload; slot: PlayerSlot }
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
  | { type: 'RANKING_UPDATED'; rankings: RunRankingEntry[]; updatedPlayer?: PlayerProfile }
  | { type: 'ERROR'; code: string; message: string; slot?: PlayerSlot };
