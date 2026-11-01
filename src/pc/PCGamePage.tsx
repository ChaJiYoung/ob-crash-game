import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BeerCrusherEngine, EngineShootResult } from './engine/BeerCrusherEngine';
import { GameCanvas3D } from './components/GameCanvas3D';
import { ArcadeOverlayHUD } from './components/ArcadeOverlayHUD';
import { CrosshairOverlay } from './components/CrosshairOverlay';
import { JudgmentBanner } from './components/JudgmentBanner';
import { QRPairingModal } from './components/QRPairingModal';
import { ResultRankingModal } from './components/ResultRankingModal';
import { GuideModal } from './components/GuideModal';
import { TutorialGuideOverlay } from './components/TutorialGuideOverlay';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { ActiveBuffState, GamePhase, JudgmentGrade, PlayerProfile, ServerToClientMessage } from '../shared/types';
import { STAGE_CONSTANTS, WEAPON_CONSTANTS } from '../shared/constants';

export const PCGamePage: React.FC = () => {
  const engine = useMemo(() => new BeerCrusherEngine(), []);
  if (typeof window !== 'undefined') {
    (window as any).__engine = engine;
  }
  const soundSynth = useMemo(() => new SoundSynthesizer(), []);

  const [gamePhase, setGamePhase] = useState<GamePhase>('PAIRING');
  const [roomId, setRoomId] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('');
  const [pairedPlayer, setPairedPlayer] = useState<PlayerProfile | undefined>();
  const [topRankings, setTopRankings] = useState<PlayerProfile[]>([]);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const [aimX, setAimX] = useState<number>(0);
  const [aimY, setAimY] = useState<number>(0);
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
  latestAimRef.current = { aimX, aimY };

  const handleShootEvent = (result: EngineShootResult) => {
    if (result.fired) {
      const isFever = engine.scoreManager.getState().isFeverActive;
      soundSynth.playShoot(isFever);

      if (result.grade !== 'MISS') {
        soundSynth.playHit(result.grade);
      }
      setLastJudgment({ grade: result.grade, key: Date.now() });
      setLastShootResult({ result, key: Date.now() });
    }
  };

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
            handleStartGame();
            break;

          case 'SENSOR_RELAY': {
            const p = msg.payload;
            latestAimRef.current = { aimX: p.aimX, aimY: p.aimY };
            setAimX(p.aimX);
            setAimY(p.aimY);

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
        }
      } catch (err) {
        console.error('Error handling WebSocket message', err);
      }
    };

    return () => {
      if (rapidFireTimerRef.current) clearInterval(rapidFireTimerRef.current);
      socket.close();
    };
  }, [engine, soundSynth]);

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

  const handleStartGame = () => {
    engine.startGame();
    setGamePhase('PLAYING');
    setIsNewRecord(false);
  };

  const handleStartTutorial = () => {
    setIsGuideOpen(false);
    engine.startTutorialMode();
    setGamePhase('TUTORIAL');
  };

  const handleExitTutorial = () => {
    engine.exitTutorialMode();
    setGamePhase('PAIRING');
  };

  const handleReturnToLobby = () => {
    engine.gamePhase = 'PAIRING';
    setGamePhase('PAIRING');
  };

  const bossEntity = engine.getBossEntity();

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 1. 3D WebGL Canvas */}
      <GameCanvas3D
        engine={engine}
        aimX={aimX}
        aimY={aimY}
        onAimChange={(x, y) => {
          setAimX(x);
          setAimY(y);
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
            aimX={aimX}
            aimY={aimY}
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
            aimX={aimX}
            aimY={aimY}
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
        <QRPairingModal
          roomId={roomId}
          lanIp={lanIp}
          pairedPlayer={pairedPlayer}
          topRankings={topRankings}
          onStartAsPc={handleStartGame}
          onStartWithController={handleStartGame}
          onOpenGuide={() => setIsGuideOpen(true)}
        />
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
