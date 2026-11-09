# Task: T01 배포·백업 스크립트

## Status: pending

## Goal
`scripts/azure/deploy.sh` 한 줄로 이미지 빌드·push → VM 시작 → 운영 compose 전달 → `pull && up -d` → `/health` 대기 → 스모크 점검까지 수행하고, 특정 태그로 롤백할 수 있게 한다. `scripts/azure/backup.sh`는 SQLite 온라인 백업을 VM에서 만들어 사용자 PC로 내려받는다. 이 Task는 스크립트와 dry-run 테스트까지이며 실제 VM 호출은 P04에서 한다.

## Decision Summary
- D05/D06: VM은 이미지를 pull만 한다. 빌드·push는 `build-push.sh`(P01)를 호출하고, 이 스크립트는 "VM 갱신" 단계만 소유한다(나중에 Actions가 앞 단계를 대신해도 이 단계는 그대로).
- D10: 오라클 D11의 SQLite 온라인 백업(WAL 때문에 `game.db` 파일 복사 금지)을 재사용하고 로컬 PC로 `scp`.
- VM은 대부분 꺼져 있으므로 deploy는 VM이 꺼져 있으면 `vm.sh start`를 먼저 수행한다.

## Implementation

### I01. 배포 스크립트
- Related Files:
  - `scripts/azure/deploy.sh` :: 배포 오케스트레이션; new (chmod +x)
  - `scripts/azure/build-push.sh`, `scripts/azure/vm.sh`, `scripts/azure/lib.sh`, `deploy/azure/docker-compose.yml`, `scripts/deploy-smoke.mjs` :: 호출 대상; read-only

#### Details
- **Signatures**: `deploy.sh [--tag TAG] [--skip-build] [--allow-dirty] [--dry-run]`
  - `--skip-build`: 빌드·push 생략. `--tag`와 함께 쓰면 **롤백**(이미 GHCR에 있는 해시 태그로 되돌림). `--skip-build`인데 `--tag` 없으면 `latest`.
