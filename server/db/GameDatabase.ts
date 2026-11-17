import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS, SCHEMA_SQL, SCHEMA_VERSION } from './schema';

export const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'game.db');

export class GameDatabase {
  /** 스토어가 prepare()에 쓰는 원시 연결. */
  readonly conn: Database.Database;

  constructor(filePath: string = DEFAULT_DB_PATH) {
    const inMemory = filePath === ':memory:';
    if (!inMemory) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    this.conn = new Database(filePath);
    if (!inMemory) {
      this.conn.pragma('journal_mode = WAL');
    }
    this.conn.pragma('foreign_keys = ON');
    this.conn.pragma('busy_timeout = 5000');
    // 버전은 SCHEMA_SQL 전에 읽는다. 기존 테이블은 CREATE IF NOT EXISTS가 건너뛰므로 컬럼 추가는 MIGRATIONS로 한다.
    const v = this.conn.pragma('user_version', { simple: true }) as number;
    this.conn.exec(SCHEMA_SQL);

    if (v === 0) {
      // 옛 v0 표기의 기존 DB 방어: 컬럼이 없으면 마이그레이션을 돌린다.
      const cols = this.conn.prepare(`PRAGMA table_info(games)`).all() as { name: string }[];
      if (!cols.some((c) => c.name === 'is_debug')) this.migrate(1);
      this.conn.pragma(`user_version = ${SCHEMA_VERSION}`);
    } else if (v < SCHEMA_VERSION) {
      this.migrate(v);
      this.conn.pragma(`user_version = ${SCHEMA_VERSION}`);
    } else if (v > SCHEMA_VERSION) {
      console.error(
        `[GameDatabase] 더 새로운 서버가 만든 DB입니다 (user_version=${v}, 이 서버=${SCHEMA_VERSION}). 그대로 진행합니다.`,
      );
    }
  }

  private migrate(from: number): void {
    this.transaction(() => {
      for (const m of MIGRATIONS) if (m.to > from) this.conn.exec(m.sql);
    });
  }

  /** fn을 하나의 트랜잭션으로 실행한다. fn이 던지면 전부 롤백하고 예외를 다시 던진다. */
  transaction<T>(fn: () => T): T {
    return this.conn.transaction(fn)();
  }

  close(): void {
    if (this.conn.open) this.conn.close();
  }
}
