import type { D1Migration } from "cloudflare:test";
import type { Bindings } from "../src/app";

declare global {
  namespace Cloudflare {
    // The worker's bindings, as seen by `env` from "cloudflare:test" (typed as `Cloudflare.Env`).
    interface Env extends Bindings {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
