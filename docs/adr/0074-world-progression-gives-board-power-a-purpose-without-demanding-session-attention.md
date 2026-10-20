# World progression gives board power a purpose without demanding session attention

Accepted design direction, 2026-10-19; design interview completed; simulation and prototype evidence precede production implementation.

The module board remains the central optimization activity: it produces power, the World layer supplies the long-term objective and resistance, and habit classes let real practice shape the approach. An era can reach an effective ceiling where prestige buys lasting World strength for a meaningfully different attempt; waiting within one era need not be the intended solution to every enemy.

Combat runs automatically during flow. Deployment, spell behavior, and recovery rules are configured between sessions; normal rewards and loss prevention must not require mid-session attention. Each habit–class pair owns its experience and tree, retained through free class switches without transferring experience between habits. Every class starts with a useful ability.

The first experiment tests one enemy sequence, one combat resource, scaling Arete claims, and Engineer as the first habit class. HP recovery and equipment combinations follow only after the reset loop proves compelling. 1T nous is the earliest-entry constraint; pacing remains to be established.

## Progression and reset contract

Prestige retains the existing module reset boundary: collection, placement, merge tiers, and earned rolls persist; module levels and nous purchases re-earn. World purchases and habit development persist; enemy encounters and temporary combat state reset. Era-earned nous determines a diminishing-return Arete claim from the first eligible reset, banked only on prestige. Reset count does not independently increase payout; lasting purchases provide acceleration. The exact curve remains tuning.

Enemies occupy authored World positions, discovered automatically at progression thresholds and applying their debuffs without requiring player deployment. Player forces and charge routes are arranged to reach them. Enemy cells are visibly reserved before discovery, with identity concealable until discovery. They cannot hold player World hexes; the module below remains unaffected by occupancy. Defeated encounter cells remain occupied by the encounter and its era reward.

Charge fuels combat actions, including attacks and spells; its amount is not yet defined as a direct damage conversion. Arete purchases upgrade combat hex power. Weapons store charge, spend a fixed amount per attack, and have a capped attack cadence. Arete upgrades attack power and authored stats; additional charge improves uptime until fully fueled rather than granting unlimited attack speed or damage. Exact costs and storage values remain tuning.

World replaces Mutators for this experiment; Mutators are deferred to a possible later prestige layer. Retired Arete purchases are refunded; migration details are defined below. New players start with an Engineer habit and a useful starter rig. Engineer owns practice-earned module rolls; unstructured sessions run production and charge forging without class rewards.

This direction replaces ADR-0046's shared-build choice, ADR-0042's reset-count-led progression, and ADR-0041's universal practice-roll entitlement for the experiment. Existing shipped contracts remain documented as such until implementation. The later sections settle enemy lifecycle, spatial rules, clocks, class structure, and migration policy; numerical tuning and implementation mechanics remain experimental.

## Encounter and practice contracts

At 1T era-earned nous, reveal the first enemy and open the first Arete claim. Prestige is available without defeating that enemy; the first claim guarantees a basic weapon and Charge Column for the next era. Enemy debuffs begin with predictable, bounded production penalties; dynamically disabling the strongest oscillator is not part of the first experiment.

Defeating an enemy replaces its debuff with an era-local bonus. Prestige restores enemies and removes those bonuses; lasting strength comes from Arete purchases. Permanent encounter unlocks are deferred.

Class experience and class reward progress require credited flow time with that habit and class selected. Manual logs contribute to practice history, not class experience or rewards. Breathers grant neither class experience nor class reward progress. The later sections settle World combat during breathers, charge transport, construction, Engineer advancement, and migration policy.

## World space, combat clocks, and Engineer

World shares the owned module board's footprint and coordinates. Each owned cell supports one module and one World occupant; reserved enemy cells block only World placement. Nous-funded board expansion creates space for both layers, while Arete buys combat hexes and upgrades.

A Charge Column occupies a World cell, lifts charge received at the corresponding module cell, and supplies adjacent World consumers by splitting its supply among them. Weapons initially attack adjacent discovered, undefeated enemies; players configure target priority between sessions when several qualify. Additional range is deferred to later weapon types.

Enemy damage and stored World charge persist between sessions and reset on prestige. Combat pauses during upgrade mode and session pauses. Breathers run combat alongside production and charge simulation without class progress. Provisional combat settles with the honesty report: rejected practice cannot retain its damage, victories, or encounter bonuses. The simulation implementation requires investigation before implementation.

Engineer has a reliable base module-roll cadence, modest bounded cadence upgrades, and branches improving draft control or merge progression. Tree points can be reassigned freely between sessions; earned levels remain attached to the habit's Engineer history. Exact nodes and values remain unresolved. RITUAL is deferred from the first experiment; any return needs a specific charged effect with merge scaling that cannot multiply class experience or practice-time accrual.

## Reachability, accumulated resistance, and experiment criteria

Enemies may be discovered on unowned coordinates. Their debuffs activate on discovery; attacking requires an owned neighboring cell. Enemy positions must fit within available octave rows, and the first enemy must remain reasonably reachable under its penalty. All enemies whose thresholds are crossed are discovered, with their debuffs accumulating; sequential activation was rejected because a strong board could otherwise face only one penalty and power through. The later sections settle stacking arithmetic and recovery constraints.

