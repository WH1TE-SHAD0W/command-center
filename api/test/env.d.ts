import type { D1Migration } from "cloudflare:test";
import type { Bindings } from "../src/app";

declare module "cloudflare:test" {
  // The worker's bindings, as seen by `env` from "cloudflare:test".
  interface ProvidedEnv extends Bindings {
    TEST_MIGRATIONS: D1Migration[];
  }
}
