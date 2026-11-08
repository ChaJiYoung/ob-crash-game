import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket, type ClientOptions } from 'ws';
import { createBeerCrusherServer, BeerCrusherServerInstance } from '../server/wsServer';
import { sleep, Inbox } from './helpers/wsHarness';

describe('Server connection limits and guard integration', () => {
  let server: BeerCrusherServerInstance | undefined;
  const activeSockets: WebSocket[] = [];

  const trackWs = (ws: WebSocket) => {
    activeSockets.push(ws);
    return ws;
  };

  const openSocket = (url: string, options?: ClientOptions) =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = trackWs(new WebSocket(url, options));
      ws.on('open', () => resolve(ws));
      ws.on('error', (err) => reject(err));
    });

  afterEach(async () => {
    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    activeSockets.length = 0;
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it('enforces per-ip socket limit and sends SERVER_FULL before close(1013)', async () => {
    server = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
      maxConnPerIp: 2,
    });
    const url = `ws://localhost:${server.port}`;

    // Connect 2 sockets
    const s1 = await openSocket(url);
    const s2 = await openSocket(url);
    expect(s1.readyState).toBe(WebSocket.OPEN);
    expect(s2.readyState).toBe(WebSocket.OPEN);

    // 3rd socket connects: server should accept, send SERVER_FULL, and close with 1013
    const s3 = trackWs(new WebSocket(url));
    const inbox3 = new Inbox(s3);

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      s3.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
    });

    await inbox3.waitFor(() => inbox3.of('ERROR', (m) => m.code === 'SERVER_FULL').length > 0);
    const { code } = await closePromise;
    expect(code).toBe(1013);

    // Close s1 and wait a moment
    s1.close();
    await sleep(50);

    // Now a new socket can connect and create a room
    const s4 = await openSocket(url);
    const inbox4 = new Inbox(s4);
    s4.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    await inbox4.waitFor(() => inbox4.of('ROOM_CREATED').length > 0);
  });

  it('enforces total socket limit across different ips when trustProxy is enabled', async () => {
    server = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
      maxConnPerIp: 10,
      maxConnTotal: 2,
      trustProxy: true,
    });
    const url = `ws://localhost:${server.port}`;

    await openSocket(url, { headers: { 'X-Forwarded-For': '10.0.0.1' } });
    await openSocket(url, { headers: { 'X-Forwarded-For': '10.0.0.2' } });

    // 3rd connection exceeds total limit of 2
    const s3 = trackWs(new WebSocket(url, { headers: { 'X-Forwarded-For': '10.0.0.3' } }));
    const inbox3 = new Inbox(s3);
    const closePromise = new Promise<number>((resolve) => {
      s3.on('close', (code) => resolve(code));
    });

    await inbox3.waitFor(() => inbox3.of('ERROR', (m) => m.code === 'SERVER_FULL').length > 0);
    const code = await closePromise;
    expect(code).toBe(1013);
  });

  it('verifies that rejected socket cannot interact or affect room manager', async () => {
    server = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
      maxConnPerIp: 1,
    });
    const url = `ws://localhost:${server.port}`;

    const s1 = await openSocket(url);
    const inbox1 = new Inbox(s1);
    s1.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    await inbox1.waitFor(() => inbox1.of('ROOM_CREATED').length > 0);

    // 2nd socket will be rejected
    const s2 = trackWs(new WebSocket(url));
    const inbox2 = new Inbox(s2);

    // Try sending CREATE_ROOM right away
    s2.on('open', () => {
      s2.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    });

    await inbox2.waitFor(() => inbox2.of('ERROR', (m) => m.code === 'SERVER_FULL').length > 0);
    await sleep(50);

    // No ROOM_CREATED should have been sent to s2
    expect(inbox2.of('ROOM_CREATED').length).toBe(0);
  });

  it('rejects handshake with 401 on mismatched Origin and allows matching Origin', async () => {
    server = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
      allowedOrigin: 'https://game.example.com',
    });
    const url = `ws://localhost:${server.port}`;

    // Mismatched origin should fail during handshake
    const rejectedHandshake = new Promise<boolean>((resolve) => {
      const evilWs = trackWs(
        new WebSocket(url, {
          headers: { Origin: 'https://evil.example.com' },
        })
      );
      evilWs.on('unexpected-response', (_req, res) => {
        expect(res.statusCode).toBe(401);
        resolve(true);
      });
      evilWs.on('error', () => {
        resolve(true);
      });
      evilWs.on('open', () => {
        resolve(false);
      });
    });

    expect(await rejectedHandshake).toBe(true);

    // Matching origin should succeed
    const validWs = await openSocket(url, {
      headers: { Origin: 'https://game.example.com' },
    });
    const inbox = new Inbox(validWs);
    validWs.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    await inbox.waitFor(() => inbox.of('ROOM_CREATED').length > 0);
  });

  it('closes socket with 1009 when message exceeds maxPayload', async () => {
    server = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
    });
    const url = `ws://localhost:${server.port}`;

    const ws = await openSocket(url);
    ws.on('error', () => {}); // ignore client-side drop error
    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });

    // Send 70KB string (limit is 64KB)
    const largePayload = 'a'.repeat(70 * 1024);
    ws.send(largePayload);

    const closeCode = await closePromise;
    expect(closeCode).toBe(1009);
  });

  it('isolates IP limits by X-Forwarded-For when trustProxy is enabled', async () => {
    server = await createBeerCrusherServer({
      port: 0,
      dbPath: ':memory:',
      trustProxy: true,
      maxConnPerIp: 1,
    });
    const url = `ws://localhost:${server.port}`;

    // IP A connects
    await openSocket(url, { headers: { 'X-Forwarded-For': '203.0.113.1' } });

    // IP B connects with no issue even though physical socket is same remoteAddress
    const wsB = await openSocket(url, { headers: { 'X-Forwarded-For': '203.0.113.2' } });
    expect(wsB.readyState).toBe(WebSocket.OPEN);

    // Another IP A connects -> rejected
    const wsA2 = trackWs(new WebSocket(url, { headers: { 'X-Forwarded-For': '203.0.113.1' } }));
    const inboxA2 = new Inbox(wsA2);
    await inboxA2.waitFor(() => inboxA2.of('ERROR', (m) => m.code === 'SERVER_FULL').length > 0);
  });
});
