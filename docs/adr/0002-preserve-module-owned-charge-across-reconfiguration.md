# Preserve module-owned charge across reconfiguration

Pausing charge between sessions allows players to rearrange the grid without racing a timer: remaining generator output follows its generator, stored charge follows its receiving module, and adjacency is evaluated when flow resumes. Unequipped modules preserve their state but cannot act, and moving modules never duplicates charge. Charge can carry across habits to support the broader system, while habit development stays with the habit that earned it.

Repeated activations of equal strength extend output duration. Activations of different strengths remain successive bursts rather than being converted into higher simultaneous strength.

Initially, charge generation is a capability of core focus modules. Dedicated generators are deferred until they offer a distinct build choice.

Activated core modules may receive charge to empower their synthesizer functions—their contributions to nous production—not their generator functions. This corrects the earlier generator-bonus proposal and prevents charge from amplifying its own production; no charge-generation bonus or session-level charge sampling rule was adopted.

Expansion and forging are explicit exceptions to module-owned accumulated charge: each has a separate shared player-wide progress meter and globally scaling reward threshold. ADR-0009 supersedes the former local Forge progress and combination-threshold rules; combining Forges does not move shared progress or change reward history.

Generator duration runs down during live flow even with no eligible neighbors. Upgrade mode should clearly show disconnected output so players can correct placement before starting.
