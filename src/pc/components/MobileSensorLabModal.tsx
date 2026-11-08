import React, { useEffect, useRef, useState } from 'react';
import { OneEuroFilterConfig } from '../../controller/sensors/OneEuroFilter';

export interface SensorTuningConfig extends OneEuroFilterConfig {
  isStabilizedMode: boolean; // false = 기존 아이폰 13 미니 로직 100% 유지, true = 1€ Filter 활성화
  sensitivityX: number;
  sensitivityY: number;
  invertY: boolean;
  preset: 'default_iphone' | 'stabilized_galaxy' | 'custom';
}

export interface SensorLiveMetrics {
  rawAimX: number;
  rawAimY: number;
  aimX: number;
  aimY: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  packetHz: number;
  jitterRms: number; // 최근 30개 샘플의 변위 표준편차
  isCocked?: boolean;
  lastSnapAt?: number;
  fps?: number;
  drawCalls?: number;
  geometries?: number;
  textures?: number;
}

/** 센서 프레임이 채우는 필드. 렌더 성능 지표(fps/drawCalls/geometries/textures)는 포함하지 않는다. */
export type SensorFrameMetrics = Omit<SensorLiveMetrics, 'fps' | 'drawCalls' | 'geometries' | 'textures'>;

/**
 * 센서 프레임 지표를 이전 지표 위에 얹는다. 렌더 성능 지표는 지우지 않는다.
 * 상태를 통째로 교체하면 렌더 지표가 잠깐 사라졌다 돌아와, 모달의 "렌더 성능"·"GPU 메모리" 줄이
 * 켜졌다 꺼지며 높이가 흔들린다. 프레임에 명시한 키(예: 값이 undefined인 lastSnapAt)는 그대로 덮어쓴다.
 */
export function mergeSensorFrameMetrics(prev: SensorLiveMetrics, frame: SensorFrameMetrics): SensorLiveMetrics {
  return { ...prev, ...frame };
}

export interface MobileSensorLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: SensorLiveMetrics;
  tuningConfig: SensorTuningConfig;
  onUpdateConfig: (config: SensorTuningConfig) => void;
  onResetZero: () => void;
}

export const STORAGE_KEY = 'beer_crusher_sensor_tuning_v1';

export const DEFAULT_TUNING_CONFIG: SensorTuningConfig = {
  isStabilizedMode: false, // 기본값: 아이폰 13 미니 원본 바이패스 유지
  minCutoff: 1.2,
  beta: 3.0,
  dCutoff: 1.0,
  deadzone: 0.003,
  sensitivityX: 1.0,
  sensitivityY: 1.0,
  invertY: false,
  preset: 'default_iphone',
};

export function loadSavedTuningConfig(storage?: Pick<Storage, 'getItem' | 'setItem'>): SensorTuningConfig {
  let targetStorage = storage;
  if (!targetStorage && typeof window !== 'undefined' && window.localStorage) {
    targetStorage = window.localStorage;
  }
  if (targetStorage) {
    try {
      const raw = targetStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_TUNING_CONFIG, ...JSON.parse(raw) };
      }
    } catch {
      // Local storage restricted
    }
  }
  return DEFAULT_TUNING_CONFIG;
}

export function saveTuningConfig(
  config: SensorTuningConfig,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): void {
  let targetStorage = storage;
  if (!targetStorage && typeof window !== 'undefined' && window.localStorage) {
    targetStorage = window.localStorage;
  }
  if (targetStorage) {
    try {
      targetStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Local storage restricted
    }
  }
}

