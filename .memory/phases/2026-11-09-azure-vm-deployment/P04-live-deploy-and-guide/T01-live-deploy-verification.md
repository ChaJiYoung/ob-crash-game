# Task: T01 실제 Azure 배포 검증

## Status: done

## Goal
P01~P03 스크립트로 실제 Azure에 VM을 만들고 처음 배포해, 스모크 6개 항목 통과·PC+폰 실기기 플레이·중지/재시작 복구·백업 무결성까지 확인한다. 이 Task는 **비용이 발생하고 외부에 공개되는 작업**이므로 각 게이트에서 사용자 확인을 받고 진행한다. 검증이 끝나면 VM은 **중지(deallocate) 상태로 둔다**. 발견한 문제는 스크립트·cloud-init에 반영한다.

## Decision Summary
- D04: 유료(월 약 $14~16 / 중지 시 약 $6, 추정). D07: 생성은 `provision.sh --yes`로만. D05: 첫 push 후 GHCR 패키지를 사용자가 공개로 전환.
- 이 Task 자체는 코드 변경이 거의 없고 결과(실측 비용·명령 출력·발견한 문제)를 기록하는 것이 산출물이다.

## Implementation

### I01. 사전 점검 (게이트 G0: 사용자에게 비용·내용 확인)
- Related Files:
  - `scripts/azure/provision.sh` :: dry-run 계획; read-only

#### Details
1. `az account show --query name -o tsv` → `<SUBSCRIPTION_NAME>` 확인.
2. `scripts/azure/provision.sh --dry-run`의 계획을 사용자에게 보여주고 **비용(24시간 약 $14~16, 중지 시 약 $6, 추정)과 리소스 목록을 확인받는다.** 승인 없이는 I02로 진행하지 않는다.
3. 쿼터·가용성: `az vm list-usage -l koreacentral -o table`(Basv2 계열 남은 vCPU), `az vm list-skus`(B2ats_v2 제한 없음; 2026-11-09 계획 단계에서 확인됨).
4. Azure 가격 계산기로 `Standard_B2ats_v2`·Standard 고정 IP·30GB Standard SSD의 Korea Central 실제 단가를 확인해 추정치를 교정한다(교정값을 기록).

### I02. 프로비저닝 (게이트 G1: 사용자 최종 확인 후 `--yes`)
- Related Files:
  - `scripts/azure/provision.sh`, `scripts/azure/vm.sh` :: 실행; read-only

#### Details
1. 사용자 승인 후 `scripts/azure/provision.sh --yes`.
2. 생성 확인: `az resource list -g <RESOURCE_GROUP> --query "[?tags.project=='ob-crash-game'].{n:name,t:type}" -o table`, DNS 해석(`dig +short $AZ_FQDN`이 공용 IP와 일치).
3. cloud-init 완료: `scripts/azure/vm.sh ssh`로 접속해 `cloud-init status --wait`가 `done`, `docker --version`, `docker compose version`, `free -h`에서 스왑 2G, `ls -la /opt/ob-crash` 확인. **`docker-compose-v2` 패키지명이 어긋나면 cloud-init.yml을 고치고 재프로비저닝 대신 VM에서 직접 설치해 해결한 뒤 파일을 수정**해 커밋한다.
4. 자동 종료 확인: `az resource show` 또는 포털로 `shutdown-computevm-ob-crash-vm` 스케줄(UTC 1500) 존재 확인.
5. NSG 확인: `az network nsg rule list -g <RESOURCE_GROUP> --nsg-name ob-crash-nsg -o table`에서 22번의 source가 내 IP/32이며 `*`가 아님.

### I03. 첫 배포 (게이트 G2: GHCR push 확인, 사용자의 GitHub 조작 필요)
- Related Files:
  - `scripts/azure/build-push.sh`, `scripts/azure/deploy.sh` :: 실행; read-only

#### Details
1. GHCR 쓰기 권한: 사용자가 터미널에서 `! gh auth refresh -s write:packages`(브라우저 인증 필요, 에이전트가 대신할 수 없음) 실행.
2. 사용자 승인 후 `scripts/azure/build-push.sh`(공개 저장소의 코드가 이미지로 올라감). 완료 후 안내대로 **사용자가 GitHub에서 두 패키지(`ob-crash-backend`, `ob-crash-web`)를 Public으로 전환**.
3. 공개 여부 확인: 로그인 없이 `docker pull`이 되는지 VM에서 확인(`ssh`로 `docker pull ghcr.io/chajiyoung/ob-crash-web:latest`).
4. `scripts/azure/deploy.sh --skip-build --tag <해시>`(이미 push했으므로) 또는 전체 `deploy.sh`. 첫 배포 때 Caddy가 Let's Encrypt 인증서를 받는 데 걸린 시간과 `docker compose logs web`의 ACME 로그를 기록.
5. 스모크: `node scripts/deploy-smoke.mjs https://$AZ_FQDN` 6개 OK. 브라우저에서 자물쇠(유효한 인증서) 확인.

