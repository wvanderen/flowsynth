# Evidence: chord-response support and alternative charge (#375)

Captured from the verified checkout at commit `9c1355b`
(`t3code/issue-375-implementation`), served by the worktree's own dev
server; provenance confirmed via `/-/dev/provenance` (worktree and commit
match `git rev-parse` in the editing checkout) before and after the
captures. The board was seeded through a v10 save in the served origin's
localStorage: the opening Sine at C4, a Sideband at G4 (the Fifth's
second voice), a Chorus at the shared seat, and a charged Flywheel
feeding the Sideband — the smallest board that exercises the whole wave.

Capture note: the preview automation client failed session-wide
(snapshot, record, and click all errored), so the PNGs were captured by
driving headless Chrome Canary over the DevTools protocol against the
same verified URL; the keyboard checks below used real `Tab`/`Escape`
key events through the same protocol, not programmatic focus.

## Desktop captures

- **board-desktop.png** — the deployed wave. The Chorus reads `+50%`
  with its term named beneath ("chord response") and the three voice
  lines fronting the Booster's dot; the Sideband reads `+0.1` — the
  charged conversion already active (uncharged it reads `+0.08`) — with
  the side-flanked trace; the Fifth's seam runs C4–G4 and the ledger
  strip carries the summed rate (0.26 ν/s).
- **forge-tiles-desktop.png** — the draft carrying the wave: the
  Sideband (rare plate) with "Received charge → chord response · weak
  standalone term" and the fixed grade signature `base D · boost B ·
  chord S · charge —` (the absent mark — the replacement is the
  disclosure); the Chorus (uncommon plate) with "Neighbors' chord
  response +50% · charge boosts share · needs a chord" and no grade
  chips (a booster carries no oscillator axes); the Saw beside for the
  charged contrast (`charge S`).
- **sideband-charge-breakdown-desktop.png** — the Hex detail's charge
  wave on the charged Sideband, opened by keyboard focus (17 Tab steps,
  real key events): Incoming charge ⌁1 → Base output 0.05 ν/s → Host
  power ×1 → Chord factor ×2.3 → Booster uplift ×1 → **Charged
  empowerment ×1** (the leg the Sideband never takes, stated where the
  rows multiply out) → Final output +0.11 ν/s.
- **sideband-chord-breakdown-desktop.png** — the same voice's chord
  wave (one more Tab): Chord factor ×2.3 · Formation ×1.12 · Fifth ×1.3
  · **Charge → response ×1.5** — the conversion named as a
  decomposition row beside the terms, never a second empowerment leg.
  Escape dismissed the disclosure while the detail stayed open
  (verified live; the capture holds the open state).

## Phone captures

- **forge-tiles-phone.png** — the Forge sheet at 390×844: both new
  candidates with their rarity words, effect lines, and grade chips at
  phone width.
- **board-phone.png** — the board at 390×844: the Chorus's named-term
  note, the Sideband's charged read, and the seam all render at thumb
  scale.

## Interaction checks run against the verified server

- **Keyboard disclosure**: both wave breakdowns open from real Tab
  navigation alone (no pointer), with the trigger's `aria-expanded`
  flipping through the shared instrument layer; Escape dismisses the
  disclosure and keeps the detail open. The exact rows read from the
  live DOM during the capture are quoted above.
- **Non-color state**: the charged Sideband's state is carried by the
  readout figure (+0.08 uncharged → +0.11 charged) and the breakdown's
  rows, never by hue alone; the grade chips carry the letter in text
  and `aria-label`.
- **Touch disclosure**: **unavailable** — the headless capture path has
  no touch input (`navigator.maxTouchPoints` is zero); the tap-to-pin
  path is covered by the automated UI regressions
  (`src/ui/profile.test.ts`), but no physical tap check was performed
  and none is claimed.
- **Hover disclosure**: not captured (keyboard path only); the hover
  path rides the same `sync` write as focus, covered by the UI
  regressions.
- **Reduced motion**: not applicable — the change adds no animation or
  glow; the new readouts, chips, and breakdown rows are static, and the
  existing surfaces' motion behavior is untouched.
