// The hoverable domain terms (the disclosure doctrine): a term defined in
// CONTEXT.md renders hoverable wherever copy uses it, and its hover opens
// the glossary meaning — description prose never grows around it. The
// meanings here are the glossary's own, distilled to the one-line ceiling.
// The union keeps the map closed: only glossary terms may render hoverable.
export type CatalogTerm = "Breather" | "Oscillator" | "Generator" | "Booster" | "Silent voice" | "Spacer" | "Forge" | "Charge conduit" | "RITUAL" | "merge tier" | "Harmonic capacity" | "memorized" | "Arete" | "Poly Expander" | "Expansion Bays" | "Chord Catalysts" | "Warp Beam" | "nous" | "charge" | "pitch" | "chords" | "module rolls" | "mutator rolls" | "habit build" | "goals" | "Habit class" | "Engineer" | "practice-roll meter" | "tree point" | "Respec" | "Preset" | "Governor" | "Reed" | "Punch card" | "World layer" | "Charge Blade" | "Charge Column" | "Enemy" | "Penalty" | "Era bonus" | "Reserved cell" | "Cleared" | "Unfed" | "Target priority" | "Hone" | "World tray" | "Claimed frontier" | "Pending claim";
const CATALOG_TERMS: Record<CatalogTerm, string> = {
  Breather: "Timed post-flow break with profile-scaled production",
  Oscillator: "Pitched module contributing production",
  Generator: "Produces charge from practice",
  Booster: "Improves eligible adjacent modules",
  "Silent voice": "Silent pitch that forms and strengthens chords",
  Spacer: "Silent wire conducting chord adjacency",
  Forge: "Received charge accumulates toward draft thresholds",
  "Charge conduit": "Routes received charge onward without producing it",
  RITUAL: "Received charge amplifies the active habit’s build effects",
  "merge tier": "Matching copies combine to raise authored strengths",
  "Harmonic capacity": "Whole-chord budget per voice",
  memorized: "Persists through arete reset",
  Arete: "The resource banked when an era ends",
  "Poly Expander": "Re-earned after arete reset",
  "Expansion Bays": "Ceiling purchases persist through arete reset",
  "Chord Catalysts": "Discount purchases persist through arete reset",
  "Warp Beam": "Cap purchases persist through arete reset",
  nous: "Main progression resource spent on upgrades",
  charge: "Generator output that powers other modules",
  pitch: "The absolute note sounded by a board cell",
  chords: "Connected pitch sets multiply their member oscillators",
  "module rolls": "Choose one module from three candidates",
  "mutator rolls": "Choose one mutator from two candidates",
  "habit build": "Equipped build nodes apply during that habit’s sessions",
  goals: "Practice targets credited by flow sessions",
  "Habit class": "A habit’s specialization, keeping its own progress",
  Engineer: "Earns module rolls through credited practice",
  "practice-roll meter": "Credited practice fills it toward a module roll",
  "tree point": "Grants per class level, allocating into rank-capped nodes",
  Respec: "Returns every allocated point, keeping experience and level",
  Preset: "A named ordinary allocation the tree applies in one move",
  Governor: "Discounts the flat cadence without changing the opening fill",
  Reed: "Lifts practice-minted tiers within the unlocked cap",
  "Punch card": "Guarantees rare drafts on the pair’s own mint cadence",
  "World layer": "Enemies give the board’s power a purpose",
  "Charge Blade": "Granted weapon with stored charge and capped cadence",
  "Charge Column": "Lifts its module cell’s received charge to adjacent weapons",
  Enemy: "Authored adversary revealing at its threshold",
  Penalty: "A discovered enemy’s bounded production reduction",
  "Era bonus": "The production bonus replacing a defeated enemy’s penalty",
  "Reserved cell": "An enemy position set aside, identity concealed",
  Cleared: "A defeated enemy’s face, restored at prestige",
  Unfed: "A weapon without supply, read on its own face",
  "Target priority": "A weapon’s between-sessions ordered preference",
  Hone: "Arete’s persistent attack-power ranks for a weapon type",
  "World tray": "Where unplaced World occupants wait",
  "Claimed frontier": "The entitlement already claimed through prestige",
  "Pending claim": "Arete waiting to bank on the next prestige",
};
let catalogTermSeq = 0;
export function termTipHtml(term: CatalogTerm, label: string = term): string {
  const id = `catalog-term-${catalogTermSeq++}`;
  return `<span class="inst-tip term-tip"><button class="inst-tip-trigger term-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${term} — what it means">${label}</button><span class="inst-tip-body" id="${id}" role="tooltip">${CATALOG_TERMS[term]}</span></span>`;
}

// Disclose the first occurrence in a description; repeated mentions stay plain.
export function breatherTermsHtml(text: string): string {
  return text.replace(/\bbreathers?\b/i, label => termTipHtml("Breather", label));
}
