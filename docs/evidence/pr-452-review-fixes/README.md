# PR #452 review fixes

Captured 2026-10-22 from `npm run dev` in `/Users/eggfam/.t3/worktrees/flowsynth/t3-d4ffd163`, branch `t3/review-pr-452-1`, code commit `f584530ea63ccae81d7a79d352def4b8ac66beb4`. The browser fetched `http://localhost:5175/-/dev/provenance` and confirmed this worktree and commit before capture. The working tree was clean at capture; the later documentation commit changes no application code.

- `desktop-running.png`: 1280×800, running PLAN with a 20-minute Piano goal and the compact class summary. Goal, countdown, class XP and Next module roll remain visible. Edit habit, Develop, goal editing/removal, and allocation controls are absent.
- `phone-paused.png`: 390×844 CSS pixels, paused PLAN with the same reads. No horizontal document overflow. Header Resume and Finish remain visible; paused state is named in text, and PLAN has an underline selection marker.

The layout retains the pinned instrument language (`eb232c4`, controls `d405ce2`): clipped outer panel, open ruled divisions, vertical goal column, square controls, and text state indicators. This change adds no CSS, animation, or glow.

Browser checks: advancing practice by 60 seconds changed the goal figures in the same DOM node (`7s` → `1 min 7s`) and updated the remaining countdown; no mutation controls appeared. Keyboard focus opened the Engineer disclosure (`aria-expanded=true`); Escape dismissed it while preserving focus. Phone tabs measured 44px tall; existing term targets measured 43.5px (Engineer/tree points) and 63px (Next module roll).

Unavailable: physical touch input and reduced-motion emulation were not exercised. No new motion is introduced. The automated Focus regression covers running, paused, resumed, completed-goal, and locked-control behavior; existing migration-choice and editor tests cover the shared goal-state precedence.
