# Issue #353: type ramp reconciliation

One ramp, documented and obeyed. The decision is recorded first
(commit `0064eb1`): the 12px step stays and is documented as the ramp's
**Compact** register, `DESIGN.md` §Typography writes the ladder out stop
by stop (whole pixels only, the reserved moments named), and the sidecar
carries it mechanically (`typeRamp`, the `control` and `compact` role
metas). The CSS then folds every off-ramp size onto a stop: all seven
half-pixel steps (8.5/9.5/10.5/11.5/12.5/13.5/15.5) resolve to their
neighboring whole step, the 21px modal title and 18px focus detail name
join the 19px Headline stop, and the two 16px strays fold to 17 (the
chord stage's figure line, a Readout) and 15 (the honesty choice label,
a Control). The detector sweep in `instrument.test.ts` asserts the
stylesheet's sizes resolve to the documented set and nothing else.

All captures and probes from `http://localhost:5174/` in this worktree,
branch `t3code/issue-353`, commit `0064eb1` + the CSS change in the
working tree. Provenance verified before capturing: the endpoint's
`worktree` equals `git rev-parse --show-toplevel` and its `commit`
equals `git rev-parse HEAD` here.

- [Console, desktop](console-desktop.png): the 64px console with the
  clock stack, ledger figures at their 15px stop beside the 15px marks,
  and the switch at its 15px Control voice.
- Computed probe, desktop console: `.console` measures 64px; the clock
  stack measures 46px tall, fully inside the rail (top 9, bottom 54) —
  the fixed-height chrome holds with the caption at 10px and the
  provisional line at 11px/14px.
- Computed probe, phone composition (the console keys on the `#app`
  container's inline size, so the container driven to 390px renders the
  true phone anatomy): `.console` measures exactly 56px; the clock stack
  measures 39px, fully inside (top 8, bottom 47); banner reads and board
  ledger drop, the thumb bar engages, and the clock reads its documented
  22px narrow stop. The phone console fits at 56px.

## Unavailable

- **Phone viewport capture**: all three `preview_resize` attempts to
  390×844 timed out after 15s; the resize budget is spent, so the phone
  screenshot pass is recorded as unavailable, not verified. The phone
  composition is verified by the container probe above and pinned by the
  suite (`app.phone.test.ts` asserts the 56px console block).
- **Reduced-motion**: no new motion in this change; every rule touched
  is static type sizing.

## Checks

- `npm run check` (tsc) passed.
- `npx vitest run --project ui` passed 743 tests.
- The new detector sweep resolves the stylesheet's font sizes to exactly
  the documented set: 8 / 9 / 10 / 11 / 12 / 13 / 14 / 15 / 17 / 19 plus
  the reserved moments 20 / 22 / 24 / 28 / 34 / 40 — no half-pixel steps.
  The sweep reads its set from the sidecar's `typeRamp` extension, so the
  two mechanical copies cannot drift apart.
- The impeccable detector (`detect.mjs src/ui/style.css`, DESIGN.md and
  sidecar loaded) reports **no type or font advisories**. Its six
  remaining findings are the pre-existing sanctioned set: the two #352
  radii (the ⓘ ring's 999px, the hex-stack chassis 14px) and the four
  deliberate fill transitions (goal-bar height, horizon width, water
  level).

## PR #381 review follow-up

Additional captures come from `npm run dev` in
`/private/tmp/flowsynth-review-381`, served at `http://localhost:5174/`.
Before capturing, the preview fetched `/-/dev/provenance`: `worktree`
was `/private/tmp/flowsynth-review-381` and `commit` was
`3f0db7aeaef3bcf9db46be413c722af957a173c6`, matching the checkout.
No production source changes were made for these captures. Preview status
reported a 1402×877 CSS viewport; saved PNGs are scaled to 1280×800.

Representative additional desktop evidence:

- [Honesty modal](honesty-desktop.png): the changed modal title and choice
  label/consequence sizes remain distinct and contained in the ruled rows.
- [Settings sheet](settings-desktop.png): the changed preference labels fit
  beside their controls; notes and actions remain readable and separated.
- [Focus panel and board](focus-board-desktop.png): compact controls and
  selected-tab marker remain legible, with module nameplates and figure
  hierarchy visible in board context.

Compared with the presentation criteria of the pinned instrument prototype
(`eb232c4`) and controls sheet (`d405ce2`): these captures retain clipped
outer panels, open ruled divisions, square-cut controls, condensed names,
mono figures, and the firm inset selected marker. No clipping or overlapping
text was observed on these captured desktop surfaces. This is a limited
visual comparison, not an all-surfaces or interaction pass. Settings and
Focus were opened by DOM activation after preview click failures; that
activation does not verify pointer, keyboard, or touch access.

### Coverage and unavailable checks

- **Desktop catalog, drilled focus detail, candidate/Forge readouts, and
  remaining changed sheets**: unavailable. Catalog DOM activation did not
  open the sheet in this session; before further navigation the preview
  lost its automation host and returned an explicit “Do not retry” error.
  The three captures above are representative, not coverage of every
  changed selector. No layout conclusion is claimed for uncaptured sheets.
- **Phone compositions of all changed surfaces**: unavailable. Two renewed
  390×844 resize attempts timed out after 15 seconds, with `preview_status`
  between attempts. The viewport stayed at 1402×877, then the automation
  host disconnected. The earlier 390px container probe covers console
  containment only; it does not verify full phone viewport layout.
- **Keyboard disclosure open/Escape dismissal and touch open/tap-away**:
  unavailable. Preview clicks failed and the host disconnected before
  native input checks could run. DOM activation and synthetic events are
  not counted as evidence for either input method.
- **Four-state grammar without color**: full check unavailable. The Focus
  capture shows the selected PLAN tab's inset marker, but no greyscale
  capture or unavailable/available/acquired state matrix was obtained
  before disconnection; the four-state criterion is not claimed verified.
- **Reduced-motion behavior on animated/glowing surfaces**: unavailable.
  No preference-emulated animation pass ran before disconnection. The
  diff changes static typography only, but existing motion is not thereby
  treated as verified.

Validation at the captured commit: `npm run check` passed; `npm test`
passed 64 files, 1,368 tests, with 2 skipped. This follow-up changes only
screenshots and their evidence record, so those source checks were not
repeated. Each linked PNG was opened locally for visual inspection.
