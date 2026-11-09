import type { ActiveTargetEntity, SkillExecuteResult } from './BeerCrusherEngine';
import type { PlayerIndex } from './PlayerCombatState';

export type EngineEvent =
  | { type: 'targetKilled'; target: ActiveTargetEntity; playerIndex: PlayerIndex; nowMs: number }
  | { type: 'targetBreached'; target: ActiveTargetEntity; nowMs: number }
  | { type: 'skillUsed'; playerIndex: PlayerIndex; result: SkillExecuteResult; nowMs: number }
  | { type: 'plungerBlasted'; playerIndex: PlayerIndex; target: ActiveTargetEntity; killed: boolean; nowMs: number }
  | { type: 'feverStarted'; playerIndex: PlayerIndex; nowMs: number }
  | { type: 'feverEnded'; playerIndex: PlayerIndex; nowMs: number };

export type EngineEventListener = (e: EngineEvent) => void;
