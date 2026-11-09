import React from 'react';
import { REWARD_CARD_SPECS } from '../../../shared/constants';
import { GAME_TUNING } from '../../../shared/gameTuning';
import { GuideCard } from './GuideCard';

/** 중간 카드가 나오는 웨이브. 가이드 문구가 웨이브 표와 어긋나지 않게 표에서 만든다. */
const MID_CARD_TEXT = GAME_TUNING.waves
  .filter((w) => w.midWaveCard)
  .map((w) => `${w.waveIndex}`)
  .join('·') + '웨이브';


/** 탭 3: 보상 카드 & 조작법. 카드 9종은 한 줄 효과로, 긴 규칙 설명과 조작법 표는 접혀 있다. */
export const CardsTab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <details
      data-testid="card-rules"
      style={{
        background: 'rgba(56, 189, 248, 0.08)',
        border: '1.5px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '16px',
        padding: '14px 20px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: '17px', fontWeight: 900, color: '#38bdf8' }}>
        🃏 킬 게이지 보상 카드 (Shoot-to-Select & 전장 일시정지)
      </summary>
      <div style={{ marginTop: '10px' }}>
<div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  웨이브를 클리어할 때(3·5웨이브는 보스를 처치한 뒤), 그리고 {MID_CARD_TEXT} 진행도가 절반(처치 수가 웨이브 몬스터 수의 절반)에 닿을 때 한 번 전장이 즉시 일시정지(Combat Freeze)되며 <strong>9종 중 무작위 3장</strong>의 3D 홀로그램 카드가 소환됩니다. 이미 최대치인 카드는 나오지 않고, 무기 레벨 상한은 1웨이브 Lv.2 · 2~4웨이브 Lv.3 · 5웨이브부터 MAX입니다. 카드를 고르는 동안 피버·버프·쿨다운 시간은 모두 멈추고, <strong>누르고 있던 입력은 무시</strong>되니 버튼을 뗐다가 새로 눌러 <strong>직접 사격</strong>하여 획득하세요! (카드 등장 후 0.8초는 입력 잠금)
                </div>
      </div>
    </details>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
      {Object.entries(REWARD_CARD_SPECS).map(([rk, cspec]) => (
        <GuideCard
          key={rk}
          testId={`reward-card-${rk}`}
          icon={cspec.icon}
          title={cspec.nameKo}
          badge={cspec.badgeText}
          oneLiner={cspec.descriptionKo}
          accentColor={cspec.colorHex}
        />
      ))}
    </div>

    <GuideCard
      testId="controls-card"
      icon="🎮"
      title="조작법 & 액티브 스킬 발동 가이드"
      oneLiner="폰: 탭 발사 · 꾹 눌러 연사 · 위로 휙 스킬 · 더블탭 피버 / 마우스: 클릭 · 우클릭 스킬 · 더블클릭 피버 · Esc 일시정지"
      accentColor="#fbbf24"
    >
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                    <strong>📱 모바일 건그립 컨트롤러:</strong><br />
                    • <strong>톡 탭 / 꾸욱 홀드:</strong> 화면 톡 탭 시 1발 단발, 화면을 꾸욱 누르면 첫 발은 즉시 단발 강타 후 무기별 속도로 <strong>'투두두두' 자동 연발!</strong><br />
                    • <strong>⚡ 필살 액티브 스킬:</strong> 총구를 위로 <strong>'휙!(Snap)'</strong> 젖히기 (스킬 완충 시 진동 알림, 카드 선택 직후 0.3초간은 안전 잠금)<br />
                    • <strong>🔥 {GAME_TUNING.fever.durationMs / 1000}초 피버 버스트:</strong> PERFECT(+{GAME_TUNING.fever.perfectDelta}%) 및 몬스터 처치(+{GAME_TUNING.fever.killDelta}%) 충전 후 100% 게이지에서 <strong>따닥 더블 탭</strong> ({GAME_TUNING.fever.durationMs / 1000}초간 무한 탄창 자동 연사 & 명중 점수 {GAME_TUNING.fever.scoreMult}배, 명중은 모두 GREAT 판정 & 대미지 {GAME_TUNING.judgment.feverDamage}배!)<br />
                    • <strong>영점 보정:</strong> 상단 주황색 띠 탭
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                    <strong>💻 PC 단독 플레이 키보드/마우스:</strong><br />
                    • <strong>조준 & 사격:</strong> 마우스 이동 및 좌클릭 톡 탭 / 좌클릭 홀드 시 모든 무기 <strong>'투두두두' 자동 연발 지원!</strong><br />
                    • <strong>⚡ 필살 액티브 스킬:</strong> <strong>마우스 우클릭</strong> (시작 카운트다운 중·카드 선택 중엔 미발동, 카드 선택 직후 0.3초 안전 잠금)<br />
                    • <strong>🔥 {GAME_TUNING.fever.durationMs / 1000}초 피버 버스트:</strong> PERFECT(+{GAME_TUNING.fever.perfectDelta}%) 및 몬스터 처치(+{GAME_TUNING.fever.killDelta}%) 충전 후 <strong>마우스 더블클릭</strong> ({GAME_TUNING.fever.durationMs / 1000}초간 무한 탄창 자동 연사 & 명중 점수 {GAME_TUNING.fever.scoreMult}배, 명중은 모두 GREAT 판정 & 대미지 {GAME_TUNING.judgment.feverDamage}배)<br />
                    • <strong>⏸ 일시정지:</strong> <strong>Esc 키</strong> 또는 상단 일시정지 버튼 (이어하기 / 다시시작)
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                    <strong>🎯 조준경 링 게이지:</strong> 십자선 둘레의 원호로 상태를 봅니다. <strong>위</strong>는 남은 탄창(20% 미만이면 노란색, 장전 중에는 하늘색으로 차오르며 피버 중에도 장전은 계속됩니다), <strong>왼쪽 아래</strong>는 스킬 충전(점은 스택), <strong>오른쪽 아래</strong>는 피버입니다. 피버 게이지는 충전될 때 주황색으로 차오르고, 피버가 켜지면 붉은색으로 남은 시간만큼 줄어듭니다. 가득 차면 반짝입니다.
                  </div>
                </div>
    </GuideCard>
  </div>
);
