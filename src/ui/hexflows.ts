// The Hex detail's wave connections (issue #297): the cross-section's
// relationships drawn as directional waves with accessible authoritative
// breakdowns. Three relationships exist at one cell, each with its own
// semantic register and its own disclosure:
//
//   mutator → module   the cross-layer effect, the wave bridging the two
//                      faces and pointing at the affected layer below —
//                      the arete register, the Mutators layer's own voice;
//   charge → module    incoming charge from the off-stage generators and
//                      relays — the charge register, entering the module
//                      face's left vertex;
//   chord → module     the voice's chord bonus from its formation — the
//                      named chord's own hue (the chord row's grammar)
//                      while one rides the voice, the muted wire when none
//                      does, entering the right vertex.
//
// The waves carry no figures: relationship calculations live in the
// disclosure each connection opens (hover, keyboard focus, and tap share
// the one full breakdown; Escape and tap-away dismiss through the shared
// instrument layer). The breakdown multiplies out in authoritative
// production terms — mutator contribution, chord bonuses, incoming charge
// — folds mutators into the host terms they modify, and names the
// resulting output once, as the module's actual outcome (the one read the
// face.ts shared reads and the engine's own functions publish — never a
// second source). Inert relationships draw quiet dashed waves; live ones
// solid — the state survives greyscale. The shapes are static; motion
// rides flow only (the scene's flow-live class), and reduced motion keeps
// the static wave.
import { BALANCE, CHARGE_RECEIVING_CATEGORIES, CATEGORY_OF } from "../engine/constants";
import { chargedFactor, emittedStrength, hostPower, modulePower, mutatorAt, mutatorMagnitude, ritualAmpOf } from "../engine/economy";
import type { GameState, ModuleInstance, RateSnapshot } from "../engine/types";
import { buildFactorsFor } from "../engine/builds";
import { activeHabit } from "../engine/habits";
import { CHORD_HUES } from "./chordlayer";
import { formatNumber } from "./format";
import { boosterUpliftOf, relayStrengthOf } from "./face";
import { FAMILY_WORD, mutatorEffectText, mutatorInertVerdict } from "./mutators";
import { RARITY_LABEL } from "./meta";

/* ── The wave shapes ──────────────────────────────────
   Three distinct shapes — the smooth sine toward the layer below, the
   sharp electrical zigzag for charge, the gentle formation wave for
   chords — so the relationship survives greyscale beside its color. The
   pulse path duplicates the wave for flow-only motion; the stylesheet
   shows it only on active waves in a live flow. */

const WAVE_DOWN = "M32 4q9.5 9 0 18t0 18";
const ARROW_DOWN = "M26.5 34.5 32 40.5l5.5-6";
const ZIGZAG_IN = "M4 20l7-7 7 14 7-14 7 14 7-7 4 0";
const ARROW_IN = "M46.5 14.5 52.5 20l-6 5.5";
const WAVE_PATHS = (wave: string, arrow: string): string =>
  `<path class="flow-wave" d="${wave}"/><path class="flow-wave flow-pulse" d="${wave}"/><path class="flow-arrow" d="${arrow}"/>`;

function waveSvg(dir: "down" | "in-left" | "in-right", color: string): string {
  const down = dir === "down";
  const horizontal = WAVE_PATHS(ZIGZAG_IN, ARROW_IN);
  const body = down ? WAVE_PATHS(WAVE_DOWN, ARROW_DOWN)
    : dir === "in-right" ? `<g transform="scale(-1 1) translate(-56 0)">${horizontal}</g>` : horizontal;
  return `<svg viewBox="${down ? "0 0 64 44" : "0 0 56 40"}" aria-hidden="true" style="color:${color}">${body}</svg>`;
}

/* ── The breakdown's rows ───────────────────────────── */

