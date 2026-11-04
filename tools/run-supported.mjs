// Issue #505: the npm-script runtime selector. Every check script runs
// through this wrapper so ordinary checks use the declared runtime no matter
// which node started them — an agent never reconstructs a private PATH
// override, and a machine without the declared runtime installed gets a
// named, per-manager fix instead of a confusing failure deep in a suite.
// The declaration is the one authoritative source (.node-version, read by
// version managers and CI alike); this wrapper is its enforcement for the
// script path. Plain node, no dependencies, development-only.
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DECLARATION_FILE, declaredRuntimeVersion } from "./dev/runtime.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const USAGE =
  "Usage: node tools/run-supported.mjs [--root <checkout-dir>] [--print-runtime] <entry> [args...]\n" +
  "  <entry> is a script path relative to the checkout root, run under the declared runtime.";

const normalizeVersion = (version) => version.replace(/^v/, "");

// Where each supported version manager installs the declared version. The
// first existing `node` binary wins; an explicit FLOWSYNTH_NODE override
// answers before any layout scan.
export function candidateBinDirs(declared, home = os.homedir()) {
  const v = declared;
  return [
    path.join(home, ".local/share/mise/installs/node", v, "bin"),
    path.join(home, ".nvm/versions/node", `v${v}`, "bin"),
    path.join(home, ".local/share/fnm/node-versions", `v${v}-installation`, "bin"),
    path.join(home, ".fnm/node-versions", `v${v}-installation`, "bin"),
    path.join(home, ".volta/tools/image/node", v, "bin"),
    path.join(home, ".asdf/installs/nodejs", v, "bin"),
    path.join("/usr/local/n/versions/node", v, "bin"),
  ];
}

// The explicit override first, then the managers' layouts. Returns the binary
// path or a named error; the caller verifies the binary actually reports the
// declared version before trusting it.
export function locateDeclaredRuntime(declared, { home = os.homedir(), override, candidates } = {}) {
  if (override) return { bin: override };
  const dirs = candidates ?? candidateBinDirs(declared, home);
  for (const dir of dirs) {
    const bin = path.join(dir, "node");
    if (existsSync(bin)) return { bin };
  }
  return {
    error:
      `the declared runtime ${declared} is not installed — no version manager layout carries it.\n` +
      `  install it with your manager, then rerun:\n` +
      `    mise install node@${declared}\n` +
      `    nvm install ${declared}\n` +
      `    fnm install ${declared}\n` +
      `  or point FLOWSYNTH_NODE at its binary directly.`,
  };
}

// Verify a located binary reports the declared version before handing the
// entry to it — a lying or misconfigured binary is refused here, with the
// mismatch named.
function verifyBinary(bin, declared) {
  const probe = spawnSync(bin, ["-p", "process.version"], { encoding: "utf8" });
  if (probe.status !== 0 || probe.error) {
    return `FLOWSYNTH_NODE (${bin}) is not a runnable node binary${probe.error ? `: ${probe.error.message}` : ""}.`;
  }
  const reported = normalizeVersion(probe.stdout.trim());
  if (reported !== declared) {
    return `the selected binary (${bin}) reports ${probe.stdout.trim()}, not the declared ${declared} — fix FLOWSYNTH_NODE or install ${declared}.`;
  }
  return null;
}

export function main(argv) {
  const args = [...argv];
  let root = repoRoot;
  let printRuntime = false;
  while (args.length > 0 && args[0].startsWith("--")) {
    const flag = args.shift();
    if (flag === "--root") root = path.resolve(args.shift() ?? repoRoot);
    else if (flag === "--print-runtime") printRuntime = true;
    else {
      console.error(`Unknown argument: ${flag}\n${USAGE}`);
      return 1;
    }
  }
  const entry = args.shift();
  if (!printRuntime && entry === undefined) {
    console.error(USAGE);
    return 1;
  }

  const declared = declaredRuntimeVersion(root);
  if (declared === null) {
    console.error(`no runtime declaration: ${DECLARATION_FILE} not found in ${root} — the repository pins its supported Node runtime there.`);
    return 1;
  }
  if (!/^\d+\.\d+\.\d+$/.test(declared)) {
    console.error(`unsupported ${DECLARATION_FILE} content: "${declared}" — pin one concrete semver version.`);
    return 1;
  }

  const effective = normalizeVersion(process.version);
  let bin = process.execPath;
  if (effective !== declared) {
    const located = locateDeclaredRuntime(declared, { override: process.env.FLOWSYNTH_NODE });
    if ("error" in located) {
      console.error(`supported runtime mismatch: effective v${effective}, declared ${declared} (${DECLARATION_FILE}).`);
      console.error(located.error);
      return 1;
    }
    const invalid = verifyBinary(located.bin, declared);
    if (invalid !== null) {
      console.error(invalid);
      return 1;
    }
    bin = located.bin;
  }

  if (printRuntime) {
    // Self-demo: report the runtime the entry would run under, verified the
    // same way a re-exec is. Direct mode answers from the ambient process;
    // after selection, from the selected binary.
    console.log(bin === process.execPath ? process.version : spawnSync(bin, ["-p", "process.version"], { encoding: "utf8" }).stdout.trim());
    return 0;
  }

  const entryPath = path.join(root, entry);
  if (!existsSync(entryPath)) {
    console.error(`entry not found: ${entry} (resolved ${entryPath})`);
    return 1;
  }

  const binDir = path.dirname(bin);
  const env = { ...process.env };
  env.PATH = `${binDir}${path.delimiter}${env.PATH ?? ""}`;
  const ran = spawnSync(bin, [entryPath, ...args], { stdio: "inherit", env });
  if (ran.error) {
    console.error(`running ${entry} under ${bin} failed: ${ran.error.message}`);
    return 1;
  }
  return ran.status ?? 1;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(main(process.argv.slice(2)));
}
