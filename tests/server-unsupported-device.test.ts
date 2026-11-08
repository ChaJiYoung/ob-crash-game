import { describe, it, expect, afterEach, vi } from 'vitest';
import { startHarness, open, Inbox, sleep, Harness } from './helpers/wsHarness';

const unsupported = (h: Harness, deviceId: string, reason: string = 'NO_GYRO', slot = 1) =>
  JSON.stringify({ type: 'DEVICE_UNSUPPORTED', roomId: h.roomId, deviceId, reason, slot });

describe('server DEVICE_UNSUPPORTED', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await h?.cleanup();
    h = undefined;
  });

  const start = () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    return startHarness({ controllerFrameTimeoutMs: 60_000, watchIntervalMs: 50 });
  };

  it('PC가 CONTROLLER_UNSUPPORTED를 받고, 이어서 CONTROLLER_DISCONNECTED를 정확히 한 번 받는다', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);

    phone.ws.send(unsupported(h, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('CONTROLLER_UNSUPPORTED').length > 0);
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0);
    await sleep(200);

    const un = h.pc.of('CONTROLLER_UNSUPPORTED');
    expect(un).toHaveLength(1);
    expect(un[0]).toMatchObject({ slot: 1, reason: 'NO_GYRO' });
    expect(h.pc.disconnects(1)).toHaveLength(1);

    // 순서: UNSUPPORTED가 먼저, DISCONNECTED가 나중
    const types = h.pc.messages
      .filter((m) => m.type === 'CONTROLLER_UNSUPPORTED' || (m.type === 'ERROR' && m.code === 'CONTROLLER_DISCONNECTED'))
      .map((m) => m.type);
    expect(types).toEqual(['CONTROLLER_UNSUPPORTED', 'ERROR']);
  });

  it('비워진 슬롯에 다른 폰이 점유 오류 없이 들어올 수 있다', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(unsupported(h, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0);

    const b = await h.phone('phone-B', 1);
    expect(b.of('ERROR', (m) => m.code === 'SLOT_OCCUPIED')).toHaveLength(0);
    // 하네스는 PC가 CONTROLLER_PAIRED를 받으면 돌아오므로 폰 쪽 AUTH_RESULT 도착은 따로 기다린다.
    await b.waitFor(() => b.of('AUTH_RESULT').length > 0);
    expect(b.of('ERROR', (m) => m.code === 'SLOT_OCCUPIED')).toHaveLength(0);
  });

  it('좌석에 안 붙은 소켓이 보내도 다른 폰은 쫓겨나지 않는다', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    const url = `ws://localhost:${h.server.port}`;
    const stranger = await open(url);
    new Inbox(stranger);
    stranger.send(unsupported(h, 'phone-A')); // 남의 deviceId를 대도 소켓이 좌석에 안 붙어 있다
    await sleep(300);

    expect(h.pc.of('CONTROLLER_UNSUPPORTED')).toHaveLength(0);
    expect(h.pc.disconnects(1)).toHaveLength(0);
    expect(phone.ws.readyState).toBe(phone.ws.OPEN);
    stranger.close();
  });

  it('좌석의 기기와 deviceId가 다르면 무시하고 보낸 소켓만 닫는다', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(unsupported(h, 'someone-else'));
    await sleep(300);
    expect(h.pc.of('CONTROLLER_UNSUPPORTED')).toHaveLength(0);
  });

  it('정의되지 않은 이유는 NO_GYRO로 보정해 PC에 전한다', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(unsupported(h, 'phone-A', 'WHATEVER'));
    await h.pc.waitFor(() => h!.pc.of('CONTROLLER_UNSUPPORTED').length > 0);
    expect(h.pc.of('CONTROLLER_UNSUPPORTED')[0].reason).toBe('NO_GYRO');
  });

  it('NO_EVENTS 이유는 그대로 전한다', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(unsupported(h, 'phone-A', 'NO_EVENTS'));
    await h.pc.waitFor(() => h!.pc.of('CONTROLLER_UNSUPPORTED').length > 0);
    expect(h.pc.of('CONTROLLER_UNSUPPORTED')[0].reason).toBe('NO_EVENTS');
  });

  it('roomId나 deviceId가 비어 있으면 INVALID_REQUEST', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(JSON.stringify({ type: 'DEVICE_UNSUPPORTED', roomId: h.roomId, deviceId: '', reason: 'NO_GYRO' }));
    await phone.waitFor(() => phone.of('ERROR', (m) => m.code === 'INVALID_REQUEST').length > 0);
    expect(h.pc.of('CONTROLLER_UNSUPPORTED')).toHaveLength(0);
  });
});
