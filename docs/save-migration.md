# The calibrated save translation: the field-by-field table

Status: **published with the v12 → v13 conversion** (issue #493, parent [#484](https://github.com/wvanderen/flowsynth/issues/484)). The conversion lives at the save boundary (`src/engine/save.ts`, `migrateV12ToV13`); this table is its contract. The arithmetic it converts against is the frozen century baseline ([ADR-0079](adr/0079-the-calibrated-century-baseline-is-frozen-for-save-translation.md)); the reset half's shape is the shipped prestige rule's own, grounded by the century record's collection-reset fixture — the anonymized supplied-board topology walked through a calibrated century from exactly this reset. This slice handles **finite** saves whose economy predates the calibration; saves with missing or null monetary state are the recovery slice's separate class (issue #494), distinguished at the same boundary and never silently repaired here.

## The transition

One schema-version boundary, one pass. A save at v10 or v11 first runs its own pinned conversion (issues #427, #445), then lands here; a v12 save lands here directly; the file the game writes next is **v13**, which every later load reads untouched. The version gate is the whole idempotence story: a converted save reloads with no report, no second reset, no duplicated anything. The load that performed the finite conversion returns a report (what moved, including any cleared provisional nous) and the save/import flow explains it exactly once, at the destination where the save arrived — boot or import. The exact pre-conversion stored bytes replace the downloadable original only after any earlier lineage backup has been archived separately (`flowsynth.save.original.pre-v13`); an import retains its exact source as the new lineage's original. Backup denial prevents adoption and replacement. Lost monetary state refuses before normalization or older refund steps: boot's fallback is unsaved, and neither ordinary nor forced saves overwrite the protected source. A valid applied import can adopt a new lineage; the explicit recovery choice remains issue #494.

## Stands — everything the calibration never re-prices

| Field(s) | What stands | Grounding |
| --- | --- | --- |
| `modules[].type`, `.tier`, `.shift`, `.target` | The collection's identity: every design, merge tier, and secondary | The ticket's retention list; tiers are earned collection, not era progress |
| `modules[].pos`, `cells`, `cellsBought`, `gatedRows` | The board as placed, with every purchased cell and paid row gate | Prestige keeps the board and placement; the conversion is that same reset |
| `unlockedRows`, `catalogEntryOwned`, `rollPoolJoined` | The Arete Catalog's unlocks | Memorized purchases — no refund path exists in the shipped economy |
| `capacityCeilings`, `capacityDiscounts`, `mergeCapPurchases` | The Arete offerings beside the capacity ladder | Memorized with the Arete that paid them |
| `world.starterWeaponGranted`, `world.columns`, `world.weapons[].pos`/`.targetPriority`, `world.hone` | The World's purchases: the granted blade, Columns, weapon copies, Hone ranks | Purchases are permanent; determined together with Arete (below) |
| `scrap`, `draftTierBonus`, `specialDrafts` | The scrap economy and its permanent purchases | Memorized with the scrap that paid for them |
| `mutatorSlots`, `mutators`, `bankedMutatorRolls`, `mutatorForge` | The whole Mutator layer, tray and placed | Persists through prestige |
| `forge` | The Forge's fill and earned count | Memorized progress, like prestige leaves it |
| `forge`, `mutatorForge`, and the habit classes' practice-roll meters | Every memorized meter — fill and earned counts — stands | Meters earned by real time are never un-earned at the moment prestige pays off; the conversion is that same reset |
| `bankedRolls` | Every earned, unchosen module roll | Earned rolls are on the retention list |
| `habits[].classes` (and `classId`) | Class development: experience, levels, tree points, allocations, practice-roll meters | Nothing class-side resets; prestige explicitly keeps it |
| `habits` (names, seconds, colors, archived), `activeHabitId`, `practiceLog`, `sessionRecords`, `goals`, `goalFuel`, `notes`, `achievements`, `chordDiscovery`, `combinations`, `sessionsCompleted`, `sessionIndex`, `unstructuredSessions`, `plannedSessionsCompleted` | The life record: practice history, goals, notes, feats, discovery ledger, session history | The ticket's retention list, field for field |
| `totalEarned` | Lifetime earned ν — the monotonic truth under every era | Prestige keeps it; only the per-era measure rebases |
| `breathersCompleted`, `breatherSeconds`, `lastSessionClock`, `breather`, `summary` | Breather facts and any standing session-end report | Life-record state; an incoherent breather falls back per the existing load rule |
| `prestiges` | The era count | History, not currency — and the Catalog's lock reads it (`catalogOpen`) |
| `mode`, `session` except `session.accounting.bucketNous`, `activeChords`, `nextId`, `muted`, `notificationAsked`, `arcCardSeen`, `purchased` | Mode, session history and practice-time accounting (a mid-flow/paused save resumes on the rebased economy), the allocation retention hint, id continuity, preferences, shelf purchases | Monetary reset does not discard provisional minutes, credited practice, or settled honesty events |

## Rebased — the calibrated era reset

| Field(s) | Becomes | Grounding |
| --- | --- | --- |
| `modules[].level`, `.invested` | 0 | The prestige rule's own reset; the collection-reset grounding walks a calibrated century from exactly here |
| `nous` | `openingGrant()` (12) | The era reset's fresh opening; the opening grant affords the first upgrade |
| `eraEarned` | 0 | The per-era measure rebases; lifetime `totalEarned` stands |
| `session.accounting.bucketNous` | 0 | Provisional nous is old-era money; honesty can still credit its minutes but cannot resurrect the retired economy's wallet or entitlement |
| `capacityBought` | 0 | Purchased capacity is era progress — the voices return to one; the Arete offerings above stand |
| `modules[].reserve` | 0 | The era's temporary charge meters empty with everything else charge-shaped (ADR-0047); the memorized meters above stand |
| `world.enemies` | Fresh at authored stats | Discoveries, damage, and defeated-state era bonuses clear with the era |
| `world.weapons[].store`, `.cooldown` | 0 | Stored World charge and cadence clocks empty with the era |

## Determined together — Arete, World purchases, claimed frontier

The ticket requires these three to resolve **together**, from the calibrated economy, rather than as a blanket reset. The resolution:

- **Banked Arete stands as carried.** It is earned currency, the same ladders it always fed still sell for it, and the World purchases beside it were bought with it. Retaining currency while refunding its purchases would strand both.
- **World purchases stand as carried.** They are permanent in the shipped economy — the conversion is a calibrated era reset, not a refund event.
- **The claimed frontier clears to zero.** The frontier is the claim curve's own ledger: the entitlement already banked against, read off the curve that banked it. The calibration re-priced that curve (the century slope decision, ADR-0079), so a frontier carried from the retired pricing can only bank against depths the calibrated economy cannot re-reach — exactly the stranding the ticket names a failed recovery ("a frontier that cannot be surpassed is not successful recovery"; the raw fixture recorded it at 684). Cleared, it duplicates nothing: the conversion grants no Arete and leaves no instant claim (`bankableClaimOf` reads zero on the converted state — asserted in `save.test.ts` and `tools/save-migration.test.ts`), so every future claim banks against newly earned calibrated depth alone. The historical payout lives on in the retained balance and purchases; nothing pays twice for the same depth.

## Unreadable figures

Missing, null, nonnumeric, or nonfinite required monetary balances refuse ordinary migration before normalization or older refunds can hide the loss. Explicitly lost investment, reserves, frontier, stored combat charge, forge fill, or provisional nous likewise require recovery. Historical optional fields may still take their documented absent-field defaults. The refusal names the lost paths, returns no adopted state or migration report, and protects the stored bytes and any earlier original from boot's fallback saves. A rejected import changes neither state nor slot. No monetary replacement or recovery choice is applied here; issue #494 owns that explicit flow.

## Evidence map

| Behavior | Named verification |
| --- | --- |
| Reset half lands, retention half stands, report figures | `src/engine/save.test.ts`, "the v12 → v13 migration (issue #493)" — "a finite overpowered save lands on the calibrated economy…" and "the whole stands list rides the boundary untouched" |
| No entitlement mints; claims bank against new depth only | `save.test.ts` "the conversion grants no entitlement…", "future claims bank against newly earned depth alone…" |
| Old-version chain pins every boundary, one pass | `save.test.ts` "the whole chain runs once…"; the v10/v11 suites beside it |
| Idempotence (save → reload converts nothing again) | `save.test.ts` "the converted save reloads as v13 and nothing runs again" |
| Exact pre-conversion bytes and earlier backup both retained; retention denial protects both slots | `src/ui/app.migration.test.ts` — "an existing lineage backup survives beside the exact pre-conversion bytes", "migration backup denial at … replaces neither…" |
| Provisional money clears without losing honesty credit; flow/paused conversion and reload | `src/engine/save.test.ts` — "a flow/paused conversion clears old provisional nous…"; `src/ui/app.migration.test.ts` — "honesty credits the retained minutes without resurrecting old money…" |
| Lost money refuses ordinary migration/import; boot cannot overwrite either slot | `save.test.ts` — "missing, null, and nonfinite … require recovery…", "lost investment, frontier, and provisional money…"; `app.migration.test.ts` — "lost-money v… boot preserves both slots…", "a lost-money import adopts nothing…" |
| Original bytes retained; cancel/failure preserves; the flow explains once | `src/ui/app.migration.test.ts` — "a canceled import migrates nothing…", "a rejected v12 save adopts nothing and its exact bytes stay retained", "booting a stored v12 save explains the migration, retains the original bytes…", "an imported v12 save retains its source bytes and explains the economy it landed on" |
| Converted play: engine actions, purchases, the tiered scheduled walk | `tools/save-migration.test.ts`; recorded run `docs/evidence/issue-493/converted-walk.json` |
| Desktop/phone evidence of the explanation and outcomes | `docs/evidence/issue-493/` (README beside the captures) |
