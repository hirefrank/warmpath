import { Database } from "bun:sqlite";
import { migrations } from "./migrate";

let db: Database | null = null;
let dbPath: string | null = null;

export function getDatabase(): Database {
  if (db) {
    return db;
  }

  const configuredPath = process.env.WARMPATH_DB_PATH?.trim();
  dbPath = configuredPath && configuredPath.length > 0
    ? configuredPath
    : `${process.cwd()}/warmpath.db`;

  db = new Database(dbPath, { create: true, strict: true });
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");

  runMigrations(db);
  return db;
}

export function resetDatabaseForTests(): void {
  if (!db) {
    return;
  }

  try {
    db.close();
  } catch {
    // Ignore close errors in test cleanup.
  }

  db = null;
  dbPath = null;
}

export function getCurrentDatabasePath(): string | null {
  return dbPath;
}

function runMigrations(database: Database): void {
  for (const sql of migrations) {
    database.exec(sql);
  }
}
