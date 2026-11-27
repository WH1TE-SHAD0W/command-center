// The combined Drizzle schema (ADR 0013): one re-export line per module, e.g.
//   export * from "./kitchen";
// Every module's tables live in their own file, src/schema/<module>.ts, with table names prefixed
// by the module (ADR 0010). No module schema exists yet (#17 adds the first).
export {};
