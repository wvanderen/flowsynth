# The lost-money recovery's flow — issue #494

Captured from the verified checkout: served by `npm run dev` at
`http://localhost:5173/`, gated by the capture preflight —
`provenance.json` records worktree `/home/lem/dev/flowsynth`, branch
`t3/issue-494`, commit `fd9a952` (the persistence corrections at
`b742663` plus non-overlapping disclosure targets), clean source. All
captures are headless-Chromium screenshots of that server (chromedriver
session, window 1280×1200 desktop / 390×987 phone, screenshots at the
viewport's CSS pixels).

The journey under capture: the committed lost-money seed
(`seed-lost-v12.json` — the anonymized supplied-board shape the #493
capture seed carries, at the reported level 1506 with the null monetary
figures the pre-integrity serializer wrote; no personal save, note
content, habit name, or practice detail is used) is placed in the save
slot; the app boots, refuses ordinary loading, and presents the recovery
offer where the save arrived. The offer names the unavailable figures
verbatim, what stands, what rebases, and the original's backup; the
choice applies once, retains the exact source bytes, and lands the
calibrated economy. `capture.mjs` holds the full sequence and the run
log's assertions (`checks.json`); the committed seed re-runs the journey
byte-for-byte.

## Captures

| File | What it shows |
| --- | --- |
| `desktop-recovery-offer.png` | The boot offer at desktop width: the SAVE RECOVERY modal's composition — the lost/stands/rebased/original folio rows with hoverable terms, and the unavailable figures verbatim (`nous`, `totalEarned`, `eraEarned`, `arete`, every `modules[i].invested`) in the mono block. The Arete disclosure stands open under keyboard focus. |
| `desktop-recovery-memorized.png`, `desktop-recovery-warp-beam.png` | Both newly disclosed terms under keyboard focus; Escape dismisses each without closing the offer (asserted). |
| `desktop-recovery-write-failed.png` | Primary-only quota denial: the error and retry/download actions remain in the recovery destination, working state and all three persistence slots unchanged; a subsequent retry succeeds (asserted). |
| `phone-recovery-memorized.png`, `phone-recovery-warp-beam.png` | Both newly disclosed terms opened through emulated touch, with tap-away dismissal asserted. Wrapped controls reserve their full vertical hit space. |
| `desktop-recovery-disclosure.png` | The disclosure standard: the Arete term trigger under keyboard focus (visible outline) with its tooltip layer open — plain floating text, no card. Escape dismisses the disclosure without closing the offer (asserted). |
| `desktop-recovered-board.png` | The outcome after Recover: the calibrated economy on the retained collection — every module at Lv. 0 with its merge tier (Roman numerals) and placement standing, nous at the opening grant (12 ν, 4.15 ν/s), Arete 0 (lost in this seed), Harmonic capacity returned to 1/3. The run asserted the slot carries finite v13 bytes and the exact source bytes stand as the original. |
| `desktop-recovery-declined.png` | The declined choice: the offer retired, the fresh instrument beneath, both slots intact — the next boot re-offers (asserted). |
| `desktop-import-recovery.png` | The import destination: a pasted lost save presents the same offer there (import context behind it); declining returns to the import walk with its message, adopting nothing (asserted). |
| `phone-recovery-offer.png` | The boot offer at phone width (390×844): the same rows at the phone composition, the modal face scrolling internally. |
| `phone-recovery-touch.png` | The disclosure opened by emulated touch — dismissed by tap-away (asserted). |
| `phone-recovery-actions.png` | The offer's actions before applying: Download the original, Not now, Recover. |
| `phone-recovered-board.png` | The phone outcome: the recovered calibrated board, finite v13 bytes written (asserted). |

## Assertions the run made beside the captures

From `capture.mjs`'s run log (`checks.json`): both slots kept their exact
bytes while the offer stood, with no duplicate load-failure notice beside
it; the downloaded file equaled the stored source byte for byte; recovery
landed the opening grant with levels cleared and wrote finite v13 bytes;
the recovered save reloaded with neither the offer nor the migration;
declining and the next boot's re-offer behaved as the contract states;
the import path adopted nothing on decline and retained its exact source
before applying. Primary-only write denial was injected through the browser's
Storage prototype: the app kept its working state and offer, restored the exact
primary/original/archive bytes, and succeeded after storage was restored.
Memorized and Warp Beam were opened and dismissed by keyboard and emulated
touch. Reduced motion was emulated active on the phone pass with zero running
animations on the offer.

The first capture attempt timed out opening Arete on phone. After a successful
server health check and preflight, the second attempt's hit-test assertion
identified Warp Beam intercepting Arete's center point: the newly disclosed
wrapped controls overlapped. A local row rule now reserves each control's full
44px height; the complete recapture at `fd9a952` passed the hit test and every
touch interaction. These are successful final captures, not claims based on
the failed attempts.

Recorded alongside (the original engine-era evidence, not rerun for these
persistence-only corrections): `recovered-walk.json` — the recovered supplied-board
position's scheduled continuation (the same seed/policy/stop the #493
converted walk recorded), run from the recovered fixture: a 6-Arete claim
banked inside four credited hours past the cleared frontier, every
figure finite. Produced by the gated case:
`FLOWSYNTH_SAVE_RECOVERY_WALK=docs/evidence/issue-494/recovered-walk.json npm test -- tools/save-recovery.test.ts`.

## Unavailable checks

- Physical-device touch was not exercised; Chromium touch emulation was
  used.
- The backup-denial failure path is covered by the automated cases
  (`src/ui/app.recovery.test.ts`); it was not reproduced in-browser,
  which would require denying storage writes to the origin.
