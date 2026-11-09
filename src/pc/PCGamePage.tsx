import { GAME_TUNING } from '../shared/gameTuning';
import { TutorialStep } from '../shared/types';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { BeerCrusherEngine, EngineShootResult } from './engine/BeerCrusherEngine';
import { GameCanvas3D, GameCanvas3DHandle, RenderPerformanceMetrics } from './components/GameCanvas3D';
import { ArcadeOverlayHUD, MonsterHudProjection } from './components/ArcadeOverlayHUD';
import { MonsterHpBarLayer, MonsterHpBarLayerHandle } from './components/MonsterHpBarLayer';
import { HudSnapshot, buildHudSnapshot, isHudSnapshotEqual } from './hudSnapshot';
import { CrosshairOverlay, CrosshairOverlayHandle, formatCrosshairNameTag } from './components/CrosshairOverlay';
import { JudgmentBanner, JudgmentBannerHandle } from './components/JudgmentBanner';
import { QRPairingModal } from './components/QRPairingModal';
import { PauseMenuOverlay } from './components/PauseMenuOverlay';
import { canOpenPauseMenu, PauseReason } from './pauseFlow';
import { loadSavedRoomId, saveRoomId, clearSavedRoomId } from './roomMemory';
import { ResultRankingModal, CoopResultInfo } from './components/ResultRankingModal';
import { SelectRoundOverlay } from './components/SelectRoundOverlay';
import { GuideModal } from './components/GuideModal';
import { TutorialGuideOverlay } from './components/TutorialGuideOverlay';
import { PlayerPanel } from './components/PlayerPanel';
import { buildTeamKey } from './components/RankingTabs';
import { loadLastInput, saveLastInput } from './lobbyInputMemory';
import { TutorialDirector, TutorialRoundState } from './tutorial/TutorialDirector';
import { SensorAndModuleTestLabOverlay, SensorDiagnosticsState } from './components/SensorAndModuleTestLabOverlay';
import {
  MobileSensorLabModal,
  loadSavedTuningConfig,
  mergeSensorFrameMetrics,
  saveTuningConfig,
  SensorLiveMetrics,
  SensorTuningConfig,
} from './components/MobileSensorLabModal';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { ActiveBuffState, GamePhase, JudgmentGrade, PlayerProfile, RunRankingEntry, ServerToClientMessage, TeamRankingEntry, WeaponKind, WeaponLevel } from '../shared/types';
import { STAGE_CONSTANTS, WEAPON_CONSTANTS } from '../shared/constants';
import { RANKING_RULESET_VERSION } from '../shared/gameTuning';
import { PlayerIndex } from './engine/PlayerCombatState';
import { PlayerActionProcessor, ShootableButton } from './input/PlayerActionProcessor';
import { MouseAdapter } from './input/MouseAdapter';
import { getReconnectDelayMs } from '../controller/sensors/ReconnectPolicy';
import { PhoneAdapter } from './input/PhoneAdapter';
import { GraceState, decideDisconnectAction, startGrace, tickGrace } from './coopDisconnect';
import { getPlayerPresentation, getTeamPresentation, PLAYER_COLORS } from './playerPresentation';
import { buildDebugSnapshot } from './debug/debugSnapshot';

