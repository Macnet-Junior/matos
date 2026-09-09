import path from "node:path";
import { defineConfig } from "vitest/config";

const defaultDb = path.resolve(
  __dirname,
  "../../packages/db/prisma/dev.db",
);
process.env.DATABASE_URL ??= `file:${defaultDb}`;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
