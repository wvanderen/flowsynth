/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { defaultTheme, themeCss } from "./src/ui/theme";

export default defineConfig({
  base: "./",
  plugins: [
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
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
