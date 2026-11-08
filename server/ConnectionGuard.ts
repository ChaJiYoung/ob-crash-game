import type { IncomingMessage } from 'node:http';

export const CONNECTION_GUARD_DEFAULTS = {
  maxPerIp: 60,
  maxTotal: 300,
  maxPayloadBytes: 64 * 1024,
} as const;

export interface ConnectionGuardOptions {
  /** IP 하나가 동시에 가질 수 있는 소켓 수. */
  maxPerIp: number;
  /** 서버 전체 동시 소켓 수. */
  maxTotal: number;
}

/** compose/env에서 받은 서버 보안 설정. 없는 값은 undefined (createBeerCrusherServer가 기본값 적용). */
export interface ConnectionGuardEnv {
  maxPerIp?: number;
  maxTotal?: number;
  allowedOrigin?: string;
  trustProxy: boolean;
}

/** 요청을 보낸 실제 클라이언트 IP. trustProxy면 X-Forwarded-For의 첫 값, 아니면 소켓 주소. */
export function resolveClientIp(req: IncomingMessage, trustProxy: boolean): string {
  let ip: string | undefined;

  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim().length > 0) {
      ip = xff.split(',')[0].trim();
    } else if (Array.isArray(xff) && xff.length > 0 && typeof xff[0] === 'string' && xff[0].trim().length > 0) {
      ip = xff[0].split(',')[0].trim();
    }
  }

  if (!ip) {
    ip = req.socket?.remoteAddress ?? 'unknown';
  }

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return ip;
}

/** allowedOrigin이 비어 있으면 항상 true. 있으면 origin과 정확히 일치(끝 '/' 제거, 소문자 비교)할 때만 true. */
export function isOriginAllowed(origin: string | undefined, allowedOrigin: string | undefined): boolean {
  if (!allowedOrigin || allowedOrigin.trim().length === 0) {
    return true;
  }
  if (!origin || origin.trim().length === 0) {
    return false;
  }

  const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
  return normalize(origin) === normalize(allowedOrigin);
}

/** process.env 형태에서 설정을 읽는다. 숫자가 아니거나 1 미만이면 undefined. */
export function readConnectionGuardEnv(env: Record<string, string | undefined>): ConnectionGuardEnv {
  const parsePositiveInt = (v: string | undefined) => {
    if (!v) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  };

  const allowedOriginRaw = env.ALLOWED_ORIGIN?.trim();
  const allowedOrigin = allowedOriginRaw && allowedOriginRaw.length > 0 ? allowedOriginRaw : undefined;

  const trustProxyRaw = env.TRUST_PROXY?.trim().toLowerCase();
  const trustProxy = trustProxyRaw === '1' || trustProxyRaw === 'true';

  return {
    maxPerIp: parsePositiveInt(env.WS_MAX_CONN_PER_IP),
    maxTotal: parsePositiveInt(env.WS_MAX_CONN_TOTAL),
    allowedOrigin,
    trustProxy,
  };
}

export class ConnectionGuard {
  private perIp = new Map<string, number>();
  private totalCount = 0;
  private readonly maxPerIp: number;
  private readonly maxTotal: number;

  constructor(options: ConnectionGuardOptions) {
    this.maxPerIp = options.maxPerIp;
    this.maxTotal = options.maxTotal;
  }

  /** 자리가 있으면 카운트를 올리고 true. 없으면 아무것도 바꾸지 않고 false. */
  tryAcquire(ip: string): boolean {
    if (this.totalCount >= this.maxTotal) {
      return false;
    }
    const current = this.perIp.get(ip) ?? 0;
    if (current >= this.maxPerIp) {
      return false;
    }
    this.perIp.set(ip, current + 1);
    this.totalCount++;
    return true;
  }

  /** tryAcquire가 true였던 소켓이 닫힐 때 정확히 한 번 호출. 0이 되면 Map에서 키 삭제. */
  release(ip: string): void {
    const current = this.perIp.get(ip) ?? 0;
    if (current <= 0) {
      return;
    }
    if (current === 1) {
      this.perIp.delete(ip);
    } else {
      this.perIp.set(ip, current - 1);
    }
    this.totalCount = Math.max(0, this.totalCount - 1);
  }

  get total(): number {
    return this.totalCount;
  }

  countFor(ip: string): number {
    return this.perIp.get(ip) ?? 0;
  }
}
