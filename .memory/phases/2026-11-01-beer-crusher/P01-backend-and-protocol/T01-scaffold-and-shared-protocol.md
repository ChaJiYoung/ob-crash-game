# Task: T01 프로젝트 스캐폴딩 및 공유 프로토콜·상수 정의

## Status: done

## Goal
React 18 + Three.js + TypeScript + Vite(로컬 HTTPS `@vitejs/plugin-basic-ssl`) + Node.js `ws` 개발 환경을 세팅하고, PC 디스플레이·모바일 컨트롤러·WebSocket 서버가 공유할 6종 타겟 스펙(`D02`), 3단계 판정 및 피버 100% 잠금 상수(`D06`), 부채꼴 스폰 파라미터(`D07`), WebSocket 양방향 메시지 스키마(`D08`, `D09`)를 `src/shared/*`에 구현합니다.

## Decision Summary
- **D01**: React 18 + Three.js + TypeScript + Vite (`@vitejs/plugin-basic-ssl`로 로컬 HTTPS 활성화하여 모바일 센서 보안 컨텍스트 충족)
- **D02/D06/D07/D08/D09**: 6종 타겟(`pilgood`, `caslight`, `obi`, `hanmac`, `mug`, `boss`), 3단계 판정(`PERFECT`/`GREAT`/`GOOD`) + 피버 100% 완충 잠금, 부채꼴 스폰 반경(`28m` -> `1.8m`), `deviceId` 인증 및 권총 그립 센서 패킷 스키마 고정

## Implementation

### I01. 패키지·빌드·로컬 HTTPS 설정 및 공유 프로토콜/상수 정의
- Related Files:
  - `package.json` :: `scripts`, `dependencies`, `devDependencies` — 프로젝트 의존성 및 실행 스크립트 정의; new
  - `tsconfig.json` :: `compilerOptions` — TypeScript strict 컴파일 설정; new
  - `vite.config.ts` :: `default` — `@vitejs/plugin-react`, `@vitejs/plugin-basic-ssl`, `/ws` WebSocket 프록시 설정; new
  - `src/shared/types.ts` :: `TargetKind`, `JudgmentGrade`, `PlayerProfile`, `ClientToServerMessage`, `ServerToClientMessage` — 공유 타입 및 메시지 유니온 정의; new
  - `src/shared/constants.ts` :: `TARGET_SPECS`, `JUDGMENT_SPECS`, `FEVER_CONSTANTS`, `WEAPON_CONSTANTS`, `STAGE_CONSTANTS` — 공유 상수 테이블 정의; new

#### Details
- **Signatures & Types (`src/shared/types.ts`)**:
  ```typescript
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
    | { type: 'ROOM_CREATED'; roomId: string; rankings: PlayerProfile[] }
    | { type: 'AUTH_RESULT'; roomId: string; isNewUser: boolean; player?: PlayerProfile; rankings: PlayerProfile[] }
    | { type: 'CONTROLLER_PAIRED'; roomId: string; player: PlayerProfile }
    | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string }
    | { type: 'SENSOR_RELAY'; roomId: string; deviceId: string; payload: SensorFramePayload }
    | { type: 'RANKING_UPDATED'; rankings: PlayerProfile[]; updatedPlayer?: PlayerProfile }
    | { type: 'ERROR'; code: string; message: string };
  ```
