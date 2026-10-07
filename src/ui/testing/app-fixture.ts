import { readFileSync } from "node:fs";
import { App } from "../app";
import type { SignalChannels } from "../signals";

const html = readFileSync("index.html", "utf8");
// The test constructs App directly: keep the production skeleton, but do
// not execute the browser entry point as a second, unowned instrument.
const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

export function createAppFixture() {
  const apps = new Set<App>();
  return {
    boot(channels?: SignalChannels, dev = false): App {
      document.body.innerHTML = body;
      const els: Record<string, HTMLElement> = {};
      for (const id of ["console-session", "console-apps", "board-tools", "thumb-bar", "grid", "status", "modal", "modal-content"]) {
        const element = document.getElementById(id);
        if (element) els[id] = element;
      }
      const app = new App(els, dev, channels);
      apps.add(app);
      return app;
    },
    release(): void {
      for (const app of apps) app.dispose();
      apps.clear();
      document.body.replaceChildren();
      document.body.className = "";
      document.title = "FlowSynth";
      delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
      delete (document as unknown as { visibilityState?: unknown }).visibilityState;
      localStorage.clear();
    },
  };
}
