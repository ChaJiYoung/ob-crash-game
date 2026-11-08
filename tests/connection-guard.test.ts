import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  ConnectionGuard,
  resolveClientIp,
  isOriginAllowed,
  readConnectionGuardEnv,
} from '../server/ConnectionGuard';

describe('ConnectionGuard unit tests', () => {
  it('tryAcquire enforces per-ip limit and total limit', () => {
    const guard = new ConnectionGuard({ maxPerIp: 2, maxTotal: 3 });

    // IP 1: first 2 succeed, 3rd fails
    expect(guard.tryAcquire('1.1.1.1')).toBe(true);
    expect(guard.tryAcquire('1.1.1.1')).toBe(true);
    expect(guard.tryAcquire('1.1.1.1')).toBe(false);

    // IP 2: 1st succeeds, but reaches total 3
    expect(guard.tryAcquire('2.2.2.2')).toBe(true);
    expect(guard.total).toBe(3);

    // Now total is 3: IP 2 second try or IP 3 first try fails
    expect(guard.tryAcquire('2.2.2.2')).toBe(false);
    expect(guard.tryAcquire('3.3.3.3')).toBe(false);
  });

  it('release decreases counts and allows re-acquiring', () => {
    const guard = new ConnectionGuard({ maxPerIp: 2, maxTotal: 3 });
    guard.tryAcquire('1.1.1.1');
    guard.tryAcquire('1.1.1.1');
    expect(guard.tryAcquire('1.1.1.1')).toBe(false);

    guard.release('1.1.1.1');
    expect(guard.countFor('1.1.1.1')).toBe(1);
    expect(guard.total).toBe(1);
    expect(guard.tryAcquire('1.1.1.1')).toBe(true);

    // Releasing nonexistent or double release does not make total negative
    guard.release('9.9.9.9');
    expect(guard.total).toBe(2);
    guard.release('1.1.1.1');
    guard.release('1.1.1.1');
    guard.release('1.1.1.1'); // extra release
    expect(guard.countFor('1.1.1.1')).toBe(0);
    expect(guard.total).toBe(0);
  });

  it('resolveClientIp handles direct and proxied connections', () => {
    const mockReq = (headers: Record<string, string | string[] | undefined>, remoteAddress = '127.0.0.1') =>
      ({
        headers,
        socket: { remoteAddress },
      } as unknown as IncomingMessage);

    // trustProxy = false: always uses remoteAddress
    expect(resolveClientIp(mockReq({ 'x-forwarded-for': '1.2.3.4' }, '10.0.0.1'), false)).toBe('10.0.0.1');

    // trustProxy = true: uses first XFF IP
    expect(resolveClientIp(mockReq({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, '10.0.0.1'), true)).toBe('1.2.3.4');
    expect(resolveClientIp(mockReq({ 'x-forwarded-for': ['2.3.4.5', '10.0.0.1'] }, '10.0.0.1'), true)).toBe('2.3.4.5');

    // trustProxy = true but XFF is missing
    expect(resolveClientIp(mockReq({}, '192.168.1.10'), true)).toBe('192.168.1.10');

    // Strips ::ffff: prefix
    expect(resolveClientIp(mockReq({}, '::ffff:192.168.1.10'), false)).toBe('192.168.1.10');
  });

  it('isOriginAllowed validates allowed origin', () => {
    // If allowedOrigin is not set: allows any origin (dev mode)
    expect(isOriginAllowed(undefined, undefined)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', undefined)).toBe(true);
    expect(isOriginAllowed('https://evil.com', '')).toBe(true);

    // If allowedOrigin is set
    const allowed = 'https://game.example.com';
    expect(isOriginAllowed('https://game.example.com', allowed)).toBe(true);
    expect(isOriginAllowed('https://game.example.com/', allowed)).toBe(true);
    expect(isOriginAllowed('HTTPS://GAME.EXAMPLE.COM', allowed)).toBe(true);
    expect(isOriginAllowed('https://evil.com', allowed)).toBe(false);
    expect(isOriginAllowed(undefined, allowed)).toBe(false);
    expect(isOriginAllowed('', allowed)).toBe(false);
  });

  it('readConnectionGuardEnv parses environment variables safely', () => {
    expect(readConnectionGuardEnv({})).toEqual({
      maxPerIp: undefined,
      maxTotal: undefined,
      allowedOrigin: undefined,
      trustProxy: false,
    });

    const parsed = readConnectionGuardEnv({
      WS_MAX_CONN_PER_IP: '40',
      WS_MAX_CONN_TOTAL: '150',
      ALLOWED_ORIGIN: ' https://ob-crash.duckdns.org/ ',
      TRUST_PROXY: '1',
    });

    expect(parsed.maxPerIp).toBe(40);
    expect(parsed.maxTotal).toBe(150);
    expect(parsed.allowedOrigin).toBe('https://ob-crash.duckdns.org/');
    expect(parsed.trustProxy).toBe(true);

    // Invalid numbers or 0/negative numbers
    const invalid = readConnectionGuardEnv({
      WS_MAX_CONN_PER_IP: 'abc',
      WS_MAX_CONN_TOTAL: '-5',
      ALLOWED_ORIGIN: '   ',
      TRUST_PROXY: 'true',
    });
    expect(invalid.maxPerIp).toBeUndefined();
    expect(invalid.maxTotal).toBeUndefined();
    expect(invalid.allowedOrigin).toBeUndefined();
    expect(invalid.trustProxy).toBe(true);
  });
});