- **Data & Schema Fields (`src/shared/constants.ts`)**:
  - `TARGET_SPECS: Record<TargetKind, TargetSpec>`:
    - `pilgood`: `{ kind: 'pilgood', displayName: '필굿 (FiLGOOD)', maxHp: 1, speedMps: 4.5, hitRadiusM: 0.55, killBonusScore: 30, brandColorHex: '#00a8e8', accentColorHex: '#ffd100' }`
    - `caslight`: `{ kind: 'caslight', displayName: '카스 라이트 (Cass Light)', maxHp: 1, speedMps: 3.8, hitRadiusM: 0.58, killBonusScore: 40, brandColorHex: '#38bdf8', accentColorHex: '#e2e8f0' }`
    - `obi`: `{ kind: 'obi', displayName: '오비 라거 (OB Lager)', maxHp: 2, speedMps: 3.1, hitRadiusM: 0.65, killBonusScore: 70, brandColorHex: '#f59e0b', accentColorHex: '#b91c1c' }`
    - `hanmac`: `{ kind: 'hanmac', displayName: '한맥 (HANMAC)', maxHp: 2, speedMps: 3.3, hitRadiusM: 0.65, killBonusScore: 90, brandColorHex: '#047857', accentColorHex: '#d4af37' }`
    - `mug`: `{ kind: 'mug', displayName: '500ml 생맥주잔 (Draft Mug)', maxHp: 3, speedMps: 2.4, hitRadiusM: 0.80, killBonusScore: 160, brandColorHex: '#fbbf24', accentColorHex: '#ffffff' }`
    - `boss`: `{ kind: 'boss', displayName: '업소용 생맥주 냉각기 보스', maxHp: 30, speedMps: 1.15, hitRadiusM: 1.55, killBonusScore: 1500, brandColorHex: '#111827', accentColorHex: '#f59e0b' }`
  - `JUDGMENT_SPECS`:
    - `PERFECT`: `{ maxErrorRatio: 0.15, baseScore: 150, feverDelta: 30, colorHex: '#fbbf24' }`
    - `GREAT`: `{ maxErrorRatio: 0.45, baseScore: 100, feverDelta: 20, colorHex: '#38bdf8' }`
    - `GOOD`: `{ maxErrorRatio: 1.00, baseScore: 50, feverDelta: 10, colorHex: '#4ade80' }`
  - `FEVER_CONSTANTS`: `{ MAX_GAUGE: 100, MISS_PENALTY: 5, DURATION_MS: 6000, LOCK_WHEN_FULL: true }`
  - `WEAPON_CONSTANTS`: `{ MAX_AMMO: 10, AUTO_RELOAD_MS: 1200, RAPID_FIRE_HOLD_MS: 250, RAPID_FIRE_INTERVAL_MS: 115, FEVER_DOUBLE_TAP_MS: 300, SNAP_ACCEL_THRESHOLD_MPS2: 12.0 }`
  - `STAGE_CONSTANTS`: `{ SPAWN_RADIUS_M: 28.0, DEFENSE_LINE_RADIUS_M: 1.8, CAMERA_FOV_DEG: 52, FAN_MARGIN_RATIO: 0.92, PLAYER_MAX_LIVES: 3 }`

### I02. 공유 스키마 및 상수 무결성 단위 테스트
- Related Files:
  - `tests/shared-protocol.test.ts` :: `describe('Shared Protocol & Constants')` — 6종 타겟 스펙, 판정 상수, 피버 100% 잠금 상수 검증; new

#### Details
- 6종 타겟(`pilgood`, `caslight`, `obi`, `hanmac`, `mug`, `boss`)의 체력·속도·반경·보너스 점수가 설계서(`D02`)와 정확히 일치하는지 검증.
- `JUDGMENT_SPECS`의 `PERFECT`(`0.15`, `150점`, `+30`), `GREAT`(`0.45`, `100점`, `+20`), `GOOD`(`1.00`, `50점`, `+10`) 수치 검증.

## Acceptance Criteria
- [ ] `npm install` 후 `package.json`, `tsconfig.json`, `vite.config.ts`가 오류 없이 구성됨
- [ ] `src/shared/types.ts`와 `src/shared/constants.ts`에 모든 공유 타입 및 상수가 누락 없이 정의됨
- [ ] `npx vitest run tests/shared-protocol.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/shared-protocol.test.ts` — 6종 타겟 스펙 및 판정·피버·무기·스테이지 상수 검증 통과

## Commit Message
```text
feat(shared): scaffold project and define shared protocol types and constants

Plan: 2026-11-01-beer-crusher
Phase: P01-backend-and-protocol
Task: T01-scaffold-and-shared-protocol

- Configure package.json, tsconfig.json, and Vite with @vitejs/plugin-basic-ssl
- Define 6 target specs, 3-tier judgment constants, fever lock rules, and WebSocket message schemas
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
