import React from 'react';

/** blocked: 렌더러를 처음부터 만들 수 없음(브라우저 차단). lost: 게임 중 손실 후 복구 실패. */
export type WebGLErrorReason = 'blocked' | 'lost';

const COPY: Record<WebGLErrorReason, { title: string; cause: string }> = {
  blocked: {
    title: '그래픽(WebGL)을 켤 수 없습니다',
    cause: '브라우저가 이 사이트의 그래픽(WebGL)을 차단했습니다. 그래픽 오류가 여러 번 나면 Chrome이 사이트를 막습니다.',
  },
  lost: {
    title: '그래픽이 중단됐습니다',
    cause: '그래픽 장치가 응답하지 않아 화면을 다시 그릴 수 없습니다.',
  },
};

/** 빈 화면 대신 원인·해결 방법·새로고침 버튼을 보여 준다(2026-11-08-webgl-context-loss D03). */
export const WebGLErrorOverlay: React.FC<{ reason: WebGLErrorReason; onReload?: () => void }> = ({ reason, onReload }) => {
  const copy = COPY[reason];
  return (
    <div
      data-testid="webgl-error-overlay"
      role="alert"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: '#0b0f17',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '24px',
        textAlign: 'center',
        cursor: 'default',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '26px', color: '#fbbf24' }}>{copy.title}</h2>
      <p style={{ margin: 0, maxWidth: '560px', lineHeight: 1.6 }}>{copy.cause}</p>
      <ol style={{ margin: 0, maxWidth: '560px', textAlign: 'left', lineHeight: 1.7, color: '#cbd5e1' }}>
        <li>Chrome을 ⌘Q(Windows는 창 모두 닫기)로 완전히 종료한 뒤 다시 실행하세요. 탭 새로고침만으로는 풀리지 않습니다.</li>
        <li>
          <code>chrome://gpu</code>에서 WebGL이 Hardware accelerated인지, 설정 → 시스템 → &lsquo;가능한 경우 그래픽 가속 사용&rsquo;이 켜져 있는지 확인하세요.
        </li>
      </ol>
      <button
        type="button"
        data-testid="webgl-error-reload"
        onClick={onReload ?? (() => window.location.reload())}
        style={{
          background: '#f59e0b',
          color: '#111',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 22px',
          fontWeight: 800,
          fontSize: '16px',
          cursor: 'pointer',
        }}
      >
        새로고침
      </button>
    </div>
  );
};
