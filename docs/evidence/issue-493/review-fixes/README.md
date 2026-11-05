# PR #516 review corrections

Verified source: `484812db` (review fixes `1df04b3`, finite legacy test
fixture `484812d`), worktree
`/home/lem/dev/flowsynth`, branch `t3/issue-493`, clean source, served by
`npm run dev` at `http://localhost:5173/`. `provenance.json` is the accepted
capture preflight. Runtime preflight accepted Node 22.23.4,
America/Chicago, and the UI storage roundtrip.

`capture.mjs` drives its own headless Chromium session through chromedriver
on port 9517, checks the real page, writes these captures, and closes the
session. Run after starting the checkout's dev server and passing the
capture preflight. It uses the earlier synthetic supplied-board seed with
`world.frontier` explicitly set to 1: the earlier committed seed actually
carried 0, despite the original README describing 1. This pass tests a
nonzero frontier and an already-populated original slot, unlike the earlier
capture. No personal practice data is used.

## Before / after

Before fixing production code, the new cases were run with:

```text
npm test -- src/engine/save.test.ts src/ui/app.migration.test.ts
```

The regression assertions failed on the reviewed source (`d078669`):

- `an existing lineage backup survives beside the exact pre-conversion bytes`
  downloaded the earlier snapshot instead of the source being converted;
- `migration backup denial ...` adopted a migration report despite the
  missing boundary backup;
- the flow/paused provisional-bucket cases retained old money instead of 0;
- the lost-money engine/boot/import cases adopted state instead of refusing;
- the explanation case found no glossary trigger for the missing terms.

After the fix, targeted engine/persistence/UI checks passed:

```text
npm test -- src/engine/save.test.ts src/ui/app.migration.test.ts \
  src/ui/shared-save.test.ts src/ui/app.savefailure.test.ts tools/save-migration.test.ts \
  src/engine/library.test.ts
npm run check
```

The first full run at `1df04b3` found that the old chord-root normalization
case used a synthetic v10 file missing every monetary balance. That run was
stopped after the known failure (exit 130); it is not claimed green. The
fixture now carries a finite fresh state plus its old ledger entry, so it
still tests normalization without bypassing the lost-money guard. The
library case and all touched persistence/UI files passed targeted checks at
`484812d`. The final full-suite outcome belongs to the PR's Verification
record; this capture record makes no full-suite claim.

The named regression cases map to the findings in the PR's single
Verification record. The opt-in scheduled migration walk was not rerun;
its prior `converted-walk.json` record remains historical evidence, not a
new recording at this source.

## Browser evidence

`checks.json` records the assertions that passed during capture:

- the downloadable original equals the exact current pre-conversion bytes;
  the earlier original remains in the separate pre-v13 archive;
- **a real downloaded file** equals those bytes (headless Chromium's download
  directory is checked before cleanup), not just a retained byte count;
- finite import explains the conversion at the same destination and retains
  its exact source; a v13 reload does not explain again;
- real engine production creates a 4.969B provisional bucket at level 100;
  conversion clears that money while honesty still credits its 600 seconds
  (ten minutes) of provisional time; no old-money claim is restored;
- lost-money boot keeps the exact source and older original, then the existing
  import destination visibly refuses the same lost-money source;
- keyboard focus opens Catalog's disclosure; Escape dismisses it without
  closing the modal;
- Chromium touch emulation opens Hone's disclosure; tap-away dismisses it;
- the phone viewport is read back as 390×844; reduced motion is active and
  the page has no running animations.

| Capture | Observable |
| --- | --- |
| `desktop-migration.png` | Stands/rebased composition, inline glossary doors, figures, original download and Continue |
| `desktop-catalog-keyboard.png` | Catalog meaning opened by keyboard focus with visible focus state |
| `desktop-import-migration.png` | The explanation after applying a finite import |
| `desktop-outcome.png` | Retained board and collection on the calibrated opening |
| `desktop-cleared-bucket.png` | The old provisional 4.969B ν cleared; practice-time accounting retained, after honesty settlement |
| `desktop-recovery-refusal.png` | Lost-money import refused visibly in the existing destination |
| `phone-migration.png` | 390×844 upper composition with glossary doors |
| `phone-hone-touch.png` | Hone meaning opened by emulated touch |
| `phone-migration-actions.png` | Lower composition and both actions reachable by scrolling |
| `phone-outcome.png` | Retained board and calibrated opening at phone width |
| `phone-recovery-refusal.png` | Existing import destination's refusal at phone width |

## Judgment against the pinned standards

Compared with the presentation pin `eb232c4` and controls pin `d405ce2`,
with the current graphite/clipped-panel amendments: square controls,
continuous clipped outer hairline, open ruled divisions, mono figures with
units, readable inline term triggers, visible keyboard focus, and no nested
cards or expansion surfaces. Copy is wrapped inside a single inline content
span per folio row so the shared column layout no longer splits sentences
around each figure or term. Phone scroll reaches both actions. The static
report introduces no animation or duplicate ambient warning.

## Limits

- Physical-device touch is unavailable; Chromium touch emulation was used.
- The explicit recovery **choice** remains #494, not a claim of this patch.
  This patch refuses ordinary conversion and protects the source. Boot's
  fallback opening is unsaved until a valid load/import can be adopted.
- Existing ordinary controls remain square-cut; this informational report
  has no selected/acquired/unavailable choice states to demonstrate.
