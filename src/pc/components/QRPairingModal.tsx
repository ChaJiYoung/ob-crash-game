import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { PlayerProfile } from '../../shared/types';

export function buildControllerPairingUrl(origin: string, roomId: string, lanIp?: string): string {
  let cleanOrigin = origin.replace(/\/+$/, '');
  if (lanIp) {
    cleanOrigin = cleanOrigin.replace(/localhost|127\.0\.0\.1/, lanIp);
  }
  return `${cleanOrigin}/controller?room=${encodeURIComponent(roomId)}`;
}

export interface QRPairingModalProps {
  roomId: string;
  lanIp?: string;
  pairedPlayer?: PlayerProfile;
  topRankings: PlayerProfile[];
  isZeroCalibrated?: boolean;
  onStartAsPc: () => void;
  onStartWithController: () => void;
  onOpenGuide?: () => void;
  onStartSandbox?: () => void;
}

export const QRPairingModal: React.FC<QRPairingModalProps> = ({
  roomId,
  lanIp,
  pairedPlayer,
  topRankings,
  isZeroCalibrated = false,
  onStartAsPc,
  onStartWithController,
  onOpenGuide,
  onStartSandbox,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pairingUrl, setPairingUrl] = useState<string>('');

  useEffect(() => {
    if (!roomId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const url = buildControllerPairingUrl(origin, roomId, lanIp);
    setPairingUrl(url);

    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [roomId, lanIp]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.78)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
        color: '#ffffff',
      }}
    >
      <div
        style={{
          width: '740px',
          background: 'linear-gradient(145deg, #131a29, #0d121c)',
          border: '2px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '24px',
          padding: '36px 40px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            🍺 BEER CRUSHER 3D
          </div>
          <div style={{ fontSize: '15px', color: '#94a3b8', marginTop: '6px' }}>
            스마트폰 카메라로 아래 QR 코드를 스캔하여 권총 컨트롤러를 연결하세요!
          </div>
        </div>

        {/* 2-Column Content: QR & Leaderboard */}
        <div style={{ display: 'flex', gap: '36px', width: '100%', alignItems: 'center' }}>
          {/* Left: QR Code & Room Badge */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#38bdf8',
                marginBottom: '12px',
                letterSpacing: '1px',
              }}
            >
              ROOM CODE: <span style={{ color: '#fbbf24', fontSize: '18px' }}>{roomId || '----'}</span>
            </div>

            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '12px',
                  border: '4px solid #ffffff',
                }}
              />
            ) : (
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#1f2937',
                  borderRadius: '12px',
                }}
              >
                QR 생성 중...
              </div>
            )}

            {pairingUrl && (
              <div
                style={{
                  marginTop: '10px',
                  fontSize: '11px',
                  color: '#94a3b8',
                  textAlign: 'center',
                  wordBreak: 'break-all',
                  maxWidth: '240px',
                  lineHeight: 1.4,
                }}
              >
                직접 접속: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{pairingUrl}</span>
              </div>
            )}

            {/* Connection Status Card */}
            {pairedPlayer ? (
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: isZeroCalibrated ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  border: isZeroCalibrated ? '1px solid #38bdf8' : '1px solid #10b981',
                  borderRadius: '10px',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: isZeroCalibrated ? '#38bdf8' : '#34d399' }}>
                  {isZeroCalibrated ? '🎯 영점 조절 완료! (조준선 확인 중)' : `🔫 ${pairedPlayer.nickname}님 접속 완료!`}
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                  {isZeroCalibrated ? '화면 조준선을 확인한 뒤 시작 버튼을 누르세요' : `최고 기록: ${pairedPlayer.bestScore}점 (영점 대기 중)`}
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: '16px',
                  fontSize: '13px',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
                스마트폰 연결 대기 중...
              </div>
            )}
          </div>

          {/* Right: Hall of Fame TOP 5 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '320px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#fbbf24',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🏆 명예의 전당 TOP 5
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              {topRankings.length > 0 ? (
                topRankings.slice(0, 5).map((p, idx) => (
                  <div
                    key={p.deviceId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: idx === 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: idx === 0 ? '1px solid rgba(245, 158, 11, 0.35)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontWeight: 900,
                          fontSize: '13px',
                          color: idx === 0 ? '#fbbf24' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#b45309' : '#94a3b8',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.nickname}</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>
                      {p.bestScore}점
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ margin: 'auto', fontSize: '13px', color: '#64748b' }}>
                  아직 등록된 랭킹 기록이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            {pairedPlayer ? (
              <button
                onClick={onStartWithController}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  transition: 'transform 0.1s',
                }}
              >
                🔫 스마트폰 컨트롤러로 게임 시작!
              </button>
            ) : (
              <button
                onClick={onStartAsPc}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                🖱️ 스마트폰 없이 PC 마우스/키보드로 바로 시작
              </button>
            )}
          </div>

          {onStartSandbox && (
            <button
              onClick={onStartSandbox}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s',
              }}
            >
              🎯 영점·센서 & 모듈 테스트장 (실시간 각도·몬스터·피버 시험)
            </button>
          )}

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#fbbf24',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s',
              }}
            >
              📖 게임 가이드 & 튜토리얼 (조작법 · 몬스터 도감 · 아이템)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
