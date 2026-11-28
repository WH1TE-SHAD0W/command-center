// Architecture check (ADR 0011 rule 3): no module imports another module's files.
// It runs as part of `npm test -w api` through test/architecture/architecture.test.ts.
//
// A module "<m>" owns `src/<folder>/<m>.ts` and anything under `src/<folder>/<m>/`
// for each folder below. Core files (app.ts, routes.ts, modules.ts, events/,
// enums/, and schema/index.ts, the combined schema of ADR 0013) are not module
// files, so modules may import them and they may import modules.

const MODULE_FOLDERS = "(?:controllers|services|schema|mcp|listeners|validation)";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-module",
      comment:
        "A module's files must not import another module's files (ADR 0011 rule 3). " +
        "Talk through events/ instead, or move shared code to a core file.",
      severity: "error",
      from: {
        path: `(?:^|/)src/${MODULE_FOLDERS}/([^/.]+)`,
        // The combined schema re-exports every module's schema file (ADR 0013).
        pathNot: "(?:^|/)src/schema/index\\.ts$",
      },
      to: {
        path: `(?:^|/)src/${MODULE_FOLDERS}/`,
        pathNot: `(?:^|/)src/${MODULE_FOLDERS}/$1(?:[./]|$)`,
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Type-only imports couple modules too, so check them as well.
    tsPreCompilationDeps: true,
  },
};
