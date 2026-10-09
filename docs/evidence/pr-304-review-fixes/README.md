# PR #304 review fixes

Captured from `http://localhost:5178/`, launched with `npm run dev` in
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-fbda221c`.
The provenance endpoint matched that worktree and base HEAD `bdcc15c7`;
the captures include the uncommitted review fixes.

- [Desktop breakdown](desktop-breakdown.png): incoming charge arrow points
  inward, SVG/path click pins the disclosure, and the host calculation names
  base output, power, chord factor, build synth term, booster uplift,
  empowerment, achievements and discovery before one final output.
  Action cost and benefit remain visible.
- [Phone container fallback](phone-container-breakdown.png): `#app` constrained
  to 390px triggers the actual container query and sheet composition. The
  breakdown remains within the container and the SVG/path click pins it.
  Exact 390×844 viewport resize timed out after 3000ms; this is a container
  layout check, not a verified device viewport or physical touch pass.

Against the pinned instrument prototype (`eb232c4`): mechanics stay in the
shared tooltip layer, rows use open hairline divisions, readouts retain
units, and faces and action costs remain compact and visible. Static waves
retain solid/dashed state distinctions; arrows point toward the module.

Live browser checks: SVG/path click opened and pinned the body, Escape
closed it; left wave is unmirrored and right wave mirrored. Physical touch
and real keyboard focus were unavailable in the hidden preview. Automated
focus, Escape, SVG hover, path/SVG click and tap-away coverage passed.
Greyscale rendering and reduced-motion emulation remain unavailable;
source rules and tests verify the static equivalent and live-flow-only
animation, including pause/resume with an active mutator.

Regression coverage also checks Forge and Amplifier calculations against
snapshot outcomes, external bonus terms on all oscillator disclosures,
and rebuilding when a bonus changes without changing the displayed face.

Validation: `npm run check` passed; full suite 58 files / 1183 tests
passed; UI project 22 files / 581 tests passed. The first full-suite run
had a timeout in the unrelated dev-provenance exact-route test; that test
passed alone and the full-suite rerun passed. Seven new regression cases
bring the Hex flow suite to 27 tests.
