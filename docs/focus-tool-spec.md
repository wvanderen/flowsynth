# FlowSynth focus-tool spec

Trusted session accounting, end-of-target signals, freeform targets, the free-apps opening, history, and reflection — assembled for implementation.

**Status**: produced by the focus-tool elevation map ([issue #68](https://github.com/wvanderen/flowsynth/issues/68)); every decision below is final for this effort and traceable to its deciding ticket. Exact numbers are **provisional tuning** unless a source says otherwise. Companion records: [ADR-0019](adr/0019-open-the-focus-apps-free-and-account-sessions-by-trust.md) (supersessions) and the amended `CONTEXT.md` (glossary). Where this spec and an ADR disagree, the ADR wins; where both are silent, consult the linked ticket. It extends the [redesign spec](redesign-spec.md) and supersedes only what its §11 ledger lists.

---

## 1. Session accounting: the trust model

*Decided by [Trust and honesty accounting: the credited-time seam, #70](https://github.com/wvanderen/flowsynth/issues/70), on browser facts from [the research ticket, #69](https://github.com/wvanderen/flowsynth/issues/69).*

**The law: away trust runs to the plan; presence is always trusted.** Planned sessions accrue unconditionally up to their planned target — the old confirm-or-discard reconcile dialog is gone. Only away time past the target is provisional. Open-ended sessions trust present time and make all away time provisional, save brief absences.

### Measurement — events, never ticks

- Presence is `visibilityState === "visible"`; everything else is away. Focus loss alone is not away.
- At every boundary — `visibilitychange`, `focus`, `pageshow`/`resume`, every timer wake-up — the wall-clock delta since the last boundary is classified by the presence state that held during it, and the whole simulation (board + session clock) advances by that delta. The board catches up at full rate after a hidden stretch. This extends the existing `lastWall`/save-on-hidden architecture.
- **Never accrue by tick count** — throttled tabs tick ~1/s hidden and ~1/min in Chrome after five minutes (§10).
- Sleep gaps are sized by dual-clock drift: a positive step in `Date.now() − (performance.timeOrigin + performance.now())` is a slept gap = away, even if the tab was "visible" when the machine slept; negative drift past the quantization noise floor (clock rolled back) credits 0. Millisecond jitter between the two clocks' readings is measurement noise, not drift — its boundary credits its wall gap whole.
- Paused time is neither present nor away: it produces and credits nothing.
- **Reconciliation floor**: absences below 3 minutes (tuning) auto-credit silently on both modes — nous banks, time credits, no report, never joins the pool.

### The trust table

| Time | Planned, up to target | Planned, past target | Open-ended |
|---|---|---|---|
| Present | banks, credits, accrues habit — live | banks, credits, accrues habit — live | banks, credits, accrues habit — live |
| Away | **trusted**: banks, credits, never questioned | **provisional**: nous to the bucket, minutes to the pool | **provisional**: bucket + pool |
| Paused | produces and credits nothing | produces and credits nothing | produces and credits nothing |

- Away time up to the planned target is trusted — the reconciliation machinery exists only past the scheduled time. Absences spanning the target split at return: the under-plan slice auto-banks, the past-target slice goes provisional.
- Sleep-gap credit clamps at the plan on planned sessions, per the trust table.
- At each return with pool outstanding, the **mandatory honesty report** appears (§2). The session keeps running and presence keeps banking behind it — presence is always trusted — but away time keeps flowing provisional until the outstanding pool is settled; the next return re-presents it, recalculated. At exit the answer is mandatory and final.
- **No caps** — no maximum on gap size or bucket size. Honesty is the clamp; caps are tuning if playtesting ever shows abuse.

### Gaps and interruptions — one reconcile path

Persist session + bucket + `lastSeen` at every transition to hidden (the last reliably observable save point). Sleep gaps, tab discard (`document.wasDiscarded` reconcile at load), mid-session reload with a full bucket, and save-import while a session runs all classify the gap as away and flow through the same trust rules; the existing imported-save away-interval confirmation folds into this path.

## 2. The honesty report and the provisional bucket

*Decided by [#70](https://github.com/wvanderen/flowsynth/issues/70); screen shape by [the close-out ticket, #73](https://github.com/wvanderen/flowsynth/issues/73).*

- **The provisional bucket** is a visibly flagged counter on the console holding nous produced by provisional time — nous only; the minutes join a **provisional pool** behind it. When the report resolves, the bucket banks or drops **in one move**. Nothing already banked is ever clawed back — the report retracts nothing, it only settles the provisional.
- **One surface, both uses**: the report is the same standalone forced modal mid-session and at exit, differing only in copy framing ("before you wrap up"; tuning). It is never merged into the dismissible summary.
- **The screen**: the away minutes and the bucket (minutes + nous in it) stated up top; the options carry their consequences inline as their labels. No arithmetic preview beyond the labels — the outcome is visible on the next screen.
- **Options** — the answer covers that absence's past-target slice only; under-plan slices are never mentioned:
  - **Didn't practice** → the pool credits 0; the bucket drops; outcome `missed`.
  - **Did what I planned** → credited rises to `max(C, T)` (T = the planned target); the pool credits only up to the plan; the bucket banks; outcome `planned`.
  - **Practiced the whole time away** → the pool credits fully; the bucket banks; outcome `full`.
- Planned sessions offer all three; **open-ended sessions offer two** — didn't practice / practiced the whole time away (no plan, no middle option). No freeform trim at launch.
- Mid-session the report can be left unanswered (pool rolls forward, §1); at exit the choice is mandatory and final — the bucket must bank or drop before the summary shows.

## 3. Credited practice time: the consumers' seam

*Decided by [#70](https://github.com/wvanderen/flowsynth/issues/70).*

**Credited practice time (C)** is a session's post-reconciliation practice total: live present time + trusted away time + provisional time as the report credits it. Away time's contributions become final only at its reconciliation — nothing ever accrues from away before that, so no retraction is ever needed.

C is the seam every focus-side consumer keys off:

- **Practice log**: one entry per session, `seconds = C` (source `live`, as today). Manual logs unchanged.
- **Habit development** accrues from the practice log (live sessions + manual logs).
- **Goal progress** accrues from that entry.
- **The charge window** banks `fraction × C` (ADR-0019 amends the live-practice-time basis; manual logs still never bank one).
- **Session achievements** read the log.

Nous is never governed by C: it banks live (present + trusted away) or via the bucket (bank/drop). Derived, never stored: `targetHit` (`C ≥ target`), the honesty summary (`missed` if any event missed, else `full`, else `planned`, else `none`), and miss-row status (**the miss row** = any record carrying a `missed` event; a reported miss never suppresses a derived hit — presence is always trusted).

## 4. End-of-target signals

*Decided by [End-of-target signals, #71](https://github.com/wvanderen/flowsynth/issues/71), with launch sound design from [#76](https://github.com/wvanderen/flowsynth/issues/76) and browser facts from [#69](https://github.com/wvanderen/flowsynth/issues/69).*

**Firing**: every channel keys off the same event — the first boundary or timer wake-up whose wall clock sees `now ≥ target`. The session then enters **overrun** (§1: presence banks live, away goes provisional).

**Chime** — one synthesized just-intonation two-note motif via Web Audio, no asset; fixed quiet gain, no volume setting at launch. The session's `AudioContext` is created/resumed inside the start-session gesture (autoplay unlock). It fires at the target wake-up (≤ ~1 s late normally, ≤ ~1 min late under Chrome's intensive throttling); while the tab stays hidden it re-fires at most once per wall-clock minute, capped at 3 total (numbers tuning). Acknowledged = the tab becomes visible; a notification click focuses the tab and so acknowledges; pausing silences immediately.

**Notification** — one permission ask, once ever, inside the **first planned-session start flow**, from the start gesture on a visible page ("we'll notify you at your target"); open-ended starts never ask; nothing at minute 0. Denial or dismissal is silent degradation — chime + title alone carry the signal, nothing in-session mentions it, no re-prompt at launch. Non-persistent page notification, marked **silent** so the OS never doubles the chime; clicking it focuses the FlowSynth tab. Notifications display from hidden tabs — it is the punctual channel.

**Tab title** — carries the live clock while a session runs; updates land only at wake-ups while hidden (up to ~1 min stale under intensive throttling), exact whenever visible:

| State | Title |
|---|---|
| Planned, under target | `12:34 · FlowSynth` (remaining; `H:MM:SS` past 1 h) |
| Planned, past target | `done · FlowSynth` (static) |
| Open-ended | `42:10 · FlowSynth` (elapsed) |
| Paused | `paused · FlowSynth` (overrides done during overrun) |
| No session | `FlowSynth` |

**Restraint** — open-ended sessions fire no chime and no notification, ever; the elapsed title clock is their only live surface. Paused sessions fire nothing: the frozen clock never reaches the target, pending repetition stops, delivered notifications are left alone.

## 5. Launch sound design

*Decided by [#76](https://github.com/wvanderen/flowsynth/issues/76).*

- **The target chime ships alone.** No board or economy sounds (Forge rolls, achievement toasts, shelf acquisitions, Arete minting, goal completion), no session lifecycle sounds (start, pause/resume, report/summary arrival), no session ambience at launch. The board's feedback stays visual; silence is the session's resting state per §4.
- **One global mute toggle** in the settings modal's PREFERENCES — gates every app sound, including the chime's hidden re-fires. No volume slider, no per-sound mix. (The new save field is implementation detail.)
- **Sonic identity standing rule**: every sound, at launch and beyond, is synthesized from the game's just-intonation math (chord ratios) via Web Audio — no audio files, no sampled packs, no new dependencies. Sounds are derived from the formula's terms, never new mechanics.
- Timbre and tuning details are numbers, not spec.

## 6. Session start: freeform planned targets

*Charted on the map (decision 6); placement of the permission ask from [#71](https://github.com/wvanderen/flowsynth/issues/71) and [#74](https://github.com/wvanderen/flowsynth/issues/74).*

- Planned targets are set in the Time app's enter flow: **preset chips stay as quick picks** (the set gains 90; exact chips are tuning) **plus free number entry from 1 to 90 minutes in 1-minute steps**.
- **Open-ended remains its own mode** — not a duration choice.
- The notification permission ask rides the first planned start (§4); the `AudioContext` is unlocked inside every start gesture (§4).

## 7. The opening, amended: free apps and session one

*Decided by [The opening without rungs, #74](https://github.com/wvanderen/flowsynth/issues/74), with the maintainer. Amends the beat sheet (#24) and the opening economy (#11); recorded in ADR-0019.*

- **Time is free at minute 0.** The after-first-session auto-activation milestone is struck: Habit, Time, Notes, and Goals are all active from the very first session, and session one can be planned. The loud summary keeps its unlock row in design, inert at launch — it fires when Tasks joins, post-launch.
- **Session one stays open-ended-steered.** The enter prompt carries the duration affordances (preset chips + free 1–90 entry) from the very first start, visible but unpushed; the first-session copy still suggests a few minutes (~5, tuning) then exiting — reinstating a steered suggestion for session one only (ADR-0018's flavor cut otherwise stands). The chime, title flip, and the permission ask land whenever the player first plans — never at minute 0.
- **Session-one tiles: openable but unprompted.** The focus tiles open in-session from session one, wearing live state; the script never spotlights them — the HUD stays the ticking nous counter and per-minute rate, with zero purchases.
- **Nothing replaces the first-spend fork.** Beat 8's rung-1-vs-generator choice dies with the rungs. Post-session, the shelf generator — carrying its permanent "produces charge — feeds the Forge" hint — is the only spend path; early agency lives in using the free apps, not buying them.
- **The ladder stays hidden while empty.** The catalog omits the activation section entirely until the ladder has a tenant; no telegraph row; dashed-strip rendering stays reserved for console long goals.
- **Ladder pricing defers to its first tenant.** ADR-0013's "rung one below the shelf floor" is superseded: the shared, scaling, free-order shape stands; pricing is decided with the Tasks effort.
- **The welcome card is unchanged**: grant → first-upgrade CTA.

**Beat-sheet deltas** (against redesign-spec §5): beat 3 — all four tiles live, greyed tiles and locknotes struck; beat 5 — unchanged habit ask and unstructured affordance, now with visible duration affordances, "planned targets arrive with the Time app" struck; beat 6 — "no apps" becomes "tiles openable but unprompted", HUD and zero-purchase lines stand; beat 7 — the unlock row no longer fires, the row stays in design inert; beat 8 — the side-by-side fork is struck, generator pull only. The coarse skeleton renumbers: grant → first upgrade; session one (open-ended, steered short); loud summary (nothing fires); generator pull; generator → charge → Forge → first roll; first cell purchase; capstone console long goal.

## 8. Close-out choreography and reflection

*Decided by [#73](https://github.com/wvanderen/flowsynth/issues/73).*

**Order — sequential, report first.** Exit (the main switch, no added confirmation) runs: **honesty report → summary modal → upgrade mode**. The report appears only when the provisional pool is outstanding; a present-typed exit goes straight to the summary. The report precedes the summary because the summary's numbers aren't final until the bucket banks or drops.

**The summary shows final numbers.** The earned headline is **banked** nous — a dropped bucket is simply absent from the number, with the drop visible in the event lines. Practice time shows **credited** minutes: planned sessions as "X / Y min" (matching the history list's format), open-ended as "X min". Honesty events render beneath as the neutral factual lines history uses ("22 min away · didn't practice"). No raw wall-duration row. All four dismissal paths (Continue, ✕, backdrop, Esc) count as dismissal and log the reflection or absent — no distinct skip state.

**Reflection** — lives in the summary's reserved slot above dismissal: free text plus a five-position slider, **end labels only — rough ↔ great** ("How did it go?"), middle neutral and the default. The reflection records if **either** field was touched (the untouched field keeps its neutral default: empty text, middle slider); neither touched = absent. The same step for every session, misses included — the event lines are already visible and free text covers the rest; no miss-adapted prompt at launch. Pure insight at launch: nothing in the economy reads it.

**Relaunch resumes; no auto-abandon.** A running session persists across tab close and resumes on relaunch (today's shape): the offline gap classifies per the trust rules (§1) and the report fires at that return if the pool is outstanding. Close-out runs on the player's next exit. The never-returned case is fully handled by the return report; nothing is ever closed without the player's answer.

## 9. Session records, history, and habit-keyed notes

*Decided by [Session history and habit development, #72](https://github.com/wvanderen/flowsynth/issues/72); visualization by [#77](https://github.com/wvanderen/flowsynth/issues/77).*

### The session record

Written once at session close, append-only. **Every** flow session gets one — planned, open-ended, unstructured, seconds-long; no minimum length, no filtering:

- `sessionNumber`, `startedAt`, `endedAt`
- `habitId | null` (null = unstructured); the id resolves at render, so renames and archiving never rewrite history
- `mode` (planned | open-ended) and `plannedTarget` seconds (null on open-ended)
- `creditedSeconds` — C, post-reconciliation (§3)
- `earned` — the nous that actually banked, after any bucket drop; history never contradicts the balance
- `honestyEvents: [{awayMinutes, outcome}]` — per reconciliation
- `reflection: {text, slider} | absent` — absent = never touched, renders neutral
- `goalsAdvanced: [{goalId, seconds}]` — a snapshot at close, so deleting or replacing a goal never rewrites history
- `achievements: string[]` — the summary's unlocked row, carried for drill-down

Derived, never stored: `targetHit`, the honesty summary, miss-row status (§3). Also not stored: present/away/paused breakdowns — nothing reads them.

**Storage**: a new append-only array in the v5 save state; pre-release additive fields join with lenient defaults — no version bump (ADR-0017's clean cut untouched; the existing `save.ts` defaulting pattern covers it). **Keep all**: no pruning, no caps at launch.

### The Time app's history surface

A History affordance in the Time app panel opens the popover: flat list, newest first, ~20 rows with a "show more" tail — no day grouping, charts, or calendars. Rows: date · habit name (or "unstructured") · credited minutes, planned sessions as "X / Y min" · a small hit or miss chip. Tapping a row opens the **drill-down**: dates, mode and target, credited vs planned, earned nous, each honesty event as a factual line, the reflection if present, goals advanced, achievements unlocked. Notes and the rate breakdown are excluded — the drill-down is about practice, not economy replay.

### Misses render neutral

The honesty report is accounting, not judgment, and history follows suit: a miss is a per-event factual line ("22 min away · didn't practice") plus a small muted marker on list rows carrying one — muted grey, never red, no streak shaming.

### The Habit app's development summary

Per habit: lifetime practice time (its development total), sessions practiced, last practiced, and its tagged notes beneath — newest first, with date and in-session stamp. Aggregates read the **practice log** (live sessions and manual logs together — manual time is development too, matching how `Habit.seconds` accrues); hit/miss material comes from session records. Archiving hides a habit from selection only: history rows keep resolving its name, and an archived section keeps its summary and notes reachable.

### Notes tagging (habit-keyed notes)

Tagged once, at capture, from the session's selected habit; unstructured and upgrade-mode notes go untagged; no retagging at launch. The Notes app's full stream gains a small habit chip on tagged notes and keeps showing everything.

### Post-launch visualization (decided now, built later)

Launch stays aggregates-only. When built, the per-habit summary gains:

- **Practice calendar** (first) — a month day-grid per habit, intensity = practice minutes that day, fed by the **practice log only** (live credited + manual — the same source that accrues `Habit.seconds`, so the grid agrees with the development total by construction). Local-day bucketing. No honesty events, hit/miss markers, or judgment shading are ever painted on it — the miss marker stays confined to the history lists.
- **Practice runs** — consecutive days with any credited practice for the habit, live or manual; factual **current run** and **longest run** lines beside the aggregates. Never keyed off honesty outcomes or planned-target hits; a gap ends a run unremarked.

Trend charts stay fog: build them only if playtesting asks. Nothing new joins the record or the log. Unstructured time never appears in per-habit views (it writes no practice-log entry by construction).

## 10. Browser-contract implementation notes

*Researched by [#69](https://github.com/wvanderen/flowsynth/issues/69) against MDN and vendor docs, 2026-09-18.*

- **Accrual**: wall-clock `Date.now()` deltas at event boundaries (§1). A 100 ms tick fires ~1×/s hidden (all engines) and ~1×/min in Chrome after 5 min hidden+silent — never accrue by ticks.
- **Persistence**: save on every transition to `hidden` — the last reliably observable save point; on load, `document.wasDiscarded` reconciles against the persisted `lastSeen` (§1). Memory Saver discard is routine; suggest pinning the tab or adding the site to "Always keep these sites active" (documented discard guards).
- **Sleep**: no sleep event exists; sample dual-clock drift at every boundary — a positive step sizes the slept gap (§1). Chrome freeze (timers suspended, clocks running) appears the same way. `visibilitychange` covers tab switch, minimize, full obscuring, and screen off; focus loss alone does not hide.
- **Signals while hidden**: notifications render from hidden tabs — fire at the wake-up that sees the target (the punctual channel); chime and title ride the same wake-up (§4). There is no page API to schedule sound at a future wall-clock time.
- **Audio**: create/resume the `AudioContext` inside the start-session gesture — a context created before a gesture is born `suspended` (Chrome autoplay policy). Audio is not paused by hiding: when a timer fires, the chime sounds at that moment.
- **Don't fight the throttler**: silent-audio keep-alives don't work in Chrome and are battery-hostile; Web Locks are not a timer keep-alive. Design for "wake-up ≤ 60 s late" instead.

## 11. Retirement ledger (additions)

| Retired | Was | Now |
|---|---|---|
| 120 s confirm-or-discard reconcile dialog (ADR-0010) | freeze + confirm/discard of missing intervals | trust-model accounting: gaps classify as away, sessions resume on relaunch, the honesty report adjudicates the provisional (§1–2; → ADR-0019) |
| Time's after-first-session auto-activation (ADR-0012/0013, §2.3) | milestone unlock | all four apps active from the first session (§7; → ADR-0019) |
| Launch ladder rungs — Notes/Goals purchases (ADR-0013) | rung 1 below the shelf floor, either order | the ladder rests empty at launch, hidden until Tasks; pricing decided with its first tenant (§7; → ADR-0019) |
| The rung-1-vs-generator first-spend fork (§5 beat 8) | unguided side-by-side choice | the shelf generator's hinted pull is the only spend path (§7) |
| Session-one "no apps" beat (§5 beat 6) | bare HUD only | tiles openable but unprompted from session one (§7) |
| Charge-window basis `fraction × live practice time` (ADR-0012) | live practice time | `fraction × credited practice time` (§3; → ADR-0019) |
| Unadjudicated away time past the target | banked silently | provisional bucket + honesty report (§1–2) |
| Soundless target arrival | no signal at target | chime + silent notification + title flip (§4) |

## 12. Deferred and out of scope

**Map fog (in scope for future efforts, not this one)** — achievement feats on the new surfaces (honesty streaks, reflection milestones, first 90-min plan); focus-keyed modules reading the new state (reflection quality, honesty streak as module-effect inputs — the boundary rule holds); notification re-prompt UX after refusal (nothing at launch: denial degrades silently); session-record growth (pruning/export if local saves balloon); practice-over-time trend charts (build only if playtesting asks); sonic breadth beyond the chime (ambience, board event sounds).

**Out of scope** — the Tasks app and the ladder's pricing (decided with that effort); prestige design; the goal capacity mechanism (2 base slots + console long goals stays exactly as is); board and economy module work (the credited-time seam is the only board-side touch); gameplay reads of reflection at launch; themes, phone support, sync/backend.

## 13. Handoff notes for implementation sessions

- **Read order**: this spec → ADR-0019 → the deciding tickets for any section's rationale → the amended `CONTEXT.md` for vocabulary → redesign-spec §1/§13 and `research/implementation-survey.md` §7 for the coupled-code map (activation flags, save migration, and the session/persistence suites are the touched surfaces).
- **Suggested sequencing** (one vertical at a time, engine-first): (1) accounting engine — boundary classification, trust rules, drift-sized sleep gaps, C and the practice-log seam, additive v5 fields (§1, §3, §9); (2) honesty report + close-out choreography + reflection (§2, §8); (3) signals — chime, notification, title, mute toggle (§4–5, §6); (4) history surfaces — Time popover + drill-down, Habit development summary, note tagging (§9); (5) opening/onboarding amendments (§7).
- **The engine test matrix**: presence state (visible / hidden / slept / discarded / reloaded / import) × mode (planned / open-ended) × slice (under-plan / past-target / sub-floor) — every cell's banking, crediting, and report expectation is decided by §1–2.
- **Tuning fronts** (numbers, not spec): the 3-minute reconciliation floor; chime re-fire cadence and cap; title-format cadence; the preset chip set around the 1–90 free range; the ~20-row history page; the mute toggle's save field shape.