### I04. 실기기 확인 (게이트 G3: 사용자가 직접 수행, 에이전트는 체크리스트 제공)
- Related Files: 없음 (수동 검증)

#### Details
- PC 브라우저로 `https://$AZ_FQDN` → 3D 대기실 로드, 1P·2P QR 표시. QR 주소가 `https://$AZ_FQDN/controller?room=…`인지 확인.
- 폰 1~2대로 QR 스캔 → 자이로 권한 허용 → 조준·발사 동작, 한 판 완료 후 랭킹 저장.
- 접속 가드: 필요 시 `WS_MAX_CONN_PER_IP`를 낮춰 SERVER_FULL 배너를 확인하는 것은 선택 사항.

### I05. 중지·재시작·백업 검증
- Related Files:
  - `scripts/azure/vm.sh`, `scripts/azure/backup.sh` :: 실행; read-only

#### Details
1. 백업: `scripts/azure/backup.sh` → `backups/backup-*.db`가 내려오고 `sqlite3 … 'PRAGMA integrity_check'`가 `ok`. `node -e`의 `require` 동작 여부를 확인하고, 필요하면 `--input-type=commonjs`를 `backup.sh`와 P03 T01 문서에 반영.
2. 중지: `scripts/azure/vm.sh stop` → `vm.sh status`가 `VM deallocated`. 이후 비용 정책에 따라 공용 IP·디스크 비용만 남는지 포털(비용 권한이 있다면) 또는 SKU 기준으로 확인.
3. 재시작: `scripts/azure/vm.sh start` 후 **재배포 없이** `https://$AZ_FQDN/health`가 200(`restart: unless-stopped`로 컨테이너 복구, IP·도메인·인증서 유지)이고 랭킹 데이터가 남아 있음.
4. 롤백 리허설: `deploy.sh --skip-build --tag <이전 해시>`(해시가 하나뿐이면 `latest`)가 동작.
5. 마지막에 `vm.sh stop`으로 VM을 **중지 상태로 남긴다**(사용자가 지금 계속 쓰겠다고 하면 예외).

### I06. 결과 기록
- Related Files:
  - `.memory/phases/2026-11-09-azure-vm-deployment/P04-live-deploy-and-guide/phase.md` :: 검증 결과 표 추가; modify
  - `scripts/azure/*`, `scripts/azure/cloud-init.yml` :: 검증 중 발견한 오류 수정; modify (필요 시)

#### Details
- phase.md 하단에 "실배포 결과" 표를 추가한다: 항목(스모크 6개, 인증서 발급 시간, 실기기 플레이, 재시작 복구, 백업 무결성, 롤백), 결과, 실제 단가(가격 계산기 교정값), 발견한 문제와 조치.
- 스크립트·cloud-init 수정이 있었다면 별도 `fix(deploy)` 커밋으로 분리한다(결과 기록 커밋과 섞지 않는다).

## Acceptance Criteria
- [ ] 각 게이트(G0~G3)에서 사용자 승인을 받았고 승인 전에는 리소스를 만들거나 이미지를 push하지 않았다.
- [ ] `deploy-smoke.mjs https://$AZ_FQDN`이 6개 모두 OK다.
- [ ] 유효한 Let's Encrypt 인증서로 HTTPS가 동작하고 폰에서 자이로가 동작한다.
- [ ] `vm.sh stop` → `start` 후 재배포 없이 `/health`가 200이다.
- [ ] 백업 파일이 PC로 내려오고 `integrity_check`가 `ok`다.
- [ ] 종료 시 VM이 `deallocated`다(예외 합의 시 제외).
- [ ] 22번 포트 규칙이 `*`로 열려 있지 않다.

## Validation
- `node scripts/deploy-smoke.mjs https://<FQDN>` — 6개 OK
- `bash scripts/azure/vm.sh status` — 최종 `VM deallocated`
- `az resource list -g <RESOURCE_GROUP> --query "[?tags.project=='ob-crash-game'].name" -o tsv` — 생성된 리소스 목록과 가이드의 삭제 대상이 일치
- `npx tsc --noEmit && npm test` — 스크립트 수정이 있었다면 전체 통과

## Commit Message
```text
docs(memory): Azure VM 실배포 검증 결과 기록

Plan: 2026-11-09-azure-vm-deployment
Phase: P04-live-deploy-and-guide
Task: T01-live-deploy-verification

- I01~I05: 프로비저닝·첫 배포·스모크·실기기·중지/재시작·백업 검증 결과
- I06: 실측 단가와 발견한 문제·조치 기록 (스크립트 수정은 별도 fix(deploy) 커밋)
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (폰 한 판 완료·랭킹 저장, 자동 종료 실동작은 미확인으로 기록)
- commit: pending
