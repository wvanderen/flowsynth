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

export interface RecordingInput {
  path: string;
  recording: {
    source: unknown;
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
