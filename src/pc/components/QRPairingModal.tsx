import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { PlayerSlot, RunRankingEntry, TeamRankingEntry } from '../../shared/types';
import { PLAYER_COLORS, WEAPON_RANKING_LABEL } from '../../shared/constants';
import { LobbyNextStepBanner } from './LobbyNextStepBanner';
import { getLobbyNextAction, getStartButtonView, isOptionalSlot } from '../lobbyGuide';
import { SlotPair, SlotState, SlotInput, StartGate, isSlotJoined, isSlotReady, getJoinedSlots } from '../coopSlots';
import { RankingTabs, RankingTab, getDefaultRankTab } from './RankingTabs';

export function buildControllerPairingUrl(origin: string, roomId: string, lanIp?: string, slot: PlayerSlot = 1): string {
  let cleanOrigin = origin.replace(/\/+$/, '');
  if (lanIp) {
    cleanOrigin = cleanOrigin.replace(/localhost|127\.0\.0\.1/, lanIp);
  }
  return `${cleanOrigin}/controller?room=${encodeURIComponent(roomId)}&slot=${slot}`;
}

export interface QRPairingModalProps {
  roomId: string;
  lanIp?: string;
  slots: SlotPair;
  startGate: StartGate;
  topRankings: RunRankingEntry[];
  teamRankings?: TeamRankingEntry[];
  highlightTeamKey?: string;
  highlightDeviceIds?: string[];
  activeRankTab?: RankingTab;
  onChangeRankTab?: (tab: RankingTab) => void;
  mouseNicknameError?: string | null;
  startNotice?: string | null;
  /** 지원하지 않는 폰이 연결을 시도했다는 안내(몇 초간). */
  unsupportedNotice?: string | null;
  onChooseInput: (slot: PlayerSlot, input: SlotInput | null) => void;
  onSubmitMouseNickname: (slot: PlayerSlot, nickname: string) => void;
  onEditMouseNickname: (slot: PlayerSlot) => void;
  onStart: () => void;
  onOpenGuide?: () => void;
  onStartTutorial?: () => void;
  onRenewRoom?: () => void;
}

interface SlotCardProps {
  slotState: SlotState;
  /** 이 슬롯이 "선택 사항"인가(1P 준비 완료 + 2P 폰 미연결). 상태 글자만 바꾼다. */
  optional: boolean;
  otherSlotState: SlotState;
  roomId: string;
  lanIp?: string;
  mouseNicknameError?: string | null;
  onChooseInput: (slot: PlayerSlot, input: SlotInput | null) => void;
  onSubmitMouseNickname: (slot: PlayerSlot, nickname: string) => void;
  onEditMouseNickname: (slot: PlayerSlot) => void;
}

