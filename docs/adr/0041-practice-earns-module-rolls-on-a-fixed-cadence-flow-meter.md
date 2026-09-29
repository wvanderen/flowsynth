# Practice earns module rolls on a fixed-cadence flow meter

The spec's opening arc (§8) shipped the practice leg as a placeholder: flat 0.5 progress per credited practice second into the single shared forge meter whose threshold scales ×1.5 per roll (ADR-0009). It taught the opening — first roll in about two minutes of practice, no Forge module required — and then decayed to noise: with the threshold exponential and the contribution flat, the playtest's ~37 earned rolls put the next practice-only roll years away, and no surface showed progress, threshold, or rate. Grilling the two-source contract (issue #175, 2026-09-29) decided the sources' identities, cadence, interaction with provisional time, and minimum disclosure.

## Decision

- **Two meters, two characters.** Credited practice banks module rolls through its own player-wide **flow meter** on a fixed cadence; the Forge branches keep ADR-0009's shared, globally scaling thresholds fed by received charge alone. Practice contributes to no Forge branch's threshold — the §8 placeholder leg is superseded.
- **Flat cadence, one-time opening fill.** The flow meter crosses once fast (tuning, ≈ 2–5 minutes, rigged synth candidate as today) so the opening still teaches the loop, then runs flat forever — one module roll per fixed block of credited practice time (target ≈ 30 minutes, tuning). It never scales: growth lives in the charge branches and the board; the flow meter is the steady floor.
- **Every credited minute counts.** Present and trusted time fills the meter live; honesty-credited provisional minutes top it up at reconciliation, beside habits and goals. Credited practice time is the one concept; the flow meter keys off it as the charge window already does, ending the asymmetry where the charge leg ran in both sinks and practice in neither's reconciliation.
- **Module rolls only.** Mutator rolls stay charge-earned and Catalog-gated (ADR-0040); the flow meter never mints them.
- **One queue, per-source accounting.** Both sources bank into the single banked-roll queue — a module roll is a module roll, spent interchangeably. Progress and earned counts stay per source so display and feats can attribute them; feats keyed on rolls taken read the total.
- **Persistence.** The flow meter's fill and earned count survive prestige, in ADR-0039's reset-boundary class beside banked rolls and forge progress — progress earned by real life time, reset with the era, would punish at the moment prestige pays off.
- **Disclosure.** The dock's Forge pip shows the flow meter: the charge branches are already legible on their Forge modules' faces, and the flow meter has no board presence. Hover, focus, or tap on the pip opens one detail listing every meter's progress, threshold, and rate ("next roll in ~X min of practice" / the charge contribution), live during flow. The session summary's rolls line splits by source when both fired. No lifetime per-source counters on any surface yet.

## Consequences

- The engine's practice leg leaves `advance`'s shared-meter path for its own meter fed by the same credited seconds and the reconciliation credit; save shapes change per the map's standing note that saves from earlier major iterations are disposable.
- §8's "practice fills the forge" opening arc rebases onto the flow meter's opening fill; its pacing numbers stay tuning.
- ADR-0009 stands for the charge branches: "according to received charge and their progress efficiency" was already their whole diet; this decision removes the practice leg that rode beside it, not the sharing design.
- The Forge dock icon keeps opening the roll UI; the pip's meaning shifts from charge-branch progress to the flow meter. Mutator Forge branch display rides its own surfaces, untouched here.
