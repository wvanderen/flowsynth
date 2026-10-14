---
target: "Forge issue #335"
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/eggfam/.t3/worktrees/flowsynth/t3code-22e6f5ec/src/ui/render.ts"
target_fingerprint: "sha256:e4d97704502c99450e2f45d068f2ee08fb1a43baa1147fb2902b9b974ec37a0a"
target_path: /Users/eggfam/.t3/worktrees/flowsynth/t3code-22e6f5ec/src/ui/render.ts
timestamp: 2026-10-14T16-07-53Z
slug: src-ui-render-ts
---
Method: dual-agent (A: /root/design_review · B: /root/evidence_review)

Forge critique — issue #335

The hex identity belongs to FlowSynth; the comparison-card composition does not. Use one draft at a time in a compact nonblocking panel, with counts directly on the branch switch.

| Heuristic | Score /4 | Finding |
|---|---:|---|
| Status | 2 | Header counts modules only |
| Real-world match | 2 | Queue and production mixed |
| Control/freedom | 3 | Nonblocking but physically obscures board |
| Consistency | 2 | Boxed candidates, wrong branch order |
| Error prevention | 2 | Exclusive choice consequence distant |
| Recognition | 2 | Full names depend on title |
| Efficiency | 2 | Scroll between separate drafts |
| Minimalism | 1 | Repeated labels and long prose |
| Recovery | 2 | Failure announcements; no reversal |
| Help | 2 | Relevant instructions below fold |
| Total | 20/40 | Significant refinement needed |

Strengths: recognizable hexes, scrimless board inspection, accurate numeric progress.

P1: Two drafts compete. Replace stacked sections with Mutators 2 / Modules 4 switch, firm selected marker. Show only active branch. Keep choice on selected branch while rolls remain; avoid unexpected branch switching.
P1: Rectangles overpower hexes. Remove enclosing cards; full name, rarity, terse effect and relevant cost/scaling beneath each hex. Preserve large native-button targets and visible focus.
P1: Banked count is ambiguous. Counts mean rolls, not candidates. Show branch counts once in switch; update dock count/disclosure to represent both branches clearly.
P2: Three verbose meters precede reward. Put active branch horizontal progress tracks below choices; modules has Flow + Forge, mutators has Mutator Forge. Keep current/threshold figures and non-color state; goals unchanged.
P2: Footer paragraphs compensate for weak affordances. Remove them, use visible Close + Esc and Choose 1 of 3 / Choose 1 of 2. Preserve outside click dismissal without committing. Update standards sample that currently preserves old bottom prompt.

Desktop: three exposed hexes across; mutator face two. Phone proposal: compact open rows, hex left/readout right, no carousel or tiny three-column text. Retain board visibility with a compact docked surface; final positioning requires prototype validation.

Cognitive load: five controls from two independent decisions, three sources and duplicate prose. One branch reduces immediate choice to two or three.
Journey: earned reward is buried beneath diagnostics; bring hex choices first.
Personas: Alex scrolls for mutators; Jordan sees module-only count as total; Sam receives long concatenated button names and hover-only full names. Preserve native button semantics and accessible names.
Minor: remove hover translation; unify branch layout rhythm. No new undo or economy behavior proposed.

Detector: static renderer scan returned zero; runtime Forge scan 43 flags across 40 elements: 18 small-text, 2 line-length, 3 height-transition, 19 semantic-violet palette, 1 border/shadow. Violet is approved semantic color, not a defect. Height transition flags do not establish performance defects. Typography/paragraph flags support manual findings.

Questions: opening rule — current board layer or pending branch first? Layout — compact docked strip or side panel? Recommend board layer with pending-branch fallback and docked strip.
