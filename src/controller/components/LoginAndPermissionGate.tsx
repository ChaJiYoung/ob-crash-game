import React, { useState } from 'react';
import { requestSensorPermission } from '../sensors/SensorPermission';
import { PlayerProfile } from '../../shared/types';

export function validateNicknameInput(rawNickname: string): { valid: boolean; trimmed: string; error?: string } {
  const trimmed = rawNickname.trim();
  if (trimmed.length < 2) {
    return { valid: false, trimmed, error: '닉네임은 최소 2자 이상 입력해주세요.' };
  }
  if (trimmed.length > 10) {
    return { valid: false, trimmed, error: '닉네임은 최대 10자까지만 가능합니다.' };
  }
  return { valid: true, trimmed };
}

export interface LoginAndPermissionGateProps {
  isNewUser: boolean;
  player?: PlayerProfile;
  onRegisterNickname: (nickname: string) => void;
  onPermissionGranted: () => void;
}

export const LoginAndPermissionGate: React.FC<LoginAndPermissionGateProps> = ({
  isNewUser,
  player,
  onRegisterNickname,
  onPermissionGranted,
}) => {
  const [nicknameInput, setNicknameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateNicknameInput(nicknameInput);
    if (!result.valid) {
      setErrorMessage(result.error || '유효하지 않은 닉네임입니다.');
      return;
    }
    setErrorMessage('');
    onRegisterNickname(result.trimmed);
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const result = await requestSensorPermission();
      if (result !== 'granted') {
        alert('모션 센서 권한이 허용되어야 권총 조준이 가능합니다.');
        return;
      }
      onPermissionGranted();
    } finally {
      setIsRequestingPermission(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        padding: '24px',
        backgroundColor: '#0a0d14',
        color: '#ffffff',
        fontFamily: "'Noto Sans KR', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(19, 26, 41, 0.95)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍺🔫</div>
        <div style={{ fontSize: '22px', fontWeight: 900, color: '#fbbf24', marginBottom: '4px' }}>
          비어 크러셔 컨트롤러
        </div>

        {isNewUser ? (
          /* New User Form */
          <form onSubmit={handleRegisterSubmit} style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
              첫 접속입니다! 게임에서 사용할 닉네임을 입력해주세요.
            </div>

            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="닉네임 (2~10자)"
              maxLength={10}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                color: '#ffffff',
                fontSize: '16px',
                textAlign: 'center',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '12px',
              }}
            />

            {errorMessage && (
              <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                color: '#111827',
                fontSize: '16px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🚀 닉네임 등록 및 계속하기
            </button>
          </form>
        ) : (
          /* Existing User Welcome & Sensor Permission */
          <div style={{ marginTop: '16px' }}>
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                borderRadius: '12px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#34d399' }}>
                반갑습니다, {player?.nickname}님!
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                최고 기록: {player?.bestScore || 0}점 (총 {player?.totalGames || 0}회 플레이)
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
              스마트폰을 권총처럼 쥐어 조준할 수 있도록 센서 권한을 허용해주세요.
            </div>

            <button
              onClick={handleRequestPermission}
              disabled={isRequestingPermission}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              {isRequestingPermission ? '권한 요청 중...' : '🔫 센서 권한 허용 및 총기 그립 준비'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
