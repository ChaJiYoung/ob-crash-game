import React from 'react';
import { TutorialStep } from '../../shared/types';
import { GAME_TUNING } from '../../shared/gameTuning';

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
              {step === 1 && '🎯 STEP 1. 정밀 조준 배율(2.0x/1.0x/0.5x) & 원샷'}
              {step === 2 && '💥 STEP 2. 홀드 자동 연발(투두두두) & 100% 체력 게이지'}
              {step === 3 && '⚡ STEP 3. 액티브 스킬 (우클릭 / 폰 휙!)'}
              {step === 4 && '🔥 STEP 4. 피버 모드 & 무제한 탄창'}
              {step === 'COMPLETED' && '🎉 훈련 수료 완료!'}
            </span>
          </div>

          <div style={{ fontSize: '15px', color: '#f8fafc', fontWeight: 600, lineHeight: '1.5' }}>
            {step === 1 && (
              <>
                스마트폰을 모니터로 겨누고 <strong>화면을 톡 탭(탕! 발사)</strong>하여 정지된 <strong>연습 캔 3개</strong>를 맞히세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  💡 <strong>PERFECT(2.0배)·GREAT(1.0배)</strong> 명중 시 1HP 캔 한 방 격파! <strong>GOOD(0.5배)</strong> 스침 시 잔여 체력 게이지가 표시됩니다. (MISS 페널티 없음 / 남은 표적:{' '}
                  <span style={{ color: '#fbbf24', fontWeight: 800 }}>{targetsRemaining}개</span>)
                </div>
              </>
            )}

            {step === 2 && (
              <>
                다가오는 <strong>카스 병맥주 (4HP)</strong>를 향해 화면을 <strong>꾸욱 누르고(홀드) 있거나</strong> PC 마우스 좌클릭을 유지하여 <strong>'투두두두' 자동 연발</strong>로 격파하세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  💡 100% 슬림 연속 체력 게이지가 깎이며, 탄약 소진 시 자동으로 재장전됩니다. (현재 탄창:{' '}
                  <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                    {isReloading ? '⚡ 재장전 중...' : `${ammo}/${maxAmmo}`}
                  </span>
                  )
                </div>
              </>
            )}

            {step === 3 && (
              <>
                정지한 몬스터 편대 앞에서 <strong style={{ color: '#fbbf24' }}>마우스 우클릭</strong> 또는 폰을 위로 <strong style={{ color: '#fbbf24' }}>'휙!'</strong> 젖혀 무기 스킬을 발동하세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  💡 샷건 스킬은 화면의 모든 몬스터를 기절시키고 피해를 줍니다. 한 번만 쓰면 통과!
                </div>
              </>
            )}

            {step === 4 && (
              <>
                피버 게이지 100% 충전 완료! 화면을 <strong style={{ color: '#fbbf24' }}>따닥! 빠르게 두 번 탭</strong>하거나 PC에서는 <strong style={{ color: '#fbbf24' }}>마우스 더블클릭</strong>으로 피버를 발동하세요!
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  {isFeverActive ? (
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>
                      🔥 4초 피버 발동 중! 무한 탄창 자동 연사 & 명중 점수 1.5배!
                    </span>
                  ) : (
                    <span>💡 PERFECT(+{GAME_TUNING.fever.perfectDelta}%) 및 몬스터 처치(+{GAME_TUNING.fever.killDelta}%)로 충전되며, 발동 시 4초간 무한 탄창 자동 연사 & 명중 점수 1.5배!</span>
                  )}
                </div>
              </>
            )}

            {step === 'COMPLETED' && (
              <>
                모든 건슈팅 조작법(단발 탭 & 홀드 자동 연발, 액티브 스킬, 더블탭 피버 버스트)을 완벽히 마스터하셨습니다!
                <div style={{ fontSize: '13px', color: '#10b981', marginTop: '4px' }}>
                  💡 <strong>전용 액티브 스킬 팁:</strong> 총구를 위로 <strong>'휙!(Snap)'</strong> 젖히면 강력한 필살기가 발동됩니다! (PC는 우클릭)
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
            ? '⚡ 자동 재장전 중...'
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
            ? '🔥 FEVER ACTIVE (무한 탄창 & 명중 점수 1.5배)'
            : isFeverReady
            ? '🔥 FEVER READY! [더블클릭 / 모바일 더블탭]'
            : 'FEVER GAUGE 준비 중'}
        </div>
      </div>
    </div>
  );
};