function row(label: string, figure: string, cls = ""): string {
  return `<span class="hex-breakdown-row${cls ? ` ${cls}` : ""}"><span>${label}</span>${figure ? `<span class="mono">${figure}</span>` : ""}</span>`;
}

// The module's actual outcome, stated once per breakdown — the same figure
// the face's readout carries, in the production terms the engine publishes
// (final output, charge strength, relay strength, build amplification,
// booster uplift, the meters' progress rates, the chord factor). The label
// names the term; the figure carries its unit. A spacer is silent wire: no
// outcome.
function outcomeRow(state: GameState, module: ModuleInstance, snapshot: RateSnapshot, flow: boolean): string {
  const contribution = snapshot.contributions.get(module.id);
  const strength = snapshot.chargeStrength.get(module.id) ?? 0;
  const category = CATEGORY_OF[module.type];
  if (category === "oscillator") return row("Final output", `+${formatNumber(contribution?.value ?? 0)} ν/s`, "result");
  if (category === "silentVoice") return row("Chord voice", `×${formatNumber(contribution?.chordFactor ?? 1)}`, "result");
  if (category === "generator") return row("Charge strength", `⌁${formatNumber(emittedStrength(state, module, flow))}`, "result");
  if (module.type === "amplifier") return row("Relay strength", `⌁${formatNumber(relayStrengthOf(module, snapshot))}`, "result");
  if (module.type === "ritual") return row("Build amplification", `×${formatNumber(1 + ritualAmpOf(module.level, strength))}`, "result");
  if (module.type === "infusor") return row("Booster uplift", `+${formatNumber(boosterUpliftOf(state, module, snapshot))}%`, "result");
  if (module.type === "forge") return row("Forge", `+${formatNumber(contribution?.value ?? 0)} progress/s`, "result");
  if (module.type === "mutatorForge") return row("Mutator Forge", `+${formatNumber(contribution?.value ?? 0)} progress/s`, "result");
  return "";
}

// Use the same build derivation and published contribution terms as the
// production pass. Each relationship ends with the host's calculation,
// including external bonuses, followed by exactly one outcome.
function productionRows(state: GameState, module: ModuleInstance, snapshot: RateSnapshot, relationship: "mutator" | "charge" | "chord"): string[] {
  const category = CATEGORY_OF[module.type];
  const contribution = snapshot.contributions.get(module.id);
  const strength = snapshot.chargeStrength.get(module.id) ?? 0;
  const factors = buildFactorsFor(activeHabit(state), snapshot.ritualAmplification);
  const rows: string[] = [];
  const multiplier = (label: string, value: number) => rows.push(row(label, `×${formatNumber(value)}`));
  if (category === "oscillator") {
    rows.push(row("Base output", `${formatNumber(BALANCE.synthRate)} ν/s`));
    multiplier("Host power", hostPower(state, module));
    if (relationship !== "chord") multiplier("Chord factor", contribution?.chordFactor ?? 1);
    multiplier("Build synth term", 1 + factors.synthTerm);
    multiplier("Booster uplift", 1 + (contribution?.infusorBonus ?? 0));
    multiplier(module.type === "blaster" ? "Charge conversion" : "Charged empowerment", contribution?.chargeFactor ?? 1);
    multiplier("Achievement bonus", snapshot.achievementBoost);
    multiplier("Discovery bonus", snapshot.discoveryBoost);
  } else if (category === "forge") {
    if (relationship !== "charge") rows.push(row("Incoming charge", `⌁${formatNumber(strength)}`));
    multiplier("Host power", hostPower(state, module));
    multiplier("Build forge efficiency", 1 + factors.forgeEfficiency);
  } else if (module.type === "amplifier") {
    if (relationship !== "charge") rows.push(row("Incoming charge", `⌁${formatNumber(strength)}`));
    multiplier("Relay gain", 1 + BALANCE.amplifierGainPerLevel * module.level);
  } else if (module.type === "infusor") {
    rows.push(row("Base uplift", `+${formatNumber(100 * BALANCE.infusorBonus)}%`));
    multiplier("Host power", hostPower(state, module));
    multiplier("Charged empowerment", chargedFactor(strength));
  } else if (module.type === "ritual") {
    rows.push(row("Base amplification", `+${formatNumber(BALANCE.ritualAmpPerLevel * module.level)}`));
    multiplier("Charged empowerment", chargedFactor(strength));
  } else if (category === "generator" && factors.generatorStrength !== 0) {
    rows.push(row("Build generator strength", `+${formatNumber(factors.generatorStrength)}`));
  }
  return rows;
}

