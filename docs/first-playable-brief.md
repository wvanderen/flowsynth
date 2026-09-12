# FlowSynth first playable

Status: consolidated design for review, 2026-09-12. This is the local review copy of the implementation brief; the repository's canonical issue tracker is GitHub. No application stack has been selected and this document does not authorize silently resolving the open decisions below.

Publication status: published with user approval as [GitHub review issue #1](https://github.com/wvanderen/flowsynth/issues/1), containing the consolidated brief and economy findings. Open design decisions remain explicit; the issue is for review, not unattended implementation.

## Purpose and success criterion

Test one experience: complete real practice, make an understandable build improvement, and want to start another practice to see that build run. Target a meaningful charge-powered build within two or three roughly ten-minute sessions, followed by a day or two of personal use. A rising counter alone does not validate the game.

The browser-based local playable must feel like a modular instrument or game, not a conventional website. It operates offline after setup, saves locally, and supports export/import. Accounts, backend services, desktop packaging, and phone sync are deferred; accounts and sync remain important to the eventual product.

## Scope

Implement Enter/Exit Flow, Time, two synthesizers (additive and conditional), one basic infusor, Forge, and expander. Start with eight hex cells: six required core placeholders around a free center cell and one free outer cell. Habit, Notes, Goals, and Tasks reserve cells but have no effects or purchasable activation in this playable.

Only Enter/Exit starts active. Ending the first session activates Time; completing a timed target opens the starter store and purchased module levels. For this reduced test the store offers all five implemented gameplay types directly. Each guaranteed common starter copy may be purchased once, even if a roll has already provided the same type. Rolled gameplay copies work immediately; core activation is a permanent type unlock, separate from acquiring copies. A core type has exactly one deployed copy; duplicates can stay in inventory.

There is no charge from Enter/Exit. Time's completion burst is the test's only charge source. Open-ended sessions get the same Time multiplier and can consume banked charge, but do not earn a completion burst. This is an intentional tradeoff, not an omission to fill automatically.

## Session rules

- Upgrade mode permits purchases, combinations, forge choices, replacement, movement, and connected-board reshaping. Nothing produces resources or consumes queued charge in this mode.
- Flow locks the grid, active configuration, and planned duration. Production runs automatically. No gameplay advantage comes from checking the screen or timing a gameplay action.
- A timed target awards its completion burst once; flow and its Time multiplier continue until the player ends the session. Practice beyond the target does not automatically create another target or another burst.
- Ending early keeps earned production and withholds only the completion bonus. An open-ended session has no target bonus.
- Pausing freezes elapsed practice and grid activity while retaining the locked configuration. Entering upgrade mode ends the session.
- Ordinary background window use continues uninterrupted. After extended sleep or closure, confirm the practiced interval before finalizing that interval's rewards. The interruption threshold and reconciliation interaction remain open.
- If a session ends exactly at its target, its newly earned burst is queued intact for the next session; there is no elapsed time in which it can act before stopping.

## Board and charge

Core modules can move but cannot be removed. Inactive core modules neither receive nor produce charge, provide no production or infusor effects, and preserve any pre-existing held charge frozen until activation. Power upgrades require activation; replacement and combination may precede activation.

Generators emit strength for a remaining duration. Every eligible adjacent receiver gets the full strength; output is not divided. Multiple generator strengths add. Equal-strength activations extend duration; different-strength activations queue successive bursts. Duration elapses during live flow even without eligible neighbors. Charge never amplifies charge generation.

Generator output belongs to the generator; stored charge belongs to receiving modules where relevant. **Forge and expansion are exceptions:** each uses its own player-wide progress meter and globally increasing threshold. All deployed modules of the corresponding type contribute received strength multiplied by their own progress efficiency. Threshold crossings bank rewards automatically, carry excess forward, and increase the next threshold. Combining, replacing, or unequipping modules cannot reset or move global progress.

Earned cells are banked and placed adjacent to the existing board during upgrade mode. Players can also reshape the entire unlocked board, preserving its cell count and a connected final shape, with a preview before applying. No production occurs during rearrangement. All six required placeholders must remain deployed.

## Single production formula

Let `P_i` be a module's level/rarity power; `C_i` its charged empowerment factor; and `I_i` the sum of the effective bonuses from eligible adjacent infusors. A charged infusor increases its own offered bonus, but infusors do not amplify one another or charge generation.

For each production contribution, use the local factor `P_i × (1 + I_i) × C_i`. Add adjusted Enter/Exit and additive-synthesizer contributions to obtain one shared base rate. Sum adjusted bonuses of copies of the same multiplier type, add one to form that type's factor, and multiply distinct factors together:

`nous/s = (adjusted Enter/Exit + sum(adjusted additive)) × (1 + adjusted Time bonus) × (1 + sum(adjusted conditional bonuses))`

The conditional bonus is proportional to adjacent active core modules; inactive placeholders do not count. Both charge and infusors affect only the bonus above ×1 for multipliers. The infusor targets production capabilities, including core production functions. Forge and expander progress are not production contributions and receive no infusor or extra charged-production bonus.

There are no independent module payout clocks. Retain fractional production internally, display and spend whole nous, and show the final nous/s rate. The upgrade-mode breakdown exposes the terms. A provisional continuous empowerment curve `1 + s/(1+s)` fits the accepted strength examples; only strengths zero and one are exercised in the present economy routes.

## Accepted provisional balance

These numbers are authorized starting points for experiments, not final balance. Small whole-number nous and meaningful early powers of ten are the intended feel; very large later values are acceptable.

| Parameter | Baseline |
|---|---:|
| Enter/Exit base | 0.1 nous/s |
| Time bonus | +0.2, producing ×1.2 |
| Additive base contribution | 0.05 nous/s |
| Conditional bonus | +0.1 per adjacent active core |
| Infusor bonus | +20% to eligible contributions |
| Empowerment at strengths 1 / 2 / 3 | +50% / approximately +67% / +75% |
| Time burst | strength 1, 60 seconds per 600 seconds of planned completed practice |
| Additive / infusor / conditional starter price | 40 / 40 / 60 nous |
| Forge / expander starter price | 80 / 80 nous |
| First upgrade cost | 10 nous |
| Subsequent upgrade cost growth | ×1.6, rounded up |
| Power per level: common / uncommon / rare | ×1.20 / ×1.25 / ×1.30 |
| First Forge / expansion threshold | 60 / 60 progress |
| Forge / expansion threshold growth | ×1.5 / ×2 globally per earned reward |
| Per-candidate common / uncommon / rare odds | 99% / 0.9% / 0.1% |

Modules begin at level zero. One purchased level improves the module's primary effect: base production, Time's multiplier bonus, additive production, conditional bonus per core, infusor percentage, Forge efficiency, or expansion efficiency. Costs initially do not depend on rarity. Forge and expansion start at one progress per received charge.

## Forging and combination

A banked roll offers three candidates; select one, discard the other two without consolation currency. The first-playable pool includes the seven implemented types, not unfinished core types. Sample three distinct specific module types uniformly without replacement from the seven implemented types, then independently roll rarity for each candidate. Additive Synthesizer and Conditional Synthesizer are distinct types and can both appear; two copies of the same type cannot appear in one choice. Generate and persist all three outcomes when the roll is earned, revealing them only in upgrade mode. Reloading or delaying a reveal preserves those outcomes; future odds changes affect newly earned rolls only. The specific RNG algorithm is not chosen here.

Combine two copies of the same type and rarity to obtain the next rarity, keeping the higher level and refunding the lower-level copy's actual nous upgrade investment. Three tiers are implemented; the highest does not combine further. Both inputs are consumed, with no extra combination fee specified. At level zero, higher rarity alone does not improve primary power under this model.

Retain both inputs' earned module-owned charge and preserve burst strengths/durations. Global meters are unchanged. Refund accounting must preserve the retained input's investment history without treating a previous refund as new expenditure. An equal-level tie may use either input under the current equal-price curve; future variants require an explicit rule.

Secondary effects, random affixes, inheritance-choice UI, gems, and Forge quality bonuses are deferred. Playable rolls all use the same odds regardless of which Forges contributed.

## Presentation and persistence contract

Focus controls are prominent. The grid remains visible with calm pulsing and chargeable progress rings. No reward popups, upgrade prompts, or live forge-selection interruptions. Detailed production math, available rolls, comparison tools, and management belong in upgrade mode.

Selecting a generator in upgrade mode highlights eligible neighbors and previews queued output. Selecting a receiver shows sources and current threshold progress. Global progress must not be mistaken for independently owned progress when several Forges or expanders are shown; the exact visual treatment is still to sketch.

Persist the board, inventory and levels, activation and store state, fractional nous, queued charge, global progress and earned counts, banked rewards, and session state. Reload/import must not create duplicate rewards or erase earned progress. Persist the generated candidate outcomes for every unclaimed roll when earned. Technology and file format are not chosen here.

## Deferred full-game design

Habit development and customization, Notes rewards, goal templates and slots, task allowance and pending rewards, and additional core activations remain defined in the existing domain docs but are not implemented in this test. Reflection is a later possibly optional module: self-reported assessment, with charge for logging rather than high scores. Dedicated generators, batteries, conductors, transmitting infusors, prestige, epics, and late-game progression remain deferred.

## Review questions exposed by the experiment

1. Resolved: levels unlock with the starter store after the first completed timed target. The earlier-unlock simulation remains a historical sensitivity comparison.
2. Do the observed first-two-hour production trajectories match the intended scale? The model compares cost growth alone and paired changes to power and cost; no alternate curve is adopted automatically.
3. Is early combination primarily a space-saving decision acceptable, including no immediate level-zero power gain? Refund reinvestment and redeploying the freed cell both matter.
4. Resolved: three distinct uniformly sampled specific types, independent rarity draws, generated and saved when earned. The existing deterministic routes still bank all rolls; stochastic choice policies have not yet been added.
5. What are the actual interruption confirmation behavior, UI layout, save format, and stack? These belong to the next implementation-design pass, not the economy experiment.

## Verification targets

- The no-upgrade opening yields 60 nous after session one, 132 after session two, then buys additive plus Forge for 120. Proper adjacency yields 113.4 nous and one roll during session three.
- One burst supplies its full charge to both Forge and expansion when both are connected. Multiple Forges share one increasing threshold rather than earning independent cheap first rolls.
- Modifier arithmetic matches the shared formula, including bonus-only empowerment and additive infusor stacking.
- Pausing and upgrade mode create no production; completion rewards happen once and do not retroactively power earlier elapsed time.
- Spending never exceeds available whole nous. Combining consumes both inputs, preserves the retained investment and earned state, and refunds only the lower input's eligible spending.
- Real use validates desire to return to practice; numerical simulation cannot establish engagement or validate the visual feel.

## Evidence and precedence

`CONTEXT.md` is the glossary. ADR-0007 supersedes ADR-0003's cell grants on core unlocks. ADR-0008 narrows the full game to this playable. ADR-0009 supersedes local Forge progress and threshold inheritance. Production stacking is in ADR-0004. This brief consolidates accepted decisions without silently accepting the open items above.

Simulation inputs: `tools/economy/baseline.json`. Executable experiment: `tools/economy/simulate.py`. Accounting checks: `tools/economy/test_simulate.py`. Results and interpretation: `docs/economy-results.json` and `docs/economy-report.md`.
