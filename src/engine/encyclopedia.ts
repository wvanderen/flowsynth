import type { GameState, ModuleType } from "./types";
import { CATEGORY_OF } from "./constants";

// Stable identity is independent of title, balance, and supporting copy.
export type EntryId = "charge";
export type EncyclopediaState = Partial<Record<EntryId, "available" | "seen">>;
export interface EncounterContext { starterShelfVisible?: boolean; chargeMeterVisible?: boolean; inspectedType?: ModuleType | undefined }
function chargeReceiver(type: ModuleType): boolean {
  return ["oscillator", "booster", "forge", "conduit", "ritual", "generator"].includes(CATEGORY_OF[type]);
}
interface Entry {
  id: EntryId;
  title: string;
  group: string;
  keywords: readonly string[];
  related: readonly EntryId[];
  content: string;
  encountered(state: GameState, context: EncounterContext): boolean;
}
export const ENTRIES: readonly Entry[] = [{
  id: "charge", title: "Charge", group: "Board mechanics",
  keywords: ["power", "battery", "fuel", "generator", "Flywheel", "supply", "receiver", "adjacency", "energy"],
  related: [],
  encountered: (state, context) => context.starterShelfVisible === true || context.chargeMeterVisible === true || (context.inspectedType !== undefined && chargeReceiver(context.inspectedType)) || state.purchased.generator || state.purchased.infusor || state.purchased.forge || state.modules.some(m => (["generator", "booster", "forge", "conduit", "ritual"].includes(CATEGORY_OF[m.type]) || ["blaster", "sideband", "saw"].includes(m.type))),
  content: `<p>Generators bank charge from practice, notes and live goal completion according to their profiles, even in inventory. Deploy them beside receivers to deliver that supply while the board runs. Charge pauses between sessions; remaining reserves follow generators when moved.</p>
    <figure class="charge-example"><figcaption>Illustrative example — not your live board</figcaption>
      <div class="charge-example-row"><span>Receiver A<br>strength 2</span><span aria-hidden="true">←</span><strong>Generator<br>strength 2</strong><span aria-hidden="true">→</span><span>Receiver B<br>strength 2</span></div>
      <p>A and B each touch the generator. Each receives the full strength 2, not half. A distant receiver with no connection receives none.</p>
    </figure>
    <p>Direct delivery reaches eligible adjacent receivers, not the whole board. Strengths from active generators add at a receiver. A generator spends reserve at its emission rate, not once per receiver; adding a neighbor does not shorten its remaining duration.</p>
    <p>Oscillators and boosters use received charge continuously; a Module Forge accumulates it toward drafts. Each module’s profile and current readouts show its actual response. Conduits route received charge onward rather than generating it.</p>
    <p><strong>Decision:</strong> place supply beside the receivers you want to power. Check remaining reserve and received strength before moving a generator: ownership earns charge, but placement determines delivery. Current effects and prices stay on the live inspection and purchase surfaces.</p>`,
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
export function normalizeEncyclopedia(state: GameState, raw: unknown): void {
  state.encyclopedia = {};
  const legacy = raw === undefined;
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  for (const entry of ENTRIES) {
    const value = record[entry.id];
    if (value === "available" || value === "seen") state.encyclopedia[entry.id] = value;
    else if (legacy && entry.encountered(state, {})) state.encyclopedia[entry.id] = "seen";
  }
}
