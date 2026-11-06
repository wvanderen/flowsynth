// Type surface for tools/dev/compile-engine.mjs — the implementation is
// plain JavaScript so the npm-script path runs under plain node; this
// declaration is what the TypeScript side compiles against.

/**
 * Compiles a recorder engine entry with Vite's real transforms and returns
 * the loaded module (the recorders' shared compile seam).
 */
export declare function compileEngine(entry: string, name: string): Promise<any>;
