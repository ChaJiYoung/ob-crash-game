import { GAME_TUNING } from '../shared/gameTuning';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { BeerCrusherEngine, EngineShootResult } from './engine/BeerCrusherEngine';
import { GameCanvas3D, GameCanvas3DHandle, RenderPerformanceMetrics } from './components/GameCanvas3D';
import { ArcadeOverlayHUD, MonsterHudProjection } from './components/ArcadeOverlayHUD';
import { MonsterHpBarLayer, MonsterHpBarLayerHandle } from './components/MonsterHpBarLayer';
import { HudSnapshot, buildHudSnapshot, isHudSnapshotEqual } from './hudSnapshot';
import { CrosshairOverlay, CrosshairOverlayHandle } from './components/CrosshairOverlay';
import { JudgmentBanner, JudgmentBannerHandle } from './components/JudgmentBanner';
import { QRPairingModal } from './components/QRPairingModal';
import { ResultRankingModal } from './components/ResultRankingModal';
import { GuideModal } from './components/GuideModal';
import { TutorialGuideOverlay } from './components/TutorialGuideOverlay';
import { SensorAndModuleTestLabOverlay, SensorDiagnosticsState } from './components/SensorAndModuleTestLabOverlay';
import {
  MobileSensorLabModal,
  loadSavedTuningConfig,
  saveTuningConfig,
  SensorLiveMetrics,
  SensorTuningConfig,
} from './components/MobileSensorLabModal';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { ActiveBuffState, GamePhase, JudgmentGrade, PlayerProfile, ServerToClientMessage, WeaponKind, WeaponLevel } from '../shared/types';
import { STAGE_CONSTANTS, WEAPON_CONSTANTS } from '../shared/constants';
import { RANKING_RULESET_VERSION } from '../shared/gameTuning';

export interface PCGamePageProps {
  initialPhase?: GamePhase;
}

