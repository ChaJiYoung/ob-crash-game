import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { BeerCrusherEngine, EngineShootResult } from './engine/BeerCrusherEngine';
import { GameCanvas3D, GameCanvas3DHandle } from './components/GameCanvas3D';
import { ArcadeOverlayHUD } from './components/ArcadeOverlayHUD';
import { CrosshairOverlay, CrosshairOverlayHandle } from './components/CrosshairOverlay';
import { JudgmentBanner } from './components/JudgmentBanner';
import { QRPairingModal } from './components/QRPairingModal';
import { ResultRankingModal } from './components/ResultRankingModal';
import { GuideModal } from './components/GuideModal';
import { TutorialGuideOverlay } from './components/TutorialGuideOverlay';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { ActiveBuffState, GamePhase, JudgmentGrade, PlayerProfile, ServerToClientMessage } from '../shared/types';
import { STAGE_CONSTANTS, WEAPON_CONSTANTS } from '../shared/constants';

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
  const [roomId, setRoomId] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [pairedPlayer, setPairedPlayer] = useState<PlayerProfile | undefined>();
  const [topRankings, setTopRankings] = useState<PlayerProfile[]>([]);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isZeroCalibrated, setIsZeroCalibrated] = useState<boolean>(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canvasRef = useRef<GameCanvas3DHandle>(null);
  const crosshairRef = useRef<CrosshairOverlayHandle>(null);

  const [lastJudgment, setLastJudgment] = useState<{ grade: JudgmentGrade; key: number }>({
    grade: 'GOOD',
    key: 0,
  });
  const [lastShootResult, setLastShootResult] = useState<
    { result: EngineShootResult; key: number } | undefined
  >();

  // Snapshot for HUD
  const [hudState, setHudState] = useState({
    score: 0,
    combo: 0,
    comboMultiplier: 1.0,
    lives: STAGE_CONSTANTS.PLAYER_MAX_LIVES as number,
    wave: 1,
    ammo: 10,
    maxAmmo: 10,
    isReloading: false,
    feverGauge: 0,
    isFeverReady: false,
    isFeverActive: false,
    activeBuffs: [] as ActiveBuffState[],
    isWideScopeActive: false,
    isPowerShotActive: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const rapidFireTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pairedPlayerRef = useRef<PlayerProfile | undefined>(undefined);
  pairedPlayerRef.current = pairedPlayer;

  const latestAimRef = useRef({ aimX: 0, aimY: 0 });
  const lastSentFeverReadyRef = useRef<boolean>(false);

  const updateAimDirect = useCallback((x: number, y: number, immediate = false) => {
    latestAimRef.current = { aimX: x, aimY: y };
    canvasRef.current?.setAim(x, y, immediate);
    crosshairRef.current?.updatePosition(x, y);
  }, []);

  const handleShootEvent = useCallback((result: EngineShootResult) => {
    if (result.fired) {
      const isFever = engine.scoreManager.getState().isFeverActive;
      soundSynth.playShoot(isFever);

      if (result.grade !== 'MISS') {
        soundSynth.playHit(result.grade);
      }
      setLastJudgment({ grade: result.grade, key: Date.now() });
      setLastShootResult({ result, key: Date.now() });
    }
  }, [engine, soundSynth]);

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
            break;

          case 'ZERO_CALIBRATED':
            setIsZeroCalibrated(true);
            setGamePhase('ZEROING');
            break;

          case 'GAME_START_RELAY':
            startCountdownAndGameRef.current();
            break;

          case 'SENSOR_RELAY': {
            const p = msg.payload;
            updateAimDirect(p.aimX, p.aimY, false);

            if (p.snapFire) {
              const res = engine.shootAt(p.aimX, p.aimY, performance.now());
              handleShootEvent(res);
            }

            // Rapid fire hold using live aim coordinates
            if (p.rapidFireHold) {
              if (!rapidFireTimerRef.current) {
                rapidFireTimerRef.current = setInterval(() => {
                  const curAim = latestAimRef.current;
                  const res = engine.shootAt(curAim.aimX, curAim.aimY, performance.now());
                  handleShootEvent(res);
                }, WEAPON_CONSTANTS.RAPID_FIRE_INTERVAL_MS);
              }
            } else {
              if (rapidFireTimerRef.current) {
                clearInterval(rapidFireTimerRef.current);
                rapidFireTimerRef.current = null;
              }
            }

            if (p.feverTriggered) {
              const activated = engine.scoreManager.activateFever(performance.now());
              if (activated) {
                soundSynth.playFeverStart();
                if (engine.isTutorialMode && engine.tutorialStep === 3) {
                  engine.spawnTutorialStep3Enemies();
                }
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
      const activeBuffs = engine.getActiveBuffs(now);
      const isWideScopeActive = engine.isBuffActive('wide_scope', now);
      const isPowerShotActive = engine.isBuffActive('power_shot', now);

      setHudState({
        score: feverState.totalScore,
        combo: feverState.combo,
        comboMultiplier: feverState.comboMultiplier,
        lives: engine.lives,
        wave: engine.currentWave,
        ammo: weaponState.ammo,
        maxAmmo: weaponState.maxAmmo,
        isReloading: weaponState.isReloading,
        feverGauge: feverState.feverGauge,
        isFeverReady: feverState.isFeverReady,
        isFeverActive: feverState.isFeverActive,
        activeBuffs,
        isWideScopeActive,
        isPowerShotActive,
      });

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
      }

      // Synchronize game over / victory
      if (engine.gamePhase === 'GAMEOVER' && gamePhase === 'PLAYING') {
        setGamePhase('GAMEOVER');
        soundSynth.playHit('MISS');
        submitScore(feverState.totalScore, engine.currentWave, feverState.maxCombo);
      } else if (engine.gamePhase === 'VICTORY' && gamePhase === 'PLAYING') {
        setGamePhase('VICTORY');
        soundSynth.playFeverStart();
        submitScore(feverState.totalScore, STAGE_CONSTANTS.TOTAL_WAVES, feverState.maxCombo);
      }
    }, 50);

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
        })
      );
    }
  };

  const handleStartGame = useCallback(() => {
    engine.startGame();
    setGamePhase('PLAYING');
    setIsNewRecord(false);
  }, [engine]);

  const startCountdownAndGame = useCallback(() => {
    if (countdownTimerRef.current) return;
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
        handleStartGame();
      }
    }, 1000);
  }, [handleStartGame]);

  const startCountdownAndGameRef = useRef(startCountdownAndGame);
  startCountdownAndGameRef.current = startCountdownAndGame;

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
    engine.exitTutorialMode();
    setGamePhase('PAIRING');
  }, [engine]);

  const handleReturnToLobby = useCallback(() => {
    engine.gamePhase = 'PAIRING';
    setGamePhase('PAIRING');
  }, [engine]);

  const bossEntity = engine.getBossEntity();

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 1. 3D WebGL Canvas */}
      <GameCanvas3D
        ref={canvasRef}
        engine={engine}
        aimX={0}
        aimY={0}
        onAimChange={(x, y) => {
          updateAimDirect(x, y, true);
        }}
        onShoot={handleShootEvent}
        soundSynth={soundSynth}
        lastShootResult={lastShootResult}
      />

      {/* 2. 4-Corner Arcade Overlay HUD */}
      {gamePhase === 'PLAYING' && (
        <>
          <ArcadeOverlayHUD
            player={pairedPlayer}
            score={hudState.score}
            combo={hudState.combo}
            comboMultiplier={hudState.comboMultiplier}
            lives={hudState.lives}
            maxLives={STAGE_CONSTANTS.PLAYER_MAX_LIVES}
            wave={hudState.wave}
            totalWaves={STAGE_CONSTANTS.TOTAL_WAVES}
            ammo={hudState.ammo}
            maxAmmo={hudState.maxAmmo}
            isReloading={hudState.isReloading}
            feverGauge={hudState.feverGauge}
            isFeverReady={hudState.isFeverReady}
            isFeverActive={hudState.isFeverActive}
            bossEntity={bossEntity}
            activeBuffs={hudState.activeBuffs}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
          <CrosshairOverlay
            ref={crosshairRef}
            aimX={latestAimRef.current.aimX}
            aimY={latestAimRef.current.aimY}
            isFeverActive={hudState.isFeverActive}
            isWideScopeActive={hudState.isWideScopeActive}
            isPowerShotActive={hudState.isPowerShotActive}
            shotTriggerKey={lastShootResult?.key || 0}
          />
          <JudgmentBanner grade={lastJudgment.grade} triggerKey={lastJudgment.key} />
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
            shotTriggerKey={lastShootResult?.key || 0}
          />
          <JudgmentBanner grade={lastJudgment.grade} triggerKey={lastJudgment.key} />
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
            onOpenGuide={() => setIsGuideOpen(true)}
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
                shotTriggerKey={0}
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
            backdropFilter: 'blur(10px)',
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
            전투 준비! 조준선을 정렬하세요
          </div>
        </div>
      )}

      {/* 4. Game Result Modal */}
      {(gamePhase === 'GAMEOVER' || gamePhase === 'VICTORY') && (
        <ResultRankingModal
          gamePhase={gamePhase}
          score={hudState.score}
          maxCombo={engine.scoreManager.getState().maxCombo}
          waveReached={engine.currentWave}
          currentPlayer={pairedPlayer}
          isNewRecord={isNewRecord}
          rankings={topRankings}
          onRestart={handleStartGame}
          onReturnToLobby={handleReturnToLobby}
        />
      )}

      {/* 5. Guide & Codex Modal */}
      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        showTutorialButton={gamePhase === 'PAIRING' || gamePhase === 'ZEROING'}
        onStartTutorial={handleStartTutorial}
      />
    </div>
  );
};
