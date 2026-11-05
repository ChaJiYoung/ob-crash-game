import React, { useEffect, useRef, useState } from 'react';
import { UnifiedTouchPadController } from '../sensors/UnifiedTouchPad';
import { triggerHaptic } from '../sensors/HapticFeedback';
import { WeaponKind, WeaponLevel } from '../../shared/types';
import { WEAPON_ARCHETYPE_SPECS } from '../../shared/constants';

export interface GunGripSkillInfo {
  weaponKind: WeaponKind;
  weaponLevel: WeaponLevel;
  skillStock: number;
  maxSkillStock: number;
  skillCooldownRemainingMs: number;
  skillCooldownTotalMs: number;
}

export interface GunGripPadProps {
  onRecalibrateZero: () => void;
  onFeverTrigger: () => void;
  onSingleTapFire?: () => void;
  onRapidFireHoldChange?: (holding: boolean) => void;
  onCockingChange?: (cocked: boolean) => void;
  isFeverReady?: boolean;
  isCocked?: boolean;
  skillState?: GunGripSkillInfo;
  isStabilizedMode?: boolean;
  onToggleStabilizedMode?: () => void;
}

export const GunGripPad: React.FC<GunGripPadProps> = ({
  onRecalibrateZero,
  onFeverTrigger,
  onSingleTapFire,
  onRapidFireHoldChange,
  onCockingChange,
  isFeverReady = false,
  isCocked: isCockedProp,
  skillState,
  isStabilizedMode = false,
  onToggleStabilizedMode,
}) => {
  const [internalCocked, setInternalCocked] = useState(false);
  const isCocked = isCockedProp !== undefined ? isCockedProp : internalCocked;
  const touchPadRef = useRef<UnifiedTouchPadController | null>(null);

  const weaponSpec = skillState ? WEAPON_ARCHETYPE_SPECS[skillState.weaponKind] : undefined;
  const isSkillReady = skillState ? skillState.skillStock > 0 : true;
  const currentLevelSpec = weaponSpec && skillState ? weaponSpec.levels[skillState.weaponLevel] : undefined;
  const skillName = currentLevelSpec ? currentLevelSpec.skillNameKo : '특수 액티브 스킬';

  const onFeverTriggerRef = useRef(onFeverTrigger);
  onFeverTriggerRef.current = onFeverTrigger;
  const onSingleTapFireRef = useRef(onSingleTapFire);
  onSingleTapFireRef.current = onSingleTapFire;
  const onRapidFireHoldChangeRef = useRef(onRapidFireHoldChange);
  onRapidFireHoldChangeRef.current = onRapidFireHoldChange;
  const onCockingChangeRef = useRef(onCockingChange);
  onCockingChangeRef.current = onCockingChange;

  useEffect(() => {
    const pad = new UnifiedTouchPadController({
      onSingleTapFire: () => {
        triggerHaptic(25);
        onSingleTapFireRef.current?.();
      },
      onFeverTrigger: () => {
        triggerHaptic([50, 50, 100]);
        onFeverTriggerRef.current();
      },
      onRapidFireHoldChange: (holding) => {
        if (holding) {
          triggerHaptic(30);
        }
        onRapidFireHoldChangeRef.current?.(holding);
      },
    });

    touchPadRef.current = pad;
    return () => {
      pad.dispose();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setInternalCocked(true);
    onCockingChangeRef.current?.(true);
    touchPadRef.current?.handlePointerDown();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    setInternalCocked(false);
    onCockingChangeRef.current?.(false);
    touchPadRef.current?.handlePointerUp();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#05070a',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', sans-serif",
        userSelect: 'none',
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 1. FRONT 15% STRIP: Zero Recalibration (Towards Monitor) */}
      <div
        style={{
          height: '15%',
          width: '100%',
          background: 'rgba(245, 158, 11, 0.15)',
          borderBottom: '2px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', width: '100%', maxWidth: '390px', gap: '8px', height: '100%' }}>
          <button
            onClick={() => {
              triggerHaptic([40, 60]);
              onRecalibrateZero();
            }}
            style={{
              height: '100%',
              flex: 1,
              borderRadius: '12px',
              border: '2px solid #f59e0b',
              background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.25), rgba(19, 26, 41, 0.95))',
              color: '#fbbf24',
              fontSize: '14px',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.2)',
            }}
          >
            <span>🎯</span>
            <span>정면 영점 (모니터 겨누고 탭)</span>
          </button>

          {onToggleStabilizedMode && (
            <button
              onClick={() => {
                triggerHaptic(50);
                onToggleStabilizedMode();
              }}
              style={{
                height: '100%',
                minWidth: '108px',
                borderRadius: '12px',
                border: isStabilizedMode ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)',
                background: isStabilizedMode
                  ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.3), rgba(19, 26, 41, 0.95))'
                  : 'rgba(255, 255, 255, 0.08)',
                color: isStabilizedMode ? '#34d399' : '#94a3b8',
                fontSize: '13px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span>{isStabilizedMode ? '🛡️ 안정화 ON' : '📱 기본 모드'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. REAR 85% UNIFIED ACTION TOUCH PAD (Towards Body) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          height: '85%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          cursor: 'pointer',
          background: isFeverReady
            ? 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, #05070a 70%)'
            : isCocked
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, #05070a 75%)'
            : 'radial-gradient(circle, rgba(30, 41, 59, 0.5) 0%, #05070a 80%)',
          border: isFeverReady
            ? '4px solid #fbbf24'
            : isCocked
            ? '4px solid #10b981'
            : '4px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isFeverReady
            ? 'inset 0 0 30px #fbbf24'
            : isCocked
            ? 'inset 0 0 30px #10b981'
            : 'none',
          transition: 'border 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Weapon & Active Skill Badge */}
        {weaponSpec && skillState && (
          <div
            style={{
              marginBottom: '16px',
              padding: '8px 16px',
              borderRadius: '12px',
              background: isSkillReady
                ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.2), rgba(6, 182, 212, 0.2))'
                : 'rgba(255, 255, 255, 0.05)',
              border: `1.5px solid ${isSkillReady ? '#fbbf24' : 'rgba(255, 255, 255, 0.15)'}`,
              boxShadow: isSkillReady ? '0 0 16px rgba(251, 191, 36, 0.35)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              maxWidth: '340px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{weaponSpec.badgeIcon}</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                {weaponSpec.nameKo} {skillState.weaponLevel >= 4 ? 'Lv.MAX' : `Lv.${skillState.weaponLevel}`}
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 900,
                color: isSkillReady ? '#fbbf24' : '#94a3b8',
                letterSpacing: '0.3px',
                textAlign: 'center',
              }}
            >
              {isSkillReady
                ? `⚡ ${skillName} READY! 총구를 위로 '휙!' 젖히기`
                : `스킬 재충전 중... ${(skillState.skillCooldownRemainingMs / 1000).toFixed(1)}s`}
            </div>
          </div>
        )}

        <div style={{ fontSize: '56px', marginBottom: '16px' }}>
          {isFeverReady ? '🔥' : isCocked ? '🔒' : '👆'}
        </div>

        <div
          style={{
            fontSize: '22px',
            fontWeight: 900,
            color: isFeverReady ? '#fbbf24' : isCocked ? '#38bdf8' : '#f8fafc',
            marginBottom: '20px',
            textAlign: 'center',
            letterSpacing: '0.5px',
          }}
        >
          {isFeverReady
            ? '🔥 따닥 더블탭하여 FEVER 발동!'
            : isCocked
            ? '💥 1발 사격 및 홀드 연발 중...'
            : '화면 톡 탭: 단발 / 꾸욱: 자동 연발'}
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '340px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '14px',
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '15px' }}>🎯 톡 탭 / 꾸욱:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>1발 단발 사격 및 꾸욱 눌러 자동 연발!</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '15px' }}>🔥 따닥 두 번 탭:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>피버 모드 발동 (게이지 100% 시)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#a855f7', fontWeight: 900, fontSize: '15px' }}>⚡ 위로 휙! 제스처:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{skillName} 즉시 발동</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#34d399', fontWeight: 900, fontSize: '15px' }}>🔄 상단 주황 바:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>화면 중앙 영점 재정렬</span>
          </div>
        </div>

        {/* 100% Auto Reload Reminder */}
        <div style={{ marginTop: '24px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
          ⚡ 탄창이 비면 자동으로 재장전됩니다
        </div>
      </div>
    </div>
  );
};
