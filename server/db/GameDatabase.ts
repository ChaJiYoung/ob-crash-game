import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

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
    this.conn.exec(SCHEMA_SQL);

    const v = this.conn.pragma('user_version', { simple: true }) as number;
    if (v === 0) {
      this.conn.pragma(`user_version = ${SCHEMA_VERSION}`);
    } else if (v > SCHEMA_VERSION) {
      console.error(
        `[GameDatabase] 더 새로운 서버가 만든 DB입니다 (user_version=${v}, 이 서버=${SCHEMA_VERSION}). 그대로 진행합니다.`,
      );
    }
  }

  /** fn을 하나의 트랜잭션으로 실행한다. fn이 던지면 전부 롤백하고 예외를 다시 던진다. */
  transaction<T>(fn: () => T): T {
    return this.conn.transaction(fn)();
  }

  close(): void {
    if (this.conn.open) this.conn.close();
  }
}
