export type TargetKind = 'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'mug' | 'boss';
export type JudgmentGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export type GamePhase = 'PAIRING' | 'ZEROING' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';

export interface TargetSpec {
  kind: TargetKind;
  displayName: string;
  maxHp: number;
  speedMps: number;
  hitRadiusM: number;
  killBonusScore: number;
  brandColorHex: string;
  accentColorHex: string;
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
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
  snapFire: boolean; // +X축 상단 스냅 단발 사격 트리거
  rapidFireHold: boolean; // 85% 통합 패드 0.25s 홀드 연사 상태
  feverTriggered: boolean; // 85% 통합 패드 0.3s 더블탭 피버 발동 트리거
  timestamp: number;
}

export type ClientToServerMessage =
  | { type: 'CREATE_ROOM'; roomId?: string }
  | { type: 'DEVICE_CHECK'; roomId: string; deviceId: string }
  | { type: 'REGISTER_NICKNAME'; roomId: string; deviceId: string; nickname: string }
  | { type: 'CALIBRATE_ZERO'; roomId: string; deviceId: string }
  | { type: 'SENSOR_FRAME'; roomId: string; deviceId: string; payload: SensorFramePayload }
  | { type: 'GAME_SCORE_SUBMIT'; roomId: string; deviceId: string; score: number; waveReached: number; maxCombo: number };

export type ServerToClientMessage =
  | { type: 'ROOM_CREATED'; roomId: string; rankings: PlayerProfile[]; lanIp?: string }
  | { type: 'AUTH_RESULT'; roomId: string; isNewUser: boolean; player?: PlayerProfile; rankings: PlayerProfile[] }
  | { type: 'CONTROLLER_PAIRED'; roomId: string; player: PlayerProfile }
  | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string }
  | { type: 'SENSOR_RELAY'; roomId: string; deviceId: string; payload: SensorFramePayload }
  | { type: 'RANKING_UPDATED'; rankings: PlayerProfile[]; updatedPlayer?: PlayerProfile }
  | { type: 'ERROR'; code: string; message: string };
