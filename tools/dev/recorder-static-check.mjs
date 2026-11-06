// Issue #506: the recorder CLIs (tools/record-*.mjs) are plain .mjs —
// outside the root tsc program — so an undefined variable or a broken
// import could survive a green ordinary suite unexercised: nothing in
// `npm test` imports the recording entry points, and actually running
// them launches git, a Vite compile, and expensive walks. This gate
// checks the recorder scripts statically with TypeScript's JS checking
// (undefined references, unresolved modules, bad named imports, duplicate
// and syntax defects) without executing any of it. It runs as the second
// leg of `npm run check`, so ordinary CI rejects the defect before any
// walk. Plain JavaScript so the npm script runs under plain node; the
// TypeScript surface lives in recorder-static-check.d.mts.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const RECORDER_SCRIPTS = [
  "tools/record-century.mjs",
  "tools/record-later-eras.mjs",
  // Issue #507: the resumable job boundary and its worker — plain .mjs
  // outside tsc's program, so the gate covers them with the CLIs.
  "tools/dev/job-recorder.mjs",
  "tools/dev/job-worker.mjs",
  // Issue #509: the retained-recording profiler — the same plain-.mjs
  // tier, statically checked with the CLIs it shares the runtime with.
  "tools/record-profile.mjs",
];

const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// strict stays off on purpose: the criterion is undefined references and
// equivalent static defects, not full type coverage of untyped scripts —
// strict JS checking would demand JSDoc annotations across both recorders
// and churn them without adding a defect this tier cares about. With the
// typed surfaces (runtime.d.mts, vite, @types/node) in play, the checker
// still resolves every import and named export the recorders use.
const recorderOptions = (root) => ({
  // No explicit lib: the ES2022 target implies its default library, and
  // lib entries passed through the compiler API would need lib-file paths.
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  types: ["node"],
  typeRoots: [path.join(root, "node_modules", "@types")],
  allowJs: true,
  checkJs: true,
  strict: false,
  noEmit: true,
  skipLibCheck: true,
});

// Check the recorder scripts (paths relative to the checkout root, or
// absolute). `overrides` substitutes in-memory text for a file on disk —
// content-resolved for its own imports exactly as committed — so a test
// can prove a deliberate defect is refused without touching the tree.
export function checkRecorderScripts({ scripts = RECORDER_SCRIPTS, overrides = [], root = repoRoot } = {}) {
  const options = recorderOptions(root);
  const host = ts.createCompilerHost(options);
  const overridden = new Map(overrides.map((override) => [path.resolve(override.path), override.text]));
  const realGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const text = overridden.get(path.resolve(fileName));
    if (text === undefined) return realGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    return ts.createSourceFile(fileName, text, languageVersion, true);
  };
  const program = ts.createProgram({
    rootNames: scripts.map((script) => path.resolve(root, script)),
    options,
    host,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  return { ok: diagnostics.length === 0, diagnostics: ts.formatDiagnostics(diagnostics, host).trimEnd() };
}

const invokedDirectly = process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const result = checkRecorderScripts();
  if (!result.ok) {
    console.error(result.diagnostics);
    console.error(`recorder static gate failed: ${RECORDER_SCRIPTS.join(", ")}`);
    process.exit(1);
  }
  console.log(`recorder static gate ok: ${RECORDER_SCRIPTS.length} scripts, no static defects`);
}
