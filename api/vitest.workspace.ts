import { defineWorkspace } from "vitest/config";

// Two projects, one `npm test -w api`:
// - workers: everything in test/, inside workerd with a local D1 (ADR 0002)
// - architecture: the dependency-cruiser check, on Node because it reads the file tree
export default defineWorkspace(["./vitest.config.ts", "./vitest.architecture.config.ts"]);
