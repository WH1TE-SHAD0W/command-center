import type { Bindings } from "../src/app";

declare module "cloudflare:test" {
  // The worker's bindings, as seen by `env` from "cloudflare:test".
  interface ProvidedEnv extends Bindings {}
}
