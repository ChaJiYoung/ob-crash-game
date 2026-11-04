import React from 'react';
import { ActiveBuffState, ItemBuffKind, JudgmentGrade, PlayerProfile, TargetKind, WeaponKind, WeaponLevel } from '../../shared/types';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../../shared/constants';

export interface SensorDiagnosticsState {
  aimX: number;
  aimY: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  sensitivityX: number;
  sensitivityY: number;
  invertY: boolean;
  lastSnapFireAt?: number;
  rapidFireHold: boolean;
  packetHz: number;
}

export interface SensorAndModuleTestLabOverlayProps {
  roomId: string;
  lanIp?: string;
  pairedPlayer?: PlayerProfile;
  diagnostics: SensorDiagnosticsState;
  targetsCount: number;
  stationarySpawn: boolean;
  infiniteAmmo: boolean;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  feverGauge: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
  activeBuffs: ActiveBuffState[];
  lastJudgment?: { grade: JudgmentGrade; key: number };
  onToggleStationarySpawn: (stationary: boolean) => void;
  onSpawnTarget: (kind: TargetKind) => void;
  onSpawnFivePointTargets: () => void;
  onClearTargets: () => void;
  onSpawnItem: (itemKind: ItemBuffKind) => void;
  onActivateBuffImmediate: (itemKind: ItemBuffKind) => void;
  onTriggerFeverImmediate: () => void;
  onToggleInfiniteAmmo: (infinite: boolean) => void;
  onTestFireShot: () => void;
  onSensitivityChange: (sensX: number, sensY: number, invertY: boolean) => void;
  weaponKind?: WeaponKind;
  weaponLevel?: WeaponLevel;
  onSelectWeapon?: (kind: WeaponKind) => void;
  onUpgradeWeapon?: () => void;
  onSpawnRewardCards?: () => void;
  onSummonBossMinions?: () => void;
  onResetZeroCenter: () => void;
  onStartRealGame: () => void;
  onExitToLobby: () => void;
}

