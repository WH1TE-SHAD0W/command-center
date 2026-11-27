import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const apiRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    name: "architecture",
    root: apiRoot,
    environment: "node",
    include: ["test/architecture/**/*.test.ts"],
    provide: { apiRoot },
  },
});
