# The calibrated century baseline is frozen for save translation

Accepted, 2026-11-03 (issue #492, parent #484's rebalance).

> Current-scope amendment: ADR-0087 (#526–#530) retires Column purchasing and the open-ended Column-sink premise. This baseline remains frozen historical save-translation arithmetic; its recordings do not validate the replacement draft-acquisition economy. ADR-0086 separately records the later slope/grant re-freeze.

## Context

ADR-0078 accepted the rebalance direction and left the exact curves to implementation. The shipped economy's frontier claim curve carried two authored figures — the entry depth (`BALANCE.world.entryNous`, #490's calibration) and the depth slope (findings.md's flagged hypothesis, 2) whose recoverability re-derivation had never landed. The recorded 100-credited-hour walks priced that hypothesis against the board it governs: a mature board's production compounds roughly ×3–4 per productive era, while a slope of 2 demanded ×10 of era-earned depth per banked advance. Later eras lengthened past the 5–10 credited-hour window, bankless tails stretched to tens of hours, and the walks' frontier reach sat well under the roster's authored span.

Separately, the board's six-row cap — the expansion ceiling the Row unlock sells (1 then 2 Arete) — stood outside every declared playthrough policy's purchase rules, so the recorded walks never played the expansion product the Catalog offers. The century walks' maturation ceiling is largely the cell ladder inside the launch band; the unlock is the authored relief.

The save translation (issue #493) needs the calibrated curve and entitlement figures pinned somewhere a migration can read, so a translated save's balances, banked Arete, and claimed frontier convert against known arithmetic — not against whatever the constants read that day.

## Decision

1. **The frontier claim curve's depth slope ships at 4** (`BALANCE.world.claimDepthSlope`). Each banked claim — the declared two-Arete target — now demands 2/4 of a decade (×3.16) of era-earned depth where the shipped hypothesis demanded a full decade (×10), matched to the mature board's demonstrated growth. The entry depth, claim base, horizon, and enemy ladder stay exactly as #490 and #489 shipped them; the slope never touches the opening era, whose first worthwhile bank lands at the entry depth whatever the slope reads. This retires the last findings.md hypothesis knob in the World layer.
2. **Every declared playthrough policy reads the Catalog's Rack Extenders** after the World's entry: a locked octave row the board reaches opens before the expansion continues, and the opened cells buy as usual. This is the declared player rule inside the runner and its recipes — ordinary play already could buy the Extenders; the policies now do. It is declared policy content — a decision rule reading an existing Catalog product — recorded as such, beside the numeric tuning, not disguised as one.
3. **The calibrated figures are frozen in `docs/century-calibration-baseline.json`**, compiled from the shipped constants (claim curve, enemy ladder, World purchase ladders, capacity ladder, response-support shape, level and cell price curves, schema versions) beside the recorded evidence. The save translation works from that artifact; a later change to any frozen figure must re-run the century evidence and re-freeze, never silently slide under an existing translation.

## Consequences

- The century matrix (eight seeds × two session shapes × five policies × the declared 100-credited-hour mark) holds its later eras against the 5–10 credited-hour window on the baseline schedule, and roughly doubles the century's productive banks in the historical recordings. The former claim that no bankless stretch exceeds two credited hours without a decision is withdrawn: the legacy reader omitted start and terminal waits. Boundary-aware measurements now include those waits; their 80-walk evaluation is not yet recorded. The numeric baseline stays frozen, but this is not a current long-gap success verdict. The recorded distributions carry every timing miss explicitly.
- The first later era on the fastest seeds can sit under the window's floor — the fixed rebuild ramp against a small first bank. Recorded, not tuned away; the #491 effort criterion remains that ticket's own unmet record.
- The enemy ladder's upper two decades (w7, w8) sit past the century horizon on every recorded walk. The reachable roster span is w0–w6; deeper decades remain authored content beyond this scope's ~100-hour calibration.
- The raw supplied-board position banks a frontier the calibrated curve cannot re-reach — the stranding the save translation exists to repair. The baseline's frozen figures are that repair's arithmetic; the translation itself is #493's scope.
- The Arete product ladders (Hone, Chord Catalysts, Expansion Bays) saturate inside the century; Charge Columns remain the open-ended sink. Extending them is future calibration work, not this ticket's.

## Provenance

The slope's validation evidence and the frozen baseline's compilation live in [the century calibration record](../century-calibration.md); the rechecks of the 8–12 and 5–10-hour windows after the change live in the respective evaluation records' recheck sections. The engine pins the shipped value in `world.test.ts`, and `tools/century.test.ts` compares every compiled numeric/schema figure against the committed baseline artifact, excluding only recording-source identity. The artifacts restored in PR #514 retain their original provenance and legacy metadata absence; the current long-tier evidence gap is explicit in the calibration record.
