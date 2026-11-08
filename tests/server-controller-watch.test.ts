import { describe, it, expect, afterEach } from 'vitest';
import { startHarness, sleep, sensorFrame, Harness } from './helpers/wsHarness';

describe('server frame-loss detection', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('tells the PC once when frames stop; frames alone never bring it back, the zero signal does', async () => {
    h = await startHarness({ controllerFrameTimeoutMs: 300, watchIntervalMs: 50 });
    const phone = await h.phone('phone-A', 1);

    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length > 0);
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);

    const pairedBefore = h.pc.of('CONTROLLER_PAIRED').length;
    for (let i = 0; i < 6; i++) {
      phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
      await sleep(100);
    }
    expect(h.pc.disconnects(1)).toHaveLength(1);
    expect(h.pc.of('ZERO_CALIBRATED')).toHaveLength(0);
    expect(h.pc.of('CONTROLLER_PAIRED')).toHaveLength(pairedBefore);

    // the return button sends a plain zero
    phone.ws.send(JSON.stringify({ type: 'CALIBRATE_ZERO', roomId: h.roomId, deviceId: 'phone-A', slot: 1 }));
    await h.pc.waitFor(() => h!.pc.of('ZERO_CALIBRATED').length > 0);
    expect(h.pc.of('ZERO_CALIBRATED')[0].resume).toBeUndefined();

    // watched again from now on
    await h.pc.waitFor(() => h!.pc.disconnects(1).length === 2, 2000);
  });

  it('does not report a controller that keeps sending frames', async () => {
    h = await startHarness({ controllerFrameTimeoutMs: 300, watchIntervalMs: 50 });
    const phone = await h.phone('phone-A', 1);
    for (let i = 0; i < 12; i++) {
      phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
      await sleep(50);
    }
    expect(h.pc.disconnects(1)).toHaveLength(0);
  });

  it('does not add a frame-loss alert for a controller whose socket closed', async () => {
    h = await startHarness({ controllerFrameTimeoutMs: 300, watchIntervalMs: 50 });
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length > 0);

    phone.ws.close();
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);
    await sleep(600);
    expect(h.pc.disconnects(1)).toHaveLength(1);
  });

  it('does not repeat the alert when the socket of an already reported controller closes', async () => {
    h = await startHarness({ controllerFrameTimeoutMs: 300, watchIntervalMs: 50 });
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);

    phone.ws.close();
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(1);
  });

  it('watches the two slots independently', async () => {
    h = await startHarness({ controllerFrameTimeoutMs: 300, watchIntervalMs: 50 });
    const a = await h.phone('phone-A', 1);
    const b = await h.phone('phone-B', 2);
    a.ws.send(sensorFrame(h.roomId, 'phone-A'));
    b.ws.send(sensorFrame(h.roomId, 'phone-B'));
    for (let i = 0; i < 12; i++) {
      b.ws.send(sensorFrame(h.roomId, 'phone-B'));
      await sleep(50);
    }
    expect(h.pc.disconnects(1)).toHaveLength(1);
    expect(h.pc.disconnects(2)).toHaveLength(0);
  });
});
