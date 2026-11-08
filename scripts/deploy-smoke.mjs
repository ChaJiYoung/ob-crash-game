#!/usr/bin/env node
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { WebSocket } from 'ws';

const targetUrl = process.argv[2] || 'https://localhost';
const parsedUrl = new URL(targetUrl);
const isHttps = parsedUrl.protocol === 'https:';
const isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
const rejectUnauthorized = !isLocal;
const baseOrigin = parsedUrl.origin;
const wsBaseUrl = targetUrl.replace(/^http/, 'ws');

console.log(`[SmokeTest] Target: ${targetUrl} (rejectUnauthorized: ${rejectUnauthorized})`);

function request(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(path, targetUrl);
    const client = isHttps ? https : http;
    const req = client.get(
      fullUrl,
      {
        rejectUnauthorized,
        headers: {
          'User-Agent': 'DeploySmoke/1.0',
          ...headers,
        },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${path}`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

const results = [];

async function runCheck(name, fn) {
  process.stdout.write(`• Checking: ${name}... `);
  try {
    const detail = await fn();
    console.log(`✅ OK (${detail || 'pass'})`);
    results.push({ name, ok: true, detail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`❌ FAILED: ${msg}`);
    results.push({ name, ok: false, detail: msg });
  }
}

async function main() {
  // 1. GET /health
  await runCheck('GET /health (HTTP 200, status: ok)', async () => {
    const res = await request('/health');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got ${data.status}`);
    return `status=${data.status}`;
  });

  // 2. GET /controller (SPA Fallback)
  await runCheck('GET /controller (SPA Fallback, <div id="root")', async () => {
    const res = await request('/controller');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.includes('<div id="root"')) throw new Error('Root div not found in response body');
    return 'root div found';
  });

  // 3. GET / (Header: X-Robots-Tag: noindex)
  await runCheck('GET / (Header: X-Robots-Tag contains noindex)', async () => {
    const res = await request('/');
    const header = res.headers['x-robots-tag'];
    if (!header || !header.toLowerCase().includes('noindex')) {
      throw new Error(`Expected x-robots-tag header with noindex, got "${header}"`);
    }
    return `x-robots-tag: ${header}`;
  });

  // 4. GET /robots.txt
  await runCheck('GET /robots.txt (Contains Disallow: /)', async () => {
    const res = await request('/robots.txt');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.includes('Disallow: /')) {
      throw new Error(`Expected "Disallow: /" in robots.txt, got: ${res.body.slice(0, 50)}`);
    }
    return 'Disallow: / confirmed';
  });

  // 5. WSS normal origin -> CREATE_ROOM -> ROOM_CREATED
  await runCheck('WSS normal origin (CREATE_ROOM -> ROOM_CREATED)', () => {
    return new Promise((resolve, reject) => {
      const wsUrl = `${wsBaseUrl}/ws`;
      const ws = new WebSocket(wsUrl, {
        rejectUnauthorized,
        headers: { Origin: baseOrigin },
        timeout: 5000,
      });

      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for ROOM_CREATED'));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'CREATE_ROOM' }));
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'ROOM_CREATED' && msg.roomId) {
            clearTimeout(timer);
            ws.close();
            resolve(`Room created: ${msg.roomId}`);
          }
        } catch (e) {
          clearTimeout(timer);
          ws.close();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  });

  // 6. WSS mismatched origin -> Handshake rejected (401 or error)
  await runCheck('WSS mismatched origin (Origin: https://evil.example -> rejected 401)', () => {
    return new Promise((resolve, reject) => {
      const wsUrl = `${wsBaseUrl}/ws`;
      const ws = new WebSocket(wsUrl, {
        rejectUnauthorized,
        headers: { Origin: 'https://evil.example' },
        timeout: 5000,
      });

      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Failed: connection opened or did not reject in time'));
      }, 5000);

      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer);
        if (res.statusCode === 401) {
          resolve('Rejected with HTTP 401');
        } else {
          resolve(`Rejected with HTTP ${res.statusCode}`);
        }
      });

      ws.on('open', () => {
        clearTimeout(timer);
        ws.close();
        reject(new Error('Security violation: Connection opened for evil origin!'));
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        resolve(`Rejected with error (${err.message})`);
      });
    });
  });

  console.log('\n================ Smoke Test Summary ================');
  console.table(results);

  const allPassed = results.every((r) => r.ok);
  if (!allPassed) {
    console.error('❌ Some checks failed.');
    process.exit(1);
  } else {
    console.log('🎉 All smoke tests passed successfully!');
  }
}

main().catch((err) => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
