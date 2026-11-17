import type { GameState, ModuleType } from "./types";
import { CATEGORY_OF, isVoiceType } from "./constants";

// Stable identity is independent of title, balance, and supporting copy.
export const ENCYCLOPEDIA_REVISION = 3;
export type EntryId = "charge" | "chords" | "prestige";
export type EncyclopediaState = Partial<Record<EntryId, "available" | "seen">>;
export interface EncounterContext { prestigeVisible?: boolean; starterShelfVisible?: boolean; capacityVisible?: boolean; chargeMeterVisible?: boolean; inspectedType?: ModuleType | undefined }
function chargeReceiver(type: ModuleType): boolean {
  return ["oscillator", "booster", "forge", "conduit", "ritual", "generator"].includes(CATEGORY_OF[type]);
}
interface Entry {
  id: EntryId;
  introduced: number;
  title: string;
  group: string;
  keywords: readonly string[];
  related: readonly EntryId[];
  content: string;
  encountered(state: GameState, context: EncounterContext): boolean;
}
export const ENTRIES: readonly Entry[] = [{
  id: "charge", introduced: 1, title: "Charge", group: "Board mechanics",
  keywords: ["power", "battery", "fuel", "generator", "Flywheel", "supply", "receiver", "adjacency", "energy"],
  related: ["chords", "prestige"],
  encountered: (state, context) => context.starterShelfVisible === true || context.chargeMeterVisible === true || (context.inspectedType !== undefined && chargeReceiver(context.inspectedType)) || state.purchased.generator || state.purchased.infusor || state.purchased.forge || state.modules.some(m => (["generator", "booster", "forge", "conduit", "ritual"].includes(CATEGORY_OF[m.type]) || ["blaster", "sideband", "saw"].includes(m.type))),
  content: `<p>Generators bank charge from practice, notes and live goal completion according to their profiles, even in inventory. Deploy them beside receivers to deliver that supply while the board runs. Upgrade mode and paused flow stop charge delivery and reserve drain. Breathers keep delivery and reserve drain running, but earn no practice charge. Remaining reserves follow generators when moved.</p>
    <figure class="charge-example"><figcaption>Illustrative example — not your live board</figcaption>
      <div class="charge-example-row"><span>Receiver A<br>strength 2</span><span aria-hidden="true">←</span><strong>Generator<br>strength 2</strong><span aria-hidden="true">→</span><span>Receiver B<br>strength 2</span></div>
      <p>A and B each touch the generator. Each receives the full strength 2, not half. A distant receiver with no connection receives none.</p>
    </figure>
    <p>Direct delivery reaches eligible adjacent receivers, not the whole board. Strengths from active generators add at a receiver. A generator spends reserve at its emission rate, not once per receiver; adding a neighbor does not shorten its remaining duration.</p>
    <p>Oscillators and boosters use received charge continuously; a Module Forge accumulates it toward drafts. Each module’s profile and current readouts show its actual response. Conduits route received charge onward rather than generating it.</p>
    <p><strong>Decision:</strong> place supply beside the receivers you want to power. Check remaining reserve and received strength before moving a generator: ownership earns charge, but placement determines delivery. Current effects and prices stay on the live inspection and purchase surfaces.</p>`,
}, {
  id: "prestige", introduced: 3, title: "Prestige", group: "Progression",
  keywords: ["reset", "era", "Arete", "start over", "horizon", "claim", "permanent", "memorized"],
  related: ["charge"],
  // The ambient Reset era control is visible even before eligibility. For
  // legacy backfill only, require evidence of play rather than opening defaults.
  encountered: (state, context) => context.prestigeVisible === true || state.eraEarned > 0 || state.prestiges > 0 || state.arete > 0,
  content: `<p>Prestige starts a new era while keeping your enduring progress. It banks the whole Arete in your pending claim. Arete buys memorized upgrades that survive later resets; repeating an old depth does not earn that claim again.</p>
    <figure><figcaption>Illustrative example — not your live claim</figcaption><p>If your pending claim is 3.4 Arete, prestige banks 3. The fraction stays pending. A later era must push beyond the frontier already claimed to build a new claim; merely reaching reset eligibility does not guarantee Arete.</p></figure>
    <p>Reaching the horizon makes reset eligible between sessions. A zero-yield reset is allowed, but banks no Arete. Nous, module levels, capacity purchases and charge state reset. Owned modules, cells and placement, memorized purchases, earned ordinary drafts and your life record remain.</p>
    <p><strong>Decision:</strong> compare the actual pending yield with the rebuild you are choosing. Check Reset era’s confirmation for this reset’s losses, preservation and warnings. Reading this page never resets your era or spends anything.</p>`,
}, {
  id: "chords", introduced: 2, title: "Chords and harmonic capacity", group: "Board mechanics",
  keywords: ["recognition", "activation", "idle", "budget", "slots", "whole chord", "Poly Expander", "harmony", "allocation"],
  related: ["charge"],
  encountered: (state, context) => context.capacityVisible === true || (context.inspectedType !== undefined && isVoiceType(context.inspectedType)) || Object.values(state.chordDiscovery).some(record => record.formed) || state.capacityBought > 0 || state.capacityCeilings > 0 || state.capacityDiscounts > 0 || state.modules.some(m => isVoiceType(m.type) && m.type !== "additive") || state.modules.filter(m => isVoiceType(m.type)).length > 1,
  content: `<p>Recognition finds named pitch sets in connected voices, including silent voices. Adjacency alone is not a chord. Activation is a separate choice made automatically: only selected whole chords earn their member oscillators a bonus.</p>
    <figure><figcaption>Illustrative example — not your live board</figcaption>
      <p>Suppose two recognized chords share a voice with capacity 1. Each chord needs one unit on every member. Both cannot activate together: selecting one leaves the other idle, even if its other members have spare capacity. No partial chord earns a bonus.</p>
      <p>With capacity 2 on the shared voice, both can fit if every other member also has room. Fitting is not a promise of activation: the allocator seeks the highest total board production, and can leave chords idle when activating would reduce it. The result is proven optimal only when certified. If the search budget runs out, it uses the best allocation found so far, without claiming optimality. Check the local certification status in Chord facts.</p>
    </figure>
    <p>Each voice has its type’s intrinsic capacity plus purchased Poly Expander increments. Silent voices also spend capacity. The purchase ceiling limits the purchased ladder, not a voice’s intrinsic seats. Active overlapping instances stack multiplicatively on their members; distant oscillators do not receive their bonus.</p>
    <p><strong>Diagnose an idle chord:</strong> open a participating hex and read Chord facts: its actual used/available capacity, active and idle names, factors and Formation read. Inspect the other members too: spare room on one voice does not establish room on all. Idle means recognized but unselected, not necessarily broken adjacency or insufficient capacity. The allocator compares final production, including charge and other effects; equal-output choices retain the previous active set before stable ordering.</p>
    <p>The Catalog shows the actual next capacity price, allowance and ceiling. Use those live facts before buying or rearranging. These examples do not describe your current allocation.</p>`,
}];