Columns conserve lifted charge, split it equally among adjacent consumers with available storage, and redistribute overflow to consumers still able to accept it. Full storage wastes no share while another consumer can accept charge. Columns do not relay to Columns in the first experiment.

World hex placement and relocation are free between sessions. Purchased upgrades belong to the individual hex and move with it. Full Arete refunds are available between sessions during the experiment, enabling build exploration without trapping progression.

The first enemy has fixed HP, never attacks, and applies a bounded percentage reduction to nous production. Defeat replaces the penalty with a modest era-local nous bonus. Weapons spend charge to deal their Arete-upgraded attack damage. Enemy attacks, shields, summons, spells, and recovery are outside the first experiment.

Success requires demonstrating a worthwhile first reset through faster return to familiar territory; meaningful combat improvement through Column, weapon, or supporting module placement; and a real choice between pushing for a larger claim and resetting sooner for stronger forces. Exact pacing targets require a tuning pass and validation of the economy version behind existing playtest saves.

## Penalty arithmetic, charge lifting, and retained class progress

Enemy penalties multiply their remaining-production factors, and defeated enemies' production bonuses multiply. First-experiment penalties affect nous production only; charge generation, routing, and combat remain functional. Any discovered enemy can be attacked when reachable, irrespective of discovery order.

Columns copy the received charge supply upward without draining the module beneath. Distribution on the World layer conserves that copied supply. Each habit's Engineer class owns its partial practice-roll progress, which freezes while another class or habit is selected; earned rolls enter the shared queue.

Arete rewards newly surpassed era-nous territory only: repeating a previously reached depth must not award that territory again. This amends the earlier era-earned claim direction with a persistent high-water constraint; the following section defines claim and high-water banking semantics. The formula requires prototyping, with no reset-count bonus or arbitrary cooldown.

Migration preserves the life record, habits, module collection, and banked rolls, refunds retired Arete purchases, and converts each habit's existing development into Engineer experience using an explicit conversion rule. Shared partial flow progress converts as specified in the migration policy below. Migration details belong in a dedicated implementation task.

## Claimed frontier and cumulative entitlement

The claimed frontier advances only on prestige, atomically with banking Arete. Before that, new era-earned depth increases the pending claim but grants no spendable currency. A cumulative reward curve assigns total Arete entitlement to depth; a claim is the positive difference between entitlement at the current era score and entitlement already claimed. Preserve fractional entitlement internally so rounding neither destroys progress nor rewards partitioning the climb. The first eligible claim guarantees the basic weapon and Column.

Once prestige is unlocked, zero-claim resets remain available behind clear confirmation. Available Arete is finite at any frontier; repeat runs cannot farm it. Full World refunds enable recovery, and tuning must prove that the cumulative budget at each frontier can fund a build capable of surpassing it. Failure is a progression-design bug.

Enemy thresholds, positions, and stats repeat unchanged each era. Purchased power eases the return climb, while defeated enemies' era bonuses help reach new territory. Prestige does not increase enemy strength.

## Purchases, habit trees, goals, and migration

The first World experiment sells weapons, Columns, and upgrades to owned copies directly for Arete; multiple copies are allowed. A separate technology-unlock tree is deferred until distinct combat options justify it. Prices and upgrade curves require tuning.

Engineer offers a useful default allocation and later draft-control and merge-progression presets. Presets assign ordinary freely adjustable tree points with no exclusive benefits. Credited practice earns class experience; authored level thresholds grant points. Nodes have bounded ranks and explicit prerequisites. Respec returns all spent points without changing class experience or level. Exact thresholds and node effects require prototyping.

Goals remain player-configured practice targets owned by a habit independently of class. Class switches preserve them; only the selected habit's goals display, and only credited practice for that habit advances them. Class abilities progress through credited time without goal-completion requirements. Retire cross-habit goals and the shared goal-slot economy; each habit receives a small fixed capacity. Preserve old goals in history, refund retired capacity purchases in their original currency, and do not reinterpret multi-habit goals as single-habit goals.

Migration converts each habit's recorded development into Engineer experience once, including historical manual practice credited under the old rules. Subsequent class development requires credited flow. Nonzero shared partial flow-meter progress converts into one final banked module roll before that meter retires. Habit color is independent of class.

## Remaining economy boundaries and next work

Useful non-Mutator Arete products remain available. During the experiment, every Arete purchase is fully refundable between sessions; dependent purchases refund together, safely returning occupants where spatial unlocks are removed. Headroom retires because frontier-based claims are available from the first reset.

Habit goal completions still fuel generators, with a bounded reward budget per credited practice minute. More goals, shorter targets, and repeated replacement cannot increase the total available fuel from the same practice time. Notes retain their existing role. Habit and class selections lock for the entire session, including pauses; changes happen between sessions.

A Wayfinder tracks three dependent steps: progression simulation, then a playable two-layer prototype, then implementation briefs informed by those results. Simulation tests cumulative budgets, accumulated resistance, return climbs, and recoverability. The prototype tests routing, placement, Engineer choices, and reset incentives. Production briefs include migration and provisional-combat reconciliation. Numerical balance remains experimental; additional classes, enemy attacks, spells, summons, equipment, and Mutators remain future branches.
