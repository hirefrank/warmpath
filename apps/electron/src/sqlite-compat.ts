/**
 * Compatibility shim that wraps better-sqlite3 to match the bun:sqlite API.
 *
 * bun:sqlite exposes `db.query(sql)` returning a statement with .run/.get/.all.
 * better-sqlite3 exposes `db.prepare(sql)` with the same statement methods.
 * This wrapper bridges the naming difference so server code written for
 * bun:sqlite works unchanged under Node.js / Electron.
 */

import BetterSqlite3 from "better-sqlite3";

export class Database {
  private db: BetterSqlite3.Database;

  constructor(path: string, _options?: { create?: boolean; strict?: boolean }) {
    this.db = new BetterSqlite3(path);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Matches bun:sqlite's `database.query(sql)` API.
   * Returns a statement-like object with .run(), .get(), .all().
   */
  query<T = unknown, P extends unknown[] = unknown[]>(
    sql: string
  ): { run: (...args: P) => void; get: (...args: P) => T | null; all: (...args: P) => T[] } {
    const stmt = this.db.prepare(sql);
    return {
      run: (...args: P) => {
        stmt.run(...(args as unknown[]));
      },
      get: (...args: P) => {
        return (stmt.get(...(args as unknown[])) as T | undefined) ?? null;
      },
      all: (...args: P) => {
        return stmt.all(...(args as unknown[])) as T[];
      },
    };
  }

  transaction<F extends (...args: unknown[]) => unknown>(fn: F): F {
    return this.db.transaction(fn) as unknown as F;
  }
}