export const MobileSensorLabModal: React.FC<MobileSensorLabModalProps> = ({
  isOpen,
  onClose,
  metrics,
  tuningConfig,
  onUpdateConfig,
  onResetZero,
}) => {
  // Trail of recent raw positions for visual jitter representation (max 15 dots)
  const [rawTrail, setRawTrail] = useState<{ x: number; y: number }[]>([]);
  const lastSampleRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) return;

    if (
      Math.abs(metrics.rawAimX - lastSampleRef.current.x) > 0.001 ||
      Math.abs(metrics.rawAimY - lastSampleRef.current.y) > 0.001
    ) {
      lastSampleRef.current = { x: metrics.rawAimX, y: metrics.rawAimY };
      setRawTrail((prev) => {
        const next = [...prev, { x: metrics.rawAimX, y: metrics.rawAimY }];
        return next.slice(-15);
      });
    }
  }, [isOpen, metrics.rawAimX, metrics.rawAimY]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Apply one-touch preset
  const handleApplyPreset = (presetKey: 'default_iphone' | 'stabilized_galaxy') => {
    let next: SensorTuningConfig;
    if (presetKey === 'default_iphone') {
      next = {
        ...tuningConfig,
        isStabilizedMode: false, // 아이폰 13 미니 원본 바이패스
        minCutoff: 1.2,
        beta: 3.0,
        deadzone: 0.003,
        preset: 'default_iphone',
      };
    } else {
      next = {
        ...tuningConfig,
        isStabilizedMode: true, // 갤럭시 A15 등 강력 안정화
        minCutoff: 0.4,
        beta: 2.0,
        deadzone: 0.01,
        preset: 'stabilized_galaxy',
      };
    }
    saveTuningConfig(next);
    onUpdateConfig(next);
  };

  const handleSliderChange = (partial: Partial<SensorTuningConfig>) => {
    const next: SensorTuningConfig = {
      ...tuningConfig,
      ...partial,
      preset: 'custom',
    };
    saveTuningConfig(next);
    onUpdateConfig(next);
  };

  // Stability badge judgment
  let stabilityColor = '#10b981';
  let stabilityText = '🟢 매우 안정 (아이폰 수준)';
  if (metrics.jitterRms >= 0.018) {
    stabilityColor = '#ef4444';
    stabilityText = '🔴 센서 노이즈 심함 (Galaxy A 가상 자이로)';
  } else if (metrics.jitterRms >= 0.006) {
    stabilityColor = '#f59e0b';
    stabilityText = '🟡 보통 (미세 흔들림)';
  }

  // 2D Scope position mapping (-1 ~ 1 -> 5% ~ 95%)
  const rawDotLeft = Math.max(5, Math.min(95, 50 + metrics.rawAimX * 45));
  const rawDotTop = Math.max(5, Math.min(95, 50 - metrics.rawAimY * 45));

  const filteredDotLeft = Math.max(5, Math.min(95, 50 + metrics.aimX * 45));
  const filteredDotTop = Math.max(5, Math.min(95, 50 - metrics.aimY * 45));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none', // Allow game scene pass-through outside modal dialog
      }}
    >
      {/* Modal Dialog Card */}
      <div
        style={{
          pointerEvents: 'auto',
          width: '94%',
          maxWidth: '820px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'rgba(10, 14, 23, 0.96)',
          backdropFilter: 'blur(16px)',
          border: '2px solid rgba(16, 185, 129, 0.6)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.25)',
          color: '#ffffff',
          fontFamily: "'Noto Sans KR', sans-serif",
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🎯</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#34d399', letterSpacing: '-0.3px' }}>
                모바일 인식 테스트 & 에임 안정화 진단 랩
              </h2>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                폰을 쥔 채로 실시간 노이즈를 확인하고 최적의 안정화 모드를 테스트하세요.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#cbd5e1',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ 닫기 (ESC)
          </button>
        </div>

        {/* Top Split: Left 2D Radar vs Right Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Left: 2D Radar Visualizer */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span style={{ color: '#ef4444', fontWeight: 800 }}>● 원시 센서(Raw)</span>
              <span style={{ color: '#10b981', fontWeight: 800 }}>✛ 실제 조준점(Filtered)</span>
            </div>

            {/* Radar Scope Box */}
            <div
              style={{
                position: 'relative',
                width: '260px',
                height: '260px',
                backgroundColor: '#050811',
                borderRadius: '50%',
                border: '2px solid rgba(52, 211, 153, 0.4)',
                boxShadow: 'inset 0 0 25px rgba(16, 185, 129, 0.15)',
                overflow: 'hidden',
              }}
            >
              {/* Center Crosshairs & Circles */}
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />
              <div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', border: '1px dashed rgba(255, 255, 255, 0.1)' }} />
              <div style={{ position: 'absolute', inset: '50%', transform: 'translate(-50%, -50%)', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />

              {/* Raw Trail Dots */}
              {rawTrail.map((dot, idx) => {
                const l = Math.max(5, Math.min(95, 50 + dot.x * 45));
                const t = Math.max(5, Math.min(95, 50 - dot.y * 45));
                const opacity = (idx + 1) / rawTrail.length * 0.4;
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${l}%`,
                      top: `${t}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      opacity,
                    }}
                  />
                );
              })}

              {/* Raw Current Point (Red Dot) */}
              <div
                style={{
                  position: 'absolute',
                  left: `${rawDotLeft}%`,
                  top: `${rawDotTop}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 8px #ef4444',
                  transition: 'left 0.03s linear, top 0.03s linear',
                }}
              />

              {/* Filtered Final Aim Target (Green Crosshair) */}
              <div
                style={{
                  position: 'absolute',
                  left: `${filteredDotLeft}%`,
                  top: `${filteredDotTop}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  border: '2px solid #10b981',
                  borderRadius: '50%',
                  boxShadow: '0 0 12px #10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'left 0.03s linear, top 0.03s linear',
                }}
              >
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', textAlign: 'center' }}>
              빨간 점(Raw)이 심하게 떨려도 초록 십자(Filtered)가 얌전하게 멈춰 있으면 정상입니다.
            </div>
          </div>

          {/* Right: Real-time Live Metrics & Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Live Metrics Box */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>센서 안정성 판정</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: stabilityColor }}>
                  {stabilityText}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>손떨림/지터 지수 (RMS)</span>
                <span style={{ fontSize: '15px', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>
                  {metrics.jitterRms.toFixed(4)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>수신 주기 (Hz)</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>
                  {metrics.packetHz} Hz
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>자이로 각도 (Yaw / Pitch)</span>
                <span style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                  Y: {metrics.yawDeg.toFixed(1)}° / P: {metrics.pitchDeg.toFixed(1)}°
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>현재 동작 모드</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: tuningConfig.isStabilizedMode ? '#34d399' : '#fbbf24' }}>
                  {tuningConfig.isStabilizedMode ? '🛡️ 강력 안정화 활성화됨' : '📱 기본 모드 (iPhone 원본 유지)'}
                </span>
              </div>

              {typeof metrics.fps === 'number' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>렌더 성능 (FPS / DrawCalls)</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {metrics.fps} FPS / {metrics.drawCalls ?? '-'} calls
                  </span>
                </div>
              )}

              {typeof metrics.geometries === 'number' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>GPU 메모리 (지오메트리 / 텍스처)</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#a78bfa', fontFamily: 'monospace' }}>
                    {metrics.geometries} geos / {metrics.textures ?? '-'} tex
                  </span>
                </div>
              )}
            </div>

            {/* One-touch Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 800 }}>원터치 기기 최적화 프리셋</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => handleApplyPreset('default_iphone')}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '12px',
                    border: tuningConfig.preset === 'default_iphone' ? '2px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.15)',
                    backgroundColor: tuningConfig.preset === 'default_iphone' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: tuningConfig.preset === 'default_iphone' ? '#fbbf24' : '#cbd5e1',
                    fontWeight: 900,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>📱 기본 모드</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>아이폰 13 미니 권장 (원본)</span>
                </button>

                <button
                  onClick={() => handleApplyPreset('stabilized_galaxy')}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '12px',
                    border: tuningConfig.preset === 'stabilized_galaxy' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                    backgroundColor: tuningConfig.preset === 'stabilized_galaxy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: tuningConfig.preset === 'stabilized_galaxy' ? '#34d399' : '#cbd5e1',
                    fontWeight: 900,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🛡️ 강력 안정화</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>Galaxy A시리즈 (떨림 차단)</span>
                </button>
              </div>
            </div>

            {/* Quick Zero Reset Button */}
            <button
              onClick={onResetZero}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                fontWeight: 900,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>🎯</span>
              <span>현재 위치를 정면 영점으로 재설정</span>
            </button>
          </div>
        </div>

        {/* Bottom Panel: Fine Tuning Sliders */}
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#94a3b8' }}>세부 튜닝 (조작 시 자동 저장)</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#38bdf8' }}>
              <input
                type="checkbox"
                checked={tuningConfig.isStabilizedMode}
                onChange={(e) => handleSliderChange({ isStabilizedMode: e.target.checked })}
              />
              <span>1€ Filter 강제 활성화</span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            {/* minCutoff */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1' }}>손떨림 억제 강도 (minCutoff)</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>{tuningConfig.minCutoff.toFixed(2)} Hz</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={tuningConfig.minCutoff}
                onChange={(e) => handleSliderChange({ minCutoff: parseFloat(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* beta */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1' }}>조준 반응 속도 (beta)</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>{tuningConfig.beta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="6.0"
                step="0.1"
                value={tuningConfig.beta}
                onChange={(e) => handleSliderChange({ beta: parseFloat(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* deadzone */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1' }}>정지 데드존 임계값 (deadzone)</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>{tuningConfig.deadzone.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.03"
                step="0.001"
                value={tuningConfig.deadzone}
                onChange={(e) => handleSliderChange({ deadzone: parseFloat(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Sensitivity X / Y */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#cbd5e1' }}>조준 감도 (X / Y)</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>
                  X:{tuningConfig.sensitivityX.toFixed(1)} / Y:{tuningConfig.sensitivityY.toFixed(1)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.1"
                  value={tuningConfig.sensitivityX}
                  onChange={(e) => handleSliderChange({ sensitivityX: parseFloat(e.target.value) })}
                  style={{ width: '50%', cursor: 'pointer' }}
                />
                <input
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.1"
                  value={tuningConfig.sensitivityY}
                  onChange={(e) => handleSliderChange({ sensitivityY: parseFloat(e.target.value) })}
                  style={{ width: '50%', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
