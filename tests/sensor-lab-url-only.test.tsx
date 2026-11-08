import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { QRPairingModal } from '../src/pc/components/QRPairingModal';
import { SensorAndModuleTestLabOverlay } from '../src/pc/components/SensorAndModuleTestLabOverlay';
import { mergeSensorFrameMetrics, SensorLiveMetrics } from '../src/pc/components/MobileSensorLabModal';
import { createInitialSlots, getStartGate } from '../src/pc/coopSlots';
import { resolveRouteMode } from '../src/App';

const read = (path: string) => fs.readFileSync(path, 'utf-8');

const metrics = (over: Partial<SensorLiveMetrics> = {}): SensorLiveMetrics => ({
  rawAimX: 0,
  rawAimY: 0,
  aimX: 0,
  aimY: 0,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  packetHz: 60,
  jitterRms: 0.002,
  ...over,
});

describe('센서 테스트장은 주소(/sensor-test)로만 들어간다', () => {
  it('로비(QR 모달)에 테스트장 진입 버튼이 없다', () => {
    const slots = createInitialSlots();
    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="AB12"
        slots={slots}
        startGate={getStartGate(slots)}
        topRankings={[]}
        savedMouseNickname=""
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );
    expect(html).not.toContain('테스트장');
    expect(html).not.toContain('모듈 테스트');
  });

  it('인게임 HUD와 페어링 화면에 센서 랩 버튼 코드가 남아 있지 않다', () => {
    expect(read('src/pc/components/ArcadeOverlayHUD.tsx')).not.toContain('onOpenSensorLab');
    expect(read('src/pc/components/ArcadeOverlayHUD.tsx')).not.toContain('센서 연구소');
    const page = read('src/pc/PCGamePage.tsx');
    expect(page).not.toContain('handleStartSandbox');
    expect(page).not.toContain('모바일 센서 진단 & 안정화 랩');
    expect(page).not.toContain('onStartSandbox');
  });

  it('테스트장 오버레이는 onOpenSensorLab을 받았을 때만 센서 랩 버튼을 그린다', () => {
    const noop = () => {};
    const base = {
      roomId: 'AB12',
      diagnostics: {
        aimX: 0,
        aimY: 0,
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        sensitivityX: 1,
        sensitivityY: 1,
        invertY: false,
        rapidFireHold: false,
        packetHz: 60,
      },
      targetsCount: 0,
      stationarySpawn: false,
      infiniteAmmo: false,
      ammo: 10,
      maxAmmo: 10,
      isReloading: false,
      feverGauge: 0,
      isFeverReady: false,
      isFeverActive: false,
      activeBuffs: [],
      onToggleStationarySpawn: noop,
      onSpawnTarget: noop,
      onSpawnFivePointTargets: noop,
      onClearTargets: noop,
      onSpawnItem: noop,
      onActivateBuffImmediate: noop,
      onTriggerFeverImmediate: noop,
      onToggleInfiniteAmmo: noop,
      onTestFireShot: noop,
      onSensitivityChange: noop,
      onResetZeroCenter: noop,
      onStartRealGame: noop,
      onExitToLobby: noop,
    };
    const without = renderToStaticMarkup(React.createElement(SensorAndModuleTestLabOverlay, base));
    expect(without).not.toContain('open-sensor-lab');
    const withBtn = renderToStaticMarkup(
      React.createElement(SensorAndModuleTestLabOverlay, { ...base, onOpenSensorLab: noop })
    );
    expect(withBtn).toContain('data-testid="open-sensor-lab"');
    expect(withBtn).toContain('센서 랩');
  });

  it('/sensor-test 주소는 그대로 테스트장(SANDBOX)으로 연결된다', () => {
    expect(resolveRouteMode('/sensor-test', '')).toBe('SANDBOX');
    expect(resolveRouteMode('/', '?mode=test')).toBe('SANDBOX');
  });
});

describe('mergeSensorFrameMetrics (센서 랩 모달 흔들림 수정)', () => {
  it('센서 프레임이 렌더 성능 지표(fps 등)를 지우지 않는다', () => {
    const prev = metrics({ fps: 60, drawCalls: 12, geometries: 5, textures: 3 });
    const next = mergeSensorFrameMetrics(prev, {
      rawAimX: 0.2,
      rawAimY: -0.1,
      aimX: 0.19,
      aimY: -0.1,
      yawDeg: 3,
      pitchDeg: 1,
      rollDeg: 0,
      packetHz: 60,
      jitterRms: 0.004,
    });
    expect(next.fps).toBe(60);
    expect(next.drawCalls).toBe(12);
    expect(next.geometries).toBe(5);
    expect(next.textures).toBe(3);
    expect(next.rawAimX).toBe(0.2);
    expect(next.jitterRms).toBe(0.004);
  });

  it('명시한 undefined(lastSnapAt)는 이전 값을 덮어쓴다', () => {
    const prev = metrics({ lastSnapAt: 123 });
    const next = mergeSensorFrameMetrics(prev, { ...metrics(), lastSnapAt: undefined });
    expect(next.lastSnapAt).toBeUndefined();
  });

  it('PCGamePage는 센서 프레임 지표를 병합 헬퍼로만 갱신한다', () => {
    const page = read('src/pc/PCGamePage.tsx');
    expect(page).toContain('mergeSensorFrameMetrics(prev');
    expect(page).not.toMatch(/setSensorLiveMetrics\(\{\s*rawAimX/);
  });
});
