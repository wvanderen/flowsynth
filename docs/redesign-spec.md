# FlowSynth redesign spec

The decoupled board, the opening, the horizon, and the Rack — assembled for implementation.

**Status**: produced by the FlowSynth redesign map ([issue #9](https://github.com/wvanderen/flowsynth/issues/9)); every decision below is final for this effort and traceable to its deciding ticket. Exact numbers are **provisional tuning** unless a source says otherwise. Companion records: ADR-0012…0018 (supersessions) and the rewritten `CONTEXT.md` (glossary). Where this spec and an ADR disagree, the ADR wins; where both are silent, consult the linked ticket.

---

## 1. Baseline: what exists today

Surveyed at commit `694d514` ([Current implementation survey, #18](https://github.com/wvanderen/flowsynth/issues/18); full findings on branch `research/implementation-survey`, file `research/implementation-survey.md`):

- **Stack**: Vite 6 + TS 5.8, zero runtime deps, no UI framework. Pure engine (`src/engine/`) vs innerHTML-template UI (`src/ui/`) with render-key + keyed-SVG diffing. Strict tsc. 104 passing engine tests, no UI tests.
- **Systems to be reshaped**: 6 pinned core types with the activation economy; 5 gameplay types (additive/conditional/infusor/forge/expander); formula `(enter+additive)×(1+time)×(1+conditional)`; Time as the only charge dispenser; shared forge meter (60×1.5^n) and expansion meter (60×2^n) + board reshape; timed/open-ended sessions with pause and 120 s reconcile-or-discard; v4 JSON saves with a migrate chain.
- **Known gaps today**: goal slots fixed at 2, no rarity secondary effects, no UI tests.
- **Coupled code the redesign touches**: activation flags, pin/place rules, save migration, and the test suites mapped to the four redesign touchpoints in section 7 of the survey doc.

## 2. The model: board, console, and the seam

*Decided by [Board & core model, #10](https://github.com/wvanderen/flowsynth/issues/10), [Module category taxonomy, #22](https://github.com/wvanderen/flowsynth/issues/22), [Console app production hooks, #28](https://github.com/wvanderen/flowsynth/issues/28); recorded in ADR-0012.*

### 2.1 Board

The hex board is **purely the optimization game**. Modules occupy cells; every nous-production term and all charge production derive from board modules — the session itself produces nothing. A zero-production board is a legal state.

**Category landscape** — board modules are *module → category → module type*:

| Category | Role | Launch types |
|---|---|---|
| **Synthesizer** | contributes harmonic terms to nous composite | the Carrier (unique), Additive, Conditional |
| **Generator** | produces charge | focus-keyed generator — the plain generator is retired pre-release (→ ADR-0018) |
| **Infusor** | amplifies neighboring effects | basic infusor |
| **Forge** | chargeable; threshold-minted rolls | the Forge |

**Chargeable** is a supertype family above the category level — members accumulate received charge toward thresholds with a special effect at threshold; the threshold fill is the family's shared rendering trait. The Forge is the sole launch instance. Continuous-charge categories (synthesizer, infusor) use received charge as continuous empowerment instead. No per-type "chargeable variant" flags.

**The Carrier**: the granted origin module — its own unique type, never rolled, never shelved — pinned immovable and unsellable at the grid's origin cell. It plays the formula's carrier role (§4) and wears white (§8). All other synthesizers are strictly harmonics.

### 2.2 Console

The top bar is promoted to the **console**, structurally above the game UI:

- Session controls: **Enter/Exit main switch** (vermillion; bright/animated = live, dim = idle), clock, pause.
- One tile per focus app — greyed until activated, then wearing live state in the tile itself (selected habit, planned clock); icon-only tiles carry unlock gates in their tooltips. State LEDs and locknotes are retired (→ ADR-0018).
- The status strip (trophy glyph → achievements popover) and the nous balance. The rung telegraph is retired — the catalog's ladder rows already price every rung (→ ADR-0018).

**Focus apps — Habit, Time, Notes, Goals — are unlock-only, fixed-function instruments.** No power-curve levels. Their permanent upgrades (goal capacity et al.) are **console long goals**: hand-paced, one at a time at named beats, priced past the current build-out, never grindable back-to-back, gated behind the app's activation, rendered as a dashed strip in the owning app's panel. Tasks joins the console when designed.

**Console UX** ([Focus-view UX, #20](https://github.com/wvanderen/flowsynth/issues/20); prototype branch `prototype/console-ux`, commit `272310f`, open `/?prototype=console&variant=A`): app panels open as **popovers anchored directly beneath their tile** — short mouse travel, and the board never moves, reflows, or dims in console use. Purchases are read-only in flow; tooltips carry the upgrade-mode gate and the practice-minute countdown (→ ADR-0018 retired locknotes). A centered faceplate modal over a dimmed board is the noted future-mobile alternative — not this effort's shape.

### 2.3 The boundary rule (the focus↔grid seam)

- **Focus state → module effect inputs**: board modules may *read* focus app activity — practice time, a note written, a planned target hit, a goal completed, the active habit, session structure.
- **Resources never cross**: console apps never grant, produce, or spend nous or charge. All charge is generator output; all nous is board production.

**Launch exception that proves the rule — one focus-keyed generator**: ending **any** session (planned or open-ended) banks a **charge window** of `fraction × that session's live practice time`, spent as this generator's output during the **next session's first X minutes** (the existing *remaining duration* vocabulary). Live practice time only — manual logs never simulate charge activity. Categorically a generator: LED green family, generator glyph. Fraction, acquisition point, and name: tuning.

**Per-app launch inventory (pure instruments)**:

| App | Activation | Launch function | Feats |
|---|---|---|---|
| Habit | free, always on | select the active habit (or practice unstructured) | — |
| Time | auto after first session | planned targets + timing tools | On the clock |
| Notes | rung purchase | notes are notes | Marginalia, Commonplace book |
| Goals | rung purchase | track goals; templates are conditions only | Kept promise |

**Retired with the old coupling**: the completion bonus, progressive rewards, Notes' charge burst, Time's multiplier and bursts, goal templates' equipped benefits and completion-charge rules. Session earnings are exactly what the board produced; the session summary and achievements carry celebration.

## 3. The opening economy

*Decided by [Opening economy, #11](https://github.com/wvanderen/flowsynth/issues/11), validated by [Prototype the new opening, #12](https://github.com/wvanderen/flowsynth/issues/12); recorded in ADR-0013. Board-first preference confirmed; generator + Forge within ~10 practice minutes is a tuning expectation, not a verified result.*

- **Start state**: upgrade mode on a tiny all-discretionary board — the Carrier at the origin plus ~2 empty cells.
- **Grant** = exactly the Carrier's first upgrade price (below the shelf floor). Beat one: buy it, watch the carrier term move, balance returns to zero.
- **The starter shelf**: one-time catalog offers — Forge, the generator, an Additive Synth, infusor — hidden once acquired (→ ADR-0018 shelved the synth and keyed the generator). Completes the landscape: synthesizers are guaranteed twice at launch (the Carrier plus one harmonic), so chord play exists before the first roll; everything else comes from rolls. Ignition is a second-session reserve payoff — session one produces no charge anywhere; synthesizers never generate.
- **Cells**: direct nous purchases on a steep geometric scaler over total cells bought; bought and placed in upgrade mode; connected-board and reshaping rules unchanged. The first acquired module must be placeable without buying a cell first.
- **The expander is retired**; charge feeds the Forge only.
- **The catalog** is the permanent upgrade-mode purchase surface (named here per the delegation in #24's handoff; post-shelf contents remain map fog): app activations, the starter shelf while available, and cells — module upgrades live on module panels (→ ADR-0018).
- **The activation ladder**: shared, scaling, free order. Rung 1 below the shelf floor; each later rung costs more, counted globally regardless of app. Habit free; Time auto-activates after the first session; Notes and Goals are the launch rungs in either order. App upgrades appear only after activation.
- **Purchase windows**: **all nous spending is upgrade-mode-only.** Live sessions are read-only. Practice-minute countdowns render on purchase surfaces in upgrade mode only — never in-session, never in the summary.

## 4. The nous formula

*Decided by [Nous production formula, #23](https://github.com/wvanderen/flowsynth/issues/23) and [Chord identity, #29](https://github.com/wvanderen/flowsynth/issues/29); recorded in ADR-0014.*

```
rate      = composite × empowerment × achievementBoost
composite = (carrier + Σ harmonic terms) × Π chord terms
```

- **Carrier**: exactly one — the pinned, unsellable Carrier at the origin. At game start the formula is the carrier term alone.
- **Pitch** = hex distance from the carrier + 1. Pure distance, no relaying; cell purchases deepen achievable pitch.
- **Chord pairs**: adjacent synthesizers at consecutive pitches; each pair multiplies the composite by a small bonus; stacking multiplicative and uncapped. Identical pitches add amplitude, no chord; skipped pitches legal, chordless; bonus-only, no dissonance penalties.
- **Named chords** — launch vocabulary of four, recognized over free-floating connected clusters (direct adjacency at launch): **octave 1:2** (the only chord touching the carrier, teachable in session one), **fifth 2:3**, **major triad 4:5:6**, **blues triad 5:6:7** (rings 4·5·6, the deep-board aspiration). A named chord's term **replaces** its member pairs' bonuses; overlapping named chords stack multiplicatively. The consecutive-run law makes the textbook minor triad 10:12:15 geometrically impossible; 5:6:7 is the minor-ish run. Each named chord pays one bonus term and shows one breakdown line. Bridge modules (gapped-ratio unlockers) are deferred.
- **Launch synth types**: **Additive** = plain harmonic term. **Conditional** = amplitude + bonus per chord pair participated.
- **Amplitude inputs unchanged**: level and rarity set amplitude; infusors add local bonuses; charge empowers per-module with the existing diminishing-returns curve. The `achievementBoost` leg collects the achievement term (§6). Generators, the Forge meter, and cells are out of the formula.
- **Board-only**: no session stage. Waves are the math's shape, not motion in the number.
- **Readability enforcement**: the live rate breakdown (carrier / harmonics / chords / empowerment / achievements → rate) and module tooltips; the static explainer panel is replaced by progressive disclosure on the status monitor's formula chip.

## 5. Onboarding: the first session, moment by moment

*Scripted by [Onboarding beat sheet, #24](https://github.com/wvanderen/flowsynth/issues/24); amends #11's skeleton. The accepted coarse skeleton: grant → first upgrade → short first session → loud summary → Time activates → rung-1-vs-generator choice → generator/charge/Forge/first roll + first cell → first console long goal capstone.*

1. **First launch — upgrade mode.** Opens directly on the tiny board: the Carrier pinned at the origin with a subtle pin locknote, ~2 empty cells. A one-time welcome card: the Carrier is granted, its first upgrade already affordable; a single CTA on the Carrier's upgrade button. Unforced — skipping straight to a session loses nothing.
2. **Beat one — first upgrade.** The carrier term visibly bumps in the status monitor; balance returns to zero.
3. **The surfaces around minute 0.** The catalog lists the starter shelf (Forge, generator, Additive Synth, infusor), each priced below reach with practice-minute countdowns; items vanish as acquired. The console rail shows greyed tiles with unlock gates in their tooltips; locked tiles open nothing (→ ADR-0018).
4. **Status monitor, pre-session.** Projected rate per practice-minute, the carrier term alone, earned-so-far 0 — the whole formula is one term. Teaching by solitude.
5. **Enter prompt.** "What are you practicing?" — the habit ask; it opens whenever no habit is selected, so session one always meets it, and once a habit is selected the Enter switch starts directly (→ ADR-0018). Unstructured practice stays a visible affordance of the prompt (no habit development accrues, nous unaffected); the ~5-minute suggestion copy was cut in the copy pass (→ ADR-0018). The session is mechanically **open-ended** — planned targets arrive with Time.
6. **Session one — pure flow.** HUD: ticking nous counter and per-practice-minute rate. No countdowns in-session, no apps, zero purchases possible. The beats are identical whatever the session's length or early exit.
7. **End — the loud summary.** A modal on returning to upgrade mode, however the session ended. Rows: headline "this session earned X nous" · practice minutes · rate achieved with the carrier-only breakdown · "New feature unlocked — time your flow sessions" (Time auto-activated). No countdown rows. The modal is the future home of session reflections (out of scope).
8. **Post-session — the first real decision.** Time is live on the rail. Side-by-side and deliberately unguided: open Notes or Goals at rung 1 (below the shelf floor), or save toward the catalog's generator — its row carries the one permanent hint: "produces charge — feeds the Forge."
9. **Scope ends here.** Session two onward stays coarse per the skeleton; the opening prototype (`prototype/new-opening`, commit `fabb7e5`) owns its feel.

## 6. Progression: the horizon, the monitor, achievements

*Decided by [Progression direction, #13](https://github.com/wvanderen/flowsynth/issues/13) (+ Forge-meter addendum), [Achievements, #26](https://github.com/wvanderen/flowsynth/issues/26), [Status monitor, #27](https://github.com/wvanderen/flowsynth/issues/27); recorded in ADR-0015. Prototype branch `prototype/status-monitor`, commit `ef5618b`, open `/?variant=C`.*

### 6.1 The Arete accumulator

- One full-width **log-scale rail** filling on **lifetime total nous earned** (`state.totalEarned`) toward the **first prestige threshold** — the horizon line (~100k, tuning). Filling **mints Arete**; nous fills, Arete is minted. Prestige's design is out of scope.
- Inert decade graduations (1e6, 1e9, …); no tiered level rewards — the paced beats are the ladder the bar strings visually.
- **Practice-relative beat readout** riding the fill head: "next mark X · ≈Nh of practice at this rate"; flips anchoring near the right edge; past the horizon yields to "Arete minted".
- **Reserved prestige button, inert at launch**: pressing acknowledges the horizon; its slot is real so the UI shape survives prestige's design. Secondaries: sessions-completed + inert Arete counter.

### 6.2 The status monitor (horizon rail)

The monitor **is** the accumulator: full-width rail under the grid, **hard cap of two elements** — the live formula chip docked on its top edge, the accumulator beneath (the era); the Forge progress meter rides the toolbar's Forge pip (→ ADR-0018). The **grid overview panel dissolves**: expansion meter and cell tokens retire; banked rolls move to the Forge surface; charge to board/module surfaces; counts to the views they describe. The static formula explainer dies → progressive disclosure on the formula chip (hover/focus: carrier, harmonics, chord, empowerment → rate). Mode-guidance text is the console's business.

### 6.3 Achievements

- **Accelerate, never gate** (the amended any% core). Launch set ships **with buff rewards**.
- **Framework**: static engine registry (pure, testable); checks at action boundaries + session ticks; v5 save stores `id → unlockedAt`; definitions in code. Upgrade-mode toasts; in-session unlocks queue as an "unlocked this session" summary row; **nothing can unlock during session one**. One global term: `composite × empowerment × achievementBoost`, additive per achievement (~+2% each, tuning), nous-rate only, one breakdown line ("Achievements +26%"). Trophy glyph on the console status strip → always-visible list popover with progress bars; no secrets at launch.
- **The 17-feat launch set** (names provisional):

  | # | Feat | Trigger |
  |---|---|---|
  | 1 | First light | complete your first flow session |
  | 2 | Off the clock | first manual practice log |
  | 3 | Kept promise | complete a goal in the Goals app |
  | 4 | Untethered | start an unstructured session *(new counter)* |
  | 5 | Marginalia | write a note during a flow session |
  | 6 | On the clock | complete a planned session to its target |
  | 7 | Room to grow | buy your first cell |
  | 8 | Spark | first charge delivered to a module |
  | 9 | Roll credit | take your first forge roll |
  | 10 | Two of a kind | first combination |
  | 11 | Power chord | stack chord multipliers to ×2+ of the composite |
  | 12 | Fine china | own a rare module |
  | 13 | Eyes on the horizon | press the reserved prestige button once |
  | 14 | Time in the seat | 100 lifetime practice minutes (live + manual) |
  | 15 | Keeping time | 10 flow sessions completed |
  | 16 | Marathoner | 10 lifetime hours of flow-session practice (live only) |
  | 17 | Commonplace book | 25 notes recorded |

## 7. Number display scheme

*Decided by [Number display scheme, #25](https://github.com/wvanderen/flowsynth/issues/25) within the genre conventions of [Number feel, #17](https://github.com/wvanderen/flowsynth/issues/17) (branch `research/number-feel`).*

- **Scale system**: short-scale suffix ladder `k, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc` (1e3…1e33); **scientific fallback ≥1e33** (`1.235e34`).
- **Exact range**: below 1,000,000, exact comma-grouped numbers; at/above, the ladder at **4 significant digits** (`1.235M`).
- **Integers always exact** ("5004" never "5.00K"); fractions below the exact range get ≤2 trimmed decimals (`0.35/s`).
- **Rates per-second everywhere** (`+/s`); practice time enters through countdowns, never the rate unit.
- **Countdowns** — upgrade-mode purchase surfaces only: basis is the **current board's projected next-session rate** (computable any time; live-updates while shopping); phrasing `in ~3:40 of practice` (m:ss; past an hour `~1h 20m`); hidden when affordable or no rate exists.
- **Aliveness**: plain ticking text from a ~10 Hz sim (exact rate tuning); no odometer.
- **Uniformity**: one shared formatter for every live value (Arete stays a fill bar); no notation setting at launch. Supersedes `fmt`'s exponential-only fallback in `src/ui/meta.ts` at implementation time.

## 8. Visual identity: the Rack

*Decided by [Visual references, #14](https://github.com/wvanderen/flowsynth/issues/14), [Art direction, #15](https://github.com/wvanderen/flowsynth/issues/15), [Retheme prototype, #16](https://github.com/wvanderen/flowsynth/issues/16), [Module category taxonomy, #22](https://github.com/wvanderen/flowsynth/issues/22); recorded in ADR-0016. Prototype branch `prototype/retheme-module-faces`, commit `a27f64c`, open `/?prototype=retheme&variant=C`.*

- **Rack identity, flat-rendered**: panel-standard hex modules (shared chassis, per-type glyph + nameplate); charge as glowing patch leads; no skeuomorphism.
- **Three channels**: hue = category · rarity = engraved ring count (1/2/3) + subtle plate tint (never glows, never hues) · charge = light + motion.
- **Register rule**: resource hues anchor their producing category — modules in the saturated LED register, resources in the luminous glow register of the same hue.
- **Hue table** (provisional): generator `#238858` · synthesizer `#6360d4` · infusor `#1f95b5` · forge `#bc9239` · charge light `#9affa8` · nous `#cbcaff` · Enter/Exit switch `#cc603d` · unbound: yellow, violet · **Carrier: white** (sole hue-law exception).
- **Console monochrome**; Enter/Exit vermillion is the sole colored element.
- **Module faces — Readout panels (C)**: prominent contribution readout, compact type nameplate, smaller geometric signature, narrow category rail. Chargeables: prominent readout is charge-vs-threshold, threshold fill + flash at crossing.
- **Charge rendering**: uniform green patch leads, center-to-center, directional; animated live, dim static previews in upgrade mode; receivers brighten toward luminous green with strength.
- **Panel language**: geometric synthesis glyphs, condensed technical caps nameplates, monospace numerals; every hue paired with a glyph.
- **Theme**: one data-defined token table; dark indigo-blue default (bg `#0d1122`, panel `#141a30`, panel-soft `#111627`, lines `#2a3150`, ink `#e5e9f5`); legacy palette retired; theme variants out of scope.

## 9. Persistence: v5, clean cut

*Decided by [Save migration, #21](https://github.com/wvanderen/flowsynth/issues/21); recorded in ADR-0017.*

- `SAVE_VERSION` = 5; `deserialize` rejects v4-and-older with a clear message and starts fresh; the v1–v3 `migrate` chain is deleted; no archive or import path; life-record loss accepted. Every player plays the new opening from zero. ADR-0010's other persistence provisions stand (versioned localStorage, export/import, autosave cadence, 120 s reconcile-or-discard).

## 10. Retirement ledger

| Retired | Was | Now |
|---|---|---|
| Required module / core module | six pinned board cores | focus apps in the console; the board hosts no required modules |
| Enter/Exit Flow module | baseline nous producer on the board | the console's main switch (vermillion) |
| Core activation | board-core unlocks | **app activation** on the shared ladder |
| Charged core bonus | core boost while charged | charge empowers board module effects |
| Completion bonus / progressive rewards | session rewards | retired; summary modal + achievements carry celebration |
| Expander type, Expansion progress, expansion meter | charge-earned cells | cells are direct nous purchases |
| Notes charge burst; Time multiplier & bursts | focus↔economy coupling | pure fixed-function instruments (§2.3) |
| Goal template equipped benefits & completion-charge rules | reward-bearing templates | conditions only |
| Rarity-as-hue stylesheet coding | rarity as color | ring count + plate tint (§8) |
| Static formula explainer panel | dedicated panel | progressive disclosure on the formula chip |
| Grid overview panel | stats aggregate | dissolved; stats dispositioned per §6.2 |
| v1–v4 saves + migrate chain | grandfathered migration | v5 clean cut (§9) |
| State LEDs + tile locknotes | tile fixtures naming state and gates | tiles wear live state; gates live in tooltips (→ ADR-0018) |
| Rung telegraph | console readout (`NEXT RUNG 45 · ANY APP`) | catalog ladder rows price every rung (→ ADR-0018) |
| Mode slot | console readout of session mode | the main switch is the mode indicator (→ ADR-0018) |
| Monitor Forge meter | status-monitor chip | toolbar Forge pip with exact progress in its tooltip (→ ADR-0018) |
| Catalog module upgrades | purchase surface | module panels own upgrades (→ ADR-0018) |
| Session-start flavor copy (~5-minute suggestion, modal leads, toast tails) | reassurance text | surfaces carry data, not commentary (→ ADR-0018) |

**ADR disposition**: ADR-0001 focus protection + charge pause stand (extended to all purchasing); session-reward provisions superseded → ADR-0012/0013. ADR-0002 charge preservation stands; core-generation clause overtaken; expansion exceptions retired → ADR-0012/0013. ADR-0003 superseded in board-core provisions → ADR-0012; reshape/banking survive. ADR-0004 superseded → ADR-0014 (two legs kept). ADR-0005 stands; Tasks deferred. ADR-0006 upgrade/combination stand; expansion half superseded → ADR-0013. ADR-0007 superseded → ADR-0012/0013; guaranteed-access rationale survives as the shelf. ADR-0008 visual provision superseded → ADR-0016; scope/economy provisions superseded → ADR-0012/0013/0015; desktop-first/offline/local persistence stand. ADR-0009 stands. ADR-0010 stands; migration chain deleted → ADR-0017. ADR-0011 repointed at apps → ADR-0012; prices superseded → ADR-0013; grandfathering superseded → ADR-0017. ADR-0015's three-element monitor composition is amended → ADR-0018.

## 11. Glossary

The rewrite of `CONTEXT.md` ships in this change set: new terms (Carrier, Pitch, Chord pair, Named chord, Composite, Charge window, Console, Focus app, App activation, Activation ladder, Console long goal, Catalog, Starter shelf, Cell, Module category, Chargeable, Status monitor, Arete, Arete accumulator, Horizon line, Achievement, Session summary, Unstructured practice, Practice-minute countdown, Planned target), rewritten terms (Nous production rate, Synthesizer, Charge, Generator, Goal template, open-ended session, the four app entries), and the retirements in §10. ADR-0018's pass additionally rewrites Module type, Catalog, Console, and Status monitor.

## 12. Deferred and out of scope

**Map fog (in scope for future efforts, not this one)** — new chargeable categories beyond the Forge; new synthesizer types (octave/sub carriers, chain-relay pitch, chosen waveforms); bridge modules (gapped-ratio canon); resonance groups; new generator types beyond the launch generator; focus-keyed board modules beyond the launch generator; the transmit-style infusor; the catalog's post-shelf contents.

**Out of scope** — prestige design (kept possible only); deferred breadth (Tasks console app, console upgrades beyond the paced set, habit development, secondary effects and rarity inheritance, achievement breadth beyond the seeds); theme variants; platform growth (phone, sync, accounts); session reflections.

## 13. Handoff notes for implementation sessions

- **Read order**: this spec → ADR-0012…0018 → the linked tickets for any section's rationale → `research/implementation-survey.md` §7 for the coupled-code map.
- **Suggested sequencing** (one vertical at a time, engine-first): (1) engine model rewrite — categories, Carrier, formula + chords, charge/Forge-only, v5 state (ADR-0014, 0012, 0017); (2) opening + ladder + catalog + onboarding script (ADR-0013, §5); (3) progression — accumulator, monitor, achievements (§6); (4) UI/theme — console, readout panels, token table, display scheme (§7, §8). Each step lands with its test suite reworked; the 104 existing engine tests are the baseline to consciously retire or port.
- **Tuning fronts** (numbers, not spec): grant/shelf/rung/cell prices and scalers; empowerment curve constants; chord pair + named-chord bonuses; achievement boost per feat; the ~100k horizon and log floor; the focus-keyed generator's fraction and window; hue hexes; glyph art; the ~10 Hz tick.
- **Prototype assets** (throwaway, branches): `prototype/new-opening` (`fabb7e5`), `prototype/console-ux` (`272310f`), `prototype/retheme-module-faces` (`a27f64c`), `prototype/status-monitor` (`ef5618b`), `prototype/chord-geometry` — reference for intent, not code to keep.
