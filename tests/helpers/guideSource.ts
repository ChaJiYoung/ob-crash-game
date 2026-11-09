import fs from 'node:fs';
import path from 'node:path';

/** GuideModal.tsx와 src/pc/components/guide/ 아래 모든 .ts/.tsx를 이어 붙인 소스. 문자열 포함 검사용. */
export function readGuideSource(): string {
  const parts = [fs.readFileSync('src/pc/components/GuideModal.tsx', 'utf8')];
  const dir = 'src/pc/components/guide';
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (/\.(ts|tsx)$/.test(f)) parts.push(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  return parts.join('\n');
}
