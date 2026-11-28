// The combined Drizzle schema (ADR 0013): one re-export line per module. Every module's tables live
// in their own file, src/schema/<module>.ts, with table names prefixed by the module (ADR 0010).
export * from "./kitchen";
