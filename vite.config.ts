/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { defaultTheme, themeCss } from "./src/ui/theme";
import { devProvenance } from "./tools/dev/provenance";

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
        server.middlewares.use("/-/dev/provenance", (_req, res) => {
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
    include: ["src/**/*.test.ts", "tools/**/*.test.ts"],
    environment: "node",
  },
});
