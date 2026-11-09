import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Documentation Screen Captures Existence', () => {
  it('every screen image referenced in README.md and docs/*.md must exist on disk', () => {
    const rootDir = process.cwd();
    const docFiles: string[] = [];

    // 1. Collect README.md
    const readmePath = path.join(rootDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      docFiles.push(readmePath);
    }

    // 2. Collect docs/*.md
    const docsDir = path.join(rootDir, 'docs');
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          docFiles.push(path.join(docsDir, f));
        }
      }
    }

    expect(docFiles.length).toBeGreaterThan(0);

    const imageRefRegex = /!\[([^\]]*)\]\(([^)]*screens\/[^)]+\.png)\)/g;
    const missing: { doc: string; ref: string; fullPath: string }[] = [];
    let totalChecked = 0;

    for (const docPath of docFiles) {
      const content = fs.readFileSync(docPath, 'utf-8');
      let match: RegExpExecArray | null;

      while ((match = imageRefRegex.exec(content)) !== null) {
        const rawRef = match[2].trim();
        // Resolve relative to the document file's directory
        const resolvedPath = path.resolve(path.dirname(docPath), rawRef);
        totalChecked++;

        if (!fs.existsSync(resolvedPath)) {
          missing.push({
            doc: path.relative(rootDir, docPath),
            ref: rawRef,
            fullPath: resolvedPath,
          });
        }
      }
    }

    console.log(`Checked ${totalChecked} screen image references across ${docFiles.length} markdown documents.`);

    expect(totalChecked).toBeGreaterThan(15);
    expect(missing).toEqual([]);
  });
});
