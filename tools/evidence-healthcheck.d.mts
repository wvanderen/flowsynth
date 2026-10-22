// Type surface for tools/evidence-healthcheck.mjs — the implementation is
// plain JavaScript so the health check runs under plain node; this
// declaration is what the TypeScript side (tests) compiles against.

export declare const SERVER: "server-provenance";
export declare const VISIBILITY: "browser-visibility";
export declare const SNAPSHOT: "browser-snapshot";
export declare const VIEWPORT: "browser-viewport";

export declare const RETRY_BUDGET: string;

export interface Viewport {
  width: number;
  height: number;
}

export interface RecoveryPlan {
  cls: string;
  observed: string[];
  recovery: string[];
  budget: string;
  exhausted: string[];
}

export declare function classifyServerFailure(reason: string): string;

export declare function parseViewport(spec: string | undefined): Viewport | { error: string } | null;

export declare function recoveryPlan(failureClass: string, viewport?: Viewport | null): RecoveryPlan;

export declare function resumeSteps(viewport?: Viewport | null): string[];

export declare function browserChecks(viewport?: Viewport | null): string[];

export declare function runHealthcheck(argv: string[]): Promise<number>;
