import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const script = (name: string) => path.join(ROOT, 'scripts/azure', name);

/** 스크립트를 실행한다. az·네트워크를 호출하면 실패하도록 PATH 에서 az/ssh 를 뺀다. */
function bash(args: string[], env: Record<string, string> = {}) {
  const safePath = ['/usr/bin', '/bin'].join(':'); // az, gh, docker 는 /usr/local 등에 있다
  return spawnSync('bash', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: safePath, HOME: process.env.HOME ?? '/tmp', ...env },
  });
}

describe('provision.sh --dry-run', () => {
  const r = bash([script('provision.sh'), '--dry-run']);
  const out = r.stdout;

  it('az 없이도 성공하고 완전한 명령 계획을 출력한다', () => {
    expect(r.status, r.stderr).toBe(0);
    expect(out).toContain('az vm create');
    expect(out).toContain('--public-ip-sku Standard');
    expect(out).toContain('--public-ip-address-allocation static');
    expect(out).toContain('--public-ip-address-dns-name <DNS_LABEL>');
    expect(out).toContain('--nsg-rule NONE');
    expect(out).toContain('--tags project=ob-crash-game');
    expect(out).toContain('--custom-data');
    expect(out).toContain('--size Standard_B2ats_v2');
    expect(out).toContain('--storage-sku StandardSSD_LRS');
    expect(out).toContain('az vm auto-shutdown');
    expect(out).toContain('--time 1500');
  });

  it('NSG 규칙 4개를 만들고 22번만 내 IP/32 로 제한한다', () => {
    for (const name of ['allow-https', 'allow-quic', 'allow-http', 'allow-ssh']) {
      expect(out).toContain(`-n ${name} `);
    }
    const ssh = out.split('\n').find((l) => l.includes('-n allow-ssh'))!;
    expect(ssh).toContain('--destination-port-ranges 22');
    expect(ssh).toContain('--source-address-prefixes <MY_IP>/32');
    expect(ssh).not.toMatch(/--source-address-prefixes \*/);
    // 22번이 전체 개방으로 만들어질 경로가 없다
    const other = out.split('\n').filter((l) => l.includes('nsg rule create') && !l.includes('allow-ssh'));
    for (const l of other) expect(l).not.toContain('--destination-port-ranges 22');
  });

  it('dry-run 은 성공/완료 문구를 내지 않는다', () => {
    expect(r.stderr).toContain('아무것도 만들지 않았습니다');
    expect(r.stderr).not.toContain('완료. 주소');
  });
});

describe('vm.sh', () => {
  it('stop 은 deallocate 만 쓰고 az vm stop 은 쓰지 않는다', () => {
    const r = bash([script('vm.sh'), 'stop', '--dry-run']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('az vm deallocate');
    expect(r.stdout).not.toMatch(/az vm stop/);
    const src = fs.readFileSync(script('vm.sh'), 'utf8');
    expect(src).not.toMatch(/^\s*run\s+"\$\{AZ\}"\s+vm\s+stop/m);
  });

  it('start 는 az vm start 를 계획한다', () => {
    const r = bash([script('vm.sh'), 'start', '--dry-run']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('az vm start');
  });

  it('인자가 없거나 알 수 없으면 64 로 종료한다', () => {
    expect(bash([script('vm.sh')]).status).toBe(64);
    expect(bash([script('vm.sh'), 'bogus']).status).toBe(64);
  });
});

describe('nsg-myip.sh --dry-run', () => {
  it('allow-ssh 규칙만 갱신한다', () => {
    const r = bash([script('nsg-myip.sh'), '--dry-run']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('az network nsg rule update');
    expect(r.stdout).toContain('-n allow-ssh');
    expect(r.stdout).toContain('<MY_IP>/32');
  });
});

describe('cloud-init.yml', () => {
  const y = fs.readFileSync(script('cloud-init.yml'), 'utf8');
  it('Docker·스왑·작업 디렉터리를 준비한다', () => {
    expect(y.startsWith('#cloud-config')).toBe(true);
    expect(y).toContain('docker.io');
    expect(y).toContain('docker-compose-v2');
    expect(y).toContain('fallocate -l 2G');
    expect(y).toMatch(/systemctl,\s*enable,\s*--now,\s*docker/);
    expect(y).toContain('/opt/ob-crash/data');
  });
  it('관리자 사용자 이름이 config.sh 와 같다', () => {
    const cfg = fs.readFileSync(script('config.sh'), 'utf8');
    const user = /AZ_ADMIN_USER="([^"]+)"/.exec(cfg)![1];
    expect(y).toContain(`usermod, -aG, docker, ${user}`);
    expect(y).toContain(`chown -R ${user}:${user} /opt/ob-crash`);
  });
});

describe('config.sh (azure)', () => {
  it('FQDN·자동 종료 시각·태그 규칙', () => {
    const r = bash(['-c', `. "${script('config.sh')}"; echo "$AZ_FQDN|$AZ_AUTOSHUTDOWN_UTC|$AZ_TAG|$AZ_VM_NAME|$AZ_PIP_NAME|$AZ_NSG_NAME"`]);
    expect(r.status, r.stderr).toBe(0);
    const [fqdn, shut, tag, vm, pip, nsg] = r.stdout.trim().split('|');
    expect(fqdn).toBe('<DNS_LABEL>.koreacentral.cloudapp.azure.com');
    expect(shut).toBe('1500');
    expect(tag).toBe('project=ob-crash-game');
    for (const n of [vm, pip, nsg]) expect(n.startsWith('ob-crash-')).toBe(true);
  });
});