export const SensorAndModuleTestLabOverlay: React.FC<SensorAndModuleTestLabOverlayProps> = ({
  roomId,
  pairedPlayer,
  diagnostics,
  targetsCount,
  stationarySpawn,
  infiniteAmmo,
  ammo,
  maxAmmo,
  isReloading,
  feverGauge,
  isFeverReady,
  isFeverActive,
  onToggleStationarySpawn,
  onSpawnTarget,
  onSpawnFivePointTargets,
  onClearTargets,
  onSpawnItem,
  onActivateBuffImmediate,
  onTriggerFeverImmediate,
  onToggleInfiniteAmmo,
  weaponKind,
  weaponLevel,
  onSelectWeapon,
  onUpgradeWeapon,
  onSpawnRewardCards,
  onSummonBossMinions,
  onTestFireShot,
  onSensitivityChange,
  onResetZeroCenter,
  onStartRealGame,
  onExitToLobby,
}) => {
  const radarDotLeft = Math.max(5, Math.min(95, 50 + diagnostics.aimX * 45));
  const radarDotTop = Math.max(5, Math.min(95, 50 - diagnostics.aimY * 45));

  const targetKinds: TargetKind[] = ['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'];
  const itemKinds: ItemBuffKind[] = ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 20px',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', sans-serif",
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      {/* 1. TOP HEADER CONSOLE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '16px',
          padding: '12px 20px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
              color: '#0f172a',
              padding: '4px 10px',
              borderRadius: '8px',
              letterSpacing: '0.5px',
            }}
          >
            LAB SANDBOX
          </div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#f8fafc' }}>
            🎯 영점·센서 진단 및 게임 모듈 테스트장
          </div>
          <div
            style={{
              fontSize: '13px',
              color: '#94a3b8',
              borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
              paddingLeft: '12px',
            }}
          >
            ROOM: <span style={{ color: '#fbbf24', fontWeight: 800 }}>{roomId || '----'}</span>
            {pairedPlayer ? (
              <span style={{ color: '#34d399', marginLeft: '8px', fontWeight: 700 }}>
                (🎮 {pairedPlayer.nickname} 연결됨)
              </span>
            ) : (
              <span style={{ color: '#94a3b8', marginLeft: '8px' }}>
                (🖱️ PC 마우스 또는 스마트폰 연결)
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onSpawnFivePointTargets}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #38bdf8',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🎯 5점 영점 과녁 재배치
          </button>
          <button
            onClick={onStartRealGame}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(90deg, #10b981, #059669)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
            }}
          >
            🚀 실전 배틀 시작!
          </button>
          <button
            onClick={onExitToLobby}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔙 로비 복귀
          </button>
        </div>
      </div>

      {/* 2. MAIN CENTER BODY (LEFT DIAGNOSTICS & RIGHT MODULE CONTROLS) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          margin: '16px 0',
          gap: '16px',
          flex: 1,
        }}
      >
        {/* LEFT PANEL: SENSOR & ZEROING DIAGNOSTICS */}
        <div
          style={{
            width: '320px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.5px' }}>
            📡 실시간 센서 & 영점 진단
          </div>

          {/* 2D Mini Radar Target Tracker */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '140px',
              background: '#0a0f1d',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Crosshair Grid Lines */}
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(56, 189, 248, 0.25)' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(56, 189, 248, 0.25)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '70px', height: '70px', borderRadius: '50%', border: '1px dashed rgba(56, 189, 248, 0.25)' }} />

            {/* Target Dot */}
            <div
              style={{
                position: 'absolute',
                left: `${radarDotLeft}%`,
                top: `${radarDotTop}%`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#fbbf24',
                boxShadow: '0 0 10px #fbbf24',
                transform: 'translate(-50%, -50%)',
                transition: 'left 0.05s linear, top 0.05s linear',
              }}
            />

            <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '11px', color: '#94a3b8' }}>
              Aim: ({diagnostics.aimX.toFixed(2)}, {diagnostics.aimY.toFixed(2)})
            </div>
            <div style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '11px', color: '#34d399', fontWeight: 700 }}>
              {diagnostics.packetHz > 0 ? `${diagnostics.packetHz} Hz` : 'Live'}
            </div>
          </div>

          {/* Gyro Angles (Yaw / Pitch / Roll) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#cbd5e1' }}>↔️ 수평 Yaw (좌우 회전):</span>
              <span style={{ fontWeight: 800, color: '#38bdf8' }}>{diagnostics.yawDeg.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#cbd5e1' }}>↕️ 수직 Pitch (상하 틸트):</span>
              <span style={{ fontWeight: 800, color: '#38bdf8' }}>{diagnostics.pitchDeg.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#cbd5e1' }}>🔄 Roll (손목 비틀림):</span>
              <span style={{ fontWeight: 800, color: '#94a3b8' }}>{diagnostics.rollDeg.toFixed(1)}°</span>
            </div>
          </div>

          {/* Sensitivity & Calibration Controls */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>좌우 감도:</span>
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>{diagnostics.sensitivityX.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={diagnostics.sensitivityX}
                onChange={(e) =>
                  onSensitivityChange(parseFloat(e.target.value), diagnostics.sensitivityY, diagnostics.invertY)
                }
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>상하 감도:</span>
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>{diagnostics.sensitivityY.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={diagnostics.sensitivityY}
                onChange={(e) =>
                  onSensitivityChange(diagnostics.sensitivityX, parseFloat(e.target.value), diagnostics.invertY)
                }
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={diagnostics.invertY}
                  onChange={(e) =>
                    onSensitivityChange(diagnostics.sensitivityX, diagnostics.sensitivityY, e.target.checked)
                  }
                />
                <span>상하 Y축 반전</span>
              </label>

              <button
                onClick={onResetZeroCenter}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fbbf24',
                  background: 'rgba(251, 191, 36, 0.15)',
                  color: '#fbbf24',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🎯 정면 영점 리셋
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: MODULE & COMBAT SANDBOX CONTROLS */}
        <div
          style={{
            width: '360px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#fbbf24' }}>
              👾 몬스터 & 무기 모듈 제어판
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              현재 표적: <b style={{ color: '#38bdf8' }}>{targetsCount}개</b>
            </span>
          </div>

          {/* Spawn Mode Toggle */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              onClick={() => onToggleStationarySpawn(true)}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                background: stationarySpawn ? '#38bdf8' : 'transparent',
                color: stationarySpawn ? '#0f172a' : '#cbd5e1',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              📌 정지 표적 (영점/조준)
            </button>
            <button
              onClick={() => onToggleStationarySpawn(false)}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                background: !stationarySpawn ? '#f59e0b' : 'transparent',
                color: !stationarySpawn ? '#0f172a' : '#cbd5e1',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🏃 이동 표적 (접근/처치)
            </button>
          </div>

          {/* 6 Target Spawners Grid */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
              몬스터 6종 즉시 소환:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {targetKinds.map((k) => {
                const spec = TARGET_SPECS[k];
                return (
                  <button
                    key={k}
                    onClick={() => onSpawnTarget(k)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${spec.brandColorHex}`,
                      background: 'rgba(0, 0, 0, 0.45)',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{spec.displayName.split(' ')[0]}</span>
                    <span style={{ fontSize: '10px', color: spec.brandColorHex }}>
                      {spec.maxHp}HP
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={onClearTargets}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid rgba(248, 113, 113, 0.4)',
                background: 'rgba(248, 113, 113, 0.1)',
                color: '#f87171',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🧹 모든 몬스터/과녁 제거
            </button>
          </div>

          {/* Weapons & Fever Triggers */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              무기 및 피버 시험:
            </div>
            {/* 3 Weapon Switcher */}
            {onSelectWeapon && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onSelectWeapon('shotgun')}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: '6px',
                    border: weaponKind === 'shotgun' ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                    background: weaponKind === 'shotgun' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0,0,0,0.4)',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🪠 샷건
                </button>
                <button
                  onClick={() => onSelectWeapon('revolver')}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: '6px',
                    border: weaponKind === 'revolver' ? '1.5px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                    background: weaponKind === 'revolver' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(0,0,0,0.4)',
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🍾 리볼버
                </button>
                <button
                  onClick={() => onSelectWeapon('gatling')}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: '6px',
                    border: weaponKind === 'gatling' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                    background: weaponKind === 'gatling' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.4)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🍺 개틀링
                </button>
              </div>
            )}

            {/* Weapon Level Up & Roguelike Reward Cards & Boss Summon Controls */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {onUpgradeWeapon && (
                <button
                  onClick={onUpgradeWeapon}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '6px',
                    border: '1px solid #fbbf24',
                    background: 'rgba(251, 191, 36, 0.15)',
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ⬆️ 레벨업 (Lv.{weaponLevel || 1})
                </button>
              )}
              {onSpawnRewardCards && (
                <button
                  onClick={onSpawnRewardCards}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '6px',
                    border: '1px solid #c084fc',
                    background: 'rgba(192, 132, 252, 0.15)',
                    color: '#c084fc',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🃏 보상 카드 스폰
                </button>
              )}
            </div>

            {onSummonBossMinions && (
              <button
                onClick={onSummonBossMinions}
                style={{
                  width: '100%',
                  padding: '7px',
                  borderRadius: '6px',
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                👑 보스 미니웨이브 소환 시험
              </button>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onTriggerFeverImmediate}
                style={{
                  flex: 1.2,
                  padding: '9px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isFeverActive ? '#ef4444' : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  color: isFeverActive ? '#ffffff' : '#0f172a',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {isFeverActive ? '🔥 피버 발동 중!' : '🔥 피버 100% 즉시 발동'}
              </button>
              <button
                onClick={() => onToggleInfiniteAmmo(!infiniteAmmo)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: infiniteAmmo ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)',
                  background: infiniteAmmo ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  color: infiniteAmmo ? '#34d399' : '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {infiniteAmmo ? '♾️ 무한탄창 ON' : '탄창 제한 ON'}
              </button>
            </div>
            <button
              onClick={onTestFireShot}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: '8px',
                border: '1px solid #38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔫 현재 조준점 시험 사격 (반동/궤적 확인)
            </button>
          </div>

          {/* Item 4 Types: Spawn or Instant Buff */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
              아이템 4종 효과 시험:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {itemKinds.map((ik) => {
                const spec = ITEM_BUFF_SPECS[ik];
                return (
                  <div
                    key={ik}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  >
                    <span>{spec.icon} {spec.displayName.split(' ')[0]}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => onSpawnItem(ik)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#e2e8f0',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        표적 스폰
                      </button>
                      <button
                        onClick={() => onActivateBuffImmediate(ik)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${spec.auraColorHex}`,
                          background: `${spec.auraColorHex}25`,
                          color: spec.auraColorHex,
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        즉시 발동
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM STATUS TICKER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          padding: '8px 16px',
          fontSize: '12px',
          color: '#cbd5e1',
          pointerEvents: 'auto',
        }}
      >
        <div>
          탄창: <b style={{ color: '#38bdf8' }}>{infiniteAmmo ? '♾️ 무한' : isReloading ? '재장전 중...' : `${ammo}/${maxAmmo}`}</b>
        </div>
        <div>
          피버 게이지: <b style={{ color: isFeverActive ? '#ef4444' : isFeverReady ? '#fbbf24' : '#94a3b8' }}>{feverGauge}%</b>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
          💡 샌드박스에서는 방어선이 돌파되어도 생명이 감소하지 않고 표적이 자동 리스폰됩니다.
        </div>
      </div>
    </div>
  );
};
