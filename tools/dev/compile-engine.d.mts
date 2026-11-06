// Type surface for tools/dev/compile-engine.mjs — the implementation is
// plain JavaScript so the npm-script path runs under plain node; this
// declaration is what the TypeScript side compiles against.

/**
 * Compiles a recorder engine entry with Vite's real transforms and returns
 * the loaded module (the recorders' shared compile seam).
 */
export declare function compileEngine(entry: string, name: string): Promise<any>;

/**
 * Compiles into a caller-owned directory and returns the bundle path —
 * the job supervisor's seam (issue #507): workers import the same bundle
 * the supervisor certified.
 */
export declare function compileEngineTo(entry: string, name: string, outDir: string): Promise<string>;
