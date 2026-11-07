import type { BeerCrusherEngine } from '../engine/BeerCrusherEngine';
import type { PlayerIndex } from '../engine/PlayerCombatState';
import type { GamePhase, TargetKind, WeaponKind, WeaponLevel } from '../../shared/types';

export interface BeerDebugTarget {
  id: string;
  kind: TargetKind;
  hp: number;
  maxHp: number;
  radiusM: number;
  aimX: number;
  aimY: number; // engine.computeTargetAimCoords(t, 1, ownerIndex ?? 0)의 targetNormX/Y
  hitRadius: number; // apparentHitRadius
  isItem: boolean;
  isProjectile: boolean;
  isGoldenCan: boolean;
  isGuarding: boolean;
  landed: boolean;
  selectKind: 'weapon' | 'card' | null;
  selectValue: string | null;
  ownerIndex: number | null;
}

export interface BeerDebugSnapshot {
  phase: GamePhase;
  wave: number;
  lives: number;
  isPaused: boolean;
  selection: { kind: 'weapon' | 'card' | null; done: boolean[] };
  players: {
    index: number;
    score: number;
    ammo: number;
    maxAmmo: number;
    isReloading: boolean;
    isFeverReady: boolean;
    isFeverActive: boolean;
    skillStock: number;
    weaponKind: WeaponKind;
    weaponLevel: WeaponLevel;
    isAway: boolean;
  }[];
  targets: BeerDebugTarget[];
}

export function buildDebugSnapshot(
  engine: BeerCrusherEngine,
  phase: GamePhase,
  nowMs: number
): BeerDebugSnapshot {
  const selectionStatus = engine.getSelectionStatus();

  const players = engine.players.map((p, idx) => {
    const pIdx = idx as PlayerIndex;
    const scoreState = p.scoreManager.getState();
    const weaponState = p.weaponSystem.getState();
    return {
      index: pIdx,
      score: scoreState.totalScore,
      ammo: weaponState.ammo,
      maxAmmo: weaponState.maxAmmo,
      isReloading: weaponState.isReloading,
      isFeverReady: scoreState.isFeverReady,
      isFeverActive: scoreState.isFeverActive,
      skillStock: weaponState.skillStock,
      weaponKind: weaponState.weaponKind,
      weaponLevel: weaponState.weaponLevel,
      isAway: Boolean(p.isAway),
    };
  });

  const targets: BeerDebugTarget[] = engine.activeTargets.map((t) => {
    const ownerIdx = (t.ownerIndex ?? 0) as PlayerIndex;
    const proj = engine.computeTargetAimCoords(t, 1.0, ownerIdx);

    let selectKind: 'weapon' | 'card' | null = null;
    let selectValue: string | null = null;
    if (t.weaponSelectKind) {
      selectKind = 'weapon';
      selectValue = t.weaponSelectKind;
    } else if (t.rewardCardKind) {
      selectKind = 'card';
      selectValue = t.rewardCardKind;
    }

    return {
      id: t.id,
      kind: t.kind,
      hp: t.hp,
      maxHp: t.maxHp,
      radiusM: t.radiusM,
      aimX: proj.targetNormX,
      aimY: proj.targetNormY,
      hitRadius: proj.apparentHitRadius,
      isItem: Boolean(t.isItem),
      isProjectile: Boolean(t.isProjectile),
      isGoldenCan: Boolean(t.isGoldenCan),
      isGuarding: Boolean(t.isGuarding),
      landed: engine.isTargetLanded(t, nowMs),
      selectKind,
      selectValue,
      ownerIndex: t.ownerIndex !== undefined ? t.ownerIndex : null,
    };
  });

  return {
    phase,
    wave: engine.currentWave,
    lives: engine.lives,
    isPaused: Boolean(engine.isPaused),
    selection: {
      kind: selectionStatus.kind,
      done: [...selectionStatus.done],
    },
    players,
    targets,
  };
}
