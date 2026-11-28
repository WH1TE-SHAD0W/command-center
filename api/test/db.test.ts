import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/db";

// A synthetic table, defined only for this test; it is not part of any module's schema.
const probes = sqliteTable("test_probes", {
  id: integer("id").primaryKey(),
  label: text("label").notNull(),
});

describe("PLT-006 #11 Drizzle and migrations", () => {
  it("AC1: services get one drizzle(env.DB, { schema }) that queries the local D1", async () => {
    const db = createDb(env.DB);
    await env.DB.exec("CREATE TABLE test_probes (id INTEGER PRIMARY KEY, label TEXT NOT NULL)");

    await db.insert(probes).values([
      { id: 1, label: "synthetic probe 1" },
      { id: 2, label: "synthetic probe 2" },
    ]);
    const rows = await db.select().from(probes).where(eq(probes.id, 2));

    expect(rows).toEqual([{ id: 2, label: "synthetic probe 2" }]);
    // The instance carries the combined schema's relational API.
    expect(db.query).toBeDefined();
  });
});
