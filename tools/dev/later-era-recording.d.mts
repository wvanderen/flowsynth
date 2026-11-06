// Type surface for tools/dev/later-era-recording.mjs — the later-era
// recording domain's adapter half (issue #507): publication and
// slice-shape verification over the job's persisted units.
import type { JobPlan } from "./job-recorder.mjs";

export declare const PROBE_EVIDENCE_PATH: string;

export declare function slicePath(minutes: number, policy: string): string;

/** The slice-shape checks both the job's publication and composition enforce. */
export declare function assertSliceRows(
  m: { LATER_ERA_SEEDS: readonly number[]; assertLaterEraRowCore: (row: unknown) => void },
  rows: Array<Record<string, unknown>>,
  minutes: number,
  policy: string,
): void;

export declare function unitProvenanceOf(unitsById: Record<string, any>): Record<string, {
  recordingCommit: string;
  recordingEnvironment?: Record<string, unknown>;
}>;

export interface PublishContext {
  commit: string;
  dir: string;
}

export interface PublicationGroup {
  id: string;
  unitIds: string[];
  publish: (unitsById: Record<string, any>, ctx: PublishContext) => Promise<string>;
}

export declare function sliceGroup(
  m: any,
  source: unknown,
  slice: [number, string],
  paths?: { slice?: string },
): PublicationGroup;

export declare function sliceGroups(m: any, source: unknown): PublicationGroup[];

export declare function probeGroup(
  m: any,
  source: unknown,
  paths?: { probe?: string },
): PublicationGroup;

/**
 * Merges the persisted plan's derived units back into a rebuilt plan,
 * keeping them exactly while their parent's identity is unchanged.
 */
export declare function mergedPlanUnits(
  dir: string,
  m: { laterEraUnitIdentity: (descriptor: unknown) => unknown },
  builder: { units: JobPlan["units"] },
): Promise<JobPlan["units"]>;