function breakdownHtml(rows: string[], bodyId: string): string {
  return `<span class="inst-tip-body" id="${bodyId}" role="tooltip"><span class="hex-breakdown">${rows.join("")}</span></span>`;
}

/* ── The one connection wrapper ───────────────────────
   Every relationship renders the same shape: the wave as its own trigger
   (the shared instrument layer's access contract rides on that markup),
   the breakdown as its disclosure body. One builder, so the three can
   never drift. */

function flowTipHtml(kind: "mutator" | "charge" | "chord", position: "between" | "left" | "right", state: { active: boolean; label: string; color: string; rows: string[]; bodyId: string }): string {
  const side = position === "between" ? "hex-detail-flow" : `hex-flow-side ${position === "left" ? "charge" : "chord"}`;
  const dir = position === "between" ? "down" : position === "left" ? "in-left" : "in-right";
  return `<span class="inst-tip ${side}" data-flow="${kind}">
    <button class="inst-tip-trigger hex-flow-trigger flow-${state.active ? "active" : "inert"}" id="detail-flow-${kind}" aria-label="${state.label}${state.active ? "" : " — none now"} — open the breakdown" aria-describedby="${state.bodyId}" aria-expanded="false">${waveSvg(dir, state.color)}</button>
    ${breakdownHtml(state.rows, state.bodyId)}
  </span>`;
}

/* ── The cross-layer mutator connection ───────────────
   Present only while a mutator occupies the slot — a locked layer, a
   slotless cell, or a vacant slot draws nothing. Solid while the engine's
   own verdict calls the mutator live, quiet and dashed when inert (no
   host, or a chordless host under resonance), always pointing at the
   layer the effect lands on. */

export function mutatorFlowHtml(state: GameState, pos: { q: number; r: number }, module: ModuleInstance | undefined, snapshot: RateSnapshot, flow: boolean): string {
  const item = mutatorAt(state, pos);
  if (!item) return "";
  const inert = module ? mutatorInertVerdict(state, pos, item, snapshot) : "inert · no host";
  const magnitude = mutatorMagnitude(item.family, item.rarity);
  const rows: string[] = [row(`${FAMILY_WORD[item.family]} mutator · ${RARITY_LABEL[item.rarity]}`, mutatorEffectText(item.family, item.rarity).split(" ")[0]!)];
  if (inert) {
    rows.push(row(inert, "", "inert"));
  } else if (module) {
    if (item.family === "power") {
      rows.push(row("Folded into power", `${formatNumber(modulePower(module))} → ${formatNumber(hostPower(state, module))}`));
    } else if (item.family === "resonance") {
      rows.push(row("Folded into chord factor", `×${formatNumber(1 + magnitude)}`));
    } else {
      rows.push(row("Folded into received charge", `×${formatNumber(1 + magnitude)}`));
    }
  }
  if (module) rows.push(...productionRows(state, module, snapshot, "mutator"), outcomeRow(state, module, snapshot, flow));
  return flowTipHtml("mutator", "between", {
    active: !inert,
    label: `${FAMILY_WORD[item.family]} mutator effect${inert ? ` — ${inert}` : ""}`,
    color: "var(--arete)",
    rows,
    bodyId: "detail-flow-mutator-tip",
  });
}

