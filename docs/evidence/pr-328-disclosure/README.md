# Channel Strips glossary disclosure

PR #328 review correction, working diff on `c8340d7`. Launched this
checkout with `npm run dev` at http://localhost:5176/. Before capture,
the provenance endpoint confirmed worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-2024c8b4` and commit
`c8340d7effaaa135277e718578a07989db994127`.

[Desktop disclosure](desktop-goals-disclosure.png) shows the product name's
engraved term underline and its plain price-ladder gloss. The effect,
price button, and countdown remain visible and distinct. Judged against
the pinned prototype's open row, compact readout, square control, and
plain disclosure grammar; the pin has no GOALS-specific mock.

Browser checks: focus opens the gloss; Escape dismisses it while keeping
the sheet open; trigger click pins it and a click away dismisses it.
The integration test also checks that disclosure never buys capacity.
The shared tooltip layer handles hover and the native trigger's tap path.

Unavailable: phone capture (both freeform and preset T3 preview resize
timed out), real touch hardware, and a dedicated grayscale capture.
The underline and opened text provide non-color disclosure affordances.
Reduced motion: this change adds static text and uses the existing term
trigger; no new animation or glow. No dedicated reduced-motion capture.
