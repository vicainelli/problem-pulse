import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export function makeDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");
  const d = drizzle(db);
  migrate(d, { migrationsFolder: "./src/db/migrations" });
  return db;
}

export function makeId(): string {
  return crypto.randomUUID();
}
