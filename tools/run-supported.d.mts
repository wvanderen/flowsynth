// Type surface for tools/run-supported.mjs — the implementation is plain
// JavaScript so the npm scripts run under plain node; this declaration is
// what the TypeScript side (tests) compiles against.

export declare function candidateBinDirs(declared: string, home?: string): string[];

export declare function locateDeclaredRuntime(
  declared: string,
  options?: { home?: string; override?: string; candidates?: string[] },
): { bin: string } | { error: string };

export declare function main(argv: string[]): number;
