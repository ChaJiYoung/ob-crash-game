import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { UnsupportedDeviceScreen } from '../src/controller/components/UnsupportedDeviceScreen';
import { LoginAndPermissionGate } from '../src/controller/components/LoginAndPermissionGate';

const source = fs.readFileSync('src/controller/MobileControllerPage.tsx', 'utf-8');

describe('UnsupportedDeviceScreen', () => {
  it('차단 안내만 보이고 우회·재시도 버튼이 없다', () => {
    const html = renderToStaticMarkup(<UnsupportedDeviceScreen reason="NO_GYRO" />);
    expect(html).toContain('data-testid="unsupported-device-screen"');
    expect(html).toContain('data-reason="NO_GYRO"');
    expect(html).toContain('이 기기는 지원하지 않아요');
    expect(html).toContain('다른 폰');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
  });

  it('이유에 따라 보조 문구가 다르다', () => {
    const noGyro = renderToStaticMarkup(<UnsupportedDeviceScreen reason="NO_GYRO" />);
    const noEvents = renderToStaticMarkup(<UnsupportedDeviceScreen reason="NO_EVENTS" />);
    expect(noGyro).toContain('자이로 값이 확인되지 않았어요');
    expect(noEvents).toContain('센서 신호가 들어오지 않았어요');
  });
});

describe('LoginAndPermissionGate 센서 확인 대기', () => {
  it('허용 버튼 문구는 기본 상태에서 센서 권한 안내다', () => {
    const html = renderToStaticMarkup(
      <LoginAndPermissionGate
        isNewUser={false}
        player={{ deviceId: 'd', nickname: 'nick', bestScore: 0, totalGames: 0, lastPlayedAt: '' }}
        onRegisterNickname={() => {}}
        onPermissionGranted={async () => {}}
      />
    );
    expect(html).toContain('센서 권한 허용');
    expect(html).not.toContain('센서 확인 중');
  });

  it('게이트는 판별이 끝날 때까지 기다리며(await) 권한 요청은 그 앞에서 한다', () => {
    const gate = fs.readFileSync('src/controller/components/LoginAndPermissionGate.tsx', 'utf-8');
    const ask = gate.indexOf('await requestSensorPermission()');
    const wait = gate.indexOf('await onPermissionGranted()');
    expect(ask).toBeGreaterThan(-1);
    expect(wait).toBeGreaterThan(ask);
    expect(gate).toContain('센서 확인 중');
  });
});

describe('MobileControllerPage 판별 연결 (소스 확인: 페이지가 훅과 WebSocket에 의존해 렌더 테스트가 어렵다)', () => {
  const start = source.indexOf('const handlePermissionGranted');
  const block = source.slice(start, source.indexOf('};', start));

  it('개발 모드에서만 판별을 건너뛰고, 배포 빌드에는 우회가 없다', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('if (!import.meta.env.DEV)');
    expect(source).not.toMatch(/bypass|skipProbe|[?&]force/i);
  });

  it('판별이 끝나기 전에는 센서를 켜거나 PAD로 가거나 영점을 예약하지 않는다', () => {
    const probe = block.indexOf('await probeSensorSupport()');
    expect(probe).toBeGreaterThan(-1);
    for (const later of ['setSensorsActive(true)', "setStep('PAD')", 'autoZeroPendingRef.current = true']) {
      expect(block.indexOf(later)).toBeGreaterThan(probe);
    }
  });

  it('미지원이면 재연결을 막고(blockedRef) 서버에 알린 뒤 차단 화면만 그린다', () => {
    const reject = source.slice(source.indexOf('const rejectUnsupportedDevice'), start);
    expect(reject).toContain('blockedRef.current = true');
    expect(reject).toContain("type: 'DEVICE_UNSUPPORTED'");
    expect(reject).toContain('setUnsupportedReason(reason)');
    expect(source).toContain('<UnsupportedDeviceScreen reason={unsupportedReason} />');
  });

  it('차단이 결정되면 예약된 재시도와 연결 중이던 소켓도 다시 붙지 않는다', () => {
    const connectStart = source.indexOf('const connect = () =>');
    const connectBlock = source.slice(connectStart, source.indexOf('wsRef.current = socket', connectStart));
    expect(connectBlock).toContain('blockedRef.current');
    const openStart = source.indexOf('socket.onopen = () =>');
    const openBlock = source.slice(openStart, source.indexOf('type: \'DEVICE_CHECK\'', openStart));
    // 인증(DEVICE_CHECK)을 보내기 전에 차단 여부를 본다.
    expect(openBlock).toContain('blockedRef.current');
    expect(openBlock).toContain('socket.close()');
  });
});