/* ── The module's incoming connections ────────────────
   Charge enters the face's left vertex whenever the module is a receiver
   — solid while strength arrives, quiet dashed while uncharged. The chord
   bonus enters the right vertex for every voice — solid while a named
   chord's factor rides the voice, quiet dashed while it sings none. Both
   disclosures fold their mutator's contribution into the host term it
   modifies and end in the module's one outcome — except the chord wave on
   a silent voice, whose factor IS the relationship: the outcome row would
   say it twice. */

export function moduleFlowsHtml(state: GameState, module: ModuleInstance | undefined, snapshot: RateSnapshot, flow: boolean): string {
  if (!module || module.type === "spacer") return "";
  return chargeFlowHtml(state, module, snapshot, flow) + chordFlowHtml(state, module, snapshot, flow);
}

function chargeFlowHtml(state: GameState, module: ModuleInstance, snapshot: RateSnapshot, flow: boolean): string {
  if (!CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type])) return "";
  const strength = snapshot.chargeStrength.get(module.id) ?? 0;
  const active = strength > 0;
  const rows: string[] = [];
  if (active) {
    rows.push(row("Incoming charge", `⌁${formatNumber(strength)}`));
    const mutator = mutatorAt(state, module.pos);
    if (mutator && mutator.family === "charge") {
      rows.push(row("Charge mutator folded in", `×${formatNumber(1 + mutatorMagnitude("charge", mutator.rarity))}`));
    }
  } else {
    rows.push(row("Incoming charge", "⌁0", "inert"));
  }
  rows.push(...productionRows(state, module, snapshot, "charge"), outcomeRow(state, module, snapshot, flow));
  return flowTipHtml("charge", "left", {
    active,
    label: "Incoming charge",
    color: "var(--charge)",
    rows,
    bodyId: "detail-flow-charge-tip",
  });
}

function chordFlowHtml(state: GameState, module: ModuleInstance, snapshot: RateSnapshot, flow: boolean): string {
  const contribution = snapshot.contributions.get(module.id);
  const factor = contribution?.chordFactor ?? null;
  if (factor === null) return "";
  const active = factor !== 1;
  const silent = CATEGORY_OF[module.type] === "silentVoice";
  const rows: string[] = [];
  if (active) {
    rows.push(row("Chord factor", `×${formatNumber(factor)}`));
    if ((contribution?.formationQ ?? 1) !== 1) rows.push(row("Formation", `×${formatNumber(contribution!.formationQ)}`));
    for (const term of snapshot.namedChords) {
      if (!term.moduleIds.includes(module.id)) continue;
      rows.push(row(term.name, `×${formatNumber(1 + term.bonus)}${term.instances > 1 ? ` ×${term.instances}` : ""}`));
    }
    const mutator = mutatorAt(state, module.pos);
    if (mutator && mutator.family === "resonance") {
      rows.push(row("Resonance mutator folded in", `×${formatNumber(1 + mutatorMagnitude("resonance", mutator.rarity))}`));
    }
  } else {
    rows.push(row("inert · no chord", "", "inert"));
  }
  // A silent voice produces nothing of its own: its factor is the display
  // read the relationship rows already carry, never a second outcome line.
  if (!silent) rows.push(...productionRows(state, module, snapshot, "chord"), outcomeRow(state, module, snapshot, flow));
  // The hue is the active named chord's own — the chord row's grammar.
  // Inert, no chord is named: the muted wire, never a specific chord's.
  const chordName = active ? snapshot.namedChords.find((term) => term.moduleIds.includes(module.id))?.name : undefined;
  const color = active
    ? `var(--${chordName ? CHORD_HUES[chordName] ?? "chord-octave" : "chord-octave"})`
    : "var(--muted)";
  return flowTipHtml("chord", "right", {
    active,
    label: "Chord bonus",
    color,
    rows,
    bodyId: "detail-flow-chord-tip",
  });
}
