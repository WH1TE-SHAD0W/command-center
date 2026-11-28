/**
 * `workers-oauth-provider` logs one `console.warn` when its module loads (CIMD is off without the
 * `global_fetch_strictly_public` flag; we don't use CIMD). In `@cloudflare/vitest-pool-workers`
 * 0.6, console output in global scope sets a timer, which workerd forbids there, so the import
 * fails. This drops exactly that message and nothing else. Remove it once the pool is upgraded
 * (#36) if the newer pool tolerates it.
 */
const warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("CIMD (Client ID Metadata Document) is disabled")) {
    return;
  }
  warn(...args);
};
