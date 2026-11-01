import React from 'react';
import { TutorialStep } from '../../shared/types';

export interface TutorialGuideOverlayProps {
  step: TutorialStep;
  targetsRemaining: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  onStartRealGame: () => void;
  onExitToLobby: () => void;
}

export const TutorialGuideOverlay: React.FC<TutorialGuideOverlayProps> = ({
  step,
  targetsRemaining,
  isFeverReady,
  isFeverActive,
  ammo,
  maxAmmo,
  isReloading,
  onStartRealGame,
  onExitToLobby,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 32px',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', 'Pretendard', sans-serif",
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      {/* Top Banner: Step Indicator & Instructions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left: Step Badge & Mission Guide */}
        <div
          style={{
            maxWidth: '640px',
            background: 'rgba(15, 23, 42, 0.90)',
            backdropFilter: 'blur(12px)',
            border: '2px solid rgba(245, 158, 11, 0.7)',
            borderRadius: '18px',
            padding: '18px 24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 900,
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                color: '#111827',
                padding: '3px 10px',
                borderRadius: '8px',
                letterSpacing: '0.5px',
              }}
            >
              TRAINING MODE
            </span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24' }}>
              {step === 1 && '🎯 STEP 1. 조준 & 단발 사격'}
              {step === 2 && '💥 STEP 2. 연타 사격 & 재장전'}
              {step === 3 && '🔥 STEP 3. 피버 모드 대폭발'}
              {step === 'COMPLETED' && '🎉 훈련 수료 완료!'}
            </span>
          </div>

          <div style={{ fontSize: '15px', color: '#f8fafc', fontWeight: 600, lineHeight: '1.5' }}>
            {step === 1 && (
              <>
                마우스를 움직여 화면에 정지된 <strong>연습 캔 표적 3개</strong>를 차례대로 맞히세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  💡 정중앙에 가까울수록 높은 판정(PERFECT)이 발생합니다. (남은 표적:{' '}
                  <span style={{ color: '#fbbf24', fontWeight: 800 }}>{targetsRemaining}개</span>)
                </div>
              </>
            )}

            {step === 2 && (
              <>
                다가오는 단단한 <strong>카스 병맥주 (체력 3HP)</strong>를 빠른 <strong>연타(홀드)</strong>로 격파하세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  💡 10발 소진 시 1.2초간 자동 재장전됩니다. (현재 탄창:{' '}
                  <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                    {isReloading ? '⚡ 재장전 중...' : `${ammo}/${maxAmmo}`}
                  </span>
                  )
                </div>
              </>
            )}

            {step === 3 && (
              <>
                피버 게이지 100% 충전 완료!{' '}
                <strong style={{ color: '#fbbf24' }}>[Space] 키</strong>(또는 모바일{' '}
                <strong style={{ color: '#ef4444' }}>[🔥 FEVER]</strong>)를 눌러 피버를 발동하세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  {isFeverActive ? (
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>
                      🔥 피버 발동 중! 탄창 무제한 난사로 쏟아지는 타겟들을 전멸시키세요!
                    </span>
                  ) : (
                    <span>💡 8초 동안 탄창 무제한(재장전 없음) & 공격력 2배로 폭주합니다!</span>
                  )}
                </div>
              </>
            )}

            {step === 'COMPLETED' && (
              <>
                모든 조작법(단발 조준, 3HP 연타 격파, 피버 난사)을 완벽히 마스터하셨습니다!
                <div style={{ fontSize: '13px', color: '#10b981', marginTop: '4px' }}>
                  이제 오비맥주 브루어리를 지키는 실전 배틀(Wave 1~5)에 도전해보세요!
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Exit / Skip Button */}
        <button
          onClick={onExitToLobby}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 18px',
            color: '#cbd5e1',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          🔙 훈련 종료 (로비 복귀)
        </button>
      </div>

      {/* Completion Modal Center Card */}
      {step === 'COMPLETED' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(5, 8, 15, 0.7)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: '540px',
              background: 'linear-gradient(145deg, #131b2e, #0c111d)',
              border: '2px solid #f59e0b',
              borderRadius: '24px',
              padding: '36px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '18px',
            }}
          >
            <div style={{ fontSize: '48px' }}>🏆</div>
            <div
              style={{
                fontSize: '26px',
                fontWeight: 900,
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              사격 훈련 코스 수료!
            </div>
            <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
              조준 사격, 3HP 연타 격파, 피버 난사까지 완벽히 체득하셨습니다.
              <br />
              지금 바로 실전 Wave 1에 출격하여 최고 기록에 도전하세요!
            </div>

            <div style={{ display: 'flex', gap: '14px', width: '100%', marginTop: '12px' }}>
              <button
                onClick={onExitToLobby}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔙 로비로 돌아가기
              </button>
              <button
                onClick={onStartRealGame}
                style={{
                  flex: 1.5,
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                }}
              >
                🚀 실전 배틀 시작! (Wave 1)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar: Ammo & Fever Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#38bdf8',
          }}
        >
          {isReloading
            ? '⚡ 자동 재장전 중 (1.2s)...'
            : isFeverActive
            ? '🔥 FEVER UNLIMITED AMMO'
            : `탄창: ${ammo} / ${maxAmmo}`}
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: isFeverReady || isFeverActive ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 800,
            color: isFeverActive ? '#ef4444' : isFeverReady ? '#fbbf24' : '#94a3b8',
          }}
        >
          {isFeverActive
            ? '🔥 FEVER ACTIVE (무한 연사 & 2배 데미지)'
            : isFeverReady
            ? '🔥 FEVER READY! [Space / 모바일 더블탭]'
            : 'FEVER GAUGE 준비 중'}
        </div>
      </div>
    </div>
  );
};
