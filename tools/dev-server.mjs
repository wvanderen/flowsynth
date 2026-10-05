// Issue #253: worktree-aware development launcher (`npm run dev`).
//
// Starts the Vite dev server for the checkout it runs in, on an available
// port — sibling worktrees therefore never collide on 5173 and each serves
// its own app — then prints the actual URL beside the absolute worktree
// path and the commit the server reports for itself. Server output is teed
// to .dev/server.log so it stays accessible after the fact.
import { createServer } from "vite";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const logDir = path.join(process.cwd(), ".dev");
const logFile = path.join(logDir, "server.log");

// Vite's logger is console-bound; tee every line it emits into the
// worktree-local log so a crashed or backgrounded server leaves its output
// readable. Failures to log must never take the server down.
function teeServerLog(server, logFile) {
  try {
    const logger = server.config.logger;
    for (const level of ["info", "warn", "warnOnce", "error"]) {
      const original = logger[level];
      if (typeof original !== "function") continue;
      logger[level] = (...args) => {
        try {
          const line = args
            .filter((arg) => typeof arg === "string")
            .join(" ")
            .replace(/\x1B\[[0-9;]*m/g, "");
          if (line) fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
        } catch {
          // Logging is best-effort.
        }
        original(...args);
      };
    }
  } catch {
    // Logging is best-effort.
  }
}

async function main() {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logFile, `\n=== launch ${new Date().toISOString()} ===\n`);

  const server = await createServer();
  teeServerLog(server, logFile);
  await server.listen();

  const url = server.resolvedUrls?.local[0];

  // Ask the running server for its own provenance; this is the same check
  // the browser performs, done once at launch so a mismatch surfaces before
  // any evidence is captured from the tab.
  let provenance = null;
  try {
    if (url) provenance = await fetch(new URL("-/dev/provenance", url)).then((r) => r.json());
  } catch {
    provenance = null;
  }

  console.log("\nFlowSynth dev server\n");
  console.log(`  worktree  ${provenance?.worktree ?? process.cwd()}`);
  if (provenance?.branch) console.log(`  branch    ${provenance.branch}`);
  if (provenance?.commit) console.log(`  commit    ${provenance.commit}`);
  console.log(`  url       ${url ?? "(no local URL resolved)"}`);
  console.log(`  log       ${logFile}`);
  if (!provenance?.commit) {
    console.log(
      "\n  ! The server did not confirm its provenance (GET /-/dev/provenance).",
    );
    console.log("  ! Verify manually before capturing any visual evidence from this URL.");
  }
  console.log("\n  Evidence rules: docs/agents/visual-evidence.md\n");
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