export const PCGamePage: React.FC<PCGamePageProps> = ({ initialPhase }) => {
  const engine = useMemo(() => new BeerCrusherEngine(), []);
  if (typeof window !== 'undefined') {
    (window as any).__engine = engine;
  }
  const soundSynth = useMemo(() => new SoundSynthesizer(), []);

  const [gamePhase, setGamePhase] = useState<GamePhase>(initialPhase ?? 'PAIRING');
  const gamePhaseRef = useRef<GamePhase>(gamePhase);
  gamePhaseRef.current = gamePhase;
  const [roomId, setRoomId] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [pairedPlayer, setPairedPlayer] = useState<PlayerProfile | undefined>();
  const [topRankings, setTopRankings] = useState<PlayerProfile[]>([]);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSensorLabOpen, setIsSensorLabOpen] = useState<boolean>(false);
  const isSensorLabOpenRef = useRef<boolean>(isSensorLabOpen);
  isSensorLabOpenRef.current = isSensorLabOpen;
  const skillGraceUntilRef = useRef<number>(0);
  const [tuningConfig, setTuningConfig] = useState<SensorTuningConfig>(() => loadSavedTuningConfig());
  const tuningConfigRef = useRef<SensorTuningConfig>(tuningConfig);
  tuningConfigRef.current = tuningConfig;

  const recentRawSamplesRef = useRef<{ x: number; y: number }[]>([]);
  const [sensorLiveMetrics, setSensorLiveMetrics] = useState<SensorLiveMetrics>({
    rawAimX: 0,
    rawAimY: 0,
    aimX: 0,
    aimY: 0,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    packetHz: 0,
    jitterRms: 0,
  });
  const [isZeroCalibrated, setIsZeroCalibrated] = useState<boolean>(false);
  const [isAimLocked, setIsAimLocked] = useState<boolean>(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [diagnostics, setDiagnostics] = useState<SensorDiagnosticsState>({
    aimX: 0,
    aimY: 0,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    sensitivityX: 1.0,
    sensitivityY: 1.0,
    invertY: false,
    rapidFireHold: false,
    packetHz: 0,
  });
  const [stationarySpawn, setStationarySpawn] = useState<boolean>(true);
  const [sandboxInfiniteAmmo, setSandboxInfiniteAmmo] = useState<boolean>(false);
  const packetCountRef = useRef(0);
  const lastPacketTimeRef = useRef(performance.now());
  const zeroOffsetRef = useRef({ offsetX: 0, offsetY: 0 });
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;

  useEffect(() => {
    if (initialPhase === 'SANDBOX') {
      engine.startSandboxMode();
    }
  }, [initialPhase, engine]);

  const canvasRef = useRef<GameCanvas3DHandle>(null);
  const crosshairRef = useRef<CrosshairOverlayHandle>(null);
  // Read once by the reload ring when it mounts, so it can skip the part of the reload already elapsed.
  const getReloadRemainingMs = useCallback(
    () => Math.max(0, engine.weaponSystem.getState().reloadEndTimeMs - performance.now()),
    [engine]
  );

  const judgmentRef = useRef<JudgmentBannerHandle>(null);
  const hpLayerRef = useRef<MonsterHpBarLayerHandle>(null);
  // Only the sandbox lab panel displays the last judgment; other phases use the imperative banner.
  const [sandboxJudgment, setSandboxJudgment] = useState<{ grade: JudgmentGrade; key: number }>({
    grade: 'GOOD',
    key: 0,
  });
  const [isGoldenCanAlertActive, setIsGoldenCanAlertActive] = useState<boolean>(false);
  const lastGoldenCanActiveRef = useRef<boolean>(false);
  const lastBossWarningRef = useRef<boolean>(false);

  // Snapshot for HUD: only replaced when a displayed value changes.
  const [hudState, setHudState] = useState<HudSnapshot>(() => buildHudSnapshot(engine, performance.now()));

  const playerHitFlashRef = useRef<HTMLDivElement>(null);
  // A ref animation: a hit must not re-render the page, and a stable callback keeps the memoized canvas untouched.
  const handlePlayerHit = useCallback(() => {
    soundSynth.playPlayerHitSound();
    playerHitFlashRef.current?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-out' });
  }, [soundSynth]);

  const handleProjections = useCallback((projections: MonsterHudProjection[]) => {
    hpLayerRef.current?.update(projections);
  }, []);

  const handleAimChange = useCallback(
    (x: number, y: number) => {
      updateAimDirect(x, y, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const wsRef = useRef<WebSocket | null>(null);
  const rapidFireTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feverAutoFireTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pairedPlayerRef = useRef<PlayerProfile | undefined>(undefined);
  pairedPlayerRef.current = pairedPlayer;

  const latestAimRef = useRef({ aimX: 0, aimY: 0 });
  const lastSentFeverReadyRef = useRef<boolean>(false);
  const lastSentSkillStockRef = useRef<number>(-1);
  const lastSkillSyncTimeRef = useRef<number>(0);
  const lastIsCockedRef = useRef<boolean>(false);
  const lastDiagUpdateTimeRef = useRef<number>(0);

  const [hoveredResultAction, setHoveredResultAction] = useState<'restart' | 'lobby' | null>(null);
  const hoveredResultActionRef = useRef<'restart' | 'lobby' | null>(null);
  const restartButtonRef = useRef<HTMLButtonElement | null>(null);
  const lobbyButtonRef = useRef<HTMLButtonElement | null>(null);

  const checkResultButtonHover = useCallback((aimX: number, aimY: number): 'restart' | 'lobby' | null => {
    if (typeof window === 'undefined') return null;
    const curPhase = gamePhaseRef.current;
    if (curPhase !== 'GAMEOVER' && curPhase !== 'VICTORY') return null;

    const screenX = ((aimX + 1) / 2) * window.innerWidth;
    const screenY = ((1 - aimY) / 2) * window.innerHeight;

    if (restartButtonRef.current) {
      const rect = restartButtonRef.current.getBoundingClientRect();
      if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
        return 'restart';
      }
    }

    if (lobbyButtonRef.current) {
      const rect = lobbyButtonRef.current.getBoundingClientRect();
      if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
        return 'lobby';
      }
    }

    return null;
  }, []);

  const updateAimDirect = useCallback((x: number, y: number, immediate = false) => {
    latestAimRef.current = { aimX: x, aimY: y };
    canvasRef.current?.setAim(x, y, immediate);
    crosshairRef.current?.updatePosition(x, y, immediate);
    const action = checkResultButtonHover(x, y);
    if (hoveredResultActionRef.current !== action) {
      hoveredResultActionRef.current = action;
      setHoveredResultAction(action);
    }
  }, [checkResultButtonHover]);

  const handleShootEvent = useCallback((result: EngineShootResult) => {
    if (!result.fired) return;
    const isFever = engine.scoreManager.getState().isFeverActive;
    const currentWeapon = result.weaponKind || engine.weaponSystem.getState().weaponKind;
    soundSynth.playWeaponShoot(currentWeapon, isFever);

    if (result.shieldBlocked) {
      // Blocked by an obi shield: only the "ting", no hit sound or judgment banner
      soundSynth.playShieldBlockSound();
    } else if (result.grade !== 'MISS') {
      soundSynth.playHit(result.grade);
      judgmentRef.current?.show(result.grade);
      if (gamePhaseRef.current === 'SANDBOX') {
        setSandboxJudgment({ grade: result.grade, key: Date.now() });
      }
    }

    if (result.interceptedProjectile) {
      soundSynth.playInterceptSound();
    }

    // Must run synchronously right after shootAt, before the render loop removes dead target meshes.
    canvasRef.current?.playShotFx(result);
    crosshairRef.current?.kick();
  }, [engine, soundSynth]);

  const executeSkill = useCallback(() => {
    const now = performance.now();
    const res = engine.triggerWeaponSkill(now);
    if (res.activated) {
      soundSynth.playSkillActivation(res.weaponKind);
      canvasRef.current?.triggerSkillEffect?.(res.weaponKind);
    }
  }, [engine, soundSynth]);

  // Keyboard 'R' & Mouse Right-Click Skill triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        executeSkill();
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      executeSkill();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [executeSkill]);

  // 1. WebSocket Setup (Isolated from pairedPlayer re-renders to prevent socket close loop)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      socket = new WebSocket(`${protocol}//${window.location.hostname}:8787`);
    }

    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMessage;
        switch (msg.type) {
          case 'ROOM_CREATED':
            setRoomId(msg.roomId);
            if (msg.rankings) setTopRankings(msg.rankings);
            if (msg.lanIp) setLanIp(msg.lanIp);
            break;

          case 'CONTROLLER_PAIRED':
            setPairedPlayer(msg.player);
            soundSynth.unlockAudio();
            break;

          case 'ZERO_CALIBRATED':
            setIsZeroCalibrated(true);
            zeroOffsetRef.current = { offsetX: 0, offsetY: 0 };
            if (gamePhaseRef.current === 'PAIRING') {
              setGamePhase('ZEROING');
            }
            break;

          case 'SENSOR_CONFIG_UPDATE':
            if (msg.config) {
              setTuningConfig((prev) => {
                const updated: SensorTuningConfig = { ...prev, ...msg.config };
                saveTuningConfig(updated);
                return updated;
              });
            }
            break;

          case 'GAME_COUNTDOWN_START':
          case 'GAME_START_RELAY':
            soundSynth.unlockAudio();
            if (gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING') {
              startCountdownAndGameRef.current();
            }
            break;

          case 'SENSOR_RELAY': {
            const p = msg.payload;
            packetCountRef.current += 1;
            const now = performance.now();
            const isDiagnosticsNeeded = isSensorLabOpenRef.current || gamePhaseRef.current === 'SANDBOX';

            if (isDiagnosticsNeeded && now - lastPacketTimeRef.current >= 1000) {
              setDiagnostics((prev) => ({
                ...prev,
                packetHz: packetCountRef.current,
              }));
              packetCountRef.current = 0;
              lastPacketTimeRef.current = now;
            } else if (!isDiagnosticsNeeded && now - lastPacketTimeRef.current >= 1000) {
              packetCountRef.current = 0;
              lastPacketTimeRef.current = now;
            }

            const curTuning = tuningConfigRef.current;
            const rawFromPayloadX = p.rawAimX ?? p.aimX;
            const rawFromPayloadY = p.rawAimY ?? p.aimY;

            let currentJitterRms = 0;
            if (isDiagnosticsNeeded) {
              // Rolling window of raw samples (up to 30) for jitter calculation
              recentRawSamplesRef.current.push({ x: rawFromPayloadX, y: rawFromPayloadY });
              if (recentRawSamplesRef.current.length > 30) {
                recentRawSamplesRef.current.shift();
              }

              const samples = recentRawSamplesRef.current;
              if (samples.length >= 2) {
                let sumSq = 0;
                for (let i = 1; i < samples.length; i++) {
                  const dx = samples[i].x - samples[i - 1].x;
                  const dy = samples[i].y - samples[i - 1].y;
                  sumSq += dx * dx + dy * dy;
                }
                currentJitterRms = Math.sqrt(sumSq / (samples.length - 1));
              }
            }

            const rawAimX = (p.aimX - zeroOffsetRef.current.offsetX) * curTuning.sensitivityX;
            const signedAimY = curTuning.invertY ? -p.aimY : p.aimY;
            const rawAimY = (signedAimY - zeroOffsetRef.current.offsetY) * curTuning.sensitivityY;
            const effectiveAimX = Math.max(-1, Math.min(1, rawAimX));
            const effectiveAimY = Math.max(-1, Math.min(1, rawAimY));

            const offsetRawX = Math.max(-1, Math.min(1, (rawFromPayloadX - zeroOffsetRef.current.offsetX) * curTuning.sensitivityX));
            const signedRawY = curTuning.invertY ? -rawFromPayloadY : rawFromPayloadY;
            const offsetRawY = Math.max(-1, Math.min(1, (signedRawY - zeroOffsetRef.current.offsetY) * curTuning.sensitivityY));

            updateAimDirect(effectiveAimX, effectiveAimY, false);

            if (isDiagnosticsNeeded && now - lastDiagUpdateTimeRef.current >= 60) {
              lastDiagUpdateTimeRef.current = now;
              setDiagnostics((prev) => ({
                ...prev,
                aimX: effectiveAimX,
                aimY: effectiveAimY,
                yawDeg: p.yawDeg,
                pitchDeg: p.pitchDeg,
                rollDeg: p.rollDeg,
                rapidFireHold: p.rapidFireHold,
                lastSnapFireAt: p.snapFire ? Date.now() : prev.lastSnapFireAt,
              }));

              setSensorLiveMetrics({
                rawAimX: offsetRawX,
                rawAimY: offsetRawY,
                aimX: effectiveAimX,
                aimY: effectiveAimY,
                yawDeg: p.yawDeg,
                pitchDeg: p.pitchDeg,
                rollDeg: p.rollDeg,
                packetHz: packetCountRef.current * 4 || 60,
                jitterRms: currentJitterRms,
                isCocked: p.isCocked,
                lastSnapAt: p.snapFire ? Date.now() : undefined,
              });
            }

            if (p.isCocked && !lastIsCockedRef.current) {
              soundSynth.playCocking();
            }
            lastIsCockedRef.current = !!p.isCocked;

            const isFever = engine.scoreManager.getState().isFeverActive;
            const aimLocked = Boolean(p.isCocked && !isFever && !p.rapidFireHold);
            setIsAimLocked(aimLocked);

            // A flick that picks a card must not also fire the skill in the same packet.
            const cardPendingBeforeShot = engine.isCardSelectPending;
            if (p.snapFire) {
              setIsAimLocked(false);
              const curPhase = gamePhaseRef.current;
              if (curPhase === 'PAIRING' || curPhase === 'ZEROING') {
                soundSynth.playShoot(false);
                // Shoot to start target hit when aiming at monitor center
                if (Math.abs(effectiveAimX) < 0.65 && Math.abs(effectiveAimY) < 0.65) {
                  soundSynth.playHit('PERFECT');
                  startCountdownAndGameRef.current();
                }
              } else if (curPhase === 'GAMEOVER' || curPhase === 'VICTORY') {
                soundSynth.playShoot(false);
                const action = checkResultButtonHover(effectiveAimX, effectiveAimY);
                if (action === 'restart') {
                  soundSynth.playHit('PERFECT');
                  handleStartGame();
                } else if (action === 'lobby') {
                  soundSynth.playHit('PERFECT');
                  handleReturnToLobby();
                } else {
                  soundSynth.playHit('MISS');
                }
              } else {
                const res = engine.shootAt(effectiveAimX, effectiveAimY, performance.now(), 'press');
                handleShootEvent(res);
              }
            }

            // Rapid fire hold using live aim coordinates (5ms polling interval to respect fast fire rates like gatling 58ms without quantization loss)
            if (p.rapidFireHold) {
              if (!rapidFireTimerRef.current) {
                rapidFireTimerRef.current = setInterval(() => {
                  const curAim = latestAimRef.current;
                  const res = engine.shootAt(curAim.aimX, curAim.aimY, performance.now(), 'hold');
                  if (res.fired) {
                    handleShootEvent(res);
                  }
                }, 5);
              }
            } else {
              if (rapidFireTimerRef.current) {
                clearInterval(rapidFireTimerRef.current);
                rapidFireTimerRef.current = null;
              }
            }

            if (p.feverTriggered) {
              const activated = engine.activateFever(performance.now());
              if (activated) {
                soundSynth.playFeverStart();
                if (engine.isTutorialMode && engine.tutorialStep === 3) {
                  engine.spawnTutorialStep3Enemies();
                }
              }
            }

            if (p.skillSnapTriggered) {
              const isPendingCard = cardPendingBeforeShot || engine.isCardSelectPending;
              const inGrace = performance.now() < skillGraceUntilRef.current;
              if (gamePhaseRef.current === 'PLAYING' && !isPendingCard && !inGrace) {
                executeSkill();
              }
            }
            break;
          }

          case 'RANKING_UPDATED':
            setTopRankings(msg.rankings);
            const curP = pairedPlayerRef.current;
            if (msg.updatedPlayer && curP && msg.updatedPlayer.deviceId === curP.deviceId) {
              setIsNewRecord(msg.updatedPlayer.bestScore > (curP.bestScore || 0));
              setPairedPlayer(msg.updatedPlayer);
            }
            break;

          case 'ERROR':
            if (msg.code === 'CONTROLLER_DISCONNECTED') {
              if (rapidFireTimerRef.current) {
                clearInterval(rapidFireTimerRef.current);
                rapidFireTimerRef.current = null;
              }
            }
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message', err);
      }
    };

    return () => {
      if (rapidFireTimerRef.current) clearInterval(rapidFireTimerRef.current);
      if (feverAutoFireTimerRef.current) clearInterval(feverAutoFireTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      socket.close();
    };
  }, [engine, soundSynth, updateAimDirect, handleShootEvent]);

  // 2. Engine HUD Tick
  useEffect(() => {
    const interval = setInterval(() => {
      const feverState = engine.scoreManager.getState();
      const weaponState = engine.weaponSystem.getState();
      const now = performance.now();

      const nextHud = buildHudSnapshot(engine, now);
      setHudState((prev) => (isHudSnapshotEqual(prev, nextHud) ? prev : nextHud));

      // Golden Can Spawn alert check
      const hasGoldenCan = engine.activeTargets.some((t) => t.isGoldenCan);
      if (hasGoldenCan && !lastGoldenCanActiveRef.current) {
        soundSynth.playGoldenCanChime();
        setIsGoldenCanAlertActive(true);
        setTimeout(() => setIsGoldenCanAlertActive(false), 2400);
      }
      lastGoldenCanActiveRef.current = hasGoldenCan;

      // Boss warning alarm: once, on the rising edge
      if (nextHud.isBossWarning && !lastBossWarningRef.current) soundSynth.playBossWarningSound();
      lastBossWarningRef.current = nextHud.isBossWarning;

      // Auto-fire loop during active Fever mode: polls fast, the weapon's own fire interval gates the actual shots
      if (feverState.isFeverActive && !engine.isPaused && !engine.isCardSelectPending && (gamePhase === 'PLAYING' || gamePhase === 'SANDBOX')) {
        if (!feverAutoFireTimerRef.current) {
          feverAutoFireTimerRef.current = setInterval(() => {
            const curAim = latestAimRef.current;
            const res = engine.shootAt(curAim.aimX, curAim.aimY, performance.now(), 'fever');
            handleShootEvent(res);
          }, 16);
        }
      } else {
        if (feverAutoFireTimerRef.current) {
          clearInterval(feverAutoFireTimerRef.current);
          feverAutoFireTimerRef.current = null;
        }
      }

      // Sync fever ready status to mobile controller
      if (roomId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (lastSentFeverReadyRef.current !== feverState.isFeverReady) {
          lastSentFeverReadyRef.current = feverState.isFeverReady;
          wsRef.current.send(
            JSON.stringify({
              type: 'FEVER_STATUS_SYNC',
              roomId,
              isFeverReady: feverState.isFeverReady,
            })
          );
        }

        // Sync skill state to mobile controller (on state change or throttled 150ms)
        const stockChanged = lastSentSkillStockRef.current !== weaponState.skillStock;
        if (stockChanged || now - lastSkillSyncTimeRef.current >= 150) {
          lastSkillSyncTimeRef.current = now;
          lastSentSkillStockRef.current = weaponState.skillStock;
          wsRef.current.send(
            JSON.stringify({
              type: 'SKILL_STATE_SYNC',
              roomId,
              weaponKind: weaponState.weaponKind,
              weaponLevel: weaponState.weaponLevel,
              skillStock: weaponState.skillStock,
              maxSkillStock: weaponState.maxSkillStock,
              skillCooldownRemainingMs: weaponState.skillCooldownRemainingMs,
              skillCooldownTotalMs: weaponState.skillCooldownTotalMs,
            })
          );
        }
      }

      // Synchronize game over / victory
      if (engine.gamePhase === 'GAMEOVER' && gamePhase === 'PLAYING') {
        if (rapidFireTimerRef.current) {
          clearInterval(rapidFireTimerRef.current);
          rapidFireTimerRef.current = null;
        }
        setGamePhase('GAMEOVER');
        soundSynth.playHit('MISS');
        submitScore(feverState.totalScore, engine.currentWave, feverState.maxCombo);
      } else if (engine.gamePhase === 'VICTORY' && gamePhase === 'PLAYING') {
        if (rapidFireTimerRef.current) {
          clearInterval(rapidFireTimerRef.current);
          rapidFireTimerRef.current = null;
        }
        setGamePhase('VICTORY');
        soundSynth.playFeverStart();
        submitScore(feverState.totalScore, STAGE_CONSTANTS.TOTAL_WAVES, feverState.maxCombo);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [engine, gamePhase, soundSynth]);

  const submitScore = (score: number, waveReached: number, maxCombo: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      const deviceId = pairedPlayerRef.current ? pairedPlayerRef.current.deviceId : 'pc-device-host';
      wsRef.current.send(
        JSON.stringify({
          type: 'GAME_SCORE_SUBMIT',
          roomId,
          deviceId,
          score,
          waveReached,
          maxCombo,
          rulesetVersion: RANKING_RULESET_VERSION,
          stats: engine.getPlayRunStats() ?? undefined,
        })
      );
    }
  };

  const handleStartGame = useCallback(() => {
    if (rapidFireTimerRef.current) {
      clearInterval(rapidFireTimerRef.current);
      rapidFireTimerRef.current = null;
    }
    skillGraceUntilRef.current = performance.now() + 1500;
    engine.startGame({ withWeaponSelect: true });
    setGamePhase('PLAYING');
    setIsNewRecord(false);
  }, [engine]);

  const startCountdownAndGame = useCallback(() => {
    soundSynth.unlockAudio();
    if (countdownTimerRef.current) return;
    if (gamePhaseRef.current !== 'PAIRING' && gamePhaseRef.current !== 'ZEROING') return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'START_GAME_REQUEST',
          roomId,
          deviceId: pairedPlayerRef.current?.deviceId || 'pc-host',
        })
      );
    }

    setCountdownSec(3);

    let sec = 3;
    countdownTimerRef.current = setInterval(() => {
      sec -= 1;
      if (sec > 0) {
        setCountdownSec(sec);
      } else {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdownSec(null);
        // Automatically calibrate zero to current aim angle when countdown reaches 0
        zeroOffsetRef.current = {
          offsetX: latestAimRef.current.aimX,
          offsetY: latestAimRef.current.aimY,
        };
        handleStartGame();
      }
    }, 1000);
  }, [handleStartGame, roomId, soundSynth]);

  const startCountdownAndGameRef = useRef(startCountdownAndGame);
  startCountdownAndGameRef.current = startCountdownAndGame;

  const startResumeCountdown = useCallback(() => {
    soundSynth.unlockAudio();
    if (countdownTimerRef.current) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'START_GAME_REQUEST',
          roomId,
          deviceId: pairedPlayerRef.current?.deviceId || 'pc-host',
        })
      );
    }

    setCountdownSec(3);

    let sec = 3;
    countdownTimerRef.current = setInterval(() => {
      sec -= 1;
      if (sec > 0) {
        setCountdownSec(sec);
      } else {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdownSec(null);
        // Automatically calibrate zero to current aim angle when countdown reaches 0
        zeroOffsetRef.current = {
          offsetX: latestAimRef.current.aimX,
          offsetY: latestAimRef.current.aimY,
        };
        engine.setPaused(false, performance.now());
      }
    }, 1000);
  }, [engine, roomId, soundSynth]);

  const handleOpenGuide = useCallback(() => {
    setIsGuideOpen(true);
    if (gamePhaseRef.current === 'PLAYING' || gamePhaseRef.current === 'TUTORIAL') {
      engine.setPaused(true, performance.now());
    }
  }, [engine]);

  const handleCloseGuide = useCallback(() => {
    setIsGuideOpen(false);
    if (gamePhaseRef.current === 'PLAYING' || gamePhaseRef.current === 'TUTORIAL') {
      startResumeCountdown();
    }
  }, [startResumeCountdown]);

  const handleOpenSensorLab = useCallback(() => {
    setIsSensorLabOpen(true);
  }, []);

  const handleCloseSensorLab = useCallback(() => {
    setIsSensorLabOpen(false);
  }, []);

  const handleUpdateTuningConfig = useCallback(
    (newConfig: SensorTuningConfig) => {
      setTuningConfig(newConfig);
      saveTuningConfig(newConfig);

      // Relay config update to mobile controller via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
        wsRef.current.send(
          JSON.stringify({
            type: 'SENSOR_CONFIG_UPDATE',
            roomId,
            config: newConfig,
          })
        );
      }
    },
    [roomId]
  );

  const handleResetSensorZero = useCallback(() => {
    zeroOffsetRef.current = {
      offsetX: latestAimRef.current.aimX,
      offsetY: latestAimRef.current.aimY,
    };
  }, []);

  const handleStartSandbox = useCallback(() => {
    setIsGuideOpen(false);
    engine.startSandboxMode();
    setGamePhase('SANDBOX');
  }, [engine]);

  const handleStartTutorial = useCallback(() => {
    setIsGuideOpen(false);
    engine.startTutorialMode();
    setGamePhase('TUTORIAL');
  }, [engine]);

  const handleExitTutorial = useCallback(() => {
    if (rapidFireTimerRef.current) {
      clearInterval(rapidFireTimerRef.current);
      rapidFireTimerRef.current = null;
    }
    engine.exitTutorialMode();
    setGamePhase('PAIRING');
  }, [engine]);

  const handleReturnToLobby = useCallback(() => {
    if (rapidFireTimerRef.current) {
      clearInterval(rapidFireTimerRef.current);
      rapidFireTimerRef.current = null;
    }
    engine.gamePhase = 'PAIRING';
    setGamePhase('PAIRING');
  }, [engine]);

  const handleRenderMetrics = useCallback((metrics: RenderPerformanceMetrics) => {
    if (!isSensorLabOpenRef.current && gamePhaseRef.current !== 'SANDBOX') return;
    setSensorLiveMetrics((prev) => ({
      ...prev,
      fps: metrics.fps,
      drawCalls: metrics.drawCalls,
      geometries: metrics.geometries,
      textures: metrics.textures,
    }));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 1. 3D WebGL Canvas */}
      <GameCanvas3D
        ref={canvasRef}
        engine={engine}
        aimX={0}
        aimY={0}
        onAimChange={handleAimChange}
        onShoot={handleShootEvent}
        soundSynth={soundSynth}
        onMonsterProjectionsUpdate={handleProjections}
        onRenderMetrics={handleRenderMetrics}
        onPlayerHit={handlePlayerHit}
      />

      {/* Player hit: red screen edge flash */}
      <div
        ref={playerHitFlashRef}
        data-testid="player-hit-flash"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 110,
          opacity: 0,
          boxShadow: 'inset 0 0 120px 40px rgba(220, 38, 38, 0.85)',
        }}
      />

      {/* Golden Can Screen Border Flash Indicator */}
      {isGoldenCanAlertActive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            border: '8px solid rgba(251, 191, 36, 0.75)',
            zIndex: 110,
            animation: 'pulse 0.6s ease-in-out infinite alternate',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '18px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              color: '#000',
              fontWeight: 900,
              fontSize: '14px',
              padding: '4px 16px',
              borderRadius: '20px',
              letterSpacing: '1.5px',
            }}
          >
            🪙 GOLDEN CAN DETECTED!
          </div>
        </div>
      )}

      {/* Boss encounter warning */}
      {gamePhase === 'PLAYING' && hudState.isBossWarning && (
        <div
          data-testid="boss-warning-banner"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '21.5%',
            height: '17%',
            zIndex: 125,
            overflow: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(69, 10, 10, 0.93)',
            borderTop: '4px solid #ef4444',
            borderBottom: '4px solid #ef4444',
            animation: `boss-warning-band ${GAME_TUNING.boss.warningMs}ms ease-out forwards`,
          }}
        >
          <style>{`@keyframes boss-warning-band { 0% { opacity: 0; } 8% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } } @keyframes boss-warning-sweep { from { left: -25%; } to { left: 110%; } }`}</style>
          <div style={{ color: '#fecaca', fontSize: 'clamp(40px, 6.4vw, 92px)', fontWeight: 900, letterSpacing: '0.14em', lineHeight: 1.05 }}>
            ⚠ WARNING ⚠
          </div>
          <div style={{ color: '#fca5a5', fontSize: 'clamp(16px, 2.2vw, 30px)', fontWeight: 700 }}>보스 등장</div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '13%',
              transform: 'skewX(-18deg)',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
              animation: 'boss-warning-sweep 0.7s linear infinite',
            }}
          />
        </div>
      )}

      {/* Boss defeated: shown while the clear sequence runs, then the cards (or the result) follow */}
      {gamePhase === 'PLAYING' && hudState.bossDown && (
        <div
          data-testid="boss-down-banner"
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 125,
            color: '#fbbf24',
            fontSize: '56px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textShadow: '0 0 18px rgba(251, 191, 36, 0.8), 0 4px 0 #78350f, 0 0 2px #000',
            WebkitTextStroke: '2px #78350f',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            animation: 'boss-down-pop 0.35s ease-out',
          }}
        >
          <style>{`@keyframes boss-down-pop { from { transform: translateX(-50%) scale(0.4); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }`}</style>
          BOSS DOWN!
        </div>
      )}

      {/* Wave clear: clear time and time bonus */}
      {gamePhase === 'PLAYING' && hudState.waveClearKey !== '' && (() => {
        const [waveStr, secStr, bonusStr] = hudState.waveClearKey.split('|');
        const bonus = Number(bonusStr);
        return (
          <div
            data-testid="wave-clear-banner"
            style={{
              position: 'absolute',
              top: '16%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 124,
              padding: '8px 28px',
              borderRadius: '9999px',
              background: 'rgba(8, 47, 73, 0.94)',
              border: '2px solid #38bdf8',
              color: '#e0f2fe',
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '0.06em',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            WAVE {waveStr} CLEAR · {secStr}초{bonus > 0 ? ` · +${bonus}` : ''}
          </div>
        );
      })()}

      {/* 2. 4-Corner Arcade Overlay HUD */}
      {gamePhase === 'PLAYING' && (
        <>
          {(engine.isWeaponSelectPending || engine.isRewardCardPending) && (
            <div
              data-testid="card-select-guide-banner"
              style={{
                position: 'absolute',
                top: '28px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 110,
                padding: '12px 28px',
                borderRadius: '9999px',
                background: 'rgba(15, 23, 42, 0.90)',
                border: '2px solid #06b6d4',
                color: '#ffffff',
                fontSize: '18px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <span>
                {engine.isWeaponSelectPending
                  ? '🎯 원하는 무기를 사격하여 선택하세요! (SHOOT TO SELECT)'
                  : '🃏 보상 카드를 사격하여 선택하세요! (SHOOT TO SELECT)'}
              </span>
            </div>
          )}
          <MonsterHpBarLayer ref={hpLayerRef} />
          <ArcadeOverlayHUD
            player={pairedPlayer}
            score={hudState.score}
            combo={hudState.combo}
            comboMultiplier={hudState.comboMultiplier}
            lives={hudState.lives}
            maxLives={engine.maxLives}
            wave={hudState.wave}
            totalWaves={STAGE_CONSTANTS.TOTAL_WAVES}
            ammo={hudState.ammo}
            maxAmmo={hudState.maxAmmo}
            isReloading={hudState.isReloading}
            feverGauge={hudState.feverGauge}
            isFeverReady={hudState.isFeverReady}
            isFeverActive={hudState.isFeverActive}
            bosses={hudState.bosses}
            activeBuffs={hudState.activeBuffs}
            waveProgress={hudState.waveProgress}
            weaponKind={hudState.weaponKind}
            weaponLevel={hudState.weaponLevel}
            skillStock={hudState.skillStock}
            maxSkillStock={hudState.maxSkillStock}
            skillCooldownRemainingMs={hudState.skillCooldownRemainingMs}
            onOpenGuide={handleOpenGuide}
            onOpenSensorLab={handleOpenSensorLab}
          />
          <CrosshairOverlay
            ref={crosshairRef}
            aimX={latestAimRef.current.aimX}
            aimY={latestAimRef.current.aimY}
            isFeverActive={hudState.isFeverActive}
            isWideScopeActive={hudState.isWideScopeActive}
            isPowerShotActive={hudState.isPowerShotActive}
            isAimLocked={isAimLocked}
            weaponKind={hudState.weaponKind}
            weaponLevel={hudState.weaponLevel}
            isReloading={hudState.isReloading}
            reloadDurationMs={hudState.reloadDurationMs}
            isPaused={hudState.isPaused || hudState.isRewardCardPending || hudState.isWeaponSelectPending}
            getReloadRemainingMs={getReloadRemainingMs}
          />
          <JudgmentBanner ref={judgmentRef} />
        </>
      )}

      {/* 2-B. Tutorial Mode Interactive HUD */}
      {gamePhase === 'TUTORIAL' && (
        <>
          <TutorialGuideOverlay
            step={engine.tutorialStep}
            targetsRemaining={engine.activeTargets.length}
            isFeverReady={hudState.isFeverReady}
            isFeverActive={hudState.isFeverActive}
            ammo={hudState.ammo}
            maxAmmo={hudState.maxAmmo}
            isReloading={hudState.isReloading}
            onStartRealGame={handleStartGame}
            onExitToLobby={handleExitTutorial}
          />
          <CrosshairOverlay
            ref={crosshairRef}
            aimX={latestAimRef.current.aimX}
            aimY={latestAimRef.current.aimY}
            isFeverActive={hudState.isFeverActive}
            isWideScopeActive={false}
            isPowerShotActive={false}
            isAimLocked={isAimLocked}
            weaponKind={hudState.weaponKind}
            weaponLevel={hudState.weaponLevel}
            isReloading={hudState.isReloading}
            reloadDurationMs={hudState.reloadDurationMs}
            isPaused={hudState.isPaused}
            getReloadRemainingMs={getReloadRemainingMs}
          />
          <JudgmentBanner ref={judgmentRef} />
        </>
      )}

      {/* 2-C. Sandbox Mode Interactive HUD & Controls */}
      {gamePhase === 'SANDBOX' && (
        <>
          <SensorAndModuleTestLabOverlay
            roomId={roomId}
            lanIp={lanIp}
            pairedPlayer={pairedPlayer}
            diagnostics={diagnostics}
            targetsCount={engine.activeTargets.length}
            stationarySpawn={stationarySpawn}
            infiniteAmmo={sandboxInfiniteAmmo}
            ammo={hudState.ammo}
            maxAmmo={hudState.maxAmmo}
            isReloading={hudState.isReloading}
            feverGauge={hudState.feverGauge}
            isFeverReady={hudState.isFeverReady}
            isFeverActive={hudState.isFeverActive}
            activeBuffs={hudState.activeBuffs}
            lastJudgment={sandboxJudgment}
            weaponKind={hudState.weaponKind}
            weaponLevel={hudState.weaponLevel}
            onSelectWeapon={(k) => engine.weaponSystem.selectWeapon(k)}
            onUpgradeWeapon={() => engine.weaponSystem.upgradeWeaponLevel()}
            onSpawnRewardCards={() => engine.spawnWaveRewardCards(performance.now(), false)}
            onSummonBossMinions={() => engine.spawnBossMinionWave(performance.now(), 2)}
            onToggleStationarySpawn={setStationarySpawn}
            onSpawnTarget={(k) => engine.spawnSandboxTarget(k, { stationary: stationarySpawn })}
            onSpawnFivePointTargets={() => engine.spawnCalibrationFiveTargets()}
            onClearTargets={() => engine.clearSandboxTargets()}
            onSpawnItem={(ik) => engine.spawnItemTarget(ik, performance.now())}
            onActivateBuffImmediate={(ik) => engine.activateItemBuff(ik, performance.now())}
            onTriggerFeverImmediate={() => {
              engine.triggerSandboxFever(performance.now());
              soundSynth.playFeverStart();
            }}
            onToggleInfiniteAmmo={(inf) => {
              setSandboxInfiniteAmmo(inf);
              engine.setInfiniteAmmo(inf);
            }}
            onTestFireShot={() => {
              const res = engine.shootAt(
                latestAimRef.current.aimX,
                latestAimRef.current.aimY,
                performance.now(),
                'press'
              );
              handleShootEvent(res);
            }}
            onSensitivityChange={(sx, sy, inv) => {
              setDiagnostics((prev) => ({
                ...prev,
                sensitivityX: sx,
                sensitivityY: sy,
                invertY: inv,
              }));
            }}
            onResetZeroCenter={() => {
              zeroOffsetRef.current = {
                offsetX: latestAimRef.current.aimX,
                offsetY: latestAimRef.current.aimY,
              };
            }}
            onStartRealGame={startCountdownAndGame}
            onExitToLobby={() => {
              engine.exitSandboxMode();
              setGamePhase('PAIRING');
            }}
          />
          <CrosshairOverlay
            ref={crosshairRef}
            aimX={latestAimRef.current.aimX}
            aimY={latestAimRef.current.aimY}
            isFeverActive={hudState.isFeverActive}
            isWideScopeActive={hudState.isWideScopeActive}
            isPowerShotActive={hudState.isPowerShotActive}
            isAimLocked={isAimLocked}
            weaponKind={hudState.weaponKind}
            weaponLevel={hudState.weaponLevel}
            isReloading={hudState.isReloading}
            reloadDurationMs={hudState.reloadDurationMs}
            isPaused={hudState.isPaused}
            getReloadRemainingMs={getReloadRemainingMs}
          />
          <JudgmentBanner ref={judgmentRef} />
        </>
      )}

      {/* 3. QR Pairing Modal */}
      {(gamePhase === 'PAIRING' || gamePhase === 'ZEROING') && (
        <>
          <QRPairingModal
            roomId={roomId}
            lanIp={lanIp}
            pairedPlayer={pairedPlayer}
            topRankings={topRankings}
            isZeroCalibrated={isZeroCalibrated}
            onStartAsPc={handleStartGame}
            onStartWithController={startCountdownAndGame}
            onOpenGuide={handleOpenGuide}
            onStartSandbox={handleStartSandbox}
          />
          {(isZeroCalibrated || pairedPlayer) && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 120 }}>
              <CrosshairOverlay
                ref={crosshairRef}
                aimX={latestAimRef.current.aimX}
                aimY={latestAimRef.current.aimY}
                isFeverActive={false}
                isWideScopeActive={false}
                isPowerShotActive={false}
                isAimLocked={isAimLocked}
              />
            </div>
          )}
        </>
      )}

      {/* 3-B. 3-Second Countdown Overlay */}
      {countdownSec !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 12, 0.78)',
            zIndex: 150,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              fontSize: '120px',
              fontWeight: 900,
              background: 'linear-gradient(180deg, #f59e0b, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(245, 158, 11, 0.6)',
              animation: 'pulse 0.9s infinite',
            }}
          >
            {countdownSec}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginTop: '16px' }}>
            {engine.isPaused ? '게임 재개! 조준선을 정렬하세요' : '전투 준비! 조준선을 정렬하세요'}
          </div>
        </div>
      )}

      {/* 4. Game Result Modal */}
      {(gamePhase === 'GAMEOVER' || gamePhase === 'VICTORY') && (
        <>
          <ResultRankingModal
            gamePhase={gamePhase}
            score={hudState.score}
            breakdown={engine.getScoreBreakdown()}
            lastWaveClear={engine.lastWaveClear}
            maxCombo={engine.scoreManager.getState().maxCombo}
            waveReached={engine.currentWave}
            currentPlayer={pairedPlayer}
            isNewRecord={isNewRecord}
            rankings={topRankings}
            onRestart={handleStartGame}
            onReturnToLobby={handleReturnToLobby}
            hoveredAction={hoveredResultAction}
            restartButtonRef={restartButtonRef}
            lobbyButtonRef={lobbyButtonRef}
          />
          {/* Result Crosshair Overlay on top of result modal */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 160 }}>
            <CrosshairOverlay
              ref={crosshairRef}
              aimX={latestAimRef.current.aimX}
              aimY={latestAimRef.current.aimY}
              isFeverActive={false}
              isWideScopeActive={false}
              isPowerShotActive={false}
              isAimLocked={isAimLocked}
              />
          </div>
        </>
      )}

      {/* 5. Guide & Codex Modal */}
      <GuideModal
        isOpen={isGuideOpen}
        onClose={handleCloseGuide}
        showTutorialButton={gamePhase === 'PAIRING' || gamePhase === 'ZEROING'}
        onStartTutorial={handleStartTutorial}
      />

      {/* Top-Right Quick Sensor Lab Floating Button in PAIRING / ZEROING */}
      {(gamePhase === 'PAIRING' || gamePhase === 'ZEROING') && (
        <button
          onClick={handleOpenSensorLab}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 110,
            background: 'rgba(17, 24, 39, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.7)',
            borderRadius: '12px',
            padding: '8px 18px',
            color: '#34d399',
            fontSize: '14px',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🎯</span>
          <span>모바일 센서 진단 & 안정화 랩</span>
        </button>
      )}

      {/* 6. Mobile Sensor Lab & Stabilizer Modal */}
      <MobileSensorLabModal
        isOpen={isSensorLabOpen}
        onClose={handleCloseSensorLab}
        metrics={sensorLiveMetrics}
        tuningConfig={tuningConfig}
        onUpdateConfig={handleUpdateTuningConfig}
        onResetZero={handleResetSensorZero}
      />
    </div>
  );
};
