// Stop / SubagentStop gate — translation of the workshop's agentStop `dotnet test` hook.
// Runs only when api/ code has uncommitted changes. On failure it exits 2 so the agent is told to
// keep working; `stop_hook_active` prevents an endless loop.
//
// It verifies the checkout the session works in: the git top level of the hook input's `cwd`
// (a worktree under .claude/worktrees/ is its own checkout), not $CLAUDE_PROJECT_DIR, which is
// the main checkout. Vitest runs with `--run`; without it, it stays in watch mode and never exits.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, isAbsolute } from "node:path";
import { readInput } from "./lib.mjs";

const input = await readInput();
if (input.stop_hook_active) process.exit(0);

const start = input.cwd || process.cwd();
let root;
try {
  root = execSync("git rev-parse --show-toplevel", { cwd: start, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  process.exit(0); // not a git checkout or git missing: nothing to verify
}
const sh = (c) => execSync(c, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 170_000 });

let changed = "";
try {
  changed = sh("git status --porcelain -- api web");
} catch {
  process.exit(0);
}
const files = changed.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
const apiChanged = files.some((f) => f.startsWith("api/"));
if (!apiChanged) process.exit(0);

const MOCKER_ERROR = "getMockerRegistry(...).getById is not a function";
const warnings = [];
const checks = [["typecheck (api)", "npm run -s typecheck -w api"]];
try {
  const pkg = JSON.parse(readFileSync(join(root, "api", "package.json"), "utf8"));
  if (pkg.scripts?.test) {
    const trap = foreignMocker(root);
    if (trap) {
      warnings.push(
        `Stop hook: api tests NOT run in ${root}. This checkout sits inside another checkout, and ` +
          `\`@vitest/mocker\` resolves from the outer one (${trap}), so inside workerd every test ` +
          `fails with "${MOCKER_ERROR}". That is the environment, not the code. Run the tests in a ` +
          `checkout outside the repository (e.g. \`git worktree add ../command-center-<N>\`), or ` +
          `report them as unverified.`,
      );
    } else {
      checks.push(["tests (api)", "npm test -s -w api -- --run"]);
    }
  }
} catch {}

for (const [name, cmd] of checks) {
  try {
    sh(cmd);
  } catch (e) {
    const raw = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
    let out = raw.trim().split("\n").slice(-40).join("\n");
    if (raw.includes(MOCKER_ERROR)) {
      out +=
        `\n\nNote: "${MOCKER_ERROR}" means @vitest/mocker resolved from another checkout's ` +
        `node_modules (a worktree nested inside the repository). It is the environment, not the code.`;
    }
    process.stderr.write(
      `Verification failed in ${root} — ${name} (\`${cmd}\`). Fix it before finishing, or report the failure verbatim:\n${out}\n`,
    );
    process.exit(2);
  }
}
if (warnings.length) process.stdout.write(JSON.stringify({ systemMessage: warnings.join("\n") }));
process.exit(0);

// Walks up from api/ the way Node resolves a bare `@vitest/mocker` import. Returns the package
// path when the first match lies outside `root` (the nested-worktree trap), otherwise null.
function foreignMocker(root) {
  let dir = join(root, "api");
  for (;;) {
    const pkg = join(dir, "node_modules", "@vitest", "mocker", "package.json");
    if (existsSync(pkg)) {
      const rel = relative(root, pkg);
      return rel.startsWith("..") || isAbsolute(rel) ? pkg : null;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
