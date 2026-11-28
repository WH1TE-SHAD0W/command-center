// Runs on Node (vitest.architecture.config.ts): dependency-cruiser reads the file tree.
import { cruise, type ICruiseResult } from "dependency-cruiser";
import extractDepcruiseOptions from "dependency-cruiser/config-utl/extract-depcruise-options";
import { describe, expect, inject, it } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    apiRoot: string;
  }
}

const apiRoot = inject("apiRoot");
const FIXTURES = "test/architecture/fixtures";

/** Cruises `target` (relative to api/) with the real config; returns "from -> to" per violation. */
async function violations(target: string): Promise<string[]> {
  const options = await extractDepcruiseOptions(`${apiRoot}/.dependency-cruiser.cjs`);
  const { output } = await cruise([target], { ...options, baseDir: apiRoot });
  const result = output as ICruiseResult;
  return result.summary.violations
    .map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)
    .sort();
}

describe("PLT-005 #12 module registry and architecture test", () => {
  it("AC2/AC4: a synthetic cross-module import fails the check", async () => {
    const v = `${FIXTURES}/violating/src`;
    expect(await violations(v)).toEqual(
      [
        `no-cross-module: ${v}/controllers/alpha.ts -> ${v}/schema/beta.ts`,
        `no-cross-module: ${v}/mcp/alpha.ts -> ${v}/listeners/alphabet.ts`,
        `no-cross-module: ${v}/services/alpha.ts -> ${v}/services/beta.ts`,
        `no-cross-module: ${v}/validation/gamma/index.ts -> ${v}/controllers/alpha.ts`,
      ].sort(),
    );
  });

  it("AC2: a module may import its own files and core files, and core may import modules", async () => {
    expect(await violations(`${FIXTURES}/allowed/src`)).toEqual([]);
  });

  it("AC3/AC4: the real source tree passes the check", async () => {
    expect(await violations("src")).toEqual([]);
  });
});
