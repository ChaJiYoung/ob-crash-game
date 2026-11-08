import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createBeerCrusherServer } from '../server/wsServer';
import { open, Inbox } from './helpers/wsHarness';

describe('PC socket reconnect (source guard)', () => {
  const source = fs.readFileSync('src/pc/PCGamePage.tsx', 'utf8');

  it('retries with backoff when the socket closes and recreates the saved room', () => {
    expect(source).toContain('socket.onclose');
    expect(source).toContain('getReconnectDelayMs(attempt)');
    expect(source).toMatch(/socket\.onopen = \(\) => \{[\s\S]{0,200}CREATE_ROOM', roomId: loadSavedRoomId\(\)/);
  });

  it('ignores events from replaced sockets and stops retrying on unmount', () => {
    expect(source).toMatch(/if \(disposed \|\| wsRef\.current !== socket\) return;/);
    expect(source).toMatch(/disposed = true;[\s\S]{0,80}clearTimeout\(retryTimer\)/);
  });
});

describe('a restarted server gets the same room back from the PC', () => {
  it('lets a phone rejoin once the PC recreates the room with its saved code', async () => {
    const storePath = path.join(process.cwd(), 'data', `test-pc-reconnect-${Date.now()}.json`);
    let server = await createBeerCrusherServer({ port: 0, storePath });
    const port = server.port;
    const pc1 = new Inbox(await open(`ws://localhost:${port}`));
    pc1.ws.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    await pc1.waitFor(() => pc1.of('ROOM_CREATED').length > 0);
    const roomId = pc1.of('ROOM_CREATED')[0].roomId;
    pc1.ws.close();
    await server.close();

    // restart on the same port (what tsx watch does) and reconnect like the PC does: CREATE_ROOM with the saved code
    server = await createBeerCrusherServer({ port, storePath });
    const pc2 = new Inbox(await open(`ws://localhost:${port}`));
    pc2.ws.send(JSON.stringify({ type: 'CREATE_ROOM', roomId }));
    await pc2.waitFor(() => pc2.of('ROOM_CREATED').length > 0);
    expect(pc2.of('ROOM_CREATED')[0].roomId).toBe(roomId);

    server.playerStore.registerOrUpdateNickname('phone-A', 'PlayerA');
    const phone = new Inbox(await open(`ws://localhost:${port}`));
    phone.ws.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId: 'phone-A', slot: 1 }));
    await pc2.waitFor(() => pc2.of('CONTROLLER_PAIRED').length > 0);
    expect(phone.messages.some((m) => m.type === 'ERROR' && m.code === 'ROOM_NOT_FOUND')).toBe(false);

    phone.ws.close();
    pc2.ws.close();
    await server.close();
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  });
});