- **Execution Flow** (`set -euo pipefail`, `source config.sh lib.sh`):
  1. 태그 결정: `--tag` 없으면 `git rev-parse --short HEAD`.
  2. 빌드: `--skip-build`가 아니면 `scripts/azure/build-push.sh --tag "$TAG" [--allow-dirty 전달]`. 이때 **VM 갱신에 쓰는 태그는 해시 태그**(dirty면 `-dirty` 접미사가 붙은 값)이고 `latest`에 의존하지 않는다.
  3. VM 시작: `scripts/azure/vm.sh start` (이미 실행 중이면 `az vm start`는 무해).
  4. 이전 태그 읽기: `ssh_run "grep '^IMAGE_TAG=' $REMOTE_DIR/.env 2>/dev/null || true"` → 값이 있으면 롤백 안내용으로 저장.
  5. 파일 전달: `scp $(ssh_opts) deploy/azure/docker-compose.yml "$AZ_ADMIN_USER@$AZ_FQDN:$REMOTE_DIR/docker-compose.yml"`; `.env`는 원격에서 생성:
     ```bash
     ssh_run "printf 'DOMAIN=%s\nIMAGE_PREFIX=%s\nIMAGE_TAG=%s\n' '$AZ_FQDN' '$IMAGE_PREFIX' '$TAG' > $REMOTE_DIR/.env"
     ```
     (`.env`에는 비밀값이 없다. 접속 상한을 바꾸려면 `WS_MAX_CONN_PER_IP` 등을 이 파일에 직접 추가하는 방법을 가이드에 안내하되 deploy가 덮어쓸 수 있음을 명시 → 지속 설정은 `config.local.sh`의 `EXTRA_ENV` 문자열로 받아 함께 기록하도록 한다: 기본 빈 값.)
  6. 갱신:
     ```bash
     ssh_run "cd $REMOTE_DIR && docker compose pull 2>&1 | tee /tmp/pull.log; ..."
     ```
     pull 출력에 `denied` 또는 `unauthorized`가 있으면 **GHCR 공개 전환 안내**(P01 I03와 같은 문구)를 출력하고 exit 3. 성공하면 `docker compose up -d` 후 `docker image prune -f`(dangling만; 롤백용 태그 이미지는 보존).
  7. 헬스 대기: `curl -fsS --max-time 5 "https://$AZ_FQDN/health"`를 5초 간격으로 최대 120초 재시도(첫 배포 때 Let's Encrypt 발급 지연 고려). 실패하면 `docker compose logs --tail 50 web` 원격 출력 후 exit 4.
  8. 스모크: `node scripts/deploy-smoke.mjs "https://$AZ_FQDN"` 실행, 실패 시 exit 5.
  9. 완료 요약: 배포 태그, 이전 태그, 롤백 명령(`deploy.sh --skip-build --tag <이전>`), "안 쓸 때는 `vm.sh stop`" 안내.
- **Error handling**: 각 단계 실패 시 어떤 단계인지와 해결 힌트 출력. `--dry-run`이면 실행 계획만 출력(`run()` 사용)하며 SSH·`az`·docker 호출 없음.
- **함정**:
  - 최초 배포 전에는 원격 `/opt/ob-crash`가 cloud-init으로만 만들어져 있으므로, cloud-init이 끝나기 전에 `scp`하면 디렉터리가 없을 수 있다. `ssh_run "cloud-init status --wait"`를 4단계 전에 한 번 실행한다(이미 `done`이면 즉시 반환).
  - `scp`의 `-i` 옵션이 `ssh_opts`와 호환되어야 한다(`-o ServerAliveInterval` 등은 scp도 지원).
  - 원격 명령을 큰따옴표로 감쌀 때 로컬 변수 확장과 원격 변수 확장을 구분한다(원격에서 확장할 `$`는 `\$`).

### I02. 백업 스크립트
- Related Files:
  - `scripts/azure/backup.sh` :: SQLite 온라인 백업과 다운로드; new (chmod +x)
  - `.gitignore` :: `backups/` 추가; modify

#### Details
- **Signatures**: `backup.sh [--out DIR] [--dry-run]` — 기본 `--out ./backups`.
- **Execution Flow**:
  1. VM 실행 상태 확인(`vm.sh status` 출력에 `VM running` 포함 여부). 꺼져 있으면 "먼저 `vm.sh start`" 안내 후 exit 2(백업을 위해 임의로 VM을 켜지 않는다).
  2. 타임스탬프 `STAMP=$(date +%Y%m%d%H%M%S)`.
  3. 원격에서 온라인 백업(오라클 가이드와 동일한 `better-sqlite3` `backup()` API, 파일 이름은 `STAMP`로 예측 가능하게):
     ```bash
     ssh_run "cd $REMOTE_DIR && docker compose exec -T backend node -e \"const D=require('better-sqlite3');const db=new D('data/game.db');db.backup('data/backup-'+process.argv[1]+'.db').then(()=>{db.close();console.log('ok')}).catch(e=>{console.error(e);process.exit(1)})\" $STAMP"
     ```
     **실행 형태 확인 필요**: 프로젝트가 `"type": "module"`이라 `node -e`의 `require` 허용 여부를 P04에서 실제로 확인하고, 안 되면 `--input-type=commonjs`를 추가한다(확정 후 이 문서·스크립트에 반영).
  4. 내려받기: `scp ... :$REMOTE_DIR/data/backup-$STAMP.db "$OUT/"`.
  5. 무결성 확인: `sqlite3`가 있으면 `sqlite3 "$OUT/backup-$STAMP.db" 'PRAGMA integrity_check'` 출력이 `ok`여야 하고, 없으면 파일 크기가 0보다 큰지만 확인.
  6. 원격 정리: `find $REMOTE_DIR/data -name 'backup-*.db' -mtime +7 -delete` (7일 초과분만).
- `backups/`는 `.gitignore`에 추가(DB는 저장소에 올리지 않는다).
- **함정**: 컨테이너 안의 작업 디렉터리는 `/app`이며 `data`는 호스트 `$REMOTE_DIR/data`에 마운트된 `/app/data`다. 컨테이너가 root로 쓴 파일을 `azureuser`가 `scp`로 읽을 수 있는지(권한 644) 확인한다.

### I03. 스크립트 테스트 확장
- Related Files:
  - `tests/azure-scripts.test.ts` :: deploy·backup dry-run 검증 추가; modify

#### Details
- `bash scripts/azure/deploy.sh --dry-run --skip-build --tag abc1234`: exit 0이고 stdout에 `docker compose pull`, `docker compose up -d`, `IMAGE_TAG`·`abc1234`, `deploy-smoke.mjs`가 포함, `build-push.sh`는 포함되지 않음.
- `bash scripts/azure/deploy.sh --dry-run --tag abc1234`(빌드 포함): `build-push.sh`가 `--tag abc1234`와 함께 계획에 포함.
- `bash scripts/azure/backup.sh --dry-run`: `backup(`·`scp`·`-mtime +7`이 포함되고 `cp` 명령으로 `game.db`를 직접 복사하는 줄은 없음.
- `.gitignore`에 `backups/`가 포함됨을 검사.

## Acceptance Criteria
- [ ] `deploy.sh --dry-run`이 단계 순서(빌드 → VM 시작 → 파일 전달 → pull → up → 헬스 → 스모크)대로 계획을 출력한다.
- [ ] 롤백(`--skip-build --tag X`)은 빌드·push를 호출하지 않는다.
- [ ] pull 거부 시 GHCR 공개 전환 안내를 출력하고 exit 3으로 끝난다(코드 경로 존재; 실호출 검증은 P04).
- [ ] `backup.sh`는 파일 복사가 아니라 SQLite `backup()` API를 사용한다.
- [ ] `backups/`가 git 추적에서 제외된다.

## Validation
- `npx vitest run tests/azure-scripts.test.ts tests/azure-deploy-files.test.ts` — 통과
- `bash scripts/azure/deploy.sh --dry-run --skip-build --tag abc1234` — 출력 육안 확인
- `bash scripts/azure/backup.sh --dry-run` — 출력 육안 확인
- `git check-ignore backups/x.db` — 경로가 출력됨(무시됨)
- `npx tsc --noEmit && npm test` — 전체 통과

## Commit Message
```text
feat(deploy): Azure VM 배포·롤백 스크립트와 SQLite 백업 스크립트

Plan: 2026-11-09-azure-vm-deployment
Phase: P03-deploy-and-backup
Task: T01-deploy-and-backup-scripts

- I01: deploy.sh(빌드→VM 시작→compose 전달→pull/up→헬스→스모크, 태그 롤백, GHCR 거부 안내)
- I02: backup.sh(SQLite backup() 온라인 백업→scp, 7일 지난 원격 백업 정리)와 backups/ 무시
- I03: deploy·backup dry-run 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
