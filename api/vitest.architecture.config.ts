import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const apiRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Every file below `dir` (relative to the repo root), skipping node_modules and fixtures. */
function walk(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(`${repoRoot}${dir}`, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name === "node_modules" || e.name === "fixtures") return [];
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : [rel];
  });
}

/** Path → content for the given files, read here because the test files have no Node types. */
function read(files: string[]): Record<string, string> {
  return Object.fromEntries(files.map((f) => [f, readFileSync(`${repoRoot}${f}`, "utf8")]));
}

// ADR 0015: the spec traceability test checks docs/specs/ against the requirement IDs in tests.
const specFiles = walk("docs/specs").filter((f) => f.endsWith(".md") && !f.endsWith("/README.md"));
const testFiles = ["api/test", "api/src", "web/test", "web/src"]
  .flatMap(walk)
  .filter((f) => f.endsWith(".test.ts") && !f.endsWith("/spec-trace.test.ts"));

export default defineConfig({
  test: {
    name: "architecture",
    root: apiRoot,
    environment: "node",
    include: ["test/architecture/**/*.test.ts"],
    provide: { apiRoot, specFiles: read(specFiles), testFiles: read(testFiles) },
  },
});
