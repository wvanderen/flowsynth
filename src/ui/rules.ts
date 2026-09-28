// The module rules surface (issue #155): the full effect rules, conditions,
// and current values for one module, disclosed from a help control beside
// its name on the expanded face. ADR-0026 retired the inspector and left
// per-type effect prose with no surface "until a designed need" — this is
// that need, and the surface is not a sidebar: it rides the modal layer,
// opened from the bloom, live during flow and between sessions.
//
// The synthesizer's current values share the rate details' one decomposition
// (ledger.ts's synthLegsOf), so the legs here can never disagree with the
// Rate cell's roster. Live values mount data-live slots the tick fills, so
// a clock tick never rebuilds the open dialog.
import { BALANCE } from "../engine/constants";
import { chargedFactor, modulePower } from "../engine/economy";
import { forgeThreshold } from "../engine/rolls";
import { cellNoteOf } from "../engine/lattice";
import { formatDuration } from "../engine/clock";
import type { GameState, ModuleInstance, ModuleType, RateSnapshot } from "../engine/types";
import { synthLegsOf } from "./ledger";
import { formatNumber } from "./format";
import { liveSet } from "./live";

// The static half: what the module does, and when its effects apply. The
// one place a type's rules phrasing lives — the modal reads it and nothing
// else repeats it.
export interface ModuleRule {
  rule: string;
  conditions: string[];
}

// The synthesizers' shared conditions: the chord line leads, worded per
// type; the three shared legs are one phrasing, never drifting between the
// pair (issue #155).
const CHORD_CONNECTION = "Chords need voices connected on the lattice — direct adjacency, or a spacer bridge; each chord instance multiplies only its member voices";
const SYNTH_LEG_CONDITIONS = [
  "Infusor uplift needs an adjacent infusor.",
  "Charge needs an adjacent generator emitting during live flow.",
  "Achievements boost every synthesizer, always.",
];

// The one map (ADR-0038): every launch module type's rules and conditions,
// keyed by type — the modal reads it and nothing else repeats it.
export const MODULE_RULES: Record<ModuleType, ModuleRule> = {
  additive: {
    rule: `Sings its cell's pitch and adds a synth term to the board's rate: base ${formatNumber(BALANCE.synthRate)} ν/s scaled by power (rarity to the level), multiplied by every chord it sings in, its local infusor uplift, its received charge, and the achievement boost.`,
    conditions: [`${CHORD_CONNECTION}.`, ...SYNTH_LEG_CONDITIONS],
  },
  conditional: {
    rule: `A synthesizer that keeps a bonus of its own: +${formatNumber(100 * BALANCE.conditionalChordBonus)}% per chord instance it belongs to, stacked on top of the chord's own multiplier — then the shared legs (infusor, charge, achievements) apply as for any synthesizer.`,
    conditions: [`${CHORD_CONNECTION}, and every instance it belongs to pays the per-instance bonus.`, ...SYNTH_LEG_CONDITIONS],
  },
  spacer: {
    rule: "Silent wire: it never sounds and never joins a pitch set. It conducts chord adjacency through chains of wired cells, so synthesizers on either side of it count as connected.",
    conditions: [
      "Bridges only what the wire chain connects — a chord forms across it exactly as if the voices were adjacent.",
      "Receives no charge and produces nothing, at any level or rarity.",
    ],
  },
  focusKeyed: {
    rule: `Produces charge while its charge window lasts: each eligible adjacent receiver gets its full output strength — never divided among neighbors. Each session end banks a window worth ${Math.round(BALANCE.chargeWindowFraction * 100)}% of that session's credited practice time, spent at one window-second per second of live flow. Manual practice logs never create one.`,
    conditions: [
      "Emits only during live flow, and only while window time remains.",
      "Delivers to adjacent synthesizers, infusors, and the Forge; never to itself or another generator.",
      "A new window banks at each session end — the bank is the reserve (ADR-0018).",
    ],
  },
  infusor: {
    rule: `Improves each adjacent module's production effect by +${formatNumber(100 * BALANCE.infusorBonus)}% × power. Receiving charge strengthens the uplift while it flows, with diminishing returns.`,
    conditions: [
      "Affects adjacent modules only — reach never grows with level.",
      "Charge must arrive from an adjacent generator during live flow.",
    ],
  },
  forge: {
    rule: `Accumulates received charge toward the player-wide forge meter: each point of received strength adds power × strength progress per second. Credited practice seconds feed the meter too, at +${formatNumber(BALANCE.forgePracticeRate)} progress each. Crossing the threshold banks a forge roll and carries the excess forward.`,
    conditions: [
      "Fills from adjacent generator charge during live flow, plus credited practice seconds.",
      "The meter is player-wide: every deployed Forge feeds the same threshold.",
    ],
  },
};

// The live half: one row per current value, each with its slot key when the
// value moves with the clock. The builder and the tick's filler read the
// same rows, so a label can never land in one and not the other.
export interface RuleValueRow {
  label: string;
  value: string;
  // The data-live slot when the tick fills this row; null prints it static.
  slot: string | null;
  // A small muted tail under the value (the chord terms' names, say).
  note?: string;
  noteSlot?: string | null;
}

const slotOf = (field: string): string => `mr-${field}`;