const SlotCard: React.FC<SlotCardProps> = ({
  slotState,
  optional,
  otherSlotState,
  roomId,
  lanIp,
  mouseNicknameError,
  onChooseInput,
  onSubmitMouseNickname,
  onEditMouseNickname,
}) => {
  const { slot, input, player, isZeroCalibrated, isConnected } = slotState;
  const color = PLAYER_COLORS[slot];
  const [mouseNameInput, setMouseNameInput] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const pairingUrl = roomId ? buildControllerPairingUrl(origin, roomId, lanIp, slot) : '';

  const otherHasMouse = otherSlotState.input === 'mouse';
  const isPhoneLocked = input === 'mobile' && !!player;

  useEffect(() => {
    if (!pairingUrl) return;
    QRCode.toDataURL(pairingUrl, { width: 186, margin: 1 })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error(`Failed to generate QR for slot ${slot}`, err));
  }, [pairingUrl, slot]);

  // Status text determination
  let statusText = '비어 있음';
  let statusColor = '#64748b';

  if (input === 'mobile') {
    // 플레이어 등록 전(QR만 열었다 닫은 경우)에는 "끊김"이 아니라 아직 연결 대기다(배너 단계와 맞춘다).
    if (!isConnected && player) {
      statusText = '● 연결 끊김';
      statusColor = '#f87171';
    } else if (!player) {
      statusText = optional ? '● 스마트폰 연결 대기 (선택)' : '● 스마트폰 연결 대기 중…';
      statusColor = optional ? '#94a3b8' : '#f59e0b';
    } else if (!isZeroCalibrated) {
      statusText = '● 영점 조절 필요';
      statusColor = '#f59e0b';
    } else {
      statusText = '● 준비 완료';
      statusColor = '#4ade80';
    }
  } else if (input === 'mouse') {
    if (!player) {
      statusText = '닉네임 입력 대기';
      statusColor = '#94a3b8';
    } else {
      statusText = '● 준비 완료';
      statusColor = '#4ade80';
    }
  }

  const handleMouseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mouseNameInput.trim();
    if (trimmed.length >= 2 && trimmed.length <= 10) {
      onSubmitMouseNickname(slot, trimmed);
    }
  };

  return (
    <div
      data-testid={`slot-card-${slot}`}
      style={{
        flex: 1,
        background: 'rgba(15, 23, 42, 0.7)',
        border: `2px solid ${color}`,
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.5), inset 0 0 16px ${color}1a`,
        minHeight: '340px',
      }}
    >
      {/* Slot Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 900,
              color: '#ffffff',
              backgroundColor: color,
            }}
          >
            {slot}P
          </span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#f1f5f9' }}>
            {slot === 1 ? '1P 슬롯' : '2P 슬롯'}
          </span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: statusColor }}>{statusText}</div>
      </div>

      {/* Input Selection Segments */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '18px',
          background: 'rgba(30, 41, 59, 0.6)',
          padding: '4px',
          borderRadius: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => onChooseInput(slot, input === 'mobile' ? null : 'mobile')}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            backgroundColor: input === 'mobile' ? color : 'transparent',
            color: input === 'mobile' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          📱 모바일
        </button>
        <button
          type="button"
          disabled={otherHasMouse || isPhoneLocked}
          onClick={() => {
            if (!otherHasMouse && !isPhoneLocked) {
              onChooseInput(slot, input === 'mouse' ? null : 'mouse');
            }
          }}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 800,
            cursor: otherHasMouse || isPhoneLocked ? 'not-allowed' : 'pointer',
            opacity: otherHasMouse || isPhoneLocked ? 0.35 : 1,
            textDecoration: otherHasMouse ? 'line-through' : 'none',
            backgroundColor: input === 'mouse' ? color : 'transparent',
            color: input === 'mouse' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          🖱 마우스
        </button>
      </div>

      {/* Card Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {input === null && (
          <div style={{ padding: '24px 12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#e2e8f0', marginBottom: '8px' }}>
              입력 방식을 선택하세요
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              📱 모바일은 QR 스캔, 🖱 마우스는 바로 사용
            </div>
          </div>
        )}

        {input === 'mobile' && !player && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Slot ${slot} QR Code`}
                style={{
                  width: '186px',
                  height: '186px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '10px',
                }}
              />
            ) : (
              <div
                style={{
                  width: '186px',
                  height: '186px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  marginBottom: '10px',
                }}
              >
                QR 생성 중...
              </div>
            )}
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#cbd5e1', letterSpacing: '0.05em' }}>
              ROOM CODE: <span style={{ color: color }}>{roomId}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', maxWidth: '280px', wordBreak: 'break-all' }}>
              {pairingUrl}
            </div>
          </div>
        )}

        {input === 'mobile' && player && (
          <div style={{ padding: '16px 12px' }}>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#f8fafc', marginBottom: '10px' }}>
              🔫 {player.nickname}님 접속 완료
            </div>
            {!isZeroCalibrated ? (
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                폰에서 영점을 맞춰 주세요
              </div>
            ) : (
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#4ade80' }}>
                🎯 영점 완료
              </div>
            )}
            {!isConnected && (
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f87171', marginTop: '8px' }}>
                연결이 끊어졌습니다. 다시 연결 중...
              </div>
            )}
          </div>
        )}

        {input === 'mouse' && !player && (
          <form
            onSubmit={handleMouseSubmit}
            style={{ width: '100%', maxWidth: '280px', padding: '12px 0' }}
          >
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#cbd5e1', marginBottom: '8px' }}>
              닉네임 입력 (2~10자)
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                maxLength={10}
                value={mouseNameInput}
                onChange={(e) => setMouseNameInput(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="닉네임 입력"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={mouseNameInput.trim().length < 2 || mouseNameInput.trim().length > 10}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: color,
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: mouseNameInput.trim().length >= 2 ? 'pointer' : 'not-allowed',
                  opacity: mouseNameInput.trim().length >= 2 ? 1 : 0.4,
                }}
              >
                확인
              </button>
            </div>
            {mouseNicknameError && (
              <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                {mouseNicknameError}
              </div>
            )}
          </form>
        )}

        {input === 'mouse' && player && (
          <div style={{ padding: '20px 12px' }}>
            <div style={{ fontSize: '38px', marginBottom: '8px' }}>🖱️</div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#f8fafc', marginBottom: '6px' }}>
              {player.nickname} · 마우스로 플레이
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              좌클릭 발사 · 우클릭 스킬
            </div>
            <button
              type="button"
              data-testid={`mouse-nickname-edit-${slot}`}
              onClick={() => { setMouseNameInput(player.nickname); onEditMouseNickname(slot); }}
              style={{ marginTop: '10px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}
            >
              닉네임 변경
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const QRPairingModal: React.FC<QRPairingModalProps> = ({
  roomId,
  lanIp,
  slots,
  startGate,
  topRankings,
  teamRankings = [],
  highlightTeamKey,
  highlightDeviceIds,
  activeRankTab,
  onChangeRankTab,
  mouseNicknameError,
  startNotice,
  unsupportedNotice,
  onChooseInput,
  onSubmitMouseNickname,
  onEditMouseNickname,
  onStart,
  onOpenGuide,
  onStartTutorial,
  onRenewRoom,
}) => {
  const joinedCount = getJoinedSlots(slots).length;
  const startView = getStartButtonView(slots, startGate);
  const defaultTab = getDefaultRankTab(joinedCount);

  const [localRankTab, setLocalRankTab] = useState<RankingTab>(() => {
    try {
      const saved = localStorage.getItem('beer_crusher_lobby_rank_tab');
      if (saved === 'solo' || saved === 'team') return saved;
    } catch {
      // ignore
    }
    return defaultTab;
  });

  const prevJoinedCountRef = useRef(joinedCount);
  useEffect(() => {
    if (prevJoinedCountRef.current !== joinedCount) {
      prevJoinedCountRef.current = joinedCount;
      const nextDefault = getDefaultRankTab(joinedCount);
      setLocalRankTab(nextDefault);
      try {
        localStorage.setItem('beer_crusher_lobby_rank_tab', nextDefault);
      } catch {
        // ignore
      }
    }
  }, [joinedCount]);

  const currentTab = activeRankTab ?? localRankTab;
  const handleTabChange = (t: RankingTab) => {
    if (onChangeRankTab) {
      onChangeRankTab(t);
    }
    setLocalRankTab(t);
    try {
      localStorage.setItem('beer_crusher_lobby_rank_tab', t);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.78)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'safe center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '16px',
        boxSizing: 'border-box',
        zIndex: 100,
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
        color: '#ffffff',
      }}
    >
      <div
        data-testid="qr-pairing-modal-container"
        style={{
          width: '1120px',
          maxWidth: '95vw',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          margin: 'auto',
          background: 'linear-gradient(145deg, #131a29, #0d121c)',
          border: '2px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '24px',
          padding: '32px 36px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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
          <div style={{ fontSize: '14px', color: '#cbd5e1', marginTop: '6px' }}>
            플레이어마다 입력 방식을 선택하세요. 한 명만 연결하면 1인 플레이, 둘 다 연결하면 2인 협동입니다.
          </div>
        </div>

        {/* 지금 할 일 배너 */}
        <LobbyNextStepBanner action={getLobbyNextAction(slots)} />

        {/* 1P / 2P Slot Cards */}
        <div style={{ display: 'flex', gap: '20px', width: '100%', marginBottom: '24px' }}>
          <SlotCard
            slotState={slots[0]}
            optional={isOptionalSlot(slots, 1)}
            otherSlotState={slots[1]}
            roomId={roomId}
            lanIp={lanIp}
            mouseNicknameError={mouseNicknameError}
            onChooseInput={onChooseInput}
            onSubmitMouseNickname={onSubmitMouseNickname}
            onEditMouseNickname={onEditMouseNickname}
          />
          <SlotCard
            slotState={slots[1]}
            optional={isOptionalSlot(slots, 2)}
            otherSlotState={slots[0]}
            roomId={roomId}
            lanIp={lanIp}
            mouseNicknameError={mouseNicknameError}
            onChooseInput={onChooseInput}
            onSubmitMouseNickname={onSubmitMouseNickname}
            onEditMouseNickname={onEditMouseNickname}
          />
        </div>

        {/* Lower Section: Left Leaderboard + Right Start/Actions */}
        <div style={{ display: 'flex', gap: '24px', width: '100%' }}>
          {/* Left: Top 5 Solo Ranking */}
          <div
            style={{
              flex: '0 0 320px',
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '16px 18px',
            }}
          >
            <RankingTabs
              soloRankings={topRankings}
              teamRankings={teamRankings}
              activeTab={currentTab}
              onChangeTab={handleTabChange}
              highlightTeamKey={highlightTeamKey}
              highlightDeviceIds={highlightDeviceIds}
              compact
            />
          </div>

          {/* Right: Start & Action Buttons */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unsupportedNotice && (
              <div
                data-testid="unsupported-notice-chip"
                role="alert"
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '2px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  fontSize: '15px',
                  fontWeight: 900,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>📵</span>
                <span>{unsupportedNotice}</span>
              </div>
            )}
            {/* Start Button or Waiting Chip */}
            <div style={{ display: 'flex' }}>
              {startNotice ? (
                <div
                  data-testid="start-notice-chip"
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '12px',
                    border: '2px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#fbbf24',
                    fontSize: '15px',
                    fontWeight: 900,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>⚠️</span>
                  <span>{startNotice}</span>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="lobby-start-button"
                  data-enabled={startView.enabled}
                  disabled={!startView.enabled}
                  {...(startView.enabled ? { 'data-shootable': 'start', onClick: onStart } : {})}
                  style={
                    startView.enabled
                      ? {
                          flex: 1,
                          padding: '16px',
                          borderRadius: '12px',
                          border: '2px solid #f59e0b',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#000000',
                          fontSize: '16px',
                          fontWeight: 900,
                          cursor: 'pointer',
                          boxShadow: '0 0 24px rgba(245, 158, 11, 0.4), inset 0 0 15px rgba(251, 191, 36, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          letterSpacing: '0.5px',
                        }
                      : {
                          flex: 1,
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          background: 'rgba(30, 41, 59, 0.5)',
                          color: '#94a3b8',
                          fontSize: '15px',
                          fontWeight: 800,
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }
                  }
                >
                  <span style={startView.enabled ? { fontSize: '22px' } : undefined}>{startView.icon}</span>
                  <span>{startView.label}</span>
                </button>
              )}
            </div>

            {(onStartTutorial || onOpenGuide) && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {onStartTutorial && (
                  <button
                    type="button"
                    data-testid="lobby-tutorial-button"
                    data-enabled={startView.enabled}
                    disabled={!startView.enabled}
                    onClick={startView.enabled ? onStartTutorial : undefined}
                    style={{
                      flex: 1,
                      padding: '11px 8px',
                      borderRadius: '12px',
                      border: startView.enabled ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(148, 163, 184, 0.25)',
                      background: startView.enabled ? 'rgba(56, 189, 248, 0.1)' : 'rgba(30, 41, 59, 0.5)',
                      color: startView.enabled ? '#38bdf8' : '#94a3b8',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: startView.enabled ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {startView.enabled ? '🎓 튜토리얼 시작' : '🎓 튜토리얼 시작 (기기 연결 후 가능)'}
                  </button>
                )}
                {onOpenGuide && (
                  <button
                    onClick={onOpenGuide}
                    style={{
                      flex: 1,
                      padding: '11px 8px',
                      borderRadius: '12px',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      color: '#fbbf24',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    📖 게임 가이드
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                fontSize: '12px',
                lineHeight: 1.7,
                color: '#94a3b8',
              }}
            >
              <div style={{ fontWeight: 800, color: '#cbd5e1' }}>🎮 조작법</div>
              <div>📱 폰: 기울여 조준 · 탭 발사(꾹 누르면 연사) · 더블탭 피버 · 총구를 위로 휙 젖혀 스킬</div>
              <div>🖱️ 마우스: 클릭 발사(누르고 있으면 연사) · 더블클릭 피버 · 우클릭 스킬 · Esc 일시정지</div>
            </div>

            {onRenewRoom && (
              <button
                onClick={onRenewRoom}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  background: 'rgba(148, 163, 184, 0.06)',
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔄 새 방 만들기 (모든 슬롯 초기화)
              </button>
            )}

            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
              🔊 크롬/사파리 사운드가 들리지 않으면 화면을 마우스로 한 번 클릭해주세요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
