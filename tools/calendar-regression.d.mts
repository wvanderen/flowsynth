// Type surface for tools/calendar-regression.mjs — the implementation is
// plain JavaScript so the runner runs under plain node; this declaration is
// what the TypeScript side (tests) compiles against.

/** The targeted calendar-sensitive files, run under every declared zone. */
export declare const CALENDAR_TEST_FILES: readonly string[];

/** The declared calendar bases: UTC and a DST-observing zone. */
export declare const CALENDAR_ZONES: readonly string[];

export declare function main(): number;
