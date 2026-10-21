# PR #450 review fixes

Captured from `npm run dev` in `/Users/eggfam/.t3/worktrees/flowsynth/t3-1529a67f` at `http://localhost:5173/`. The preview provenance endpoint matched this checkout and HEAD `8050a0891a96f69b361114a46793f3255252c29d`, with the review fixes uncommitted. These captures show the same source edits committed with this evidence.

- [Desktop, 1280 × 800](desktop-habit-editor.png)
- [Phone, 390 × 844 CSS pixels](phone-habit-editor.png)

The goal row reads `30 min a day` inside Piano's editor. It retains the vertical inherited-color meter, progress figures, square controls, open ruled divisions, and selected swatch's inset marker. Compared with the instrument and controls-sheet pins cited in `docs/instrument-standards.md`; the copy change adds no new surface or animation.

Browser navigation through Focus → Habit → Piano and both viewport compositions passed. Keyboard/touch disclosure, physical touch, grayscale simulation, and reduced-motion browser passes were unavailable in this follow-up; the UI interaction suite supplies automated coverage.

## Persistence and calendar limits

Removed goals retire in place. New session records snapshot their goal description; older records acquire that snapshot before a goal edit or removal, preserving their existing description through reload.

Cadence recalculation counts manual condition progress separately from live reward eligibility and never issues completion credit. Existing practice logs contain totals and end timestamps, not precise practice intervals. Live entries are capped by seconds available since the selected period began, fixing the uninterrupted midnight-crossing case without counting an entire crossing session in the new day. Exact attribution of pauses or uncredited gaps within historical crossing sessions cannot be reconstructed from that data.
