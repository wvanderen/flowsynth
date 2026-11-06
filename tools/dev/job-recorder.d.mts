// Type surface for tools/dev/job-recorder.mjs — the implementation is
// plain JavaScript so the npm-script path runs under plain node; this
// declaration is what the TypeScript side (tests) compiles against.
// Issue #507: the evaluation's one recording boundary — persistence,
// validity decisions, and job status.

export declare const WORKER_SCRIPT: string;
export declare const DEFAULT_JOBS: number;
export declare const DEFAULT_WORKER_MEMORY_MB: number;

export declare function unitPath(dir: string, unitId: string): string;
export declare function lockPath(dir: string): string;
export declare function statusPath(dir: string): string;
export declare function planPath(dir: string): string;
export declare function logsPath(dir: string): string;

/** Refuses by name when a live supervisor holds the job's lock. */
export declare function assertNoLiveSupervisor(dir: string): Promise<void>;

export interface SupervisorLock {
  pid: number;
  startedAt: string;
}

/**
 * One supervisor at a time per job directory: a live lock refuses by
 * name, a stale one (a killed supervisor) is taken over.
 */
export declare function acquireSupervisorLock(dir: string): Promise<SupervisorLock>;

/** The job's plan: scope, bundle path, commit, and the unit descriptors. */
export interface JobPlan {
  scope: string;
  bundle: string;
  commit: string;
  units: Array<{
    id: string;
    key: Record<string, unknown> & { kind: string };
    recipe: unknown;
    forward: Record<string, unknown> | null;
    deps: string[];
  }>;
}

/** Creates the job directory layout and writes the plan atomically. */
export declare function prepareJobDir(dir: string, plan: JobPlan): Promise<void>;

export declare function readPlan(dir: string): Promise<JobPlan>;

/** Appends derived units to the plan; returns only the fresh ones. */
export declare function appendDerivedUnits(dir: string, descriptors: JobPlan["units"]): Promise<JobPlan["units"]>;

export type ScannedUnitState = "valid" | "missing" | "corrupt" | "stale-identity";

export interface ScannedUnit {
  descriptor: JobPlan["units"][number];
  state: ScannedUnitState;
  reason?: string;
  /** The parsed payload, carried only for valid units. */
  payload?: any;
}

/**
 * Classifies every planned unit's stored state against the current
 * identity; corrupt or duplicate-shaped evidence is preserved under
 * logs/corrupt/ and re-executes.
 */
export declare function scanUnits(
  dir: string,
  plan: JobPlan,
  adapter: Pick<SupervisorAdapter, "identityOf" | "validateUnit">,
): Promise<ScannedUnit[]>;

export declare function logEvent(dir: string, line: string): Promise<void>;

export interface JobStatus {
  scope: string;
  /** "running" | "complete" | "failed" | "cancelled" */
  status: string;
  options: { jobs: number; workerMemoryBudgetMb: number; notify: string | null; detached: boolean };
  supervisor: { pid: number; startedAt: string; node: string };
  units: Record<string, {
    state: "pending" | "running" | "done" | "failed";
    attempts: number;
    error?: string | null;
    startedAt?: string;
    finishedAt?: string;
    elapsedMs?: number;
    peakRssKb?: number;
  }>;
  published: Record<string, { path: string; at: string }>;
  notification: { command: string; exitCode: number | null; error?: string; stdout?: string; stderr?: string } | null;
  startedAt: string;
  resumedAt: string;
  updatedAt: string;
  terminalAt: string | null;
}

export declare function readJobStatus(dir: string): Promise<JobStatus>;
export declare function readJobStatusIfAny(dir: string): Promise<JobStatus | null>;

/** The human summary the status command prints. */
export declare function formatStatus(dir: string, status: JobStatus): string;

export interface GroupContext {
  descriptors: Map<string, JobPlan["units"][number]>;
  validIds: Set<string>;
}

export interface SupervisorGroup {
  id: string;
  /** Static unit ids, or a resolver evaluated against the current plan. */
  unitIds: string[] | ((ctx: GroupContext) => string[]);
  /** Optional extra readiness gate (e.g. a group not publishable before its derive pass). */
  ready?: (ctx: GroupContext) => boolean;
  publish: (unitsById: Record<string, any>, ctx: { commit: string; dir: string }) => Promise<string>;
}

export interface SupervisorAdapter {
  identityOf: (descriptor: JobPlan["units"][number]) => unknown;
  validateUnit: (descriptor: JobPlan["units"][number], payload: any) => void;
  /** When set, this unit's landing triggers one derive pass. */
  deriveFrom?: string;
  derive?: (parentPayload: any) => JobPlan["units"] | Promise<JobPlan["units"]>;
  groups?: SupervisorGroup[];
}

export interface SupervisorOptions {
  jobs?: number;
  workerMemoryBudgetMb?: number;
  notify?: string | null;
  detached?: boolean;
  /** A lock acquired before compilation by the calling CLI. */
  lock?: SupervisorLock;
}

export interface SupervisorResult {
  outcome: "complete" | "failed" | "cancelled";
  publishError: string | null;
  cancelled: string | null;
}

/** Runs the job to a terminal state (see the module header for semantics). */
export declare function runSupervisor(
  dir: string,
  plan: JobPlan,
  adapter: SupervisorAdapter,
  options?: SupervisorOptions,
): Promise<SupervisorResult>;

/** Spawns the detached supervisor and waits for its live pid in the status. */
export declare function launchDetachedSupervisor(options: {
  argv: string[];
  dir: string;
  timeoutMs?: number;
}): Promise<{ pid: number; status: JobStatus }>;

/** Parses and validates --jobs/--worker-mb once for the CLI sites, with defaults. */
export declare function resolveJobBudgets(
  jobsArg: string | number | undefined,
  workerMbArg: string | number | undefined,
): { jobs: number; workerMemoryBudgetMb: number };
