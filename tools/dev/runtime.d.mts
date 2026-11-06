// Type surface for tools/dev/runtime.mjs — the implementation is plain
// JavaScript so the runtime preflight and the npm-script wrapper run under
// plain node; this declaration is what the TypeScript side (tests) compiles
// against.

export declare const DECLARATION_FILE: string;

export interface EffectiveRuntime {
  version: string;
  timeZone: string;
  utcOffsetMinutes: number;
}

export interface RuntimeProbeResult {
  ok: boolean;
  detail: string;
}

export interface RuntimeReport {
  /** The declared version line from .node-version, null when none is found. */
  declared: string | null;
  /** The effective runtime, e.g. "v22.23.4". */
  effective: string;
  /** The host's IANA zone — gameplay's calendar basis, reported not assumed. */
  timeZone: string;
  utcOffsetMinutes: number;
  storage: RuntimeProbeResult;
  ok: boolean;
  /** "missing-declaration" | "bad-declaration" | "version-mismatch" | "storage-unavailable" | null */
  reason: "missing-declaration" | "bad-declaration" | "version-mismatch" | "storage-unavailable" | null;
  /** Actionable fix lines; every refusal names the fix. */
  diagnostics: string[];
}

export interface RecordingEnvironment {
  node: string;
  timeZone: string;
  utcOffsetMinutes: number;
}

export declare function declaredRuntimeVersion(root?: string): string | null;

export declare function effectiveRuntime(): EffectiveRuntime;

export declare function probeStorageCapability(): Promise<RuntimeProbeResult>;

export declare function checkRuntimeEnvironment(input?: {
  root?: string;
  declared?: string | null;
  effective?: EffectiveRuntime;
  storage?: RuntimeProbeResult;
}): RuntimeReport;

export declare function normalizeVersion(version: string): string;

export declare function requireRuntimeEnvironment(root?: string): Promise<void>;

/** The checkout root, derived from this module's own location. */
export declare const REPO_ROOT: string;

export interface RecordingInput {
  path: string;
  recording: {
    source: unknown;
    /** "smoke" marks smoke-tier evidence; calibration slices carry no tier. */
    tier?: string;
    recordingCommit?: string;
    recordingEnvironment?: RecordingEnvironment;
    minutes?: number;
    policy?: string;
    variant?: string;
  };
}

export declare function composeRecordingPayload<T extends object>(payload: T, inputs: RecordingInput[]): T & {
  compositionEnvironment: RecordingEnvironment;
  recordingInputs: Array<RecordingInput["recording"] & { path: string }>;
};

export declare function recordingEnvironment(): RecordingEnvironment;

/** A recording's payload with `recordingEnvironment` attached — every balance writer composes through this. */
export declare function recordingPayload<T extends object>(payload: T): T & { recordingEnvironment: RecordingEnvironment };

export interface SmokeRootOptions {
  /** Environment read for FLOWSYNTH_SMOKE_OUTPUT; defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Where a relative FLOWSYNTH_SMOKE_OUTPUT resolves from; defaults to process.cwd(). */
  cwd?: string;
  /** The checkout smoke output must stay outside of. */
  repoRoot?: string;
  /** Where temporary roots are created; defaults to the OS temp dir. */
  tmp?: string;
}

/**
 * The smoke tier's output root (issue #506): a fresh temporary directory
 * per invocation by default, or the validated FLOWSYNTH_SMOKE_OUTPUT —
 * created when absent, refused when not a directory or inside the checkout
 * after canonicalizing symlinks and existing ancestors.
 */
export declare function resolveSmokeRoot(prefix: string, options?: SmokeRootOptions): Promise<string>;

/** Cheap early refusal when a path exists; publication must still use writeSmokeArtifact. */
export declare function refuseExistingArtifact(filePath: string, what: string): Promise<void>;

/** Exclusively creates JSON output; a concurrent publisher or existing symlink is refused by name. */
export declare function writeSmokeArtifact(filePath: string, payload: unknown, what: string): Promise<void>;

export interface ReadRecordingOptions {
  /** What the file is, used in every refusal message. */
  what?: string;
  /** The actionable fix appended to a missing-input refusal. */
  remedy?: string;
}

/**
 * Reads and parses a recorded JSON input, refusing a missing file with its
 * remedy and invalid JSON with the path named.
 */
export declare function readRecordingFile(filePath: string, options?: ReadRecordingOptions): Promise<any>;

/** Refuses by name when the recorded source differs from what this checkout compiles. */
export declare function assertSameCompiledSource(recordedSource: unknown, source: unknown, label: string): void;

/** Refuses when the recording is not smoke-tier evidence. */
export declare function assertSmokeTier(recorded: unknown, label: string): void;

/** Refuses when the recording is smoke-tier evidence. */
export declare function assertNotSmokeTier(recorded: unknown, label: string): void;

/**
 * Serializes, writes a uniquely named temporary sibling, fsyncs, then
 * renames over the target (issue #507): the target only ever changes by
 * one atomic rename, so any reader — or a kill at any point — sees the
 * previous bytes or the complete new ones, never a partial write that
 * could pass for completed evidence.
 */
export declare function writeJsonAtomic(filePath: string, payload: unknown): Promise<void>;

/**
 * Removes a directory's stale atomic-write temporaries; only called while
 * the caller holds the directory's supervision lock.
 */
export declare function clearStaleTemporaries(directory: string): Promise<void>;
