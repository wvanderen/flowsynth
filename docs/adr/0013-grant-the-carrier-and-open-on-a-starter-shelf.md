# Grant the Carrier and open on a starter shelf

The old opening preallocated eight cells around six core modules and opened a starter store after the first timed target. The redesign's opening economy (issue #11, 2026-09-14) replaces both, validated board-first by the opening prototype (issue #12) and scripted moment-by-moment by the onboarding beat sheet (issue #24).

## Decision

- **Start state**: the game opens in upgrade mode on a tiny all-discretionary board — the **Carrier** pinned at the origin cell plus about two empty cells. The Carrier is a unique module type, never rolled and never shelved, wearing white (ADR-0016); it is pinned, immovable, and unsellable (ADR-0014). A zero-production board is a legal state until the player assembles one.
- **The starting nous grant equals exactly the Carrier's first upgrade price**, priced below the shelf floor. Beat one is "upgrade your synth, watch the rate move" — spendable within seconds of reading — and balance returns to zero.
- **The starter shelf**: one-time guaranteed catalog offers of a Forge, one basic generator, and one infusor, hidden once acquired. The shelf completes the landscape — every launch category is guaranteed available exactly once; duplicates and everything else come from rolls. Charge ignition is the shelf's basic generator; synthesizers never secretly generate.
- **Cells are direct nous purchases** on a steep geometric scaler over total cells bought, bought and placed in upgrade mode on a connected board; the reshaping rule is unchanged. The first acquired module must be placeable without buying a cell first — the first cell purchase is its own early beat.
- **The expander module type is retired**; charge feeds the Forge only.
- **The activation ladder is shared, scaling, and free-order**: rung one is priced below the shelf floor and each later rung costs more, counted globally regardless of app. Habit stays free and always on; Time auto-activates after the first session; Notes and Goals are the launch rungs in either order. App-specific permanent upgrades appear only once their app is activated, as hand-paced console long goals (ADR-0012).
- **All nous spending is upgrade-mode-only.** Live sessions are read-only; practice-minute countdowns render on purchase surfaces in upgrade mode only — never in-session, never in the session summary. Every end-of-session summary is a shopping beat.
- **Opening beats (coarse, accepted)**: grant → first upgrade; deliberately short first session; loud summary; Time activates; the unguided rung-one-vs-generator choice; generator → charge → Forge progress → first roll; first cell purchase; first console long goal as capstone. The full first-session script lives in the redesign spec (issue #19).

## Consequences

- Supersedes ADR-0007's starter store and expansion-demo provisions, ADR-0006's expansion-meter half (its upgrade, combination, and rarity provisions survive), ADR-0011's opening prices, and ADR-0003's remaining gradual-placement remnants (its reshape rules survive as cited).
- **Extends ADR-0001's focus protection to the economy**: purchasing joins configuration as upgrade-mode work.
- The prototype validated a **board-first preference**: the opening leads toward the generator and Forge while free activation order and an app-first choice remain available. Generator plus Forge affordable within roughly ten practice minutes is the intended affordability expectation for tuning, not a verified measurement (issue #12).
- Glossary retirements: *Expansion progress*, the expander type. With ADR-0017's version gate, every player plays this opening from zero.
