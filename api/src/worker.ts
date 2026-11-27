import { createApp, Bindings } from "./app";

const app = createApp();

export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
