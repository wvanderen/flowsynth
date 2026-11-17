# Final-review recovery — one implementation revision

Base: requested integration/532-encyclopedia 010dc31, isolated branch t3/fix-encyclopedia-review-findings. Read #532–536; no issue mutations or delegates. Uses the owner-confirmed app/save/browser seams, not a new testing interface.

## Findings and dispositions (all together)

1. **Correctness + invalid mapping:** ID-only snapshots missed the recreated, ID-less `.modal-face`. Fix captures that face explicitly, including zero, and records zero for ID-bearing elements too. Restore follows render and precedes preventScroll focus. The rate/library app cases now assert the actual face, at 72 and zero, not `#modal-content`. `red.log` witnesses both nonzero cases fail 0 vs 72 before the runtime fix; `green.log` witnesses repair. A real Chromium round-trip regression at 100/0 for each section on desktop/phone is owed after freeze. Prior U-sections never demonstrated actual browser scroll continuity; the old mapping is superseded, not carried forward.
2. **Incorrect Charge general rule:** replace blanket between-session pause with upgrade/paused-flow delivery and reserve-drain stop, and explicitly running breather delivery/drain without practice charge. Checked against CONTEXT Charge/Generator/Breather and breather-tuning reserve cases. No engine timing or balance change.
3. **Unqualified optimality claim:** allocator seeks maximum production, but proof requires certification; a search-budget limit retains the best found incumbent. Direct reader to local certification status in Chord facts. Checked against allocation.ts budget contract and render.ts uncertified fact. No allocator or roster behavior changes.

The app copy regression `explains charge phases and distinguishes certified allocation from a budget-limited incumbent` failed before copy changes (`copy-red.log`), then passed in `targeted.log`. It protects the supplied explanations, not a claim to test the allocator algorithm again.

## Preliminary source/spec gate and fix review

Sequential self-review only; independent review unavailable by task constraints. Reviewed complete diff against the three findings, #532–536, CONTEXT vocabulary, instrument standards (historical prototype/controls pins and narrow selective-disclosure amendment), standing checks/review/evidence rules. Existing modal/focus boundaries retained; no save schema, session action, allocation, balance, layout, teaching topics or unrelated surface changed. Actual scroller capture includes zero and restores after the selected ledger section's render. Existing Catalog ID scroll capture retained. No remaining source finding in this bounded pass. Targeted three files/57 cases passed. `git diff --check` passed.

Phone overlap was reproduced by the reviewer before opening and unchanged on return: preexisting, not an established Encyclopedia regression. No layout fix included. Overall phone layout remains **unaccepted**, not waived. Human comprehension, physical-device accessibility and independent visual judgments are unavailable and remain acceptance blockers.

## New freeze and affected evidence

The next implementation commit is the new source freeze. All root-level #536 suites/captures/browser observations at 30274459 are **superseded historical evidence**, retained unchanged, not relabeled. Sibling slice records also retain historical identities. New final suites, capture preflight, browser observations and desktop/phone PNGs belong in this directory after freeze. No acceptance claim until they exist. No calendar-adjacent behavior changed; calendar/calibration runs not owed.
