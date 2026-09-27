# Stale tabs never overwrite a newer save

Two tabs of the same browser share one localStorage save slot, and every write path — the 5 s boundary throttle, the hidden transition, the unload — unconditionally replaced the stored file with the tab's in-memory state. A tab returning from the background, its memory predating the other tab's progress, silently clobbered the newer save (issue #128, 2026-09-27).

## Decision

- **Newer-save-wins, enforced at the writer.** Every save first reads the stored file's `savedAt`. A tab writes only when the stored save is not newer than the newest save the tab itself has incorporated — by loading at boot, writing, or adopting. A refused write leaves the newer file standing.
- **`savedAt` is the conflict signal; no schema change.** The stamp the engine already persists on every save orders the slot.
- **Convergence rides what exists.** The `storage` event (fired in every tab but the writer) tells a tab its slot moved: outside a live session the tab adopts the newer save at once; mid-flow the tab keeps its live memory, and the next visible return — or bfcache restore — adopts the newer save through the one resume/reconcile path (ADR-0019), the absence reconciling as always. Explicit import and hard reset force their write: a deliberate, visible choice outranks the stamp.
- **A broken stamp never blocks saving.** A stored file that is absent, unparseable, or carries no readable `savedAt` — and an exact timestamp tie — always permits the write. A refused save must never become a bricked save; a version-rejected file records its stamp at rejection so the fresh save can replace it.

## Consequences

- **A refused write only refuses.** `save()` never adopts as a side effect of saving: convergence happens where it is safe — the storage event outside a live session, the return doors (visibility return, bfcache restore) everywhere — so fresh, on-screen progress is never silently reverted mid-gesture.
- **The stamp is claimed only after the slot accepted the write.** A failed write (private browsing, full storage) never reads as incorporated, or later external writes would go unnoticed.
- Two tabs running live sessions at once still share one session: the visible tab's memory is canonical while a lagging tab's writes are refused until its next return. Richer conflict UX (choosing a version, merging) stays out of scope.
- No transport beyond the `storage` event — no `BroadcastChannel`, no lock files. The read-then-write window is unguarded, so same-instant concurrent writers remain last-writer-wins; a tab frozen so hard it misses both the events and its own timers converges at its next return.
