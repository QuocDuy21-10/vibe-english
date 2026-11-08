import { defineConfig, devices } from "@playwright/test";

// Responsive E2E suite. Runs the app against local Firebase emulators only (see e2e/emulator.ts).
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  workers: 4,
  retries: 1,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone SE (3rd gen)"] } },
  ],
  webServer: [
    {
      command: "npx firebase emulators:start --config firebase.e2e.json --only auth,firestore --project demo-vibe-english",
      url: "http://127.0.0.1:9199",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npx vite --port=3100 --strictPort",
      url: "http://localhost:3100",
      env: { VITE_USE_FIREBASE_EMULATORS: "true" },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
