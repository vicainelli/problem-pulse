import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(dbPath: string): Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.run("PRAGMA foreign_keys = ON");
  const d = drizzle(db);
  migrate(d, { migrationsFolder: "./src/db/migrations" });
  return db;
}
