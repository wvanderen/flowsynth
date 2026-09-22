// The module lexicon (CONTEXT.md): the single voice for what each module
// type does — the effect wording shared by the inspector, the face-tile
// readouts, and the forge-roll candidates. Every per-type magnitude is the
// economy's nominalContribution; this module words and formats it, and
// never reads GameState.
import { BALANCE } from "../engine/constants";
import { isSource, nominalContribution, type ModuleSpec } from "../engine/economy";
import type { ModuleType } from "../engine/types";
import { formatNumber } from "./format";

export type { ModuleSpec };

// The live row a caller reads from the rate snapshot: the module's
// contribution value and its received strength.
export interface LiveContribution {
  value: number;
  strength: number;
}

// The face's prominent readout from nominal (uncharged) values.
export function faceReadout(module: ModuleSpec): string {
  const value = nominalContribution(module);
  switch (module.type) {
    case "carrier":
    case "additive":
    case "conditional":
      return `+${formatNumber(value)}`;
    case "focusKeyed":
      return `⌁${formatNumber(value)}`;
    case "infusor":
      return `+${formatNumber(100 * value)}%`;
    case "forge":
      return `${formatNumber(value)}/s`;
  }
}

// The inspector's effect line: the live contribution while the board runs,
// otherwise the nominal wording — charged at strength 1 in upgrade mode's
// next-session preview.
export function effectLine(module: ModuleSpec, live: LiveContribution | null, charged = false): string {
  if (live) {
    switch (module.type) {
      case "carrier":
      case "additive":
      case "conditional":
        return `+${formatNumber(live.value)} ν/s`;
      case "focusKeyed":
        return `${formatNumber(nominalContribution(module))} strength`;
      case "infusor":
        return `+${formatNumber(100 * nominalContribution(module, live.strength))}% to adjacent`;
      default:
        return `${formatNumber(live.value)} progress/s`;
    }
  }
  const value = nominalContribution(module, charged ? 1 : 0);
  switch (module.type) {
    case "carrier":
    case "additive":
      return `+${formatNumber(value)} ν/s`;
    case "conditional":
      return `+${formatNumber(value)} ν/s · +${formatNumber(100 * BALANCE.conditionalPairBonus)}% per chord pair`;
    case "focusKeyed":
      return `${formatNumber(value)} charge strength while its charge window lasts`;
    case "infusor":
      return `+${formatNumber(100 * value)}% to adjacent`;
    case "forge":
      return `${formatNumber(value)} progress/s at strength 1`;
    default:
      return "—";
  }
}

// The upgrade row's gain line: what the next level's power step adds.
export function upgradeGain(module: ModuleSpec): string {
  const now = nominalContribution(module);
  const growth = BALANCE.rarityPower[module.rarity];
  if (isSource(module)) {
    return `+${formatNumber(now * (growth - 1))} strength`;
  }
  if (module.type === "forge") {
    return `${formatNumber(now * (growth - 1))} progress/s`;
  }
  return `+${formatNumber(now * (growth - 1))} effect`;
}

// The static per-type description the inspector's module panel carries.
export function typeProse(type: ModuleType): string {
  switch (type) {
    case "carrier":
      return "The granted origin synthesizer. Pinned at the origin: it never moves, never combines, never leaves the board, and plays the formula's carrier term.";
    case "additive":
      return "A plain harmonic term: amplitude at its pitch. Adjacent synthesizers one pitch apart form chord pairs whose bonuses multiply the whole composite.";
    case "conditional":
      return "Amplitude at its pitch, plus a bonus for every chord pair it participates in — a named chord counts once, however many of its pairs the module shares in.";
    case "focusKeyed":
      return "The generator (ADR-0018: the launch generator is focus-keyed). It never drips live: every session end banks a charge window — a tenth of that session's live practice time — and the generator spends it as output during the next session's first minutes. Charge is a reserve you carry between sessions.";
    case "infusor":
      return "Boosts production contributions of adjacent modules. Receives charge as continuous empowerment.";
    case "forge":
      return "The chargeable launch module: banks received charge toward a threshold and mints a roll at each crossing.";
    default:
      return "A reserved module.";
  }
}

// The forge-roll candidate's card: the nominal term plus the charge
// strength 1 line, with the caller supplying the shared meter's next
// threshold (the one state-derived number the wording needs).
export function forgeWording(type: ModuleType, nextRollProgress: number): string {
  const nominalAt = (strength: number): number => nominalContribution({ type, rarity: "common", level: 0 }, strength);
  switch (type) {
    case "carrier":
      return `The granted origin module — never rolled<br>+${formatNumber(nominalAt(1))} ν/s at charge strength 1`;
    case "additive":
      return `+${formatNumber(nominalAt(0))} ν/s harmonic term<br>+${formatNumber(nominalAt(1))} ν/s at charge strength 1`;
    case "conditional":
      return `+${formatNumber(nominalAt(0))} ν/s harmonic term<br>+${formatNumber(nominalAt(1))} ν/s at charge strength 1`;
    case "focusKeyed":
      return "The generator — keyed to your focus<br>each session end banks a charge window (a tenth of its live practice time), spent as its output next session";
    case "infusor":
      return `+${formatNumber(100 * nominalAt(0))}% to adjacent production contributions<br>+${formatNumber(100 * nominalAt(1))}% at charge strength 1`;
    case "forge":
      return `${formatNumber(nominalAt(0))} Forge progress per received charge strength<br>Next roll: ${formatNumber(nextRollProgress)} progress`;
    default:
      return "Not yet active";
  }
}
