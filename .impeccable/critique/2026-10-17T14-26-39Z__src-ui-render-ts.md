---
target: FlowSynth visual cohesion round
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/eggfam/.codex/worktrees/75bb/flowsynth/src/ui/render.ts"
target_fingerprint: "sha256:5b53e4d97507afa245c57bed0e740178be125e7f73c68e863d75a39bf34b4981"
target_path: /Users/eggfam/.codex/worktrees/75bb/flowsynth/src/ui/render.ts
timestamp: 2026-10-17T14-26-39Z
slug: src-ui-render-ts
---
Method: dual-agent (A: /root/design_review · B: /root/evidence_review)

FlowSynth has a strong module identity, but the surrounding interface lacks the same coherence. The opportunity is restraint, shared hierarchy, and a complete geometry rule.

## Design health

| Heuristic | Score /4 | Main finding |
|---|---:|---|
| System status | 3 | Clear readouts; competing activity signals |
| Match with real world | 3 | Strong instrument metaphor; symbols need learning |
| Control and freedom | 3 | Visible exits; broader undo untested |
| Consistency | 2 | Tab constructions and panel silhouettes differ |
| Error prevention | 3 | Affordability and confirmation safeguards |
| Recognition | 2 | Several utility doors rely on glyph discovery |
| Efficiency | 3 | Bulk controls and presets; keyboard unverified |
| Minimalist design | 2 | Peripheral controls and motion compete |
| Error recovery | 3 | Recovery paths in source; failures untested |
| Help | 3 | Contextual definitions; discovery remains demanding |
| Total | 27/40 | Acceptable; significant refinement needed |

These are bounded design judgments from desktop starting-board, Catalog, Focus, and source inspection, not comprehensive usability certification.

## Specificity and strengths

The hex faces, category rails, instrument readouts, and practice switch are recognizably FlowSynth. Preserve that identity. Catalog's open name/effect/price rows work well. The vermillion session switch gives practice a clear center. Surrounding controls feel individually designed rather than composed as one instrument.

## Priority issues

1. **P1: Flow motion has no screen-wide attention budget.** Source permits background breathing, lead motion, receiver glow, chord pulses, switch and strip rhythms, plus threshold flashes. Charge halos traverse opacity 0–0.6 every 2.4 seconds; Forge threshold fill jumps to 0.85 then falls to 0.22 over 0.9 seconds (style.css:2054–2074). For practice in peripheral vision this can repeatedly reclaim attention. Keep low steady illumination, narrow slow modulation, and smaller threshold cues. Remove broad substrate breathing. Suggested command: impeccable quieter.
2. **P2: Corner geometry lacks a complete meaning.** Shared --inst-clip clips top-right/bottom-left by 14px (style.css:17), but phone Catalog slopes its whole top edge (4075). Standards allow occasional clipping without defining qualifying surface families. Define one outer-panel rule and explicit phone behavior; keep controls square. Suggested commands: impeccable document, polish after agreement.
3. **P2: The substrate already spends too much color.** Navy panel tiers, blue-biased rules/muted text, and violet background glow compete with semantic module color (theme.ts:17). Change the complete neutral family to graphite, including scrim and rules, then review semantic-color contrast. This revises ADR-0016's indigo default. Suggested command: impeccable quieter.
4. **P2: Shell hierarchy and tabs diverge.** Session block, production strip, tools, layer switch, upgrades, and zoom establish separate alignments. Focus uses outlined tabs while Catalog uses open underline tabs. Define common rails, spacing, emphasis, and content-switching grammar. Suggested commands: impeccable layout, extract.
5. **P2: No complete current-state comparison surface.** Tokens, instrument primitives, and pinned prototypes exist; Storybook stories were not found. Build a production-backed specimen covering controls, panels, module states, populated boards, disclosures, and motion at desktop/phone sizes. Decide its purpose before choosing its host. Suggested commands: impeccable extract, document.

## Cognitive load and emotional journey

Focus PLAN exposes eight presets plus custom minutes and Open-ended. Icon-only utilities add recognition demands. Independent visual groupings and simultaneous rhythms raise extraneous load. Opening the board feels distinctive; Catalog is reassuring and legible. Moving into real practice should lower visual demand, while the current animation stack can increase it.

## Persona risks

A player practicing beside the screen is vulnerable to repeated peripheral flashes. A first-time player must learn tool/resource glyphs and faces ten duration routes. An experienced optimizer needs dense-board legibility that fresh-board screenshots cannot demonstrate. Accessibility remains unverified for runtime keyboard, touch, grayscale, and reduced-motion behavior.

## Detector interpretation

155 findings: font-size 100, font 20, color 15, radius 7, undersized text 4, layout-transition 4, and one each cramped-padding, thin-border/wide-shadow, em-dash-overuse, low-contrast, side-tab. Distribution: style.css 87; controls prototype 26; focus prototype 21; standards prototype 18; instrument.test.ts 3. 68 findings concern prototype/test material, including intentionally rejected examples. Token/doc mismatch is evidence to inspect, not a demonstrated visual defect. Production transition locations: style.css:152,1539,1812,2070; radius:180,2239.

## Minor observations

Reduced-motion CSS explicitly retains charge-lead motion at 1.6s infinite (style.css:3833). A calm default and reduced-motion behavior need separate decisions. A neutral background alone will leave navy islands unless the whole neutral palette changes. Documentation has substantial foundations; additional tooling must render actual production components to prevent another drifting reference.

## Decisions to resolve

- Preserve the Rack identity and refine its shell, or reopen broader layout/art direction?
- Keep one clipped outer-panel family, or remove clipping from surrounding panels?
- Make activity noticeable only on deliberate inspection, or retain visible peripheral motion?
- Should the visual library support design comparison, isolated component development, or both?
