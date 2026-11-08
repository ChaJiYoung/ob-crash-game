import { describe, it, expect, afterEach } from 'vitest';
import { startHarness, open, Inbox, sleep, sensorFrame, Harness } from './helpers/wsHarness';

const bg = (h: Harness, deviceId: string, type = 'CONTROLLER_BACKGROUND') =>
  JSON.stringify({ type, roomId: h.roomId, deviceId, slot: 1 });

describe('server background signal', () => {
  let h: Harness | undefined;

  afterEach(async () => {
    await h?.cleanup();
    h = undefined;
  });

  // frame loss detection is far out of the way so only the background signal can fire
  const start = () => startHarness({ backgroundNotifyDelayMs: 200, controllerFrameTimeoutMs: 60_000, watchIntervalMs: 50 });

  it('tells the PC once after the delay and keeps the controller socket', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(sensorFrame(h.roomId, 'phone-A')); // a playing phone streams frames
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length > 0);

    phone.ws.send(bg(h, 'phone-A'));
    expect(h.pc.disconnects(1)).toHaveLength(0); // not immediately
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);
    await sleep(400);
    expect(h.pc.disconnects(1)).toHaveLength(1);

    // the socket is still attached: frames still reach the PC
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length > 0);
    expect(h.pc.of('SENSOR_RELAY')[0].slot).toBe(1);
  });

  it('ignores a short screen-off that is followed by the foreground signal', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);

    phone.ws.send(bg(h, 'phone-A'));
    await sleep(50);
    phone.ws.send(bg(h, 'phone-A', 'CONTROLLER_FOREGROUND'));
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(0);
  });

  it('does not treat frames from a still-hidden phone as a comeback', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    phone.ws.send(bg(h, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);

    phone.ws.send(sensorFrame(h.roomId, 'phone-A')); // a throttled background tab still sends now and then
    await sleep(200);
    expect(h.pc.of('ZERO_CALIBRATED')).toHaveLength(0);

    // once the screen is back, frames restore the controller
    phone.ws.send(bg(h, 'phone-A', 'CONTROLLER_FOREGROUND'));
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('ZERO_CALIBRATED').length > 0);
    expect(h.pc.of('ZERO_CALIBRATED')[0].resume).toBe(true);
  });

  it('does not report a phone that never sent a frame, nor treat its first frame as a comeback', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1); // paired in the lobby, sensors not started
    phone.ws.send(bg(h, 'phone-A'));
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(0);

    phone.ws.send(bg(h, 'phone-A', 'CONTROLLER_FOREGROUND'));
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length > 0);
    await sleep(100);
    expect(h.pc.of('ZERO_CALIBRATED')).toHaveLength(0);
    expect(h.pc.of('CONTROLLER_PAIRED')).toHaveLength(1); // only the initial pairing
  });

  it('does not repeat the alert for a slot that was already reported when its socket finally closes', async () => {
    h = await start();
    const a = await h.phone('phone-A', 1);
    const b = await h.phone('phone-B', 2);
    for (const [ws, id] of [[a.ws, 'phone-A'], [b.ws, 'phone-B']] as const) ws.send(sensorFrame(h.roomId, id));
    await h.pc.waitFor(() => h!.pc.of('SENSOR_RELAY').length >= 2);

    a.ws.send(bg(h, 'phone-A'));
    b.ws.send(JSON.stringify({ type: 'CONTROLLER_BACKGROUND', roomId: h.roomId, deviceId: 'phone-B', slot: 2 }));
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0 && h!.pc.disconnects(2).length > 0, 2000);

    b.ws.close(); // 2P's dead socket is finally torn down
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(1);
    expect(h.pc.disconnects(2)).toHaveLength(1);
  });

  it('restores the controller once when the phone comes back with the reconnect handshake', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    phone.ws.send(bg(h, 'phone-A'));
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000);

    phone.ws.send(bg(h, 'phone-A', 'CONTROLLER_FOREGROUND'));
    phone.ws.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId: h.roomId, deviceId: 'phone-A', slot: 1 }));
    await h.pc.waitFor(() => h!.pc.of('CONTROLLER_PAIRED').length >= 2);

    phone.ws.send(sensorFrame(h.roomId, 'phone-A'));
    await sleep(200);
    // the handshake is the one comeback path: the next frame must not announce it a second time
    expect(h.pc.of('CONTROLLER_PAIRED')).toHaveLength(2);
    expect(h.pc.of('ZERO_CALIBRATED')).toHaveLength(0);
  });

  it('ignores signals from sockets that are not the controller of that slot', async () => {
    h = await start();
    await h.phone('phone-A', 1);

    const stranger = new Inbox(await open(`ws://localhost:${h.server.port}`));
    stranger.ws.send(bg(h, 'phone-A')); // not attached to the room at all
    const another = new Inbox(await open(`ws://localhost:${h.server.port}`));
    another.ws.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId: h.roomId, deviceId: 'phone-B', slot: 2 }));
    await sleep(100);
    another.ws.send(bg(h, 'phone-A')); // attached, but as another device and slot
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(0);
    stranger.ws.close();
    another.ws.close();
  });

  it('does not alert for a controller whose socket closed during the delay', async () => {
    h = await start();
    const phone = await h.phone('phone-A', 1);
    phone.ws.send(bg(h, 'phone-A'));
    phone.ws.close();
    await h.pc.waitFor(() => h!.pc.disconnects(1).length > 0, 2000); // from the normal close path
    await sleep(500);
    expect(h.pc.disconnects(1)).toHaveLength(1);
  });
});
