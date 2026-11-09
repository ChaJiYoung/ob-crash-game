import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** `backend:` 서비스의 `environment:` 블록 키만 뽑는다 (6칸 들여쓰기 `KEY:`). */
function backendEnvKeys(compose: string): string[] {
  const lines = compose.split('\n');
  const start = lines.findIndex((l) => /^ {4}environment:/.test(l));
  expect(start).toBeGreaterThan(-1);
  const keys: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^ {6}([A-Z_]+):/.exec(lines[i]);
    if (!m) break;
    keys.push(m[1]);
  }
  return keys.sort();
}

describe('azure deploy files', () => {
  const azure = read('deploy/azure/docker-compose.yml');
  const oracle = read('deploy/oracle/docker-compose.yml');

  it('운영 compose는 build 없이 image 만 참조한다', () => {
    expect(azure).not.toMatch(/^\s+build:/m);
    expect(azure).toMatch(/image: \$\{IMAGE_PREFIX[^}]*\}\/ob-crash-backend:\$\{IMAGE_TAG[^}]*\}/);
    expect(azure).toMatch(/image: \$\{IMAGE_PREFIX[^}]*\}\/ob-crash-web:\$\{IMAGE_TAG[^}]*\}/);
  });

  it('운영 compose는 DOMAIN 이 없으면 실패하고 pull_policy 를 지정하지 않는다', () => {
    expect(azure).toContain('${DOMAIN:?DOMAIN is required}');
    expect(azure).not.toMatch(/pull_policy/);
  });

  it('오라클 compose 와 backend 환경변수 키가 같다 (어긋남 방지)', () => {
    const a = backendEnvKeys(azure);
    expect(a.length).toBeGreaterThan(3);
    expect(a).toEqual(backendEnvKeys(oracle));
  });

  it('두 compose 의 포트·재시작·볼륨 규칙이 같다', () => {
    for (const c of [azure, oracle]) {
      expect(c).toContain('restart: unless-stopped');
      expect(c).toContain('"443:443/udp"');
      expect(c).toContain(':/app/data');
      expect(c).toContain('max-size: "10m"');
    }
  });

  it('scripts/azure/*.sh 는 bash 문법 검사를 통과한다', () => {
    const dir = path.join(ROOT, 'scripts/azure');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sh'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const r = spawnSync('bash', ['-n', path.join(dir, f)], { encoding: 'utf8' });
      expect(r.status, `${f}: ${r.stderr}`).toBe(0);
    }
  });

  it('config.sh 는 소문자 GHCR 이미지 이름을 만든다', () => {
    const r = spawnSync(
      'bash',
      ['-c', `. "${path.join(ROOT, 'scripts/azure/config.sh')}"; echo "$IMAGE_BACKEND $IMAGE_WEB"`],
      { encoding: 'utf8', env: { ...process.env, IMAGE_PREFIX: '' } },
    );
    expect(r.status).toBe(0);
    const [backend, web] = r.stdout.trim().split(' ');
    expect(backend).toBe('ghcr.io/chajiyoung/ob-crash-backend');
    expect(web).toBe('ghcr.io/chajiyoung/ob-crash-web');
    expect(backend).toBe(backend.toLowerCase());
  });
});
