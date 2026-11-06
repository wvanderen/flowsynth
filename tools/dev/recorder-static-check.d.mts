// Type surface for tools/dev/recorder-static-check.mjs — the
// implementation is plain JavaScript so the npm script runs under plain
// node; this declaration is what the TypeScript side (tests) compiles
// against.

/** The recorder CLI scripts the static gate checks, relative to the checkout root. */
export declare const RECORDER_SCRIPTS: readonly string[];

export interface RecorderCheckOverride {
  /** Absolute path, or relative to the checkout root. */
  path: string;
  /** The in-memory text checked in place of the file on disk. */
  text: string;
}

export interface RecorderCheckOptions {
  /** Scripts to check; defaults to RECORDER_SCRIPTS. */
  scripts?: readonly string[];
  /** In-memory content substitutions (the defect-injection seam for tests). */
  overrides?: readonly RecorderCheckOverride[];
  /** Checkout root for relative paths and module resolution; defaults to this checkout. */
  root?: string;
}

export interface RecorderCheckResult {
  /** True when the program carries no diagnostics. */
  ok: boolean;
  /** tsc-formatted diagnostics, empty when ok. */
  diagnostics: string;
}

/**
 * Statically checks the recorder scripts for undefined references and
 * equivalent static defects without executing them.
 */
export declare function checkRecorderScripts(options?: RecorderCheckOptions): RecorderCheckResult;
