/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { defaultTheme, themeCss } from "./src/ui/theme";
import { devProvenance } from "./tools/dev/provenance.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    {
      // Issue #253: development-only provenance at /-/dev/provenance, so a
      // browser can confirm which worktree and commit a preview serves
      // before evidence is captured from it. configureServer exists only on
      // the dev server — never in vite build or vite preview — so production
      // artifacts neither contain nor serve the endpoint.
      name: "flowsynth-dev-provenance",
      configureServer(server) {
        // Unmounted on purpose: connect's use(path) prefix-matches only at a
        // "/" boundary and would hand /-/dev/provenanceX to the SPA fallback.
        // Registered bare, the route is exact and everything else — methods
        // included — 404s rather than leaking provenance.
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? "";
          if (!url.startsWith("/-/dev/provenance")) {
            next();
            return;
          }
          if (req.method !== "GET" || url !== "/-/dev/provenance") {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(devProvenance(), null, 2));
        });
      },
    },
    {
      // The ADR-0016 token table is data (src/ui/theme.ts), so the page's
      // custom properties are injected from it into <head> — before first
      // paint, in dev and build alike. The stylesheet never holds colors.
      name: "flowsynth-theme-tokens",
      transformIndexHtml() {
        return [{ tag: "style", children: themeCss(defaultTheme), injectTo: "head" }];
      },
    },
  ],
  test: {
    // Issue #505: the supported-runtime guard runs before any test file —
    // a wrong runtime or a broken UI-storage capability fails the run
    // immediately with the fix, instead of deep fixture failures.
    globalSetup: "./tools/dev/runtime-guard.mjs",
    projects: [
      {
        extends: true,
        test: {
          name: "engine",
          include: ["src/engine/**/*.test.ts", "tools/**/*.test.ts"],
          environment: "node",
          pool: "forks",
          isolate: true,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          include: ["src/ui/**/*.test.ts"],
          environment: "node",
          pool: "threads",
          isolate: true,
          // One worker at a time bounds DOM memory (vitest 4 spelling of
          // the old poolOptions.threads.{min,max}Threads = 1).
          maxWorkers: 1,
        },
      },
    ],
  },
});
