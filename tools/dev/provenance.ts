import { execFileSync } from "node:child_process";

// Issue #253: development-only provenance for the serving checkout — the
// absolute worktree path, branch, and current commit. The dev server serves
// it at /-/dev/provenance so browser evidence can be tied to the exact
// checkout being reviewed. Nothing here ever runs in a production build.

export interface DevProvenance {
  app: string;
  worktree: string;
  branch: string | null;
  commit: string | null;
}

const git = (args: string[], cwd: string): string | null => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

// Recomputed per call, not cached at server start: a server restarted after
// a checkout change — or even one that keeps running across one — reports
// the commit now checked out, never a stale one.
export function devProvenance(root: string = process.cwd()): DevProvenance {
  // --show-toplevel resolves to this worktree's root, not the main checkout.
  const worktree = git(["rev-parse", "--show-toplevel"], root) ?? root;
  return {
    app: "flowsynth",
    worktree,
    branch: git(["branch", "--show-current"], worktree),
    commit: git(["rev-parse", "HEAD"], worktree),
  };
}
