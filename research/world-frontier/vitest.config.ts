import { defineConfig } from "vitest/config";

// Research-only runner for the #424 re-derivation's current-engine walk.
// The repo's default projects deliberately exclude research/, so this file
// exists to run the entry-pacing fixture explicitly:
//
//   npx vitest run --config research/world-frontier/vitest.config.ts
//
// It shares no fixtures with the production suite and asserts no tuning
// gates; it records observations the findings cite.
export default defineConfig({
  test: {
    name: "research",
    include: ["research/world-frontier/**/*.research.test.ts"],
    environment: "node",
    pool: "forks",
    isolate: true,
  },
});
