// ADR 0015: every implemented requirement in docs/specs/ has a test naming its ID, and tests name
// only requirements that exist and are implemented. vitest.architecture.config.ts reads the files.
import { describe, expect, inject, it } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    specFiles: Record<string, string>;
    testFiles: Record<string, string>;
  }
}

const STATUSES = ["accepted", "implemented", "retired"];

interface Requirement {
  id: string;
  file: string;
  status: string;
}

function parseSpecs(specFiles: Record<string, string>) {
  const prefixes = new Map<string, string>();
  const requirements: Requirement[] = [];
  for (const [file, text] of Object.entries(specFiles)) {
    const prefix = /\*\*Prefix:\*\*\s*`([A-Z]{2,5})`/.exec(text)?.[1];
    if (!prefix) throw new Error(`${file} has no **Prefix:** line`);
    prefixes.set(prefix, file);
    // A requirement starts at a "### ID title" heading; its status is the first Status line in it.
    for (const block of text.split(/^### /m).slice(1)) {
      const id = /^([A-Z]{2,5}-\d{3})\b/.exec(block)?.[1];
      if (!id) continue;
      const status = /^- \*\*Status:\*\*\s*(\S+)/m.exec(block)?.[1] ?? "(missing)";
      requirements.push({ id, file, status });
    }
  }
  return { prefixes, requirements };
}

function idsInTests(testFiles: Record<string, string>, prefixes: string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  if (prefixes.length === 0) return found;
  const pattern = new RegExp(`\\b(?:${prefixes.join("|")})-\\d{3}\\b`, "g");
  for (const [file, text] of Object.entries(testFiles)) {
    for (const id of new Set(text.match(pattern) ?? [])) {
      found.set(id, [...(found.get(id) ?? []), file]);
    }
  }
  return found;
}

const { prefixes, requirements } = parseSpecs(inject("specFiles"));
const byId = new Map(requirements.map((r) => [r.id, r]));
const tested = idsInTests(inject("testFiles"), [...prefixes.keys()]);

describe("FAC-002 ADR 0015 spec traceability", () => {
  it("every requirement has a known status, a unique ID and its file's prefix", () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const r of requirements) {
      if (!STATUSES.includes(r.status)) problems.push(`${r.id}: unknown status "${r.status}"`);
      if (seen.has(r.id)) problems.push(`${r.id}: defined twice`);
      seen.add(r.id);
      if (prefixes.get(r.id.split("-")[0]) !== r.file) problems.push(`${r.id}: wrong prefix for ${r.file}`);
    }
    expect(problems).toEqual([]);
    expect(requirements.length).toBeGreaterThan(0);
  });

  it("every implemented requirement has a test naming its ID", () => {
    const untested = requirements
      .filter((r) => r.status === "implemented" && !tested.has(r.id))
      .map((r) => `${r.id} (${r.file})`);
    expect(untested).toEqual([]);
  });

  it("tests name only requirements that exist and are implemented", () => {
    const problems = [...tested.entries()].flatMap(([id, files]) => {
      const r = byId.get(id);
      if (!r) return [`${id} in ${files.join(", ")}: no spec defines it`];
      if (r.status !== "implemented") {
        return [`${id} in ${files.join(", ")}: status is ${r.status}; mark it implemented in ${r.file}`];
      }
      return [];
    });
    expect(problems).toEqual([]);
  });
});
