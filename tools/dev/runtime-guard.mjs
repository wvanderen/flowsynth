// Issue #505: the suite's runtime guard — vitest globalSetup. Before any
// test file loads, the checkout's supported-runtime declaration
// (.node-version) is compared against the running runtime, and the UI
// harness's storage capability is probed. A mismatch fails the whole run in
// milliseconds with the fix in the message, instead of a wall of fixture
// failures or, worse, a green suite whose numbers came from an environment
// the repository does not support. The npm scripts select the declared
// runtime through tools/run-supported.mjs, so this guard only fires for a
// bare npx/node invocation — exactly the case it exists to catch.
import { checkRuntimeEnvironment, probeStorageCapability } from "./runtime.mjs";

export default async function runtimeGuard() {
  const storage = await probeStorageCapability();
  const report = checkRuntimeEnvironment({ storage });
  if (!report.ok) {
    throw new Error(
      [
        `runtime preflight failed — the suite would not run correctly in this environment.`,
        `  declared ${report.declared ?? "(missing)"} · effective ${report.effective} · timezone ${report.timeZone} · storage ${report.storage.ok ? "ok" : "unavailable"}`,
        ...report.diagnostics.flatMap((block) => block.split("\n")),
        `  (bare npx/node invocations must select the declared runtime first; the npm scripts do it automatically.)`,
      ].join("\n"),
    );
  }
}
