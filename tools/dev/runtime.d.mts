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
  reason: string | null;
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

export declare function recordingEnvironment(): RecordingEnvironment;
