import { GAME_TUNING } from '../shared/gameTuning';
import { TutorialStep } from '../shared/types';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { BeerCrusherEngine, EngineShootResult } from './engine/BeerCrusherEngine';
import { GameCanvas3D, GameCanvas3DHandle, RenderPerformanceMetrics } from './components/GameCanvas3D';
import { ArcadeOverlayHUD, MonsterHudProjection } from './components/ArcadeOverlayHUD';
import { MonsterHpBarLayer, MonsterHpBarLayerHandle } from './components/MonsterHpBarLayer';
import { HudSnapshot, buildHudSnapshot, isHudSnapshotEqual } from './hudSnapshot';
import { CrosshairOverlay, CrosshairOverlayHandle } from './components/CrosshairOverlay';
import { JudgmentBanner, JudgmentBannerHandle } from './components/JudgmentBanner';
import { QRPairingModal } from './components/QRPairingModal';
import { PauseMenuOverlay } from './components/PauseMenuOverlay';
import { canOpenPauseMenu, PauseReason } from './pauseFlow';
import { loadSavedRoomId, saveRoomId, clearSavedRoomId } from './roomMemory';
import { ResultRankingModal } from './components/ResultRankingModal';
import { GuideModal } from './components/GuideModal';
import { TutorialGuideOverlay } from './components/TutorialGuideOverlay';
import { TutorialDirector } from './tutorial/TutorialDirector';
import { SensorAndModuleTestLabOverlay, SensorDiagnosticsState } from './components/SensorAndModuleTestLabOverlay';
import {
  MobileSensorLabModal,
  loadSavedTuningConfig,
  saveTuningConfig,
  SensorLiveMetrics,
  SensorTuningConfig,
} from './components/MobileSensorLabModal';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { ActiveBuffState, GamePhase, JudgmentGrade, PlayerProfile, RunRankingEntry, ServerToClientMessage, WeaponKind, WeaponLevel } from '../shared/types';
import { STAGE_CONSTANTS, WEAPON_CONSTANTS } from '../shared/constants';
import { RANKING_RULESET_VERSION } from '../shared/gameTuning';
import { PlayerIndex } from './engine/PlayerCombatState';
import { PlayerActionProcessor, ShootableButton } from './input/PlayerActionProcessor';
import { MouseAdapter } from './input/MouseAdapter';
import { PhoneAdapter } from './input/PhoneAdapter';

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
  const roomIdRef = useRef<string>(roomId);
  roomIdRef.current = roomId;
  const [lanIp, setLanIp] = useState<string>('');
  const [pairedPlayer, setPairedPlayer] = useState<PlayerProfile | undefined>();
  const [topRankings, setTopRankings] = useState<RunRankingEntry[]>([]);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const isGuideOpenRef = useRef<boolean>(false);
  isGuideOpenRef.current = isGuideOpen;
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
  const countdownSecRef = useRef<number | null>(null);
  countdownSecRef.current = countdownSec;
  // Optimistic until the server reports a drop, so mouse-only play (no phone) is never held up by this flag.
  const [isControllerConnected, setIsControllerConnected] = useState<boolean>(true);
  const isControllerConnectedRef = useRef<boolean>(true);
  isControllerConnectedRef.current = isControllerConnected;
  // The socket callback lives in an effect that never re-runs, so it reaches the latest pause opener through a ref.
  const handleOpenPauseRef = useRef<(reason?: PauseReason) => void>(() => {});
  const [pauseMenu, setPauseMenu] = useState<{ open: boolean; reason: PauseReason }>({ open: false, reason: 'USER' });
  const pauseMenuOpenRef = useRef<boolean>(false);
  pauseMenuOpenRef.current = pauseMenu.open;
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const isExitConfirmOpenRef = useRef<boolean>(false);
  isExitConfirmOpenRef.current = isExitConfirmOpen;
  const pauseMenuReasonRef = useRef<PauseReason>('USER');
  pauseMenuReasonRef.current = pauseMenu.reason;

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
    () => Math.max(0, engine.getPlayer(0).weaponSystem.getState().reloadEndTimeMs - performance.now()),
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
  const tutorialDirectorRef = useRef<TutorialDirector | null>(null);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(1);

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

  const wsRef = useRef<WebSocket | null>(null);
  const pairedPlayerRef = useRef<PlayerProfile | undefined>(undefined);
  pairedPlayerRef.current = pairedPlayer;

  const latestAimRef = useRef({ aimX: 0, aimY: 0 });
  const lastDiagUpdateTimeRef = useRef<number>(0);

  const [hoveredResultAction, setHoveredResultAction] = useState<'restart' | 'lobby' | null>(null);
  const hoveredResultActionRef = useRef<'restart' | 'lobby' | null>(null);

  const hitTestButton = useCallback((aimX: number, aimY: number): ShootableButton | null => {
    if (typeof window === 'undefined') return null;
    const screenX = ((aimX + 1) / 2) * window.innerWidth;
    const screenY = ((1 - aimY) / 2) * window.innerHeight;

    const elements = document.querySelectorAll<HTMLElement>('[data-shootable]');
    for (const el of Array.from(elements)) {
      const rect = el.getBoundingClientRect();
      if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
        return (el.getAttribute('data-shootable') as ShootableButton) || null;
      }
    }
    return null;
  }, []);

  const updateAimDirect = useCallback((x: number, y: number, immediate = false) => {
    latestAimRef.current = { aimX: x, aimY: y };
    canvasRef.current?.setAim(x, y, immediate);
    crosshairRef.current?.updatePosition(x, y, immediate);
    const action = hitTestButton(x, y);
    const resultAction = action === 'restart' || action === 'lobby' ? action : null;
    if (hoveredResultActionRef.current !== resultAction) {
      hoveredResultActionRef.current = resultAction;
      setHoveredResultAction(resultAction);
    }
  }, [hitTestButton]);

  const handleShootEvent = useCallback((result: EngineShootResult) => {
    if (!result.fired) return;
    const isFever = engine.getPlayer(0).scoreManager.getState().isFeverActive;
    const currentWeapon = result.weaponKind || engine.getPlayer(0).weaponSystem.getState().weaponKind;
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

  const handleStartGameRef = useRef<() => void>(() => {});
  const handleReturnToLobbyRef = useRef<() => void>(() => {});

  const pressScreenButton = useCallback((button: ShootableButton) => {
    if (button === 'start') {
      if (pairedPlayerRef.current) {
        startCountdownAndGameRef.current();
      } else {
        handleStartGameRef.current();
      }
    } else if (button === 'restart') {
      handleStartGameRef.current();
    } else if (button === 'lobby') {
      handleReturnToLobbyRef.current();
    }
  }, []);

  const processorsRef = useRef<PlayerActionProcessor[]>([]);
  const phoneAdapterRef = useRef<PhoneAdapter | null>(null);
  const mouseAdapterRef = useRef<MouseAdapter | null>(null);

  const syncProcessors = useCallback(() => {
    const targetCount = engine.players.length;
    processorsRef.current.forEach((p) => p.stopAll());
    processorsRef.current = [];

    for (let p = 0; p < targetCount; p++) {
      const processor = new PlayerActionProcessor({
        engine,
        playerIndex: p as PlayerIndex,
        getPhase: () => gamePhaseRef.current,
        isPauseMenuOpen: () => pauseMenuOpenRef.current,
        getSkillGraceUntilMs: () => skillGraceUntilRef.current,
        hitTestButton,
        onButton: (btn) => {
          pressScreenButton(btn);
        },
        onMenuShot: (hit) => {
          soundSynth.playShoot(false);
          soundSynth.playHit(hit ? 'PERFECT' : 'MISS');
        },
        onShot: handleShootEvent,
        onSkill: (res) => {
          soundSynth.playSkillActivation(res.weaponKind);
          canvasRef.current?.triggerSkillEffect?.(res.weaponKind);
        },
        onFeverStarted: (_idx) => {
          soundSynth.playFeverStart();
        },
        onAim: (x, y, _idx) => {
          updateAimDirect(x, y, false);
        },
      });
      processorsRef.current.push(processor);
    }
  }, [engine, hitTestButton, pressScreenButton, handleShootEvent, soundSynth, updateAimDirect]);

  if (!phoneAdapterRef.current) {
    phoneAdapterRef.current = new PhoneAdapter({
      sink: () => processorsRef.current[0] ?? null,
      send: (msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(msg));
        }
      },
      roomId: () => roomIdRef.current,
      getTuning: () => tuningConfigRef.current,
    });
  }

  if (!mouseAdapterRef.current) {
    mouseAdapterRef.current = new MouseAdapter(
      () => processorsRef.current[0] ?? null,
      WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS
    );
  }

  useEffect(() => {
    syncProcessors();
  }, [syncProcessors]);

  // Mouse right-click skill trigger
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      mouseAdapterRef.current?.onRightClick();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

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
      socket.send(JSON.stringify({ type: 'CREATE_ROOM', roomId: loadSavedRoomId() }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMessage;
        switch (msg.type) {
          case 'ROOM_CREATED':
            setRoomId(msg.roomId);
            saveRoomId(msg.roomId);
            if (msg.rankings) setTopRankings(msg.rankings);
            if (msg.lanIp) setLanIp(msg.lanIp);
            break;

          case 'CONTROLLER_PAIRED':
            setPairedPlayer(msg.player);
            setIsControllerConnected(true);
            soundSynth.unlockAudio();
            break;

          case 'ZERO_CALIBRATED':
            if (msg.resume) {
              // Only the phone's socket came back: keep the zero offset, and only move a lobby on to zeroing.
              setIsZeroCalibrated(true);
              if (gamePhaseRef.current === 'PAIRING') {
                setGamePhase('ZEROING');
              }
              break;
            }
            setIsZeroCalibrated(true);
            phoneAdapterRef.current?.resetZero();
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

            let currentJitterRms = 0;
            if (isDiagnosticsNeeded) {
              const rawFromPayloadX = p.rawAimX ?? p.aimX;
              const rawFromPayloadY = p.rawAimY ?? p.aimY;
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

            const frameResult = phoneAdapterRef.current?.onSensorFrame(p);
            if (frameResult) {
              setIsAimLocked(frameResult.isAimLocked);
              if (frameResult.cockedJustNow) {
                soundSynth.playCocking();
              }

              if (isDiagnosticsNeeded && now - lastDiagUpdateTimeRef.current >= 60) {
                lastDiagUpdateTimeRef.current = now;
                setDiagnostics((prev) => ({
                  ...prev,
                  aimX: frameResult.aimX,
                  aimY: frameResult.aimY,
                  yawDeg: p.yawDeg,
                  pitchDeg: p.pitchDeg,
                  rollDeg: p.rollDeg,
                  rapidFireHold: p.rapidFireHold,
                  lastSnapFireAt: p.snapFire ? Date.now() : prev.lastSnapFireAt,
                }));

                setSensorLiveMetrics({
                  rawAimX: frameResult.rawAimX,
                  rawAimY: frameResult.rawAimY,
                  aimX: frameResult.aimX,
                  aimY: frameResult.aimY,
                  yawDeg: p.yawDeg,
                  pitchDeg: p.pitchDeg,
                  rollDeg: p.rollDeg,
                  packetHz: packetCountRef.current * 4 || 60,
                  jitterRms: currentJitterRms,
                  isCocked: p.isCocked,
                  lastSnapAt: p.snapFire ? Date.now() : undefined,
                });
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
              processorsRef.current.forEach((p) => p.stopAll());
              isControllerConnectedRef.current = false;
              setIsControllerConnected(false);
              if (gamePhaseRef.current === 'PLAYING') {
                if (pauseMenuOpenRef.current) {
                  // The player had already paused: keep the menu, but it must now wait for the phone.
                  setPauseMenu({ open: true, reason: 'CONTROLLER_LOST' });
                } else {
                  handleOpenPauseRef.current('CONTROLLER_LOST');
                }
              }
            }
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message', err);
      }
    };

    return () => {
      processorsRef.current.forEach((p) => p.stopAll());
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      socket.close();
    };
  }, [engine, soundSynth, updateAimDirect, handleShootEvent]);

  // 2. Engine HUD Tick
  useEffect(() => {
    const interval = setInterval(() => {
      const feverState = engine.getPlayer(0).scoreManager.getState();
      const now = performance.now();

      const nextHud = buildHudSnapshot(engine, now, tutorialDirectorRef.current?.step ?? tutorialStep);
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

      // Player action processor tick & phone feedback sync
      processorsRef.current.forEach((proc) => proc.tick());
      if (processorsRef.current[0]) {
        phoneAdapterRef.current?.syncFeedback(processorsRef.current[0].getState());
      }

      // Synchronize game over / victory
      if (engine.gamePhase === 'GAMEOVER' && gamePhase === 'PLAYING') {
        processorsRef.current.forEach((p) => p.stopAll());
        setGamePhase('GAMEOVER');
        soundSynth.playHit('MISS');
        submitScore(feverState.totalScore, engine.currentWave, feverState.maxCombo);
      } else if (engine.gamePhase === 'VICTORY' && gamePhase === 'PLAYING') {
        processorsRef.current.forEach((p) => p.stopAll());
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
    processorsRef.current.forEach((p) => p.stopAll());
    skillGraceUntilRef.current = performance.now() + 1500;
    engine.startGame({ withWeaponSelect: true });
    syncProcessors();
    setGamePhase('PLAYING');
    setIsNewRecord(false);
  }, [engine, syncProcessors]);
  handleStartGameRef.current = handleStartGame;

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
        phoneAdapterRef.current?.autoZeroFromLatest();
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
        phoneAdapterRef.current?.autoZeroFromLatest();
        engine.setPaused(false, performance.now());
      }
    }, 1000);
  }, [engine, roomId, soundSynth]);

  const handleOpenPause = useCallback(
    (reason: PauseReason = 'USER') => {
      if (
        !canOpenPauseMenu({
          phase: gamePhaseRef.current,
          isPaused: engine.isPaused,
          isMenuOpen: pauseMenuOpenRef.current,
          isGuideOpen: isGuideOpenRef.current,
          countdownSec: countdownSecRef.current,
        })
      ) {
        return;
      }
      processorsRef.current.forEach((p) => p.stopAll());
      engine.setPaused(true, performance.now());
      setIsExitConfirmOpen(false);
      setPauseMenu({ open: true, reason });
    },
    [engine]
  );

  handleOpenPauseRef.current = handleOpenPause;

  const handleResumeFromPause = useCallback(() => {
    // Without the phone nobody can aim, so a resume would only let the countdown end in a free hit.
    if (pauseMenuReasonRef.current === 'CONTROLLER_LOST' && !isControllerConnectedRef.current) return;
    setIsExitConfirmOpen(false);
    setPauseMenu({ open: false, reason: 'USER' });
    startResumeCountdown();
  }, [startResumeCountdown]);

  const handleRestartFromPause = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownSec(null);
    // startGame() does not clear the pause flag, so lift it first (this also shifts the frozen timers).
    engine.setPaused(false, performance.now());
    setPauseMenu({ open: false, reason: 'USER' });
    handleStartGame();
  }, [engine, handleStartGame]);

  // Esc: open the menu while playing, resume when it is open.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || e.repeat) return;
      if (pauseMenuOpenRef.current) {
        if (isExitConfirmOpenRef.current) {
          setIsExitConfirmOpen(false);
          return;
        }
        handleResumeFromPause();
      } else {
        handleOpenPause('USER');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenPause, handleResumeFromPause]);

  // Leaving the run (lobby, game over) closes the menu.
  useEffect(() => {
    if (gamePhase !== 'PLAYING' && pauseMenuOpenRef.current) {
      setIsExitConfirmOpen(false);
      setPauseMenu({ open: false, reason: 'USER' });
    }
  }, [gamePhase]);

  const handleOpenGuide = useCallback(() => {
    setIsGuideOpen(true);
    if (gamePhaseRef.current === 'PLAYING' || gamePhaseRef.current === 'TUTORIAL') {
      engine.setPaused(true, performance.now());
    }
  }, [engine]);

  const handleCloseGuide = useCallback(() => {
    setIsGuideOpen(false);
    if (gamePhaseRef.current === 'PLAYING' && !isControllerConnectedRef.current) {
      // The phone dropped while the guide was open: wait in the pause menu instead of counting down.
      setPauseMenu({ open: true, reason: 'CONTROLLER_LOST' });
      return;
    }
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
    phoneAdapterRef.current?.autoZeroFromLatest();
  }, []);

  const handleStartSandbox = useCallback(() => {
    setIsGuideOpen(false);
    engine.startSandboxMode();
    syncProcessors();
    setGamePhase('SANDBOX');
  }, [engine, syncProcessors]);

  const handleStartTutorial = useCallback(() => {
    setIsGuideOpen(false);
    engine.startTutorialMode();
    const director = new TutorialDirector(engine, (step) => setTutorialStep(step));
    tutorialDirectorRef.current = director;
    director.start(performance.now());
    setTutorialStep(director.step);
    syncProcessors();
    setGamePhase('TUTORIAL');
  }, [engine, syncProcessors]);

  const handleExitTutorial = useCallback(() => {
    processorsRef.current.forEach((p) => p.stopAll());
    if (tutorialDirectorRef.current) {
      tutorialDirectorRef.current.stop();
      tutorialDirectorRef.current = null;
    }
    engine.exitTutorialMode();
    syncProcessors();
    setGamePhase('PAIRING');
  }, [engine, syncProcessors]);

  const handleRenewRoom = useCallback(() => {
    clearSavedRoomId();
    window.location.reload();
  }, []);

  const handleReturnToLobby = useCallback(() => {
    processorsRef.current.forEach((p) => p.stopAll());
    engine.gamePhase = 'PAIRING';
    syncProcessors();
    setGamePhase('PAIRING');
  }, [engine, syncProcessors]);
  handleReturnToLobbyRef.current = handleReturnToLobby;

  // Leaving from the pause menu drops this run's score (no submitScore), like restart does.
  const handleExitToLobbyFromPause = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownSec(null);
    // handleReturnToLobby does not clear the pause flag; lift it so the next run does not start frozen.
    engine.setPaused(false, performance.now());
    setPauseMenu({ open: false, reason: 'USER' });
    setIsExitConfirmOpen(false);
    handleReturnToLobby();
  }, [engine, handleReturnToLobby]);

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
        onMouseAim={(x, y) => mouseAdapterRef.current?.onMove(x, y)}
        onMouseDown={() => mouseAdapterRef.current?.onLeftDown()}
        onMouseUp={() => mouseAdapterRef.current?.onLeftUp()}
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
            passiveCards={hudState.passiveCards}
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
            onPause={gamePhase === 'PLAYING' ? () => handleOpenPause('USER') : undefined}
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
            step={tutorialStep}
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
            onSelectWeapon={(k) => engine.getPlayer(0).weaponSystem.selectWeapon(k)}
            onUpgradeWeapon={() => engine.getPlayer(0).weaponSystem.upgradeWeaponLevel()}
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
              processorsRef.current[0]?.send({ type: 'fireDown' });
              processorsRef.current[0]?.send({ type: 'fireUp' });
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
              phoneAdapterRef.current?.autoZeroFromLatest();
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
            onStart={() => pressScreenButton('start')}
            onStartAsPc={() => pressScreenButton('start')}
            onStartWithController={() => pressScreenButton('start')}
            onOpenGuide={handleOpenGuide}
            onStartTutorial={handleStartTutorial}
            onStartSandbox={handleStartSandbox}
            onRenewRoom={handleRenewRoom}
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
      {gamePhase === 'PLAYING' && pauseMenu.open && (
        <PauseMenuOverlay
          reason={pauseMenu.reason}
          isControllerConnected={isControllerConnected}
          onResume={handleResumeFromPause}
          onRestart={handleRestartFromPause}
          isExitConfirmOpen={isExitConfirmOpen}
          onRequestExit={() => setIsExitConfirmOpen(true)}
          onCancelExit={() => setIsExitConfirmOpen(false)}
          onConfirmExit={handleExitToLobbyFromPause}
        />
      )}

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
            maxCombo={engine.getPlayer(0).scoreManager.getState().maxCombo}
            kills={engine.getPlayRunStats()?.kills ?? 0}
            waveReached={engine.currentWave}
            currentPlayer={pairedPlayer}
            isNewRecord={isNewRecord}
            rankings={topRankings}
            onRestart={() => pressScreenButton('restart')}
            onReturnToLobby={() => pressScreenButton('lobby')}
            hoveredAction={hoveredResultAction}
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