export function availableEntries(state: GameState, query = ""): readonly Entry[] {
  const needle = query.trim().toLocaleLowerCase();
  return ENTRIES.filter(entry => state.encyclopedia[entry.id] && (!needle || [entry.title, ...entry.keywords].some(word => word.toLocaleLowerCase().includes(needle))));
}
export function encounterEntries(state: GameState, context: EncounterContext = {}): boolean {
  let changed = false;
  for (const entry of ENTRIES) if (!state.encyclopedia[entry.id] && entry.encountered(state, context)) {
    state.encyclopedia[entry.id] = "available";
    changed = true;
  }
  return changed;
}
export function normalizeEncyclopedia(state: GameState, raw: unknown, revision: unknown): void {
  state.encyclopedia = {};
  // Charge-era saves have a map but no revision. Truly older saves have neither.
  const priorRevision = raw === undefined ? 0 : typeof revision === "number" && Number.isInteger(revision) && revision >= 1 ? revision : 1;
  state.encyclopediaRevision = ENCYCLOPEDIA_REVISION;
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  for (const entry of ENTRIES) {
    const value = record[entry.id];
    if (value === "available" || value === "seen") state.encyclopedia[entry.id] = value;
    else if ((entry.introduced > priorRevision) && entry.encountered(state, {})) state.encyclopedia[entry.id] = "seen";
  }
}
