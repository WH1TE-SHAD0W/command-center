// docs/specs/factory.md: each promise is wired into the factory's files. Runs on Node; the files are
// read by vitest.architecture.config.ts, because the test files have no Node types.
import { describe, expect, inject, it } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    factoryFiles: Record<string, string>;
    claudeTree: string[];
  }
}

const files = inject("factoryFiles");
const tree = inject("claudeTree");
const specs = inject("specFiles");

function file(path: string): string {
  const text = files[path];
  if (text === undefined) throw new Error(`${path} is missing`);
  return text;
}

/** The text of a "## heading" section, up to the next "## " heading. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const rest = text.slice(start + heading.length + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

function requirementsByStatus(): Map<string, string> {
  const status = new Map<string, string>();
  for (const text of Object.values(specs)) {
    for (const block of text.split(/^### /m).slice(1)) {
      const id = /^([A-Z]{2,5}-\d{3})\b/.exec(block)?.[1];
      const s = /^- \*\*Status:\*\*\s*(\S+)/m.exec(block)?.[1];
      if (id && s) status.set(id, s);
    }
  }
  return status;
}

describe("FAC-001 every change is specified before it is built", () => {
  it("spec first is the rule, with a spec-writer and issues that cite requirement IDs", () => {
    expect(tree).toContain(".claude/agents/spec-writer.md");
    expect(file("CLAUDE.md")).toContain("**Behaviour:** the living module specs in `docs/specs/`");
    expect(file("AGENTS.md")).toContain("A gap in a requirement is fixed by a spec PR");
    expect(file(".claude/skills/github-issues/SKILL.md")).toContain("## Implements");
    expect(file(".claude/agents/feature-builder.md")).toContain("`docs/specs/`");
  });
});

describe("FAC-003 every change is reviewed against its spec", () => {
  it("the reviewer blocks on spec mismatch and stale public docs", () => {
    const reviewer = file(".claude/agents/reviewer.md");
    expect(reviewer).toContain("**Spec match**");
    expect(reviewer).toContain("**Public docs**");
    expect(file("AGENTS.md")).toContain("one line per requirement ID");
  });
});

describe("FAC-004 the owner decides and merges", () => {
  it("agents ask instead of deciding, never merge, and cannot deploy", () => {
    const agents = file("AGENTS.md");
    expect(agents).toContain("The owner makes **every** design decision");
    expect(agents).toContain("**Never merge** a PR");
    const deny = (JSON.parse(file(".claude/settings.json")) as { permissions: { deny: string[] } })
      .permissions.deny;
    expect(deny).toEqual(expect.arrayContaining(["Bash(npm run deploy*)", "Bash(wrangler deploy*)"]));
  });
});

describe("FAC-005 the public docs describe the app as it is", () => {
  const status = requirementsByStatus();
  const capabilities = section(file("README.md"), "What it can do");
  const listed = new Set(capabilities.match(/\b[A-Z]{2,5}-\d{3}\b/g) ?? []);

  it("the README lists every implemented requirement", () => {
    const missing = [...status].filter(([, s]) => s === "implemented").map(([id]) => id);
    expect(missing.filter((id) => !listed.has(id))).toEqual([]);
  });

  it("the README lists only implemented requirements as available", () => {
    expect([...listed].filter((id) => status.get(id) !== "implemented")).toEqual([]);
  });

  it("the README links the guide, the roadmap and the specs, and the guide has a quick start", () => {
    const readme = file("README.md");
    for (const link of ["(docs/guide/)", "(docs/roadmap.md)", "(docs/specs/)"]) expect(readme).toContain(link);
    expect(tree).toContain("docs/guide/quick-start.md");
    expect(tree).toContain("docs/guide/README.md");
  });

  it("the documenter keeps README, guide and roadmap current in every PR", () => {
    const documenter = file(".claude/agents/documenter.md");
    for (const target of ["`README.md`", "`docs/guide/`", "`docs/guide/quick-start.md`", "`docs/roadmap.md`"]) {
      expect(documenter).toContain(target);
    }
  });
});

describe("FAC-006 the factory learns after every phase", () => {
  it("every PR format has a Lessons section", () => {
    expect(file("AGENTS.md")).toContain("## Lessons");
    expect(file(".claude/skills/git-pr-summary/template.md")).toContain("## Lessons");
    expect(file("ops/hermes-kanban/skills/command-center-worker/SKILL.md")).toContain("Lessons:");
  });

  it("the retro re-checks delivered work against the specs and reports spec and docs drift", () => {
    expect(tree).toContain(".claude/skills/retro/SKILL.md");
    const steward = file(".claude/agents/factory-steward.md");
    for (const step of ["**Spec drift**", "**Delivered work re-checked against the specs**", "**Docs drift**"]) {
      expect(steward).toContain(step);
    }
  });
});

describe("FAC-007 personal data never enters the repository", () => {
  it("the privacy rules and the redaction skill are in place", () => {
    expect(file(".claude/rules/tests.md")).toContain("**Synthetic data only**");
    expect(tree).toContain(".claude/skills/pii-sanitizer/SKILL.md");
    expect(file("CLAUDE.md")).toContain("The repo is public.");
  });
});

describe("FAC-008 the whole factory is described in one place", () => {
  it("every agent, skill, hook and rule in .claude/ is named in docs/specs/factory.md", () => {
    const spec = file("docs/specs/factory.md");
    const names = tree.flatMap((path) => {
      const agent = /^\.claude\/agents\/([\w-]+)\.md$/.exec(path)?.[1];
      const skill = /^\.claude\/skills\/([\w-]+)\/SKILL\.md$/.exec(path)?.[1];
      const hook = /^\.claude\/hooks\/([\w-]+)\.mjs$/.exec(path)?.[1];
      const rule = /^\.claude\/rules\/([\w-]+\.md)$/.exec(path)?.[1];
      // lib.mjs is the hooks' shared helper, not a hook.
      return [agent, skill, hook === "lib" ? undefined : hook, rule].filter((n): n is string => !!n);
    });
    expect(names.length).toBeGreaterThan(10);
    expect(names.filter((name) => !spec.includes(name))).toEqual([]);
  });
});
