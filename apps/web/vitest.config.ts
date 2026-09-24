import path from "node:path";
import { defineConfig } from "vitest/config";
import { isolatedDatabaseUrl, isolatedSuiteDatabasePath } from "./src/test/isolated-db";

const databaseUrl = isolatedDatabaseUrl(isolatedSuiteDatabasePath());
process.env.DATABASE_URL = databaseUrl;
process.env.MATOS_TEST_DB = "isolated";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    hookTimeout: 180_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: databaseUrl,
      MATOS_TEST_DB: "isolated",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
