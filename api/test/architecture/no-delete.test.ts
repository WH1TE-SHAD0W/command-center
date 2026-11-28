// Runs on Node (vitest.architecture.config.ts). Vite inlines the files' text at transform time, so
// the check needs neither node:fs nor Node's types.
import { describe, expect, it } from "vitest";

declare global {
  interface ImportMeta {
    glob<T>(
      patterns: string[],
      options: { query: "?raw"; import: "default"; eager: true },
    ): Record<string, T>;
  }
}

/** Application code and migrations, keyed by path relative to this file. */
const sources = import.meta.glob<string>(["../../src/**/*.ts", "../../migrations/*.sql"], {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Lines that delete rows: Drizzle's `.delete(` or SQL `DELETE FROM`, outside comments. */
function deletions(path: string, text: string): string[] {
  return text
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*"))
    .filter(({ line }) => /\.delete\s*\(|\bDELETE\s+FROM\b/i.test(line))
    .map(({ number }) => `${path.replace("../../", "")}:${number}`);
}

describe("#17 kitchen schema: nothing is deleted (ADR 0009)", () => {
  it("AC2: no application code or migration deletes rows", () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining(["../../src/schema/kitchen.ts", "../../migrations/0000_kitchen_schema.sql"]),
    );
    expect(Object.entries(sources).flatMap(([path, text]) => deletions(path, text))).toEqual([]);
  });

  it("AC2: the check catches a delete", () => {
    expect(deletions("../../src/services/alpha.ts", "await db.delete(alphaRows);\nDELETE FROM alpha_rows;")).toEqual([
      "src/services/alpha.ts:1",
      "src/services/alpha.ts:2",
    ]);
  });
});
