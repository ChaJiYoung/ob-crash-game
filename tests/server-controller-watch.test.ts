import { describe, it, expect, afterEach } from 'vitest';
import { startHarness, sleep, sensorFrame, Harness } from './helpers/wsHarness';

describe('server frame-loss detection', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  it('tells the PC once when frames stop, and again restores the controller when they resume', async () => {
    h = await startHarness({ controllerFrameTimeoutMs: 300, watchIntervalMs: 50 });
    const phone = await h.phone('phone-A', 1);

    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length > 0);

    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(1);

    const pairedBefore = h.pc.of('CONTROLLER_PAIRED').length;
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('ZERO_CALIBRATED').length > 0);
    expect(h.pc.of('CONTROLLER_PAIRED').length).toBe(pairedBefore + 1);
    const zero = h.pc.of('ZERO_CALIBRATED')[0];
    expect(zero.slot).toBe(1);
    expect(zero.resume).toBe(true);
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
