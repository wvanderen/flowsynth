# Evidence — issue #491 (the dev panel's policy select carries the three World-comparison policies)

Captured from the verified checkout at `http://localhost:5173` (capture
preflight accepted before both captures: worktree `/home/lem/dev/flowsynth`,
branch `t3/issue-491`, commit `a7c9c0ad` — matching `git rev-parse HEAD`,
source clean; the provenance record sits beside these captures). The state
is the shipped fresh start at `?dev=1`, upgrade mode; the dev console's
playthrough row is the changed surface — the policy select now offers the
three declared World-comparison policies beside prompt and pushing
(`app.devPlaythroughPolicies()`, the same catalog the agent command reads).

| Capture | What it shows |
| --- | --- |
| `desktop-policy-select.png` (1280×800) | The dev console's playthrough row with the policy select set through a real select interaction to **Support-seeking**; the select's option list — Prompt prestige, Pushing, Support-seeking, Combat-engaging, Enemy-ignoring — is carried in the capture pass's accessibility read of the same control. The row sits beside the scenario select, the response-curve select, the seed/budget/target inputs, the declared tuning overrides, and the run control — unchanged by this diff except for the three options. |
| `phone-policy-select.png` (390×844) | The same console dragged (through its own grip) into the phone viewport, the policy select reading Support-seeking and the row's controls rendering; the console's single-row geometry overflows the 390px viewport as it did before this diff — the panel is drag-positionable developer tooling (`?dev=1` only), and this diff changes only the select's option catalog, not the console's layout. The select's five options are verified in the same pass's accessibility read at this viewport. |

The keyboard/touch disclosure, non-color state, and reduced-motion checks
from the instrument standards do not apply: the changed surface is one
native `<select>`'s option catalog — no new control, disclosure, or
animated state was introduced. The select was operated through the real
control (select event), and the panel was moved through its own drag grip,
in both viewports.
