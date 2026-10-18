import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4310",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev --workspace=docs",
      url: "http://127.0.0.1:4310",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run dev --workspace=vanilla",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