import {
  createLobbySlots,
  applyLobbyReturnDefaults,
  resolveStartRoster,
  chooseSlotInput,
  updateSlot,
  getJoinedSlots,
  getStartGate,
  buildSlotIndexMap,
  indexToSlot,
  getSoloSlot,
  getMouseBinding,
  shouldShowLobbyCrosshair,
  decideLobbyStart,
  applyControllerPaired,
  applyControllerUnsupported,
  buildSandboxSlotMap,
  SlotPair,
  type StartRoster,
  SlotInput,
} from './coopSlots';
import { buildGameBegin, buildScoreSubmissions } from './scoreSubmission';
import { getOrCreateDeviceId } from '../shared/deviceIdentity';
import { PlayerSlot } from '../shared/types';

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
  /** 단계를 바꿀 때 ref를 먼저 바꿔, 같은 틱에 도는 처리부·핸들러가 새 단계를 본다(렌더를 기다리지 않는다). */
  const setPhase = useCallback((next: GamePhase) => {
    gamePhaseRef.current = next;
    setGamePhase(next);
  }, []);
  const [roomId, setRoomId] = useState<string>('');
  const roomIdRef = useRef<string>(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__BEER_DEBUG__ = {
      snapshot: () => buildDebugSnapshot(engine, gamePhaseRef.current, performance.now()),
    };
    return () => {
      delete (window as any).__BEER_DEBUG__;
    };
  }, [engine]);
  const [lanIp, setLanIp] = useState<string>('');
  const [isServerFull, setIsServerFull] = useState(false);

  const [slots, setSlots] = useState<SlotPair>(() => createLobbySlots(loadLastInput()));
  const slotsRef = useRef<SlotPair>(slots);
  slotsRef.current = slots;
  const [mouseNicknameError, setMouseNicknameError] = useState<string | null>(null);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);
  const unsupportedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (unsupportedNoticeTimerRef.current) clearTimeout(unsupportedNoticeTimerRef.current);
    },
    []
  );
  const pendingPlayerCountRef = useRef<1 | 2>(1);
  /** 시작을 눌러 카운트다운에 들어간 뒤 판이 시작될 때까지 고정하는 인원수·매핑(그 사이 2P가 붙어도 어긋나지 않게). */
  const lockedStartRef = useRef<StartRoster | null>(null);
  const startGate = useMemo(() => getStartGate(slots), [slots]);

  // 호환용 파생값
  const primarySlot = getJoinedSlots(slots)[0];
  const pairedPlayer = primarySlot?.player;
  const isZeroCalibrated = slots.some((s) => s.isZeroCalibrated);
  const isControllerConnected = getJoinedSlots(slots).every(
    (s) => s.input !== 'mobile' || s.isConnected
  );
  const isControllerConnectedRef = useRef<boolean>(true);
  isControllerConnectedRef.current = isControllerConnected;
  const [topRankings, setTopRankings] = useState<RunRankingEntry[]>([]);
  const [teamRankings, setTeamRankings] = useState<TeamRankingEntry[]>([]);
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
  const [isAimLocked, setIsAimLocked] = useState<boolean>(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownSecRef = useRef<number | null>(null);
  countdownSecRef.current = countdownSec;
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

  const [grace, setGrace] = useState<GraceState | null>(null);
  const graceRef = useRef<GraceState | null>(null);
  graceRef.current = grace;
  const [graceRemainingSec, setGraceRemainingSec] = useState<number>(30);
  const onSlotReconnectedRef = useRef<(slot: PlayerSlot) => void>(() => {});

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

  // /sensor-test로 바로 들어오면 로비를 거치지 않아 슬롯→플레이어 매핑이 비어 있다. 폰이 붙을 때마다 맞춰 줘야
  // 폰 조준·사격이 플레이어 0에 전달된다(마우스 보조 입력이 없으므로 이 매핑이 곧 유일한 조준 경로다).
  useEffect(() => {
    if (initialPhase !== 'SANDBOX' || gamePhase !== 'SANDBOX') return;
    slotIndexMapRef.current = buildSandboxSlotMap(slots);
  }, [initialPhase, gamePhase, slots]);

  const canvasRef = useRef<GameCanvas3DHandle>(null);
  const crosshairRefs = useRef<[React.RefObject<CrosshairOverlayHandle>, React.RefObject<CrosshairOverlayHandle>]>([
    React.createRef(),
    React.createRef(),
  ]);
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
  const [tutorialRound, setTutorialRound] = useState<TutorialRoundState>({ round: 0, phase: 'ready' });

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
  /** 서버가 발급한 현재 판 ID. GAME_STARTED를 받기 전이나 판이 없으면 null. */
  const gameIdRef = useRef<number | null>(null);
  /** 응답을 기다리는 GAME_BEGIN의 beginId. 늦게 온 옛 응답을 걸러낸다. */
  const pendingBeginIdRef = useRef<string | null>(null);
  /** gameId를 받기 전에 고른 무기. GAME_STARTED를 받으면 보낸다. */
  const pendingWeaponsRef = useRef<{ slot: PlayerSlot; weaponKind: WeaponKind }[]>([]);
  const pairedPlayerRef = useRef<PlayerProfile | undefined>(undefined);
  pairedPlayerRef.current = pairedPlayer;

  const lastDiagUpdateTimeRef = useRef<number>(0);

  const [hoveredResultAction, setHoveredResultAction] = useState<'restart' | 'lobby' | null>(null);
  const hoveredResultActionRef = useRef<'restart' | 'lobby' | null>(null);

  const processorsRef = useRef<PlayerActionProcessor[]>([]);
  const slotIndexMapRef = useRef<Partial<Record<PlayerSlot, PlayerIndex>>>({});
  const processorFor = (index: PlayerIndex | undefined) => (index === undefined ? null : processorsRef.current[index] ?? null);

  const phoneAdaptersRef = useRef<Record<PlayerSlot, PhoneAdapter>>({
    1: new PhoneAdapter({
      slot: 1,
      sink: () => processorFor(slotIndexMapRef.current[1]),
      send: (msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(msg));
        }
      },
      roomId: () => roomIdRef.current,
      getTuning: () => tuningConfigRef.current,
    }),
    2: new PhoneAdapter({
      slot: 2,
      sink: () => processorFor(slotIndexMapRef.current[2]),
      send: (msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(msg));
        }
      },
      roomId: () => roomIdRef.current,
      getTuning: () => tuningConfigRef.current,
    }),
  });

  const mouseAdapterRef = useRef<MouseAdapter | null>(null);
  if (!mouseAdapterRef.current) {
    mouseAdapterRef.current = new MouseAdapter(
      () => processorFor(getMouseBinding(slotsRef.current, slotIndexMapRef.current) ?? undefined),
      WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS
    );
  }

  const handleStartGameRef = useRef<(opts?: { sameRoster?: boolean }) => void>(() => {});
  const startCountdownAndGameRef = useRef<() => void>(() => {});
  const handleReturnToLobbyRef = useRef<() => void>(() => {});
  const startResumeCountdownRef = useRef<() => void>(() => {});
  const handleContinueAloneRef = useRef<() => void>(() => {});

  const presentations = useMemo(
    () =>
      getPlayerPresentation({
        playerCount: engine.players.length,
        slotIndexMap: slotIndexMapRef.current,
        slots,
      }),
    [engine.players.length, slots]
  );
  const teamPresentation = useMemo(
    () => getTeamPresentation(engine.players.length),
    [engine.players.length]
  );
  const playerColors = useMemo(
    () => presentations.map((p) => (p.ringColorMode === 'player' ? p.color : null)),
    [presentations]
  );
  const ownerOutlineColors = useMemo(
    () => presentations.map((p) => p.ownerOutlineColor),
    [presentations]
  );
  const gunPresentations = useMemo(
    () =>
      presentations.map((p) => ({
        offsetX: p.gunOffsetX,
        ringColor: p.gunRingColor,
      })),
    [presentations]
  );
  const [cardAnchors, setCardAnchors] = useState<{ ownerIndex: PlayerIndex; leftPercent: number; topPercent: number }[]>([]);
  const [coopResult, setCoopResult] = useState<CoopResultInfo | null>(null);
  const submitTimeRef = useRef<number>(0);

  const highlightTeamKey = useMemo(() => {
    const joined = getJoinedSlots(slots);
    if (joined.length === 2) {
      const dev0 = joined[0].player?.deviceId;
      const dev1 = joined[1].player?.deviceId;
      return buildTeamKey(dev0, dev1) ?? undefined;
    }
    return undefined;
  }, [slots]);

  const highlightDeviceIds = useMemo(() => {
    const joined = getJoinedSlots(slots);
    const ids: string[] = [];
    for (const s of joined) {
      if (s.player?.deviceId) ids.push(s.player.deviceId);
    }
    return ids.length > 0 ? ids : undefined;
  }, [slots]);

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


  const handleShootEvent = useCallback((result: EngineShootResult) => {
    if (!result.fired) return;
    const player = engine.getPlayer(result.playerIndex);
    const isFever = player.scoreManager.getState().isFeverActive;
    const currentWeapon = result.weaponKind || player.weaponSystem.getState().weaponKind;
    soundSynth.playWeaponShoot(currentWeapon, isFever);

    if (result.shieldBlocked) {
      // Blocked by an obi shield: only the "ting", no hit sound or judgment banner
      soundSynth.playShieldBlockSound();
    } else if (result.grade !== 'MISS') {
      soundSynth.playHit(result.grade);
      const pres = presentations[result.playerIndex];
      judgmentRef.current?.show(result.grade, {
        ...(pres?.slotLabel ? { color: pres.color, label: pres.slotLabel, side: pres.popupSide } : {}),
        isFever,
      });
      if (gamePhaseRef.current === 'SANDBOX') {
        setSandboxJudgment({ grade: result.grade, key: Date.now() });
      }
    }

    if (result.interceptedProjectile) {
      soundSynth.playInterceptSound();
    }

    // Must run synchronously right after shootAt, before the render loop removes dead target meshes.
    const aim = processorsRef.current[result.playerIndex]?.aim;
    canvasRef.current?.playShotFx(result, aim);
    crosshairRefs.current[result.playerIndex]?.current?.kick();
  }, [engine, soundSynth]);

  const updateResultButtonHover = useCallback(() => {
    let hovered: 'restart' | 'lobby' | null = null;
    for (const proc of processorsRef.current) {
      const action = hitTestButton(proc.aim.aimX, proc.aim.aimY);
      if (action === 'restart' || action === 'lobby') {
        hovered = action;
        break;
      }
    }
    if (hoveredResultActionRef.current !== hovered) {
      hoveredResultActionRef.current = hovered;
      setHoveredResultAction(hovered);
    }
  }, [hitTestButton]);

  const tryStartFromLobby = useCallback(() => {
    // 이미 카운트다운이 돌고 있으면 그 시점에 확정한 인원·매핑을 덮어쓰지 않는다(재클릭·재사격 무시).
    if (countdownTimerRef.current) return;
    const decision = decideLobbyStart(slotsRef.current);
    if (!decision.start) {
      setStartNotice(decision.notice);
      setTimeout(() => setStartNotice(null), 2000);
      soundSynth.playHit('MISS');
      return;
    }
    pendingPlayerCountRef.current = decision.playerCount;
    slotIndexMapRef.current = decision.map;
    lockedStartRef.current = { playerCount: decision.playerCount, map: decision.map };

    const hasPhone = slotsRef.current.some((s) => s.input === 'mobile' && s.player);
    if (hasPhone) {
      startCountdownAndGameRef.current();
    } else {
      handleStartGameRef.current();
    }
  }, [soundSynth]);

  const pressScreenButton = useCallback((button: ShootableButton) => {
    if (button === 'start') {
      tryStartFromLobby();
    } else if (button === 'restart') {
      handleStartGameRef.current({ sameRoster: true });
    } else if (button === 'lobby') {
      handleReturnToLobbyRef.current();
    }
  }, [tryStartFromLobby]);

  const syncProcessors = useCallback(() => {
    const isLobby = gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING';
    // 로비에서는 카운트다운이 도는 동안에만 확정한 로스터를 쓴다(시작을 시도했지만 카운트다운이 안 돈 경우의 낡은 잠금을 무시).
    const lobbyRoster = isLobby
      ? resolveStartRoster(
          countdownTimerRef.current ? lockedStartRef.current : null,
          slotsRef.current,
          Math.max(1, getJoinedSlots(slotsRef.current).length) as 1 | 2
        )
      : null;
    if (lobbyRoster) {
      slotIndexMapRef.current = lobbyRoster.map;
    }
    const targetCount = lobbyRoster ? lobbyRoster.playerCount : engine.players.length;

    processorsRef.current.forEach((p) => p.stopAll());
    processorsRef.current = [];

    for (let p = 0; p < targetCount; p++) {
      const pIdx = p as PlayerIndex;
      const processor = new PlayerActionProcessor({
        engine,
        playerIndex: pIdx,
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
        onShot: (res) => {
          handleShootEvent(res);
        },
        onSkill: (res) => {
          soundSynth.playSkillActivation(res.weaponKind);
          canvasRef.current?.triggerSkillEffect?.(res.weaponKind, pIdx, res.affectedTargets);
        },
        onFeverStarted: (_idx) => {
          soundSynth.playFeverStart();
        },
        onAim: (x, y, idx, immediate) => {
          crosshairRefs.current[idx]?.current?.updatePosition(x, y, immediate);
          canvasRef.current?.setAim(x, y, immediate, idx);
          const phase = gamePhaseRef.current;
          if (phase === 'GAMEOVER' || phase === 'VICTORY') {
            updateResultButtonHover();
          }
        },
      });
      processorsRef.current.push(processor);
    }
  }, [engine, hitTestButton, pressScreenButton, handleShootEvent, soundSynth, updateResultButtonHover]);

  useEffect(() => {
    syncProcessors();
  }, [syncProcessors, slots]);

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

    // The server can restart (tsx watch in dev, a crash, a network drop). Without reconnecting the PC never comes back,
    // the room stays gone, and every phone loops on ROOM_NOT_FOUND. Reconnect and recreate the same room from its saved code.
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMessage;
        switch (msg.type) {
          case 'ROOM_CREATED':
            setIsServerFull(false);
            setRoomId(msg.roomId);
            saveRoomId(msg.roomId);
            if (msg.rankings) setTopRankings(msg.rankings);
            if (msg.teamRankings) setTeamRankings(msg.teamRankings);
            if (msg.lanIp) setLanIp(msg.lanIp);
            // 서버가 재시작되면 localPlayers가 비므로, 마우스 슬롯을 다시 조회해 서버 기록을 복구한다.
            for (const seat of slotsRef.current) {
              // 기억해 둔 마우스 1P는 아직 player가 없어도 조회해야 등록된 기기가 바로 준비 완료가 된다.
              if (seat.input === 'mouse' && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'LOOKUP_LOCAL_PLAYER', roomId: msg.roomId, deviceId: getOrCreateDeviceId(), slot: seat.slot }));
              }
            }
            break;

          case 'CONTROLLER_UNSUPPORTED': {
            // 로비에서만 슬롯을 비운다. 판 도중이면 곧 이어지는 CONTROLLER_DISCONNECTED의 유예·일시정지 처리에 맡긴다.
            // (소켓 핸들러의 클로저는 오래된 state를 읽으므로 반드시 ref를 쓴다.)
            const inLobby = gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING';
            if (!inLobby) break;
            setSlots((prev) => applyControllerUnsupported(prev, msg.slot));
            setUnsupportedNotice(`${msg.slot}P에 연결한 폰은 센서가 지원되지 않아요. 다른 폰으로 접속해 주세요`);
            if (unsupportedNoticeTimerRef.current) clearTimeout(unsupportedNoticeTimerRef.current);
            unsupportedNoticeTimerRef.current = setTimeout(() => setUnsupportedNotice(null), 6000);
            break;
          }

          case 'CONTROLLER_PAIRED': {
            const slot = msg.slot;
            // 로비(PAIRING/ZEROING)에서만 같은 기기의 이전 슬롯을 비운다. 판 중엔 슬롯 매핑 고정.
            const inLobby =
              gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING';
            setSlots((prev) =>
              inLobby
                ? applyControllerPaired(prev, slot, msg.player)
                : updateSlot(chooseSlotInput(prev, slot, 'mobile').slots, slot, {
                    player: msg.player,
                    isConnected: true,
                  })
            );
            soundSynth.unlockAudio();
            // A phone that only re-attached (e.g. Safari reloaded the page after unlocking) has no sensors yet.
            // The game resumes on ZERO_CALIBRATED, which the phone sends once its sensors are on.
            break;
          }

          case 'ZERO_CALIBRATED': {
            const slot = msg.slot ?? 1;
            setSlots((prev) => updateSlot(prev, slot, { isZeroCalibrated: true, isConnected: true }));
            if (!msg.resume) {
              phoneAdaptersRef.current[slot]?.resetZero();
            }
            if (gamePhaseRef.current === 'PAIRING') {
              setPhase('ZEROING');
            } else if (gamePhaseRef.current === 'PLAYING') {
              onSlotReconnectedRef.current(slot);
            }
            break;
          }

          case 'LOCAL_PLAYER_REGISTERED':
            // 조회 응답이 오기 전에 슬롯을 폰으로 바꾸거나 비웠다면 늦게 온 응답은 무시한다.
            setSlots((prev) =>
              prev.find((s) => s.slot === msg.slot)?.input !== 'mouse' ? prev : updateSlot(prev, msg.slot, { player: msg.player })
            );
            setMouseNicknameError(null);
            break;

          case 'LOCAL_PLAYER_UNKNOWN':
            setMouseNicknameError(null);
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
            if (countdownTimerRef.current) break;
            if (gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING') {
              tryStartFromLobby();
            }
            break;

          case 'SENSOR_RELAY': {
            const slot = msg.slot ?? 1;
            const p = msg.payload;
            const adapter = phoneAdaptersRef.current[slot];
            if (!adapter) break;

            const map = slotIndexMapRef.current;
            const soloSlot = getSoloSlot(map, slotsRef.current);
            const isPlayerZeroSlot = slot === soloSlot;

            if (isPlayerZeroSlot) {
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

              const frameResult = adapter.onSensorFrame(p);
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

                  setSensorLiveMetrics((prev) =>
                    mergeSensorFrameMetrics(prev, {
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
                      // 스냅이 아닐 때는 일부러 undefined로 덮어쓴다(키를 생략하면 이전 값이 남는다).
                      lastSnapAt: p.snapFire ? Date.now() : undefined,
                    })
                  );
                }
              }
            } else {
              const frameResult = adapter.onSensorFrame(p);
              if (frameResult?.cockedJustNow) {
                soundSynth.playCocking();
              }
            }
            break;
          }

          case 'RANKING_UPDATED':
            setTopRankings(msg.rankings);
            if (msg.teamRankings) setTeamRankings(msg.teamRankings);
            if (msg.updatedPlayer) {
              const up = msg.updatedPlayer;
              setSlots((prev) => {
                const s1 = prev[0].player?.deviceId === up.deviceId ? { ...prev[0], player: up } : prev[0];
                const s2 = prev[1].player?.deviceId === up.deviceId ? { ...prev[1], player: up } : prev[1];
                return [s1, s2];
              });
              if (engine.players.length === 1) {
                const curP = pairedPlayerRef.current;
                if (curP && up.deviceId === curP.deviceId) {
                  setIsNewRecord(up.bestScore > (curP.bestScore || 0));
                }
              } else {
                setIsNewRecord(false);
                const p0Slot = indexToSlot(slotIndexMapRef.current, 0);
                const p1Slot = indexToSlot(slotIndexMapRef.current, 1);
                const p0Dev = slotsRef.current.find((s) => s.slot === p0Slot)?.player?.deviceId;
                const p1Dev = slotsRef.current.find((s) => s.slot === p1Slot)?.player?.deviceId;
                const partnerDev = up.deviceId === p0Dev ? p1Dev : up.deviceId === p1Dev ? p0Dev : undefined;

                if (partnerDev) {
                  const best = up.coopBests?.[partnerDev] ?? null;
                  setCoopResult((r) => {
                    if (!r) return null;
                    const submittedIso = new Date(submitTimeRef.current).toISOString();
                    const isNew = !!best && best.teamScore === r.teamScore && best.playedAt >= submittedIso;
                    return { ...r, teamBest: best, isNewTeamBest: isNew };
                  });
                }
              }
            }
            break;

          case 'GAME_STARTED':
            if (msg.beginId !== pendingBeginIdRef.current) break; // 이전 판의 늦은 응답
            pendingBeginIdRef.current = null;
            gameIdRef.current = msg.gameId;
            for (const w of pendingWeaponsRef.current) {
              wsRef.current?.send(JSON.stringify({ type: 'WEAPON_CHOSEN', roomId: roomIdRef.current, gameId: msg.gameId, slot: w.slot, weaponKind: w.weaponKind }));
            }
            pendingWeaponsRef.current = [];
            break;

          case 'ERROR':
            if (msg.code === 'SERVER_FULL') {
              setIsServerFull(true);
              break;
            }
            if (msg.code === 'GAME_BEGIN_REJECTED') {
              pendingBeginIdRef.current = null;
              console.warn('GAME_BEGIN rejected; this run will not be recorded', msg.message);
              break;
            }
            if (msg.code === 'INVALID_NICKNAME') {
              setMouseNicknameError(msg.message);
              break;
            }
            if (msg.code === 'CONTROLLER_DISCONNECTED') {
              const droppedSlot = msg.slot ?? 1;
              setSlots((prev) => updateSlot(prev, droppedSlot, { isConnected: false }));
              processorsRef.current.forEach((p) => p.stopAll());
              if (gamePhaseRef.current === 'PLAYING') {
                const playerIndex = slotIndexMapRef.current[droppedSlot];
                const graceMs = engine.rules.disconnectGraceMs;
                if (
                  graceMs !== null &&
                  playerIndex !== undefined &&
                  !engine.getPlayer(playerIndex).isAway
                ) {
                  const action = decideDisconnectAction(graceRef.current, droppedSlot);
                  if (action === 'second_loss') {
                    setGrace(null);
                    setPauseMenu({ open: true, reason: 'CONTROLLER_LOST' });
                  } else if (action === 'start') {
                    const newGrace = startGrace(droppedSlot, playerIndex, performance.now(), graceMs);
                    setGrace(newGrace);
                    // graceRef는 렌더 때만 갱신된다. 같은 슬롯의 알림이 연달아 오면 이 값으로 중복을 걸러야 한다.
                    graceRef.current = newGrace;
                    setGraceRemainingSec(Math.ceil(graceMs / 1000));
                    engine.setPaused(true, performance.now());
                    setIsExitConfirmOpen(false);
                    setPauseMenu({ open: true, reason: 'PLAYER_LOST' });
                  }
                  // 'ignore': 이미 이 슬롯의 유예가 진행 중이다. 기한을 다시 시작하지 않는다.
                } else {
                  if (pauseMenuOpenRef.current) {
                    // The player had already paused: keep the menu, but it must now wait for the phone.
                    setPauseMenu({ open: true, reason: 'CONTROLLER_LOST' });
                  } else {
                    handleOpenPauseRef.current('CONTROLLER_LOST');
                  }
                }
              }
            }
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message', err);
      }
    };

    const connect = () => {
      if (disposed) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        socket = new WebSocket(`${protocol}//${window.location.hostname}:8787`);
      }
      wsRef.current = socket;

      socket.onopen = () => {
        if (wsRef.current !== socket) return;
        attempt = 0;
        socket.send(JSON.stringify({ type: 'CREATE_ROOM', roomId: loadSavedRoomId() }));
      };
      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return;
        handleMessage(event);
      };
      socket.onclose = () => {
        // A replaced or disposed socket must not start another retry loop.
        if (disposed || wsRef.current !== socket) return;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, getReconnectDelayMs(attempt));
        attempt += 1;
      };
    };
    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      processorsRef.current.forEach((p) => p.stopAll());
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      lockedStartRef.current = null;
      const current = wsRef.current;
      wsRef.current = null;
      current?.close();
    };
  }, [engine, soundSynth, handleShootEvent]);

  useEffect(() => {
    engine.onWeaponChosen = (playerIndex, weaponKind) => {
      const slot = indexToSlot(slotIndexMapRef.current, playerIndex);
      if (slot === undefined) return;
      const gameId = gameIdRef.current;
      if (gameId === null) {
        pendingWeaponsRef.current.push({ slot, weaponKind });
        return;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && roomIdRef.current) {
        ws.send(JSON.stringify({ type: 'WEAPON_CHOSEN', roomId: roomIdRef.current, gameId, slot, weaponKind }));
      }
    };
    return () => {
      engine.onWeaponChosen = null;
    };
  }, [engine]);

  const submitScores = useCallback(() => {
    submitTimeRef.current = Date.now();
    const gameId = gameIdRef.current;
    if (gameId === null) {
      console.warn('Score not submitted: no gameId');
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      const messages = buildScoreSubmissions(engine, slotsRef.current, slotIndexMapRef.current, roomId, gameId);
      messages.forEach((msg) => wsRef.current!.send(JSON.stringify(msg)));
      gameIdRef.current = null;
    }
    if (engine.players.length >= 2) {
      const p0Stats = engine.getPlayRunStats(0);
      const p1Stats = engine.getPlayRunStats(1);
      if (p0Stats && p1Stats) {
        const p0Pres = presentations[0];
        const p1Pres = presentations[1];
        const p0Slot = indexToSlot(slotIndexMapRef.current, 0);
        const p1Slot = indexToSlot(slotIndexMapRef.current, 1);
        const p0Profile = slotsRef.current.find((s) => s.slot === p0Slot)?.player;
        const p1Profile = slotsRef.current.find((s) => s.slot === p1Slot)?.player;
        const teamScore = p0Stats.totalScore + p1Stats.totalScore;

        setCoopResult({
          players: [
            {
              slotLabel: p0Pres?.slotLabel ?? '1P',
              color: p0Pres?.color ?? '#38bdf8',
              nickname: p0Profile?.nickname ?? p0Pres?.nickname ?? '1P',
              score: p0Stats.totalScore,
              maxCombo: p0Stats.maxCombo,
              kills: p0Stats.kills,
              accuracy: p0Stats.accuracy,
              weaponKind: p0Stats.weaponKind,
              inputKind: slotsRef.current.find((s) => s.slot === p0Slot)?.input ?? undefined,
              leftEarly: Boolean(p0Stats.coop?.leftEarly),
            },
            {
              slotLabel: p1Pres?.slotLabel ?? '2P',
              color: p1Pres?.color ?? '#ff6b3d',
              nickname: p1Profile?.nickname ?? p1Pres?.nickname ?? '2P',
              score: p1Stats.totalScore,
              maxCombo: p1Stats.maxCombo,
              kills: p1Stats.kills,
              accuracy: p1Stats.accuracy,
              weaponKind: p1Stats.weaponKind,
              inputKind: slotsRef.current.find((s) => s.slot === p1Slot)?.input ?? undefined,
              leftEarly: Boolean(p1Stats.coop?.leftEarly),
            },
          ],
          teamScore,
          teamBest: undefined,
          isNewTeamBest: false,
        });
      }
    } else {
      setCoopResult(null);
    }
  }, [engine, roomId, presentations]);

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
      const map = slotIndexMapRef.current;
      ([1, 2] as PlayerSlot[]).forEach((s) => {
        const pIdx = map[s];
        if (pIdx !== undefined && processorsRef.current[pIdx]) {
          phoneAdaptersRef.current[s]?.syncFeedback(processorsRef.current[pIdx].getState());
        }
      });

      // Synchronize game over / victory
      if (engine.gamePhase === 'GAMEOVER' && gamePhaseRef.current === 'PLAYING') {
        processorsRef.current.forEach((p) => p.stopAll());
        setPhase('GAMEOVER');
        soundSynth.playHit('MISS');
        submitScores();
      } else if (engine.gamePhase === 'VICTORY' && gamePhaseRef.current === 'PLAYING') {
        processorsRef.current.forEach((p) => p.stopAll());
        setPhase('VICTORY');
        soundSynth.playFeverStart();
        submitScores();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [engine, gamePhase, soundSynth, submitScores]);

  const handleStartGame = useCallback((opts?: { sameRoster?: boolean }) => {
    processorsRef.current.forEach((p) => p.stopAll());
    skillGraceUntilRef.current = performance.now() + 1500;
    let playerCount = engine.players.length as 1 | 2;
    if (!opts?.sameRoster) {
      const roster = resolveStartRoster(lockedStartRef.current, slotsRef.current, pendingPlayerCountRef.current);
      lockedStartRef.current = null;
      playerCount = roster.playerCount;
      slotIndexMapRef.current = roster.map;
    }
    engine.startGame({ withWeaponSelect: true, playerCount });
    const map = slotIndexMapRef.current;
    ([1, 2] as PlayerSlot[]).forEach((s) => {
      const pIdx = map[s];
      const slotState = slotsRef.current.find((slot) => slot.slot === s);
      if (pIdx !== undefined && slotState?.input === 'mobile' && !slotState.isConnected) {
        engine.setPlayerAway(pIdx, true, performance.now());
      }
    });
    gameIdRef.current = null;
    pendingWeaponsRef.current = [];
    const beginId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const roomIdNow = roomIdRef.current;
    const beginMsg = roomIdNow ? buildGameBegin(slotsRef.current, slotIndexMapRef.current, roomIdNow, beginId) : null;
    pendingBeginIdRef.current = beginMsg ? beginId : null;
    if (beginMsg) {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(beginMsg));
    } else {
      console.warn('GAME_BEGIN not sent: missing room or player identity; this run will not be recorded');
    }
    setPhase('PLAYING');
    syncProcessors();
    setIsNewRecord(false);
    setCoopResult(null);
  }, [engine, syncProcessors]);
  handleStartGameRef.current = handleStartGame;

  const startCountdownAndGame = useCallback(() => {
    soundSynth.unlockAudio();
    if (countdownTimerRef.current) return;
    if (gamePhaseRef.current !== 'PAIRING' && gamePhaseRef.current !== 'ZEROING') return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      const firstJoined = getJoinedSlots(slotsRef.current)[0];
      const deviceId = firstJoined?.player?.deviceId ?? getOrCreateDeviceId();
      wsRef.current.send(
        JSON.stringify({
          type: 'START_GAME_REQUEST',
          roomId,
          deviceId,
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
        const map = slotIndexMapRef.current;
        ([1, 2] as PlayerSlot[]).forEach((s) => {
          if (map[s] !== undefined && slotsRef.current.find((slot) => slot.slot === s)?.input === 'mobile') {
            phoneAdaptersRef.current[s]?.autoZeroFromLatest();
          }
        });
        handleStartGame();
      }
    }, 1000);
  }, [handleStartGame, roomId, soundSynth]);

  startCountdownAndGameRef.current = startCountdownAndGame;

  const startResumeCountdown = useCallback(() => {
    soundSynth.unlockAudio();
    if (countdownTimerRef.current) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      const firstJoined = getJoinedSlots(slotsRef.current)[0];
      const deviceId = firstJoined?.player?.deviceId ?? getOrCreateDeviceId();
      wsRef.current.send(
        JSON.stringify({
          type: 'START_GAME_REQUEST',
          roomId,
          deviceId,
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
        const map = slotIndexMapRef.current;
        ([1, 2] as PlayerSlot[]).forEach((s) => {
          if (map[s] !== undefined && slotsRef.current.find((slot) => slot.slot === s)?.input === 'mobile') {
            phoneAdaptersRef.current[s]?.autoZeroFromLatest();
          }
        });
        engine.setPaused(false, performance.now());
      }
    }, 1000);
  }, [engine, roomId, soundSynth]);

  startResumeCountdownRef.current = startResumeCountdown;

  const handleContinueAlone = useCallback(() => {
    if (!graceRef.current) return;
    const currentGrace = graceRef.current;
    engine.setPlayerAway(currentGrace.playerIndex, true, performance.now());
    setSlots((prev) => updateSlot(prev, currentGrace.slot, { isAway: true }));
    setGrace(null);
    if (engine.getActivePlayers().length >= 1) {
      setIsExitConfirmOpen(false);
      setPauseMenu({ open: false, reason: 'USER' });
      startResumeCountdown();
    } else {
      setPauseMenu({ open: true, reason: 'CONTROLLER_LOST' });
    }
  }, [engine, startResumeCountdown]);

  handleContinueAloneRef.current = handleContinueAlone;

  useEffect(() => {
    if (!grace) return;
    const timer = setInterval(() => {
      const now = performance.now();
      const tick = tickGrace(grace, now);
      setGraceRemainingSec(tick.remainingSec);
      if (tick.expired) {
        handleContinueAloneRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [grace]);

  const onSlotReconnected = useCallback(
    (slot: PlayerSlot) => {
      if (gamePhaseRef.current === 'PLAYING') {
        const playerIndex = slotIndexMapRef.current[slot];
        if (playerIndex !== undefined) {
          if (graceRef.current && graceRef.current.slot === slot) {
            setGrace(null);
            setIsExitConfirmOpen(false);
            setPauseMenu({ open: false, reason: 'USER' });
            startResumeCountdown();
          } else if (engine.getPlayer(playerIndex).isAway) {
            engine.setPlayerAway(playerIndex, false, performance.now());
            setSlots((prev) => updateSlot(prev, slot, { isAway: false }));
          }
        }
      }
    },
    [engine, startResumeCountdown]
  );
  onSlotReconnectedRef.current = onSlotReconnected;

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
    if (pauseMenuReasonRef.current === 'PLAYER_LOST') return;
    // Without the phone nobody can aim, so a resume would only let the countdown end in a free hit.
    if (pauseMenuReasonRef.current === 'CONTROLLER_LOST' && !isControllerConnectedRef.current) return;

    if (engine.rules.disconnectGraceMs !== null) {
      const map = slotIndexMapRef.current;
      const droppedSlot = ([1, 2] as PlayerSlot[]).find(
        (s) =>
          map[s] !== undefined &&
          !slotsRef.current.find((slot) => slot.slot === s)?.isConnected &&
          !engine.getPlayer(map[s]!).isAway
      );
      if (droppedSlot !== undefined) {
        const pIdx = map[droppedSlot]!;
        const graceMs = engine.rules.disconnectGraceMs;
        const newGrace = startGrace(droppedSlot, pIdx, performance.now(), graceMs);
        setGrace(newGrace);
        setGraceRemainingSec(Math.ceil(graceMs / 1000));
        setIsExitConfirmOpen(false);
        setPauseMenu({ open: true, reason: 'PLAYER_LOST' });
        return;
      }
    }

    setIsExitConfirmOpen(false);
    setPauseMenu({ open: false, reason: 'USER' });
    startResumeCountdown();
  }, [engine, startResumeCountdown]);

  const handleRestartFromPause = useCallback(() => {
    const abandonId = gameIdRef.current;
    if (abandonId !== null && roomIdRef.current) {
      wsRef.current?.readyState === WebSocket.OPEN &&
        wsRef.current.send(JSON.stringify({ type: 'GAME_ABANDON', roomId: roomIdRef.current, gameId: abandonId }));
    }
    gameIdRef.current = null;
    pendingBeginIdRef.current = null;
    lockedStartRef.current = null;
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownSec(null);
    setGrace(null);
    // startGame() does not clear the pause flag, so lift it first (this also shifts the frozen timers).
    engine.setPaused(false, performance.now());
    setPauseMenu({ open: false, reason: 'USER' });
    handleStartGame({ sameRoster: true });
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
    if (gamePhase !== 'PLAYING') {
      setGrace(null);
      if (pauseMenuOpenRef.current) {
        setIsExitConfirmOpen(false);
        setPauseMenu({ open: false, reason: 'USER' });
      }
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
    const soloSlot = getSoloSlot(slotIndexMapRef.current, slotsRef.current);
    phoneAdaptersRef.current[soloSlot]?.autoZeroFromLatest();
  }, []);

  const handleStartTutorial = useCallback(() => {
    setIsGuideOpen(false);
    const soloSlot = getSoloSlot(slotIndexMapRef.current, slotsRef.current);
    slotIndexMapRef.current = { [soloSlot]: 0 };
    engine.startTutorialMode();
    const director = new TutorialDirector(engine, (step) => setTutorialStep(step), setTutorialRound);
    tutorialDirectorRef.current = director;
    director.start(performance.now());
    setTutorialStep(director.step);
    setTutorialRound({ round: 0, phase: 'ready' });
    syncProcessors();
    setPhase('TUTORIAL');
  }, [engine, syncProcessors]);

  const handleExitTutorial = useCallback(() => {
    processorsRef.current.forEach((p) => p.stopAll());
    if (tutorialDirectorRef.current) {
      tutorialDirectorRef.current.stop();
      tutorialDirectorRef.current = null;
    }
    engine.exitTutorialMode();
    syncProcessors();
    setPhase('PAIRING');
  }, [engine, syncProcessors]);

  /** 튜토리얼 수료 화면의 "실전 배틀 시작": 튜토리얼을 먼저 정리해 단계를 PAIRING으로 돌린 뒤 로비 시작 흐름을 탄다.
   *  (setPhase는 단계 ref를 즉시 갱신한다. 정리 없이 시작하면 startCountdownAndGame이 단계 검사에 걸려 폰 연결 상태에서 무반응이었다.) */
  const handleStartRealGameFromTutorial = useCallback(() => {
    handleExitTutorial();
    pressScreenButton('start');
  }, [handleExitTutorial, pressScreenButton]);

  const handleRenewRoom = useCallback(() => {
    clearSavedRoomId();
    window.location.reload();
  }, []);

  const sendLookupLocalPlayer = useCallback((slot: PlayerSlot) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && roomIdRef.current) {
      ws.send(JSON.stringify({ type: 'LOOKUP_LOCAL_PLAYER', roomId: roomIdRef.current, deviceId: getOrCreateDeviceId(), slot }));
    }
  }, []);

  const handleChooseInput = useCallback((slot: PlayerSlot, input: SlotInput | null) => {
    const res = chooseSlotInput(slotsRef.current, slot, input);
    if (res.rejected) return;
    const changedToMouse = input === 'mouse' && slotsRef.current.find((s) => s.slot === slot)?.input !== 'mouse';
    setSlots(res.slots);
    if (slot === 1 && input !== null) saveLastInput(input);
    if (changedToMouse) sendLookupLocalPlayer(slot);
  }, [sendLookupLocalPlayer]);

  const handleEditMouseNickname = useCallback((slot: PlayerSlot) => {
    setSlots((prev) => updateSlot(prev, slot, { player: undefined }));
    setMouseNicknameError(null);
  }, []);

  const handleSubmitMouseNickname = useCallback((slot: PlayerSlot, nickname: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomIdRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'REGISTER_LOCAL_PLAYER',
          roomId: roomIdRef.current,
          deviceId: getOrCreateDeviceId(),
          nickname,
          slot,
        })
      );
    }
  }, []);

  const handleReturnToLobby = useCallback(() => {
    setGrace(null);
    processorsRef.current.forEach((p) => p.stopAll());
    engine.gamePhase = 'PAIRING';
    syncProcessors();
    // 로비가 다시 열릴 때: 마우스 슬롯은 비우고, 1P는 마지막 입력 방식, 2P는 모바일로 미리 선택한다.
    setSlots((prev) => applyLobbyReturnDefaults(prev, loadLastInput()));
    // 기억한 입력이 마우스면 서버 조회가 필요하다(업데이트 함수 밖에서 보낸다: StrictMode 이중 호출 방지).
    if (loadLastInput() === 'mouse' && slotsRef.current[0].input !== 'mobile') sendLookupLocalPlayer(1);
    setPhase('PAIRING');
    setCoopResult(null);
  }, [engine, syncProcessors, sendLookupLocalPlayer]);
  handleReturnToLobbyRef.current = handleReturnToLobby;

  // Leaving from the pause menu drops this run's score (no submitScore), like restart does.
  const handleExitToLobbyFromPause = useCallback(() => {
    const abandonId = gameIdRef.current;
    if (abandonId !== null && roomIdRef.current) {
      wsRef.current?.readyState === WebSocket.OPEN &&
        wsRef.current.send(JSON.stringify({ type: 'GAME_ABANDON', roomId: roomIdRef.current, gameId: abandonId }));
    }
    gameIdRef.current = null;
    pendingBeginIdRef.current = null;
    lockedStartRef.current = null;
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownSec(null);
    setGrace(null);
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
      {isServerFull && (
        <div
          data-testid="server-full-banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20000,
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: '15px',
            fontWeight: 800,
            color: '#fef3c7',
            background: 'rgba(180, 83, 9, 0.92)',
            pointerEvents: 'none',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          👥 접속자가 많아요. 자리가 나면 자동으로 연결됩니다.
        </div>
      )}
      {/* 1. 3D WebGL Canvas */}
      <GameCanvas3D
        ref={canvasRef}
        engine={engine}
        playerColors={playerColors}
        ownerOutlineColors={ownerOutlineColors}
        gunPresentations={gunPresentations}
        onCardAnchorsUpdate={setCardAnchors}
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
          <SelectRoundOverlay
            selection={hudState.selection}
            presentations={presentations}
            cardAnchors={cardAnchors}
          />
          <MonsterHpBarLayer ref={hpLayerRef} />
          <ArcadeOverlayHUD
            lives={hudState.lives}
            maxLives={engine.maxLives}
            wave={hudState.wave}
            totalWaves={STAGE_CONSTANTS.TOTAL_WAVES}
            bosses={hudState.bosses}
            activeBuffs={hudState.activeBuffs}
            waveProgress={hudState.waveProgress}
            players={hudState.players}
            presentations={presentations}
            team={teamPresentation}
            onOpenGuide={handleOpenGuide}
            onPause={gamePhase === 'PLAYING' ? () => handleOpenPause('USER') : undefined}
          />
          {engine.players.map((p, i) => {
            const pScoreState = p.scoreManager.getState();
            const pProc = processorsRef.current[i];
            const pAim = pProc?.aim ?? { aimX: 0, aimY: 0 };
            const playerSnap = hudState.players[i];
            const pWeapon = p.weaponSystem.getState();
            const pres = presentations[i];
            const weaponKind = playerSnap?.weaponKind ?? pWeapon.weaponKind;
            const weaponLevel = playerSnap?.weaponLevel ?? pWeapon.weaponLevel;
            return (
              <CrosshairOverlay
                key={i}
                ref={crosshairRefs.current[i]}
                aimX={pAim.aimX}
                aimY={pAim.aimY}
                isFeverActive={pScoreState.isFeverActive}
                isWideScopeActive={engine.isBuffActive('wide_scope', undefined, i as PlayerIndex)}
                isPowerShotActive={engine.isBuffActive('power_shot', undefined, i as PlayerIndex)}
                isAimLocked={i === 0 ? isAimLocked : false}
                weaponKind={weaponKind}
                weaponLevel={weaponLevel}
                isReloading={playerSnap?.isReloading ?? pWeapon.isReloading}
                isPaused={hudState.isPaused || hudState.isRewardCardPending || hudState.isWeaponSelectPending}
                playerColor={pres?.ringColorMode === 'player' ? pres.color : undefined}
                nameTag={formatCrosshairNameTag(weaponKind, weaponLevel, pres?.slotLabel ?? null)}
                hidden={playerSnap?.isAway ?? p.isAway}
                gaugeSource={playerSnap}
              />
            );
          })}
          <JudgmentBanner ref={judgmentRef} />
        </>
      )}

      {/* 2-B. Tutorial Mode Interactive HUD */}
      {gamePhase === 'TUTORIAL' && (
        <>
          <TutorialGuideOverlay
            step={tutorialStep}
            targetsRemaining={engine.activeTargets.length}
            isFeverReady={hudState.players[0]?.isFeverReady ?? false}
            isFeverActive={hudState.players[0]?.isFeverActive ?? false}
            inputKind={presentations[0]?.inputKind ?? 'mouse'}
            weaponKind={hudState.players[0]?.weaponKind ?? 'shotgun'}
            skillRound={tutorialRound.round}
            skillPhase={tutorialRound.phase}
            onStartRealGame={handleStartRealGameFromTutorial}
            onExitToLobby={handleExitTutorial}
          />
          {hudState.players.map((s, i) => (
            <PlayerPanel
              key={i}
              snapshot={s}
              presentation={presentations[i]}
              isPaused={hudState.isPaused || hudState.isRewardCardPending || hudState.isWeaponSelectPending}
            />
          ))}
          <CrosshairOverlay
            ref={crosshairRefs.current[0]}
            aimX={processorsRef.current[0]?.aim.aimX ?? 0}
            aimY={processorsRef.current[0]?.aim.aimY ?? 0}
            isFeverActive={hudState.players[0]?.isFeverActive ?? false}
            isWideScopeActive={false}
            isPowerShotActive={false}
            isAimLocked={isAimLocked}
            weaponKind={hudState.players[0]?.weaponKind ?? 'shotgun'}
            weaponLevel={hudState.players[0]?.weaponLevel ?? 1}
            isReloading={hudState.players[0]?.isReloading ?? false}
            isPaused={hudState.isPaused}
            gaugeSource={hudState.players[0]}
          />
          <JudgmentBanner ref={judgmentRef} />
        </>
      )}

      {/* 2-C. Sandbox Mode Interactive HUD & Controls */}
      {gamePhase === 'SANDBOX' && (
        <>
          <SensorAndModuleTestLabOverlay
            roomId={roomId}
            onOpenSensorLab={handleOpenSensorLab}
            lanIp={lanIp}
            pairedPlayer={pairedPlayer}
            diagnostics={diagnostics}
            targetsCount={engine.activeTargets.length}
            stationarySpawn={stationarySpawn}
            infiniteAmmo={sandboxInfiniteAmmo}
            ammo={hudState.players[0]?.ammo ?? 0}
            maxAmmo={hudState.players[0]?.maxAmmo ?? 0}
            isReloading={hudState.players[0]?.isReloading ?? false}
            feverGauge={hudState.players[0]?.feverGauge ?? 0}
            isFeverReady={hudState.players[0]?.isFeverReady ?? false}
            isFeverActive={hudState.players[0]?.isFeverActive ?? false}
            activeBuffs={hudState.activeBuffs}
            lastJudgment={sandboxJudgment}
            weaponKind={hudState.players[0]?.weaponKind ?? 'shotgun'}
            weaponLevel={hudState.players[0]?.weaponLevel ?? 1}
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
              const soloSlot = getSoloSlot(slotIndexMapRef.current, slotsRef.current);
              phoneAdaptersRef.current[soloSlot]?.autoZeroFromLatest();
            }}
            onStartRealGame={() => pressScreenButton('start')}
            onExitToLobby={() => {
              engine.exitSandboxMode();
              setPhase('PAIRING');
            }}
          />
          <CrosshairOverlay
            ref={crosshairRefs.current[0]}
            aimX={processorsRef.current[0]?.aim.aimX ?? 0}
            aimY={processorsRef.current[0]?.aim.aimY ?? 0}
            isFeverActive={hudState.players[0]?.isFeverActive ?? false}
            isWideScopeActive={hudState.players[0]?.isWideScopeActive ?? false}
            isPowerShotActive={hudState.players[0]?.isPowerShotActive ?? false}
            isAimLocked={isAimLocked}
            weaponKind={hudState.players[0]?.weaponKind ?? 'shotgun'}
            weaponLevel={hudState.players[0]?.weaponLevel ?? 1}
            isReloading={hudState.players[0]?.isReloading ?? false}
            isPaused={hudState.isPaused}
            gaugeSource={hudState.players[0]}
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
            slots={slots}
            startGate={startGate}
            topRankings={topRankings}
            teamRankings={teamRankings}
            highlightTeamKey={highlightTeamKey}
            highlightDeviceIds={highlightDeviceIds}
            mouseNicknameError={mouseNicknameError}
            startNotice={startNotice}
            unsupportedNotice={unsupportedNotice}
            onChooseInput={handleChooseInput}
            onSubmitMouseNickname={handleSubmitMouseNickname}
            onEditMouseNickname={handleEditMouseNickname}
            onStart={() => pressScreenButton('start')}
            onOpenGuide={handleOpenGuide}
            onStartTutorial={handleStartTutorial}
            onRenewRoom={handleRenewRoom}
          />
          {slots.some(shouldShowLobbyCrosshair) && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 130 }}>
              {/* 슬롯 상태(state)에서 바로 계산한다. processorsRef·slotIndexMapRef는 렌더 뒤 effect에서 갱신되므로,
                  그 뒤 리렌더가 없는 마우스 참여 직후에는 빈 목록이 남는다. */}
              {getJoinedSlots(slots).map((slotState, i) => {
                if (!shouldShowLobbyCrosshair(slotState)) return null;
                const idx = i as PlayerIndex; // 로비 매핑(buildSlotIndexMap)과 같은 순서
                const aim = processorsRef.current[idx]?.aim ?? { aimX: 0, aimY: 0 };
                return (
                  <CrosshairOverlay
                    key={slotState.slot}
                    ref={crosshairRefs.current[idx]}
                    aimX={aim.aimX}
                    aimY={aim.aimY}
                    isFeverActive={false}
                    isWideScopeActive={false}
                    isPowerShotActive={false}
                    isAimLocked={idx === 0 ? isAimLocked : false}
                    playerColor={PLAYER_COLORS[slotState.slot]}
                    variant="menu"
                  />
                );
              })}
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
          lostSlot={grace?.slot}
          graceRemainingSec={graceRemainingSec}
          onContinueAlone={handleContinueAlone}
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
            score={hudState.players[0]?.score ?? 0}
            breakdown={engine.getScoreBreakdown()}
            lastWaveClear={engine.lastWaveClear}
            maxCombo={engine.getPlayer(0).scoreManager.getState().maxCombo}
            kills={engine.getPlayRunStats()?.kills ?? 0}
            waveReached={engine.currentWave}
            currentPlayer={pairedPlayer}
            isNewRecord={isNewRecord}
            rankings={topRankings}
            teamRankings={teamRankings}
            highlightTeamKey={highlightTeamKey}
            highlightDeviceIds={highlightDeviceIds}
            coop={coopResult ?? undefined}
            soloWeaponKind={engine.players.length === 1 ? engine.getPlayRunStats(0)?.weaponKind : undefined}
            soloInputKind={engine.players.length === 1 ? presentations[0]?.inputKind : undefined}
            onRestart={() => pressScreenButton('restart')}
            onReturnToLobby={() => pressScreenButton('lobby')}
            hoveredAction={hoveredResultAction}
          />
          {/* Result Crosshair Overlay on top of result modal */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 130 }}>
            {engine.players.map((p, i) => {
              const proc = processorsRef.current[i];
              const pAim = proc?.aim ?? { aimX: 0, aimY: 0 };
              const pres = presentations[i];
              const playerSnap = hudState.players[i];
              const pWeapon = p.weaponSystem.getState();
              const weaponKind = playerSnap?.weaponKind ?? pWeapon.weaponKind;
              const weaponLevel = playerSnap?.weaponLevel ?? pWeapon.weaponLevel;
              return (
                <CrosshairOverlay
                  key={i}
                  ref={crosshairRefs.current[i]}
                  aimX={pAim.aimX}
                  aimY={pAim.aimY}
                  isFeverActive={false}
                  isWideScopeActive={false}
                  isPowerShotActive={false}
                  isAimLocked={i === 0 ? isAimLocked : false}
                  playerColor={pres?.ringColorMode === 'player' ? pres.color : undefined}
                  nameTag={formatCrosshairNameTag(weaponKind, weaponLevel, pres?.slotLabel ?? null)}
                  hidden={playerSnap?.isAway ?? p.isAway}
                  variant="menu"
                />
              );
            })}
          </div>
        </>
      )}

      {/* 5. Guide & Codex Modal */}
      <GuideModal
        isOpen={isGuideOpen}
        onClose={handleCloseGuide}
      />

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
