import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

function makeDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");
  const d = drizzle(db);
  migrate(d, { migrationsFolder: "./src/db/migrations" });
  return db;
}

describe("Schema", () => {
  test("migrations create all tables", () => {
    const db = makeDb();
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r: unknown) => (r as { name: string }).name);

    expect(tables).toContain("raw_documents");
    expect(tables).toContain("documents");
    expect(tables).toContain("evidence");
    expect(tables).toContain("pains");
    expect(tables).toContain("embeddings");
    expect(tables).toContain("clusters");
    expect(tables).toContain("opportunities");
    expect(tables).toContain("__drizzle_migrations");
  });

  test("migrations track applied migrations", () => {
    const db = makeDb();
    const rows = db.query("SELECT * FROM __drizzle_migrations").all() as { hash: string }[];
    expect(rows.length).toBeGreaterThan(0);
  });

  test("migrations are idempotent", () => {
    const db = makeDb();
    const d = drizzle(db);
    migrate(d, { migrationsFolder: "./src/db/migrations" });
    const rows = db.query("SELECT * FROM __drizzle_migrations").all() as { hash: string }[];
    expect(rows.length).toBe(1);
  });
});