// The one map for current values (ADR-0038's shape): one row-builder per
// launch module type, keyed by type — the synthesizers share theirs, since
// their legs are one decomposition (synthLegsOf).
function synthValueRows(_state: GameState, module: ModuleInstance, snapshot: RateSnapshot): RuleValueRow[] {
  // The rate details' own decomposition, reused so the legs never drift.
  const contribution = snapshot.contributions.get(module.id);
  const strength = snapshot.chargeStrength.get(module.id) ?? 0;
  const legs = contribution ? synthLegsOf(snapshot, contribution, module) : null;
  return [
    { label: "Final", value: `+${formatNumber(contribution?.value ?? 0)} ν/s`, slot: slotOf("fin") },
    { label: "Base", value: legs ? `${formatNumber(legs.base)} ν/s` : "—", slot: slotOf("base"), note: `LV ${module.level} · ${module.rarity}` },
    // The note mounts even with no legs yet: a chord forming mid-flow is
    // filled by the tick's writer into the mounted slot, never a rebuild.
    { label: "Chords", value: legs ? `×${formatNumber(legs.chordMult)}` : "—", slot: slotOf("chd"), note: legs?.chordLabel ?? "", noteSlot: slotOf("chdn") },
    { label: "Infusor", value: `+${Math.round((contribution?.infusorBonus ?? 0) * 100)}%`, slot: slotOf("inf") },
    {
      label: "Charge",
      value: `×${formatNumber(contribution?.chargeFactor ?? 1)}`,
      slot: slotOf("chg"),
      note: strength > 0 ? `⌁${formatNumber(strength)} charge` : "",
      noteSlot: slotOf("chgn"),
    },
    { label: "Achievements", value: `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`, slot: slotOf("ach") },
  ];
}

const MODULE_VALUE_ROWS: Record<ModuleType, (state: GameState, module: ModuleInstance, snapshot: RateSnapshot) => RuleValueRow[]> = {
  additive: synthValueRows,
  conditional: synthValueRows,
  spacer: (_state, module) => [
    { label: "Wires", value: module.pos ? cellNoteOf(module.pos) : "—", slot: null },
    { label: "Produces", value: "nothing — it never sounds", slot: null },
    { label: "Receives", value: "no charge", slot: null },
  ],
  focusKeyed: (state, module) => {
    const flow = state.mode === "flow";
    const windowSeconds = state.chargeWindow;
    return [
      { label: "Output strength", value: `⌁${formatNumber(modulePower(module))}`, slot: slotOf("out"), note: "to each eligible receiver" },
      {
        label: "Charge window",
        value:
          windowSeconds > 0
            ? `${formatDuration(windowSeconds)}${flow ? " left" : " banked"}`
            : flow
              ? "spent"
              : "none banked",
        slot: slotOf("win"),
      },
      { label: "Banked at session end", value: `${Math.round(BALANCE.chargeWindowFraction * 100)}% of credited practice`, slot: null },
    ];
  },
  infusor: (_state, module, snapshot) => {
    const strength = snapshot.chargeStrength.get(module.id) ?? 0;
    return [
      {
        label: "Uplift now",
        value: `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength))}% to adjacent`,
        slot: slotOf("up"),
      },
      { label: "Received charge", value: strength > 0 ? `⌁${formatNumber(strength)}` : "none", slot: slotOf("str") },
      { label: "Base uplift", value: `+${formatNumber(100 * BALANCE.infusorBonus)}% × power`, slot: null },
    ];
  },
  // The Forge: chargeable, its value is progress per second — never ν/s.
  forge: (state, module, snapshot) => {
    const threshold = forgeThreshold(state.forge.earned);
    const progress = Math.max(0, state.forge.progress);
    const strength = snapshot.chargeStrength.get(module.id) ?? 0;
    const fill = snapshot.contributions.get(module.id)?.value ?? 0;
    return [
      { label: "Progress", value: `${formatNumber(Math.floor(progress))} / ${formatNumber(Math.round(threshold))}`, slot: slotOf("prog") },
      {
        label: "Fill rate",
        value: fill > 0 ? `+${formatNumber(fill)} progress/s while charged` : "waits for charge",
        slot: slotOf("rate"),
      },
      { label: "Received charge", value: strength > 0 ? `⌁${formatNumber(strength)}` : "none", slot: slotOf("str") },
      { label: "Practice feeds it", value: `+${formatNumber(BALANCE.forgePracticeRate)} progress per credited second`, slot: null },
    ];
  },
};

export function moduleValueRows(state: GameState, module: ModuleInstance, snapshot: RateSnapshot): RuleValueRow[] {
  return MODULE_VALUE_ROWS[module.type](state, module, snapshot);
}

// The current-values block: rows with live slots mounted, filled right after
// by the caller (the rate modal's pattern — build once, fill in place).
export function moduleValuesHtml(state: GameState, module: ModuleInstance, snapshot: RateSnapshot): string {
  return moduleValueRows(state, module, snapshot)
    .map((row) => {
      const value = `<span class="mono"${row.slot ? ` data-live="${row.slot}"` : ""}></span>`;
      const note =
        row.note !== undefined
          ? `<small class="rule-note"${row.noteSlot ? ` data-live="${row.noteSlot}"` : ""}></small>`
          : "";
      return `<div class="stat-row"><span>${row.label}</span><span class="rule-val">${value}${note}</span></div>`;
    })
    .join("");
}

// The tick's fill: same rows, same slot spellings — written in place, never
// a rebuild, so an open dialog survives the clock.
export function updateModuleRulesLive(scope: ParentNode, state: GameState, module: ModuleInstance, snapshot: RateSnapshot): void {
  for (const row of moduleValueRows(state, module, snapshot)) {
    if (row.slot) liveSet(scope, row.slot, row.value);
    if (row.noteSlot) liveSet(scope, row.noteSlot, row.note ?? "");
  }
}
