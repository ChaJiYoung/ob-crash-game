import React from 'react';
import { GuideCard } from './GuideCard';

/** 탭 5: 2인팟. 세 블록 모두 한 줄 요약 + 접힌 상세. */
export const CoopTab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <GuideCard
      testId="coop-lobby-card"
      icon="👥"
      title="2인팟 로비 연결 & 슬롯 시스템"
      oneLiner="1P·2P가 각자 폰 또는 마우스로 참여하고, 한 명만 연결하면 1인 플레이입니다"
      accentColor="#38bdf8"
    >
<div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                  • <strong>1P(#38bdf8 하늘색) / 2P(#ff6b3d 주황색) 슬롯:</strong> 각 슬롯마다 📱 스마트폰(슬롯별 전용 QR 스캔) 또는 🖱 마우스(닉네임 입력) 중 원하는 조작 방식을 자유롭게 선택할 수 있습니다.<br />
                  • <strong>마우스 단독 배정:</strong> 마우스는 한 슬롯만 사용할 수 있으며, 다른 슬롯은 스마트폰을 연결해야 합니다.<br />
                  • <strong>시작 게이트:</strong> 참여한 슬롯이 모두 준비(모바일 영점 완료 또는 마우스 닉네임 입력)되면 게임을 시작할 수 있습니다. 한쪽 슬롯만 참여하면 기존 1인 모드로 진행됩니다.
                </div>
    </GuideCard>

    <GuideCard
      testId="coop-rules-card"
      icon="⚔️"
      title="협동 전투 & 보상 선택 규칙"
      oneLiner="목숨·웨이브·보스는 함께, 점수·성장·카드는 각자"
      accentColor="#fbbf24"
    >
<div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                  • <strong>공유 요소:</strong> 목숨(BAR DEFENSE 5개 공유), 웨이브 진행 상태, 보스 몬스터는 팀 전체가 공유합니다.<br />
                  • <strong>개인 요소:</strong> 득점, 콤보, 처치 수, 무기 종류 및 레벨, 보상 카드는 각 플레이어 개인별로 누적됩니다.<br />
                  • <strong>몬스터 밸런스:</strong> 2인 참여 시 몬스터의 체력과 웨이브 스폰량이 2인 기준 규칙에 맞추어 강화됩니다.<br />
                  • <strong>보상 카드 선택:</strong> 웨이브 클리어 시 양쪽 플레이어 앞에 각자의 카드 3장이 소환됩니다. 두 플레이어가 모두 카드를 쏠 때까지 전장이 정지되며, 시간 제한 없이 여유롭게 선택할 수 있습니다.<br />
                  • <strong>펍 아이템:</strong> 파워샷·와이드스코프는 맞힌 플레이어 개인에게만 적용되며, 아이스 프리즈는 전장 전체(팀 공유)에 적용됩니다.
                </div>
    </GuideCard>

    <GuideCard
      testId="coop-grace-card"
      icon="🛡️"
      title="연결 끊김 보호(Grace Period) & 팀 랭킹"
      oneLiner="폰이 끊겨도 30초 안에 돌아오면 그대로 이어서, 2인 결과는 팀 랭킹에 등록됩니다"
      accentColor="#f59e0b"
    >
<div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                  • <strong>30초 연결 보호:</strong> 모바일 컨트롤러 연결이 끊기면 30초 동안 '나감(AWAY)' 상태로 총이 숨겨지고 남은 플레이어가 게임을 계속 진행합니다. 30초 내에 재접속하면 기존 점수와 무기를 그대로 유지한 채 복귀합니다.<br />
                  • <strong>팀 랭킹 명예의 전당:</strong> 2인팟 경기 결과는 솔로 랭킹을 침범하지 않으며, '팀 랭킹' 탭에 두 사람의 팀 합계 점수로 등록됩니다. 각자의 점수·무기·입력 방식(🖱/📱)도 함께 보입니다.
                </div>
    </GuideCard>
  </div>
);
