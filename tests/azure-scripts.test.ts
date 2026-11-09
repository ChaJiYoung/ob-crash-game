import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const script = (name: string) => path.join(ROOT, 'scripts/azure', name);

/** 테스트 전용 가짜 식별 값. 실제 구독·그룹 값은 저장소에 두지 않는다 (scripts/azure/config.local.sh 에만 있음). */
const FAKE_SUB_ID = '00000000-0000-4000-8000-000000000000';
const FAKE_ENV = {
  AZ_CONFIG_LOCAL: '/nonexistent', // 개발자 PC 의 실제 config.local.sh 를 읽지 않는다
  AZ_SUBSCRIPTION_NAME: 'Test-Subscription',
  AZ_SUBSCRIPTION_ID: FAKE_SUB_ID,
  AZ_RESOURCE_GROUP: 'test-rg',
  AZ_DNS_LABEL: 'ob-crash-test',
};
const FAKE_FQDN = 'ob-crash-test.koreacentral.cloudapp.azure.com';

/** 스크립트를 실행한다. az·네트워크를 호출하면 실패하도록 PATH 에서 az/ssh 를 뺀다. */
function bash(args: string[], env: Record<string, string> = FAKE_ENV) {
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
    expect(out).toContain('--public-ip-address-dns-name ob-crash-test');
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

  it('VNet·서브넷 이름을 지정해 기존 네트워크를 재사용하지 않는다', () => {
    expect(out).toContain('--vnet-name ob-crash-vnet');
    expect(out).toContain('--subnet ob-crash-subnet');
    expect(out).toContain('--vnet-address-prefix 10.77.0.0/24');
  });

  it('모든 az 호출이 구독 ID 로 고정된다', () => {
    const azLines = out.split('\n').filter((l) => l.startsWith('[dry-run] az '));
    expect(azLines.length).toBeGreaterThan(5);
    for (const l of azLines) expect(l, l).toContain(`--subscription ${FAKE_SUB_ID}`);
  });

  it('자동 종료를 NSG 규칙보다 먼저 건다 (중간 실패 시에도 과금이 하루 안에 끝남)', () => {
    const iCreate = out.indexOf('az vm create');
    const iShut = out.indexOf('az vm auto-shutdown');
    const iRule = out.indexOf('az network nsg rule create');
    expect(iCreate).toBeGreaterThan(-1);
    expect(iShut).toBeGreaterThan(iCreate);
    expect(iRule).toBeGreaterThan(iShut);
    expect(out).toContain('az resource tag');
  });

  it('--resume 은 VM 을 다시 만들지 않고 자동 종료·규칙만 적용한다', () => {
    const rr = bash([script('provision.sh'), '--dry-run', '--resume']);
    expect(rr.status, rr.stderr).toBe(0);
    expect(rr.stdout).not.toContain('az vm create');
    expect(rr.stdout).toContain('az vm auto-shutdown');
    expect(rr.stdout).toContain('-n allow-ssh');
  });

  it('실패 시 VM 을 중지하는 ERR 트랩이 있다', () => {
    const src = fs.readFileSync(script('provision.sh'), 'utf8');
    expect(src).toMatch(/set -Eeuo pipefail/);
    expect(src).toMatch(/trap on_fail ERR/);
    expect(src).toMatch(/vm deallocate/);
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

  it('autoshutdown off 는 --off, HH:MM(한국 시각)은 UTC 로 변환한다', () => {
    const off = bash([script('vm.sh'), 'autoshutdown', 'off', '--dry-run']);
    expect(off.status, off.stderr).toBe(0);
    expect(off.stdout).toContain('az vm auto-shutdown');
    expect(off.stdout).toContain('--off');
    const cases: Array<[string, string]> = [['23:30', '1430'], ['00:00', '1500'], ['09:00', '0000'], ['18:45', '0945']];
    for (const [kst, utc] of cases) {
      const r = bash([script('vm.sh'), 'autoshutdown', kst, '--dry-run']);
      expect(r.status, `${kst}: ${r.stderr}`).toBe(0);
      expect(r.stdout, kst).toContain(`--time ${utc}`);
    }
  });

  it('autoshutdown 에 잘못된 값을 주면 64 로 종료한다', () => {
    for (const bad of ['24:00', '9:00', 'tomorrow', '']) {
      const args = bad ? [script('vm.sh'), 'autoshutdown', bad, '--dry-run'] : [script('vm.sh'), 'autoshutdown', '--dry-run'];
      expect(bash(args).status, bad).toBe(64);
    }
  });

  it('인자가 없거나 알 수 없으면 64 로 종료한다', () => {
    expect(bash([script('vm.sh')]).status).toBe(64);
    expect(bash([script('vm.sh'), 'bogus']).status).toBe(64);
  });
});

describe('lib.sh', () => {
  it('ssh 는 비대화형(BatchMode)이다', () => {
    const lib = fs.readFileSync(script('lib.sh'), 'utf8');
    expect(lib).toContain('BatchMode=yes');
  });
});

describe('.dockerignore', () => {
  it('하위 경로의 .env·백업·DB·로컬 설정을 빌드 컨텍스트에서 뺀다', () => {
    const d = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
    for (const e of ['**/.env', 'backups', '*.db', 'scripts/azure/config.local.sh']) {
      expect(d.split('\n')).toContain(e);
    }
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
  it('ASCII 만 쓴다 (az vm create --custom-data 가 비라틴 문자에서 실패함)', () => {
    // eslint-disable-next-line no-control-regex
    expect(/[^\x00-\x7F]/.test(y)).toBe(false);
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
    const r = bash(['-c', `. "${script('config.sh')}"; echo "$AZ_FQDN|$AZ_AUTOSHUTDOWN_UTC|$AZ_TAG|$AZ_VM_NAME|$AZ_PIP_NAME|$AZ_NSG_NAME"`], FAKE_ENV);
    expect(r.status, r.stderr).toBe(0);
    const [fqdn, shut, tag, vm, pip, nsg] = r.stdout.trim().split('|');
    expect(fqdn).toBe(FAKE_FQDN);
    expect(shut).toBe('1500');
    expect(tag).toBe('project=ob-crash-game');
    for (const n of [vm, pip, nsg]) expect(n.startsWith('ob-crash-')).toBe(true);
  });
});

describe('deploy.sh --dry-run', () => {
  it('--skip-build 는 빌드·push 없이 pull → up → 헬스 → 스모크 순서로 계획한다', () => {
    const r = bash([script('deploy.sh'), '--dry-run', '--skip-build', '--tag', 'abc1234']);
    expect(r.status, r.stderr).toBe(0);
    const out = r.stdout;
    expect(out).not.toContain('build-push.sh');
    const order = ['az vm start', 'cloud-init status --wait', 'docker-compose.yml', 'cat > /opt/ob-crash/.env', 'docker compose pull', 'docker compose up -d', '/health', 'deploy-smoke.mjs'];
    let last = -1;
    for (const needle of order) {
      const i = out.indexOf(needle);
      expect(i, `${needle} 가 출력에 없음`).toBeGreaterThan(-1);
      expect(i, `${needle} 의 순서가 틀림`).toBeGreaterThan(last);
      last = i;
    }
    expect(r.stderr).toContain('abc1234');
    expect(r.stderr).toContain('아무것도 실행하지 않았습니다');
  });

  it('빌드 포함 시 build-push.sh 에 같은 태그를 넘긴다', () => {
    const r = bash([script('deploy.sh'), '--dry-run', '--tag', 'abc1234']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/build-push\.sh --tag abc1234/);
    expect(r.stdout.indexOf('build-push.sh')).toBeLessThan(r.stdout.indexOf('az vm start'));
  });

  it('GHCR 거부 시 공개 전환 안내와 종료 코드 3 경로가 있다', () => {
    const src = fs.readFileSync(script('deploy.sh'), 'utf8');
    expect(src).toMatch(/denied\|unauthorized/);
    expect(src).toContain('Change visibility');
    expect(src).toMatch(/exit 3/);
  });
});

describe('backup.sh --dry-run', () => {
  const r = bash([script('backup.sh'), '--dry-run']);
  it('SQLite backup() API 로 백업하고 scp 로 내려받는다', () => {
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('db.backup(');
    expect(r.stdout).toContain('docker compose exec -T backend node -e');
    expect(r.stdout).toMatch(/scp azureuser@.*backup-\d{14}\.db/);
    expect(r.stdout).toContain("-mtime +7 -delete");
  });
  it('game.db 를 cp 로 직접 복사하지 않는다', () => {
    const src = fs.readFileSync(script('backup.sh'), 'utf8');
    expect(src).not.toMatch(/\bcp\b[^\n]*game\.db/);
    expect(src).not.toMatch(/scp[^\n]*game\.db(?!['"])/);
  });
});

describe('.gitignore', () => {
  it('백업·로컬 설정은 추적하지 않는다', () => {
    const g = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(g).toMatch(/^backups\/$/m);
    expect(g).toContain('scripts/azure/config.local.sh');
  });
});

describe('식별 값 분리 (공개 저장소 보호)', () => {
  it('설정이 비어 있으면 안내하고 종료 코드 2 로 멈춘다', () => {
    for (const f of ['vm.sh', 'provision.sh', 'deploy.sh', 'backup.sh', 'nsg-myip.sh']) {
      const args = f === 'vm.sh' ? [script(f), 'status'] : [script(f), '--dry-run'];
      const r = bash(args, { AZ_CONFIG_LOCAL: '/nonexistent' });
      expect(r.status, `${f}: ${r.stderr}`).toBe(2);
      expect(r.stderr, f).toContain('config.local.sh');
    }
  });

  it('형식이 틀린 구독 ID 와 DNS 레이블은 거부한다', () => {
    const badId = bash([script('vm.sh'), 'status'], { ...FAKE_ENV, AZ_SUBSCRIPTION_ID: 'not-a-guid' });
    expect(badId.status).toBe(2);
    const badLabel = bash([script('vm.sh'), 'status'], { ...FAKE_ENV, AZ_DNS_LABEL: 'Bad_Label' });
    expect(badLabel.status).toBe(2);
  });

  it('추적되는 Azure 스크립트·compose·가이드에 실제 GUID(구독 ID)가 없다', () => {
    const guid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const files = [
      ...fs.readdirSync(path.join(ROOT, 'scripts/azure')).map((f) => `scripts/azure/${f}`),
      'deploy/azure/docker-compose.yml',
      'deploy/azure/.env.example',
      'docs/Azure_VM_배포_가이드.md',
    ].filter((f) => !f.endsWith('config.local.sh')); // 이 파일은 gitignore 대상이라 저장소에 없다
    for (const f of files) {
      const hits = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(guid) ?? []).filter((g) => g !== FAKE_SUB_ID);
      expect(hits, `${f} 에 GUID 가 있음`).toEqual([]);
    }
  });

  it('추적되는 파일에 실제 리소스그룹·구독 이름·DNS 레이블 문자열이 없다', () => {
    // 실제 값은 로컬 설정에서 읽어 비교한다. 설정이 없는 환경(CI)에서는 이 검사를 건너뛴다.
    const local = path.join(ROOT, 'scripts/azure/config.local.sh');
    if (!fs.existsSync(local)) return;
    const r = spawnSync('bash', ['-c', `. "${path.join(ROOT, 'scripts/azure/config.sh')}"; printf '%s\\n%s\\n%s\\n%s\\n' "$AZ_SUBSCRIPTION_NAME" "$AZ_SUBSCRIPTION_ID" "$AZ_RESOURCE_GROUP" "$AZ_DNS_LABEL"`], {
      cwd: ROOT, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
    });
    const secrets = r.stdout.split('\n').map((x) => x.trim()).filter((x) => x.length >= 6);
    expect(secrets.length).toBeGreaterThan(0);
    const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0').filter(Boolean);
    const scan = tracked.filter((f) => !f.startsWith('node_modules/') && /\.(sh|ts|tsx|md|yml|yaml|json|mjs|example)$/.test(f) && f !== 'package-lock.json');
    for (const f of scan) {
      const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
      for (const sec of secrets) expect(text.includes(sec), `${f} 에 식별 값이 있음`).toBe(false);
    }
  });

  it('config.local.sh 는 gitignore 되고 예시 파일은 추적 대상이다', () => {
    const g = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(g).toContain('scripts/azure/config.local.sh');
    expect(fs.existsSync(script('config.local.sh.example'))).toBe(true);
  });
});
